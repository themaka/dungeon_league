import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ProceduralSource } from "domain/content/procedural-source";
import { createRng, seedFromIds } from "domain/rng";
import { runDungeon } from "domain/sim/sim-engine";
import { score } from "domain/scoring";
import { generateHighlights } from "domain/highlights";
import { AIManager, AI_PERSONALITIES } from "domain/ai-manager";
import { generateRegularSeason } from "domain/schedule";
import { DEFAULT_LEAGUE_SETTINGS, type Character, type Lineup } from "domain/types";

const connectionString = process.env.DATABASE_URL ?? "postgresql://dungeon:league@localhost:5432/dungeon_league?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const contentSource = new ProceduralSource();

const AI_TEAM_NAMES = [
  "Shadow Syndicate", "Iron Legion", "Mystic Order",
  "Wild Hunt", "Crimson Vanguard",
];

export async function createLeague(name: string, userId: string, teamName?: string) {
  const leagueId = crypto.randomUUID();
  const rng = createRng(seedFromIds(leagueId, "init"));
  const characters = contentSource.generateCharacters(48, rng);

  const league = await prisma.league.create({
    data: {
      id: leagueId,
      name,
      phase: "draft",
      currentWeek: 0,
      settings: DEFAULT_LEAGUE_SETTINGS as any,
    },
  });

  await prisma.character.createMany({
    data: characters.map((c) => ({
      externalId: c.id,
      name: c.name,
      race: c.race,
      class: c.class,
      role: c.role,
      stats: c.stats as any,
      level: c.level,
      description: c.description,
      leagueId: league.id,
    })),
  });

  const humanTeam = await prisma.team.create({
    data: {
      name: teamName?.trim() || "Your Team",
      leagueId: league.id,
      managerId: userId,
      managerType: "human",
    },
  });

  const teamIds = [humanTeam.id];

  for (let i = 0; i < 5; i++) {
    const aiTeam = await prisma.team.create({
      data: {
        name: AI_TEAM_NAMES[i],
        leagueId: league.id,
        managerId: `ai-${i}`,
        managerType: "ai",
        aiPersonality: AI_PERSONALITIES[i] as any,
      },
    });
    teamIds.push(aiTeam.id);
  }

  const schedule = generateRegularSeason(teamIds);
  for (let weekIdx = 0; weekIdx < schedule.length; weekIdx++) {
    for (const matchup of schedule[weekIdx]) {
      await prisma.matchup.create({
        data: {
          leagueId: league.id,
          week: weekIdx + 1,
          homeTeamId: matchup.home,
          awayTeamId: matchup.away,
        },
      });
    }
  }

  return league;
}

export async function getLeague(id: string) {
  return prisma.league.findUniqueOrThrow({
    where: { id },
    include: {
      teams: { orderBy: { wins: "desc" } },
      matchups: { orderBy: { week: "asc" } },
    },
  });
}

