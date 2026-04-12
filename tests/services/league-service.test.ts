import "dotenv/config";
import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLeague, advanceWeek, getLeague } from "services/league-service.server";

const connectionString = process.env.DATABASE_URL ?? "postgresql://dungeon:league@localhost:5432/dungeon_league?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

describe("league service", () => {
  beforeEach(async () => {
    await prisma.lineup.deleteMany();
    await prisma.matchup.deleteMany();
    await prisma.character.deleteMany();
    await prisma.team.deleteMany();
    await prisma.league.deleteMany();
  });

  it("createLeague creates a league with 6 teams and 48 characters", async () => {
    const league = await createLeague("Test League", "dev-user-1");
    expect(league.name).toBe("Test League");
    expect(league.phase).toBe("draft");

    const teams = await prisma.team.findMany({ where: { leagueId: league.id } });
    expect(teams).toHaveLength(6);
    expect(teams.filter((t) => t.managerType === "human")).toHaveLength(1);
    expect(teams.filter((t) => t.managerType === "ai")).toHaveLength(5);

    const chars = await prisma.character.findMany({ where: { leagueId: league.id } });
    expect(chars).toHaveLength(48);
  });

  it("createLeague generates schedule matchups", async () => {
    const league = await createLeague("Test League", "dev-user-1");
    const matchups = await prisma.matchup.findMany({ where: { leagueId: league.id } });
    expect(matchups.filter((m) => m.week <= 5)).toHaveLength(15);
  });

  it("advanceWeek processes matchups and updates standings", async () => {
    const league = await createLeague("Advance Test", "dev-user-1");

    await prisma.league.update({
      where: { id: league.id },
      data: { phase: "regular", currentWeek: 1 },
    });

    const teams = await prisma.team.findMany({ where: { leagueId: league.id } });
    const chars = await prisma.character.findMany({ where: { leagueId: league.id } });

    // Assign 8 characters per team (simulating a completed draft)
    for (let t = 0; t < teams.length; t++) {
      const teamChars = chars.slice(t * 8, (t + 1) * 8);
      for (const c of teamChars) {
        await prisma.character.update({
          where: { id: c.id },
          data: { teamId: teams[t].id },
        });
      }
    }

    // Re-fetch chars with updated teamId
    const updatedChars = await prisma.character.findMany({ where: { leagueId: league.id } });

    for (const team of teams) {
      const teamChars = updatedChars.filter((c) => c.teamId === team.id).slice(0, 6);
      if (teamChars.length >= 6) {
        await prisma.lineup.create({
          data: {
            teamId: team.id,
            week: 1,
            active: teamChars.slice(0, 4).map((c) => c.externalId),
            bench: teamChars.slice(4, 6).map((c) => c.externalId),
          },
        });
      }
    }

    const result = await advanceWeek(league.id);
    expect(result.week).toBe(1);

    const updatedTeams = await prisma.team.findMany({ where: { leagueId: league.id } });
    const totalWins = updatedTeams.reduce((sum, t) => sum + t.wins, 0);
    const totalLosses = updatedTeams.reduce((sum, t) => sum + t.losses, 0);
    expect(totalWins).toBe(3);
    expect(totalLosses).toBe(3);
  });
});
