import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { AIManager } from "domain/ai-manager";
import { createRng, seedFromIds } from "domain/rng";
import type { Character } from "domain/types";

const connectionString = process.env.DATABASE_URL ?? "postgresql://dungeon:league@localhost:5432/dungeon_league?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function generateSnakeDraftOrder(teamIds: string[], rounds: number): { teamId: string; round: number; pick: number }[] {
  const order: { teamId: string; round: number; pick: number }[] = [];
  let pickNum = 0;

  for (let round = 0; round < rounds; round++) {
    const roundOrder = round % 2 === 0 ? teamIds : [...teamIds].reverse();
    for (const teamId of roundOrder) {
      order.push({ teamId, round, pick: pickNum++ });
    }
  }

  return order;
}

export async function getDraftState(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const teams = await prisma.team.findMany({ where: { leagueId } });
  const characters = await prisma.character.findMany({ where: { leagueId } });

  const available = characters.filter((c) => c.teamId === null);
  const drafted = characters.filter((c) => c.teamId !== null);

  const teamIds = teams.map((t) => t.id);
  const settings = league.settings as any;
  const draftOrder = generateSnakeDraftOrder(teamIds, settings.rosterSize);
  const currentPick = drafted.length;

  return {
    leagueId,
    currentPick,
    totalPicks: draftOrder.length,
    draftOrder: draftOrder.map((d) => ({
      ...d,
      managerType: teams.find((t) => t.id === d.teamId)!.managerType,
    })),
    available: available.map((c) => ({
      id: c.id,
      externalId: c.externalId,
      name: c.name,
      race: c.race,
      class: c.class,
      role: c.role,
      stats: c.stats,
      level: c.level,
      description: c.description,
    })),
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      managerType: t.managerType,
      roster: characters.filter((c) => c.teamId === t.id),
    })),
  };
}

export async function makePick(leagueId: string, teamId: string, characterDbId: string) {
  const character = await prisma.character.findUniqueOrThrow({ where: { id: characterDbId } });
  if (character.teamId) throw new Error("Character already drafted");
  if (character.leagueId !== leagueId) throw new Error("Character not in this league");

  const drafted = await prisma.character.count({ where: { leagueId, teamId: { not: null } } });

  await prisma.character.update({
    where: { id: characterDbId },
    data: { teamId, draftOrder: drafted },
  });

  const totalRosterSlots = 36;
  if (drafted + 1 >= totalRosterSlots) {
    await prisma.league.update({
      where: { id: leagueId },
      data: { phase: "regular", currentWeek: 1 },
    });
  }

  return character;
}

export async function makeAIPick(leagueId: string) {
  const state = await getDraftState(leagueId);
  if (state.currentPick >= state.totalPicks) return null;

  const currentDraftSlot = state.draftOrder[state.currentPick];
  const team = state.teams.find((t) => t.id === currentDraftSlot.teamId);
  if (!team || team.managerType !== "ai") return null;

  const aiTeam = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
  const personality = aiTeam.aiPersonality as any;
  const ai = new AIManager(personality);

  const rng = createRng(seedFromIds(leagueId, "draft", String(state.currentPick)));

  const availableChars: Character[] = state.available.map((c) => ({
    id: c.externalId,
    name: c.name,
    race: c.race as any,
    class: c.class as any,
    role: c.role as any,
    stats: c.stats as any,
    level: c.level,
    description: c.description,
  }));

  const rosterChars: Character[] = team.roster.map((c) => ({
    id: c.externalId,
    name: c.name,
    race: c.race as any,
    class: c.class as any,
    role: c.role as any,
    stats: c.stats as any,
    level: c.level,
    description: c.description,
  }));

  const pick = ai.makeDraftPick(availableChars, rosterChars, rng);
  const dbChar = state.available.find((c) => c.externalId === pick.id);
  if (!dbChar) throw new Error("AI picked unavailable character");

  await makePick(leagueId, team.id, dbChar.id);
  return pick;
}