export async function advanceWeek(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const week = league.currentWeek;

  const matchups = await prisma.matchup.findMany({
    where: { leagueId, week },
    include: { homeTeam: true, awayTeam: true },
  });

  const allChars = await prisma.character.findMany({ where: { leagueId } });
  const charByExtId = new Map(allChars.map((c) => [c.externalId, c]));

  const charMap = new Map<string, Character>();
  for (const c of allChars) {
    charMap.set(c.externalId, {
      id: c.externalId,
      name: c.name,
      race: c.race as any,
      class: c.class as any,
      role: c.role as any,
      stats: c.stats as any,
      level: c.level,
      description: c.description,
    });
  }

  for (const matchup of matchups) {
    const rng = createRng(seedFromIds(leagueId, String(week), matchup.id));
    const dungeon = contentSource.generateDungeon(week, 0, rng.fork("dungeon"));

    const processTeam = async (team: typeof matchup.homeTeam) => {
      let lineup = await prisma.lineup.findUnique({
        where: { teamId_week: { teamId: team.id, week } },
      });

      if (!lineup) {
        const teamChars = allChars.filter((c) => c.teamId === team.id);
        const rosterChars = teamChars.map((c) => charMap.get(c.externalId)!);

        if (team.managerType === "ai") {
          const personality = team.aiPersonality as any;
          const ai = new AIManager(personality);
          const aiLineup = ai.setLineup(rosterChars, dungeon, rng.fork(`lineup-${team.id}`));
          lineup = await prisma.lineup.create({
            data: { teamId: team.id, week, active: aiLineup.active, bench: aiLineup.bench },
          });
        } else {
          const active = rosterChars.slice(0, 4).map((c) => c.id);
          const bench = rosterChars.slice(4, 6).map((c) => c.id);
          lineup = await prisma.lineup.create({
            data: { teamId: team.id, week, active, bench },
          });
        }
      }

      const lineupData: Lineup = {
        active: (lineup.active as string[]) as [string, string, string, string],
        bench: (lineup.bench as string[]) as [string, string],
      };

      const events = runDungeon(lineupData, charMap, dungeon, rng.fork(`sim-${team.id}`));
      const rosterChars = (lineup.active as string[]).map((id) => charMap.get(id)!);
      const scoreResult = score(events, rosterChars);
      const highlights = generateHighlights(events, rosterChars, dungeon);

      return { events, score: scoreResult, highlights, teamTotal: scoreResult.teamTotal };
    };

    const homeResult = await processTeam(matchup.homeTeam);
    const awayResult = await processTeam(matchup.awayTeam);

    const winnerId = homeResult.teamTotal >= awayResult.teamTotal
      ? matchup.homeTeamId
      : matchup.awayTeamId;
    const loserId = winnerId === matchup.homeTeamId
      ? matchup.awayTeamId
      : matchup.homeTeamId;

    await prisma.matchup.update({
      where: { id: matchup.id },
      data: {
        dungeonData: dungeon as any,
        homeRunData: {
          events: homeResult.events,
          score: {
            perCharacter: Object.fromEntries(homeResult.score.perCharacter),
            milestones: homeResult.score.milestones,
            teamTotal: homeResult.score.teamTotal,
          },
          highlights: homeResult.highlights,
        } as any,
        awayRunData: {
          events: awayResult.events,
          score: {
            perCharacter: Object.fromEntries(awayResult.score.perCharacter),
            milestones: awayResult.score.milestones,
            teamTotal: awayResult.score.teamTotal,
          },
          highlights: awayResult.highlights,
        } as any,
        winnerId,
      },
    });

    await prisma.team.update({
      where: { id: winnerId },
      data: {
        wins: { increment: 1 },
        pointsFor: { increment: winnerId === matchup.homeTeamId ? homeResult.teamTotal : awayResult.teamTotal },
        pointsAgainst: { increment: winnerId === matchup.homeTeamId ? awayResult.teamTotal : homeResult.teamTotal },
      },
    });

    await prisma.team.update({
      where: { id: loserId },
      data: {
        losses: { increment: 1 },
        pointsFor: { increment: loserId === matchup.homeTeamId ? homeResult.teamTotal : awayResult.teamTotal },
        pointsAgainst: { increment: loserId === matchup.homeTeamId ? awayResult.teamTotal : homeResult.teamTotal },
      },
    });
  }

  const nextWeek = week + 1;
  const settings = league.settings as any;
  const totalWeeks = settings.seasonWeeks + settings.playoffWeeks;
  const enteringPlayoffs = week === settings.seasonWeeks;
  const newPhase = nextWeek > totalWeeks ? "complete" : nextWeek > settings.seasonWeeks ? "playoffs" : "regular";

  if (enteringPlayoffs) {
    const teams = await prisma.team.findMany({
      where: { leagueId },
      orderBy: [{ wins: "desc" }, { pointsFor: "desc" }],
    });
    const rankedIds = teams.map((t) => t.id);

    const { generatePlayoffMatchups } = await import("domain/schedule");
    const semis = generatePlayoffMatchups(rankedIds, "semifinal");
    for (const m of semis) {
      await prisma.matchup.create({
        data: { leagueId, week: settings.seasonWeeks + 1, homeTeamId: m.home, awayTeamId: m.away },
      });
    }

    // Consolation matchup for eliminated teams (5th vs 6th)
    const eliminated = rankedIds.slice(4);
    if (eliminated.length === 2) {
      await prisma.matchup.create({
        data: { leagueId, week: settings.seasonWeeks + 1, homeTeamId: eliminated[0], awayTeamId: eliminated[1] },
      });
    }
  }

  if (week === settings.seasonWeeks + 1 && newPhase === "playoffs") {
    const semiMatchups = await prisma.matchup.findMany({
      where: { leagueId, week },
    });
    const winnerIds = semiMatchups
      .filter((m) => m.winnerId)
      .map((m) => m.winnerId!);

    // Identify semifinal losers for consolation
    const semiTeamIds = semiMatchups.flatMap((m) => [m.homeTeamId, m.awayTeamId]);
    const semiLoserIds = semiTeamIds.filter((id) => !winnerIds.includes(id));

    if (winnerIds.length === 2) {
      const { generatePlayoffMatchups } = await import("domain/schedule");
      const finals = generatePlayoffMatchups(winnerIds, "final");
      for (const m of finals) {
        await prisma.matchup.create({
          data: { leagueId, week: settings.seasonWeeks + 2, homeTeamId: m.home, awayTeamId: m.away },
        });
      }

      // Consolation: semi losers play for 3rd place
      if (semiLoserIds.length === 2) {
        await prisma.matchup.create({
          data: { leagueId, week: settings.seasonWeeks + 2, homeTeamId: semiLoserIds[0], awayTeamId: semiLoserIds[1] },
        });
      }

      // Consolation: 5th vs 6th play again in finals week too
      const allTeams = await prisma.team.findMany({
        where: { leagueId },
        orderBy: [{ wins: "desc" }, { pointsFor: "desc" }],
      });
      const finalsTeamIds = new Set([...winnerIds, ...semiLoserIds]);
      const bottomTeams = allTeams.filter((t) => !finalsTeamIds.has(t.id));
      if (bottomTeams.length === 2) {
        await prisma.matchup.create({
          data: { leagueId, week: settings.seasonWeeks + 2, homeTeamId: bottomTeams[0].id, awayTeamId: bottomTeams[1].id },
        });
      }
    }
  }

  await prisma.league.update({
    where: { id: leagueId },
    data: { currentWeek: nextWeek, phase: newPhase },
  });

  return { week, matchupCount: matchups.length };
}
