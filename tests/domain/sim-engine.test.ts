import { describe, it, expect } from "vitest";
import { createRng } from "domain/rng";
import { runDungeon } from "domain/sim/sim-engine";
import { ProceduralSource } from "domain/content/procedural-source";
import { type Lineup, type SimEvent, type Dungeon, DEFAULT_LEAGUE_SETTINGS } from "domain/types";
import { ATTACK_STAT_BY_CLASS } from "domain/sim/abilities-runtime";
import type { Character } from "domain/types";

// Build a dungeon using only encounter types the current sim-engine handles
// (social and arcane are Task 10's domain).
function makeDungeon(seed: number): Dungeon {
  const rng = createRng(seed);
  const types = ["combat", "trap", "puzzle", "treasure"] as const;
  const encounters = Array.from({ length: 5 }, (_, i) => ({
    id: `enc-test-${seed}-${i}`,
    type: types[i % types.length],
    name: `Encounter ${i}`,
    difficulty: rng.nextInt(1, 10),
    targetStats: ["str" as const, "con" as const],
    isBoss: i === 4,
  }));
  return { id: `dungeon-test-${seed}`, name: "Test Dungeon", theme: "undead", encounters };
}

function makeTestSetup(seed: number) {
  const rng = createRng(seed);
  const source = new ProceduralSource();
  const chars = source.generateCharacters(6, createRng(seed + 1), DEFAULT_LEAGUE_SETTINGS);
  const dungeon = makeDungeon(seed + 2);
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
      "multiattack", "sneak_attack", "smite", "rage", "block", "taunt",
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

function dpsChar(id: string, cls: any, specialty: any, level = 6): Character {
  return {
    id, name: id, race: "Human", class: cls, role: "DPS", specialty,
    stats: { str: 16, dex: 16, con: 12, int: 16, wis: 10, cha: 16 },
    level, xp: 0, abilityTiers: [1, 2], description: "",
  };
}

describe("class-aware combat", () => {
  it("ATTACK_STAT_BY_CLASS maps Wizard to int and Bard to cha", () => {
    expect(ATTACK_STAT_BY_CLASS.Wizard).toBe("int");
    expect(ATTACK_STAT_BY_CLASS.Bard).toBe("cha");
    expect(ATTACK_STAT_BY_CLASS.Fighter).toBe("str");
    expect(ATTACK_STAT_BY_CLASS.Monk).toBe("dex");
  });

  it("Fighter at level 6+ produces multiattack events", () => {
    const f = dpsChar("f", "Fighter", "Battle Master", 6);
    const tank = { ...dpsChar("t", "Barbarian", "Berserker", 3), role: "Tank" as const };
    const h = { ...dpsChar("h", "Cleric", "Life Domain", 3), role: "Healer" as const };
    const u = { ...dpsChar("u", "Rogue", "Thief", 3), role: "Utility" as const };
    const charMap = new Map([f, tank, h, u].map((c) => [c.id, c]));
    const lineup: Lineup = { active: [f.id, tank.id, h.id, u.id], bench: ["x", "y"] };
    const dungeon: Dungeon = {
      id: "d", name: "T", theme: "fire",
      encounters: [{
        id: "e1", type: "combat", name: "Goblin", difficulty: 3,
        targetStats: ["str"], isBoss: false,
      }],
    };
    const events = runDungeon(lineup, charMap, dungeon, createRng(11));
    expect(events.some((e) => e.kind === "multiattack" && e.actorId === "f")).toBe(true);
  });

  it("Rogue Assassin produces sneak_attack events", () => {
    const r = dpsChar("r", "Rogue", "Assassin", 3);
    r.role = "Utility";
    const fill = { ...dpsChar("x", "Fighter", "Champion", 3) };
    const charMap = new Map([r, fill].map((c) => [c.id, c]));
    const lineup: Lineup = { active: [r.id, fill.id, fill.id, fill.id], bench: ["a", "b"] };
    const dungeon: Dungeon = {
      id: "d", name: "T", theme: "shadow",
      encounters: [{
        id: "e1", type: "combat", name: "Boss", difficulty: 5,
        targetStats: ["dex"], isBoss: true,
      }],
    };
    const events = runDungeon(lineup, charMap, dungeon, createRng(7));
    expect(events.some((e) => e.kind === "sneak_attack" && e.actorId === "r")).toBe(true);
  });

  it("Paladin Vengeance produces smite events", () => {
    const p = { ...dpsChar("p", "Paladin", "Vengeance", 3), role: "Tank" as const };
    const fill = dpsChar("x", "Fighter", "Champion", 3);
    const charMap = new Map([p, fill].map((c) => [c.id, c]));
    const lineup: Lineup = { active: [p.id, fill.id, fill.id, fill.id], bench: ["a", "b"] };
    let sawSmite = false;
    for (let seed = 0; seed < 50 && !sawSmite; seed++) {
      const dungeon: Dungeon = {
        id: "d", name: "T", theme: "demonic",
        encounters: [{
          id: "e1", type: "combat", name: "Demon", difficulty: 6,
          targetStats: ["str"], isBoss: true,
        }],
      };
      const events = runDungeon(lineup, charMap, dungeon, createRng(seed));
      if (events.some((e) => e.kind === "smite" && e.actorId === "p")) sawSmite = true;
    }
    expect(sawSmite).toBe(true);
  });

  it("Champion Fighter crits on a 19 (expanded crit range at tier 1)", () => {
    const c = dpsChar("c", "Fighter", "Champion", 3);
    c.abilityTiers = [1];
    const fill = dpsChar("x", "Fighter", "Battle Master", 3);
    const charMap = new Map([c, fill].map((ch) => [ch.id, ch]));
    const lineup: Lineup = { active: [c.id, fill.id, fill.id, fill.id], bench: ["a", "b"] };
    let sawCrit = false;
    for (let seed = 0; seed < 50 && !sawCrit; seed++) {
      const dungeon: Dungeon = {
        id: "d", name: "T", theme: "fire",
        encounters: [{
          id: "e1", type: "combat", name: "Foe", difficulty: 4,
          targetStats: ["str"], isBoss: false,
        }],
      };
      const events = runDungeon(lineup, charMap, dungeon, createRng(seed));
      if (events.some((e) => e.kind === "crit" && e.actorId === "c")) sawCrit = true;
    }
    expect(sawCrit).toBe(true);
  });
});
