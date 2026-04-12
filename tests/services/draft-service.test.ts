import "dotenv/config";
import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLeague } from "services/league-service.server";
import { getDraftState, makePick, makeAIPick } from "services/draft-service.server";

const connectionString = process.env.DATABASE_URL ?? "postgresql://dungeon:league@localhost:5432/dungeon_league?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

describe("draft service", () => {
  let leagueId: string;

  beforeEach(async () => {
    await prisma.lineup.deleteMany();
    await prisma.matchup.deleteMany();
    await prisma.character.deleteMany();
    await prisma.team.deleteMany();
    await prisma.league.deleteMany();

    const league = await createLeague("Draft Test", "dev-user-1");
    leagueId = league.id;
  });

  it("getDraftState returns correct initial state", async () => {
    const state = await getDraftState(leagueId);
    expect(state.currentPick).toBe(0);
    expect(state.totalPicks).toBe(36);
    expect(state.available).toHaveLength(48);
    expect(state.draftOrder).toHaveLength(36);
  });

  it("makePick assigns character to team and advances pick", async () => {
    const state = await getDraftState(leagueId);
    const currentTeamId = state.draftOrder[0].teamId;
    const charId = state.available[0].id;

    await makePick(leagueId, currentTeamId, charId);

    const updated = await getDraftState(leagueId);
    expect(updated.currentPick).toBe(1);
    expect(updated.available.find((c) => c.id === charId)).toBeUndefined();
  });

  it("makeAIPick selects a character for the AI team", async () => {
    const state = await getDraftState(leagueId);
    const aiTeamEntry = state.draftOrder.find((d) => d.managerType === "ai");
    if (!aiTeamEntry) return;

    // Make picks until we reach an AI team's turn
    let current = state;
    while (current.currentPick < current.totalPicks) {
      const slot = current.draftOrder[current.currentPick];
      if (slot.managerType === "ai") break;
      // Human pick — just pick the first available
      await makePick(leagueId, slot.teamId, current.available[0].id);
      current = await getDraftState(leagueId);
    }

    const beforePick = current.currentPick;
    const pick = await makeAIPick(leagueId);
    expect(pick).toBeTruthy();

    const updated = await getDraftState(leagueId);
    expect(updated.currentPick).toBeGreaterThan(beforePick);
  });
});
