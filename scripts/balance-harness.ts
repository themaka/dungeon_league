import { ProceduralSource } from "../domain/content/procedural-source";
import { runDungeon } from "../domain/sim/sim-engine";
import { score } from "../domain/scoring";
import { createRng, seedFromIds } from "../domain/rng";
import { applyPreset } from "../domain/presets";
import { ALL_THEMES } from "../domain/themes";
import type { Character, Lineup, Role } from "../domain/types";

const NUM_SEASONS = 5;
const WEEKS_PER_SEASON = 10;
const TEAMS = 6;
const ROSTER = 6;

function main() {
  const settings = applyPreset("standard");
  const source = new ProceduralSource();

  const roleTotals: Record<Role, { total: number; count: number }> = {
    Tank: { total: 0, count: 0 },
    Healer: { total: 0, count: 0 },
    DPS: { total: 0, count: 0 },
    Utility: { total: 0, count: 0 },
  };

  for (let season = 0; season < NUM_SEASONS; season++) {
    const seed = seedFromIds(`season-${season}`);
    const rng = createRng(seed);
    const characters = source.generateCharacters(48, rng, settings);
    const charMap = new Map(characters.map((c) => [c.id, c]));

    // Round-robin draft into 6 teams of 6 by total stat
    const sorted = [...characters].sort((a, b) => {
      const sa = Object.values(a.stats).reduce((s: number, v: number) => s + v, 0);
      const sb = Object.values(b.stats).reduce((s: number, v: number) => s + v, 0);
      return sb - sa;
    });
    const teams: typeof characters[] = Array.from({ length: TEAMS }, () => []);
    sorted.forEach((c, idx) => teams[idx % TEAMS].push(c));

    for (let week = 1; week <= WEEKS_PER_SEASON; week++) {
      const themeRng = rng.fork(`theme-${week}`);
      const theme = themeRng.pick(ALL_THEMES);
      const dungeon = source.generateDungeon(
        week, 0, rng.fork(`d-${week}`), theme, settings.encounterCount,
      );

      for (const team of teams) {
        if (team.length < ROSTER) continue;
        const active = team.slice(0, 4).map((c) => c.id) as [string, string, string, string];
        const lineup: Lineup = { active, bench: [team[4].id, team[5].id] };
        const events = runDungeon(lineup, charMap, dungeon, rng.fork(`s-${week}-${team[0].id}`));
        const result = score(events, team.slice(0, 4));

        for (const ch of team.slice(0, 4)) {
          const cs = result.perCharacter.get(ch.id);
          if (!cs) continue;
          roleTotals[ch.role].total += cs.totalPoints;
          roleTotals[ch.role].count += 1;
        }
      }
    }
  }

  console.log("=== Role parity over", NUM_SEASONS, "seasons ===");
  for (const role of ["Tank", "Healer", "DPS", "Utility"] as Role[]) {
    const { total, count } = roleTotals[role];
    const avg = count > 0 ? total / count : 0;
    console.log(`${role.padEnd(8)} avg=${avg.toFixed(2)} (n=${count})`);
  }

  const tankAvg = roleTotals.Tank.total / Math.max(1, roleTotals.Tank.count);
  const healerAvg = roleTotals.Healer.total / Math.max(1, roleTotals.Healer.count);
  const ratio = Math.abs(tankAvg - healerAvg) / Math.max(tankAvg, healerAvg, 1);
  console.log(`\nTank/Healer parity gap: ${(ratio * 100).toFixed(1)}% (target <30%)`);
  if (ratio > 0.3) {
    console.warn("WARN: Tank/Healer parity exceeds 30% threshold");
  }
}

main();
