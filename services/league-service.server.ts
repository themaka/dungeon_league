import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ProceduralSource } from "domain/content/procedural-source";
import { createRng, seedFromIds } from "domain/rng";
import { runDungeon } from "domain/sim/sim-engine";
import { score } from "domain/scoring";
import { generateHighlights } from "domain/highlights";
import { AIManager, AI_PERSONALITIES } from "domain/ai-manager";
import { generateRegularSeason, type ScheduleMatchup } from "domain/schedule";
import { type Character, type Lineup, type Dungeon } from "domain/types";
import { applyPreset } from "domain/presets";
import { runScouting } from "domain/scouting";
import { applyXpAndLevel, xpFromEvents } from "domain/leveling";
import type { LeagueSettings, PresetName } from "domain/types";
import { ALL_THEMES } from "domain/themes";

const connectionString = process.env.DATABASE_URL ?? "postgresql://dungeon:league@localhost:5432/dungeon_league?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const contentSource = new ProceduralSource();

const AI_TEAM_NAMES = [
  "Shadow Syndicate", "Iron Legion", "Mystic Order",
  "Wild Hunt", "Crimson Vanguard",
];

export async function createLeague(
  name: string,
  userId: string,
  teamName?: string,
  overrides: Partial<LeagueSettings> & { preset?: PresetName } = {},
) {
  const presetName = overrides.preset ?? "standard";
  const settings: LeagueSettings = applyPreset(presetName, overrides);

  const leagueId = crypto.randomUUID();
  const rng = createRng(seedFromIds(leagueId, "init"));
  const characters = contentSource.generateCharacters(settings.characterPool, rng, settings);

  const scoutingReports = runScouting(characters, contentSource, leagueId, settings.scoutingRuns, settings);

  const league = await prisma.league.create({
    data: {
      id: leagueId,
      name,
      phase: "draft",
      currentWeek: 0,
      settings: settings as any,
      scoutingReports: scoutingReports as any,
    },
  });

  await prisma.character.createMany({
    data: characters.map((c) => ({
      externalId: c.id,
      name: c.name,
      race: c.race,
      class: c.class,
      role: c.role,
      specialty: c.specialty,
      stats: c.stats as any,
      level: c.level,
      xp: c.xp,
      abilityTiers: c.abilityTiers as any,
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

  const teamIds: string[] = [humanTeam.id];
  for (let i = 0; i < settings.teamCount - 1; i++) {
    const aiTeam = await prisma.team.create({
      data: {
        name: AI_TEAM_NAMES[i] ?? `AI Team ${i + 1}`,
        leagueId: league.id,
        managerId: `ai-${i}`,
        managerType: "ai",
        aiPersonality: AI_PERSONALITIES[i % AI_PERSONALITIES.length] as any,
      },
    });
    teamIds.push(aiTeam.id);
  }

  const baseSchedule = generateRegularSeason(teamIds);
  // Loop the round-robin to fill seasonWeeks. For 6 teams the base schedule is
  // 5 rounds, so a 10-week season cycles twice (with home/away flipped on the
  // second cycle for variety).
  const fullSchedule: ScheduleMatchup[][] = [];
  let cycleIdx = 0;
  while (fullSchedule.length < settings.seasonWeeks) {
    for (const round of baseSchedule) {
      if (fullSchedule.length >= settings.seasonWeeks) break;
      if (cycleIdx % 2 === 0) {
        fullSchedule.push(round);
      } else {
        fullSchedule.push(round.map((m) => ({ home: m.away, away: m.home })));
      }
    }
    cycleIdx++;
  }

  for (let weekIdx = 0; weekIdx < fullSchedule.length; weekIdx++) {
    for (let mIdx = 0; mIdx < fullSchedule[weekIdx].length; mIdx++) {
      const matchup = fullSchedule[weekIdx][mIdx];
      const week = weekIdx + 1;
      const matchupId = crypto.randomUUID();
      const themeRng = createRng(seedFromIds(league.id, String(week), matchupId, "theme"));
      const theme = themeRng.pick(ALL_THEMES);
      const dungeonRng = createRng(seedFromIds(league.id, String(week), matchupId, "dungeon"));
      const dungeon = contentSource.generateDungeon(
        week, mIdx, dungeonRng, theme, settings.encounterCount,
      );
      await prisma.matchup.create({
        data: {
          id: matchupId,
          leagueId: league.id,
          week,
          homeTeamId: matchup.home,
          awayTeamId: matchup.away,
          dungeonData: dungeon as any,
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
      specialty: c.specialty as any,
      stats: c.stats as any,
      level: c.level,
      xp: c.xp,
      abilityTiers: (c.abilityTiers as number[]) ?? [],
      description: c.description,
    });
  }

  const leagueSettings = league.settings as any;

  for (const matchup of matchups) {
    const rng = createRng(seedFromIds(leagueId, String(week), matchup.id));
    // Dungeon was pre-generated at matchup creation; read it.
    const dungeon = matchup.dungeonData as unknown as Dungeon;
    if (!dungeon) {
      throw new Error(`Matchup ${matchup.id} has no dungeonData; was it created before the pre-generation refactor?`);
    }

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

    if (leagueSettings.xpEnabled !== false) {
      const xpScale = 10 / Math.max(1, leagueSettings.seasonWeeks ?? 10);
      for (const teamSide of ["home", "away"] as const) {
        const result = teamSide === "home" ? homeResult : awayResult;
        const teamId = teamSide === "home" ? matchup.homeTeamId : matchup.awayTeamId;
        const teamChars = allChars.filter((c) => c.teamId === teamId);
        for (const dbChar of teamChars) {
          const domainChar = charMap.get(dbChar.externalId);
          if (!domainChar) continue;
          const xpAward = xpFromEvents(domainChar, result.events);
          if (xpAward <= 0 && domainChar.level >= (leagueSettings.maxLevel ?? 20)) continue;
          const { character: updated, levelUps } = applyXpAndLevel(
            domainChar, xpAward, xpScale, leagueSettings.maxLevel ?? 20,
          );
          if (xpAward > 0 || levelUps.length > 0) {
            await prisma.character.update({
              where: { id: dbChar.id },
              data: {
                xp: updated.xp,
                level: updated.level,
                stats: updated.stats as any,
                abilityTiers: updated.abilityTiers as any,
              },
            });
            // Refresh local map so subsequent matchups in the same week see new state
            charMap.set(updated.id, updated);
          }
        }
      }
    }

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
  // Bracket is fixed at 2 rounds (semis + finals). The playoffWeeks setting is
  // retained for future bracket expansion but currently does not change layout.
  const totalWeeks = leagueSettings.seasonWeeks + 2;
  const enteringPlayoffs = week === leagueSettings.seasonWeeks;
  const newPhase = nextWeek > totalWeeks ? "complete" : nextWeek > leagueSettings.seasonWeeks ? "playoffs" : "regular";

  if (enteringPlayoffs) {
    const teams = await prisma.team.findMany({
      where: { leagueId },
      orderBy: [{ wins: "desc" }, { pointsFor: "desc" }],
    });
    const rankedIds = teams.map((t) => t.id);

    const { generatePlayoffMatchups } = await import("domain/schedule");
    const semis = generatePlayoffMatchups(rankedIds, "semifinal");
    for (const m of semis) {
      const matchupId = crypto.randomUUID();
      const week = leagueSettings.seasonWeeks + 1;
      const themeRng = createRng(seedFromIds(leagueId, String(week), matchupId, "theme"));
      const theme = themeRng.pick(ALL_THEMES);
      const dungeonRng = createRng(seedFromIds(leagueId, String(week), matchupId, "dungeon"));
      const dungeon = contentSource.generateDungeon(week, 0, dungeonRng, theme, leagueSettings.encounterCount ?? "5-8");
      await prisma.matchup.create({
        data: { id: matchupId, leagueId, week, homeTeamId: m.home, awayTeamId: m.away, dungeonData: dungeon as any },
      });
    }

  }

  if (week === leagueSettings.seasonWeeks + 1) {
    const semiMatchups = await prisma.matchup.findMany({
      where: { leagueId, week },
    });
    const winnerIds = semiMatchups
      .filter((m) => m.winnerId)
      .map((m) => m.winnerId!);

    if (winnerIds.length === 2) {
      const { generatePlayoffMatchups } = await import("domain/schedule");
      const finals = generatePlayoffMatchups(winnerIds, "final");
      for (const m of finals) {
        const matchupId = crypto.randomUUID();
        const week = leagueSettings.seasonWeeks + 2;
        const themeRng = createRng(seedFromIds(leagueId, String(week), matchupId, "theme"));
        const theme = themeRng.pick(ALL_THEMES);
        const dungeonRng = createRng(seedFromIds(leagueId, String(week), matchupId, "dungeon"));
        const dungeon = contentSource.generateDungeon(week, 0, dungeonRng, theme, leagueSettings.encounterCount ?? "5-8");
        await prisma.matchup.create({
          data: { id: matchupId, leagueId, week, homeTeamId: m.home, awayTeamId: m.away, dungeonData: dungeon as any },
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
