import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL ?? "postgresql://dungeon:league@localhost:5432/dungeon_league?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function exportLeague(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
    include: {
      teams: true,
      characters: true,
      matchups: true,
    },
  });

  const lineups = await prisma.lineup.findMany({
    where: { teamId: { in: league.teams.map((t) => t.id) } },
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    league: {
      id: league.id,
      name: league.name,
      phase: league.phase,
      currentWeek: league.currentWeek,
      settings: league.settings,
    },
    teams: league.teams,
    characters: league.characters,
    matchups: league.matchups,
    lineups,
  };
}

export async function importLeague(data: any) {
  if (data.version !== 1) throw new Error("Unsupported export version");

  const newLeagueId = crypto.randomUUID();

  const league = await prisma.league.create({
    data: {
      id: newLeagueId,
      name: `${data.league.name} (imported)`,
      phase: data.league.phase,
      currentWeek: data.league.currentWeek,
      settings: data.league.settings as any,
    },
  });

  // Build a mapping from old team IDs to new team IDs
  const teamIdMap = new Map<string, string>();

  for (const team of data.teams) {
    const newTeamId = crypto.randomUUID();
    teamIdMap.set(team.id, newTeamId);
    await prisma.team.create({
      data: {
        id: newTeamId,
        name: team.name,
        leagueId: league.id,
        managerId: team.managerId,
        managerType: team.managerType,
        aiPersonality: team.aiPersonality,
        wins: team.wins,
        losses: team.losses,
        pointsFor: team.pointsFor,
        pointsAgainst: team.pointsAgainst,
      },
    });
  }

  for (const char of data.characters) {
    await prisma.character.create({
      data: {
        id: crypto.randomUUID(),
        externalId: char.externalId,
        name: char.name,
        race: char.race,
        class: char.class,
        role: char.role,
        stats: char.stats,
        level: char.level,
        description: char.description,
        leagueId: league.id,
        teamId: char.teamId ? teamIdMap.get(char.teamId) ?? null : null,
        draftOrder: char.draftOrder,
      },
    });
  }

  for (const matchup of data.matchups) {
    await prisma.matchup.create({
      data: {
        id: crypto.randomUUID(),
        leagueId: league.id,
        week: matchup.week,
        homeTeamId: teamIdMap.get(matchup.homeTeamId)!,
        awayTeamId: teamIdMap.get(matchup.awayTeamId)!,
        dungeonData: matchup.dungeonData,
        homeRunData: matchup.homeRunData,
        awayRunData: matchup.awayRunData,
        winnerId: matchup.winnerId ? teamIdMap.get(matchup.winnerId) ?? null : null,
      },
    });
  }

  for (const lineup of data.lineups) {
    const newTeamId = teamIdMap.get(lineup.teamId);
    if (!newTeamId) continue;
    await prisma.lineup.create({
      data: {
        teamId: newTeamId,
        week: lineup.week,
        active: lineup.active,
        bench: lineup.bench,
      },
    });
  }

  return league;
}
