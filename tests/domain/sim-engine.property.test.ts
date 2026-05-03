import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { createRng } from "domain/rng";
import { ProceduralSource } from "domain/content/procedural-source";
import { runDungeon } from "domain/sim/sim-engine";
import { type Lineup, type Dungeon, DEFAULT_LEAGUE_SETTINGS } from "domain/types";

// Build a dungeon using only encounter types the current sim-engine handles
// (social and arcane are Task 10's domain).
function makeDungeon(seed: number): Dungeon {
  const rng = createRng(seed);
  const types = ["combat", "trap", "puzzle", "treasure"] as const;
  const encounters = Array.from({ length: 5 }, (_, i) => ({
    id: `enc-prop-${seed}-${i}`,
    type: types[i % types.length],
    name: `Encounter ${i}`,
    difficulty: rng.nextInt(1, 10),
    targetStats: ["str" as const, "con" as const],
    isBoss: i === 4,
  }));
  return { id: `dungeon-prop-${seed}`, name: "Test Dungeon", theme: "undead", encounters };
}

function makeSetup(seed: number) {
  const source = new ProceduralSource();
  const chars = source.generateCharacters(6, createRng(seed), DEFAULT_LEAGUE_SETTINGS);
  const dungeon = makeDungeon(seed + 1);
  const lineup: Lineup = {
    active: [chars[0].id, chars[1].id, chars[2].id, chars[3].id],
    bench: [chars[4].id, chars[5].id],
  };
  const charMap = new Map(chars.map((c) => [c.id, c]));
  return { chars, dungeon, lineup, charMap };
}

describe("sim engine property-based tests", () => {
  it("every dungeon terminates without error", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), (seed) => {
        const { dungeon, lineup, charMap } = makeSetup(seed);
        const rng = createRng(seed + 2);
        // If this throws or hangs, fast-check will catch it
        const events = runDungeon(lineup, charMap, dungeon, rng);
        expect(Array.isArray(events)).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });

  it("no event references a character not in the active lineup", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), (seed) => {
        const { dungeon, lineup, charMap } = makeSetup(seed);
        const rng = createRng(seed + 2);
        const events = runDungeon(lineup, charMap, dungeon, rng);
        const activeSet = new Set<string>(lineup.active);
        for (const event of events) {
          expect(activeSet.has(event.actorId)).toBe(true);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("every event references a valid encounter ID from the dungeon", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), (seed) => {
        const { dungeon, lineup, charMap } = makeSetup(seed);
        const rng = createRng(seed + 2);
        const events = runDungeon(lineup, charMap, dungeon, rng);
        const encounterIds = new Set(dungeon.encounters.map((e) => e.id));
        for (const event of events) {
          expect(encounterIds.has(event.encounterId)).toBe(true);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("sim is deterministic: same seed produces identical event sequences", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), (seed) => {
        const setup1 = makeSetup(seed);
        const setup2 = makeSetup(seed);
        const events1 = runDungeon(setup1.lineup, setup1.charMap, setup1.dungeon, createRng(seed + 2));
        const events2 = runDungeon(setup2.lineup, setup2.charMap, setup2.dungeon, createRng(seed + 2));
        expect(events1).toEqual(events2);
      }),
      { numRuns: 1000 },
    );
  });
});
