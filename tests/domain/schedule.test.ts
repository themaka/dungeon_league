import { describe, it, expect } from "vitest";
import { generateRegularSeason, generatePlayoffMatchups } from "domain/schedule";

describe("schedule generator", () => {
  const teamIds = ["t1", "t2", "t3", "t4", "t5", "t6"];

  describe("regular season", () => {
    it("generates 5 weeks of matchups for 6 teams", () => {
      const schedule = generateRegularSeason(teamIds);
      expect(schedule).toHaveLength(5);
    });

    it("each week has 3 matchups", () => {
      const schedule = generateRegularSeason(teamIds);
      for (const week of schedule) {
        expect(week).toHaveLength(3);
      }
    });

    it("every team plays exactly once per week", () => {
      const schedule = generateRegularSeason(teamIds);
      for (const week of schedule) {
        const teams = week.flatMap((m) => [m.home, m.away]);
        expect(new Set(teams).size).toBe(6);
      }
    });

    it("every team plays every other team exactly once across the season", () => {
      const schedule = generateRegularSeason(teamIds);
      const matchupSet = new Set<string>();
      for (const week of schedule) {
        for (const matchup of week) {
          const key = [matchup.home, matchup.away].sort().join("-");
          expect(matchupSet.has(key)).toBe(false);
          matchupSet.add(key);
        }
      }
      expect(matchupSet.size).toBe(15);
    });
  });

  describe("playoffs", () => {
    it("generates semifinal matchups from top 4 teams", () => {
      const standings = ["t1", "t2", "t3", "t4", "t5", "t6"];
      const semis = generatePlayoffMatchups(standings, "semifinal");
      expect(semis).toHaveLength(2);
      expect(semis[0].home).toBe("t1");
      expect(semis[0].away).toBe("t4");
      expect(semis[1].home).toBe("t2");
      expect(semis[1].away).toBe("t3");
    });

    it("generates final matchup from 2 winners", () => {
      const finalists = ["t1", "t2"];
      const final = generatePlayoffMatchups(finalists, "final");
      expect(final).toHaveLength(1);
      expect(final[0].home).toBe("t1");
      expect(final[0].away).toBe("t2");
    });
  });
});
