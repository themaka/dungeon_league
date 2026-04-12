import { describe, it, expect } from "vitest";
import { createRng } from "domain/rng";
import { runDungeon } from "domain/sim/sim-engine";
import { ProceduralSource } from "domain/content/procedural-source";
import type { Lineup, SimEvent } from "domain/types";

function makeTestSetup(seed: number) {
  const rng = createRng(seed);
  const source = new ProceduralSource();
  const chars = source.generateCharacters(6, createRng(seed + 1));
  const dungeon = source.generateDungeon(1, 0, createRng(seed + 2));
  const lineup: Lineup = {
    active: [chars[0].id, chars[1].id, chars[2].id, chars[3].id] as [string, string, string, string],
    bench: [chars[4].id, chars[5].id] as [string, string],
  };
  const charMap = new Map(chars.map((c) => [c.id, c]));
  return { rng, dungeon, lineup, charMap, chars };
}

describe("sim engine", () => {
  it("returns an array of events", () => {
    const { dungeon, lineup, charMap } = makeTestSetup(42);
    const events = runDungeon(lineup, charMap, dungeon, createRng(42));
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same seed", () => {
    const setup1 = makeTestSetup(42);
    const setup2 = makeTestSetup(42);
    const events1 = runDungeon(setup1.lineup, setup1.charMap, setup1.dungeon, createRng(99));
    const events2 = runDungeon(setup2.lineup, setup2.charMap, setup2.dungeon, createRng(99));
    expect(events1).toEqual(events2);
  });

  it("only emits events for active characters", () => {
    const { dungeon, lineup, charMap } = makeTestSetup(42);
    const events = runDungeon(lineup, charMap, dungeon, createRng(42));
    const activeSet = new Set(lineup.active);
    for (const event of events) {
      expect(activeSet.has(event.actorId)).toBe(true);
    }
  });

  it("emits valid event kinds", () => {
    const { dungeon, lineup, charMap } = makeTestSetup(42);
    const events = runDungeon(lineup, charMap, dungeon, createRng(42));
    const validKinds = new Set([
      "hit", "kill", "crit", "heal", "damage_taken",
      "save_pass", "save_fail", "disarm_trap", "find_treasure", "ko", "death",
    ]);
    for (const event of events) {
      expect(validKinds.has(event.kind)).toBe(true);
    }
  });

  it("events reference encounter IDs from the dungeon", () => {
    const { dungeon, lineup, charMap } = makeTestSetup(42);
    const events = runDungeon(lineup, charMap, dungeon, createRng(42));
    const encounterIds = new Set(dungeon.encounters.map((e) => e.id));
    for (const event of events) {
      expect(encounterIds.has(event.encounterId)).toBe(true);
    }
  });

  it("dead characters stop generating events after death", () => {
    let found = false;
    for (let seed = 0; seed < 200; seed++) {
      const { dungeon, lineup, charMap } = makeTestSetup(seed);
      const events = runDungeon(lineup, charMap, dungeon, createRng(seed));
      const deadChars = new Set<string>();
      for (const event of events) {
        if (event.kind === "death") deadChars.add(event.actorId);
        if (deadChars.has(event.actorId) && event.kind !== "death") {
          found = true;
          expect.unreachable("Dead character emitted a non-death event");
        }
      }
    }
  });
});
