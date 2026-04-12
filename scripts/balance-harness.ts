import { createRng } from "../domain/rng";
import { ProceduralSource } from "../domain/content/procedural-source";
import { runDungeon } from "../domain/sim/sim-engine";
import { score } from "../domain/scoring";
import type { Character, Lineup } from "../domain/types";

const LEAGUES = 100;
const WEEKS = 5;
const TEAMS_PER_LEAGUE = 6;

const source = new ProceduralSource();

interface RoleStats {
  totalPoints: number;
  count: number;
  avgPoints: number;
}

const roleStats: Record<string, RoleStats> = {
  Tank: { totalPoints: 0, count: 0, avgPoints: 0 },
  Healer: { totalPoints: 0, count: 0, avgPoints: 0 },
  DPS: { totalPoints: 0, count: 0, avgPoints: 0 },
  Utility: { totalPoints: 0, count: 0, avgPoints: 0 },
};

const scoreDistribution: number[] = [];
const marginDistribution: number[] = [];

for (let league = 0; league < LEAGUES; league++) {
  const rng = createRng(league);
  const chars = source.generateCharacters(48, rng.fork("chars"));
  const charMap = new Map<string, Character>(chars.map((c) => [c.id, c]));

  const teams: { chars: Character[]; lineup: Lineup }[] = [];
  for (let t = 0; t < TEAMS_PER_LEAGUE; t++) {
    const teamChars = chars.slice(t * 6, (t + 1) * 6);
    teams.push({
      chars: teamChars,
      lineup: {
        active: [teamChars[0].id, teamChars[1].id, teamChars[2].id, teamChars[3].id] as [string, string, string, string],
        bench: [teamChars[4].id, teamChars[5].id] as [string, string],
      },
    });
  }

  for (let week = 0; week < WEEKS; week++) {
    for (let m = 0; m < 3; m++) {
      const dungeon = source.generateDungeon(week, m, rng.fork(`d-${week}-${m}`));

      const scores: number[] = [];
      for (const team of [teams[m * 2], teams[m * 2 + 1]]) {
        if (!team) continue;
        const events = runDungeon(team.lineup, charMap, dungeon, rng.fork(`sim-${week}-${m}`));
        const result = score(events, team.chars.slice(0, 4));

        scores.push(result.teamTotal);
        scoreDistribution.push(result.teamTotal);

        for (const cs of result.perCharacter.values()) {
          const char = charMap.get(cs.characterId);
          if (char && roleStats[char.role]) {
            roleStats[char.role].totalPoints += cs.totalPoints;
            roleStats[char.role].count += 1;
          }
        }
      }

      if (scores.length === 2) {
        marginDistribution.push(Math.abs(scores[0] - scores[1]));
      }
    }
  }
}

for (const role of Object.keys(roleStats)) {
  const rs = roleStats[role];
  rs.avgPoints = rs.count > 0 ? rs.totalPoints / rs.count : 0;
}

console.log("\n=== BALANCE HARNESS REPORT ===\n");
console.log(`Simulated ${LEAGUES} leagues x ${WEEKS} weeks = ${LEAGUES * WEEKS * 3} matchups\n`);

console.log("Role Average Points Per Game:");
for (const [role, stats] of Object.entries(roleStats)) {
  console.log(`  ${role.padEnd(8)} ${stats.avgPoints.toFixed(2)} (${stats.count} appearances)`);
}

const sortedScores = scoreDistribution.sort((a, b) => a - b);
const median = sortedScores[Math.floor(sortedScores.length / 2)];
const mean = sortedScores.reduce((a, b) => a + b, 0) / sortedScores.length;
const min = sortedScores[0];
const max = sortedScores[sortedScores.length - 1];

console.log("\nTeam Score Distribution:");
console.log(`  Min: ${min.toFixed(1)}, Median: ${median.toFixed(1)}, Mean: ${mean.toFixed(1)}, Max: ${max.toFixed(1)}`);

const sortedMargins = marginDistribution.sort((a, b) => a - b);
const marginMedian = sortedMargins[Math.floor(sortedMargins.length / 2)];
const blowouts = sortedMargins.filter((m) => m > mean * 0.5).length;

console.log("\nMatchup Margin Distribution:");
console.log(`  Median margin: ${marginMedian.toFixed(1)}`);
console.log(`  Blowouts (>50% of mean score): ${blowouts} / ${sortedMargins.length} (${((blowouts / sortedMargins.length) * 100).toFixed(1)}%)`);

console.log("\n=== END REPORT ===\n");
