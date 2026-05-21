import { describe, it, expect } from "vitest";
import {
  XP_THRESHOLDS,
  xpFromEvents,
  applyXpAndLevel,
  scaledThresholds,
  xpMultiplierFor,
} from "domain/leveling";
import type { Character, SimEvent } from "domain/types";

function mkChar(over: Partial<Character> = {}): Character {
  return {
    id: "c1", name: "C1", race: "Human", class: "Cleric", role: "Healer",
    specialty: "Life Domain",
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    level: 3, xp: 30, abilityTiers: [1], description: "",
    ...over,
  };
}

describe("leveling", () => {
  it("XP_THRESHOLDS go up to level 20 monotonically", () => {
    expect(XP_THRESHOLDS[2]).toBe(15);
    expect(XP_THRESHOLDS[3]).toBe(30);
    expect(XP_THRESHOLDS[6]).toBe(95);
    expect(XP_THRESHOLDS[13]).toBe(380);
    expect(XP_THRESHOLDS[20]).toBe(1140);
    for (let l = 3; l <= 20; l++) {
      expect(XP_THRESHOLDS[l]).toBeGreaterThan(XP_THRESHOLDS[l - 1]);
    }
  });

  it("xpFromEvents awards role-relevant XP (Healer earns from heal)", () => {
    const c = mkChar({ specialty: "War Domain" });
    const events: SimEvent[] = [
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 8 },
      { kind: "save_pass", encounterId: "e", actorId: "c1" },
    ];
    expect(xpFromEvents(c, events)).toBeGreaterThan(0);
  });

  it("applies 1.5x specialty bonus on aligned events", () => {
    const aligned = mkChar({ specialty: "Life Domain" });
    const offspec = mkChar({ specialty: "War Domain" });
    const events: SimEvent[] = [
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 10 },
    ];
    const xpAligned = xpFromEvents(aligned, events);
    const xpOffspec = xpFromEvents(offspec, events);
    expect(xpAligned).toBeCloseTo(xpOffspec * 1.5, 4);
  });

  it("DPS earns no XP from heal events", () => {
    const dps = mkChar({ class: "Fighter", role: "DPS", specialty: "Champion" });
    const events: SimEvent[] = [
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 10 },
    ];
    expect(xpFromEvents(dps, events)).toBe(0);
  });

  it("applyXpAndLevel handles single level-up with stat bump and ability tier", () => {
    const c = mkChar({ level: 3, xp: 45, abilityTiers: [1] });
    const result = applyXpAndLevel(c, 10, 1, 20);
    expect(result.character.level).toBe(4);
    expect(result.character.xp).toBe(55);
    expect(result.character.stats.wis).toBe(15);
    expect(result.levelUps).toEqual([4]);
  });

  it("applyXpAndLevel unlocks ability tier 2 at level 6", () => {
    const c = mkChar({ level: 5, xp: 70, abilityTiers: [1] });
    const result = applyXpAndLevel(c, 30, 1, 20);
    expect(result.character.level).toBe(6);
    expect(result.character.abilityTiers).toContain(2);
  });

  it("respects maxLevel cap", () => {
    const c = mkChar({ level: 19, xp: 1000 });
    const result = applyXpAndLevel(c, 500, 1, 20);
    expect(result.character.level).toBe(20);
  });

  it("respects xpEnabled=false (Champions preset) — applyXpAndLevel with 0 award is a no-op", () => {
    const c = mkChar({ level: 20, xp: 0 });
    const result = applyXpAndLevel(c, 0, 1, 20);
    expect(result.character.level).toBe(20);
    expect(result.character.xp).toBe(0);
  });

  it("scaledThresholds multiplies cumulative thresholds by factor per spec", () => {
    const scaled = scaledThresholds(0.5);
    expect(scaled[3]).toBeCloseTo(15, 4);
  });

  it("applyXpAndLevel handles multi-level-up in one call", () => {
    const c = mkChar({ level: 3, xp: 0, abilityTiers: [1] });
    const result = applyXpAndLevel(c, 200, 1, 20);
    // 0 -> 200; thresholds 50 (L4), 70 (L5), 95 (L6), 120 (L7), 150 (L8), 185 (L9) all passable
    expect(result.character.level).toBe(9);
    expect(result.levelUps).toEqual([4, 5, 6, 7, 8, 9]);
    expect(result.character.abilityTiers).toContain(2);
  });

  it("applyXpAndLevel respects scaleFactor (2x means harder to level)", () => {
    const c = mkChar({ level: 3, xp: 30, abilityTiers: [1] });
    // L4 normally needs 50; with 2x scale it needs 100. Awarding 50 should NOT level up.
    const result = applyXpAndLevel(c, 50, 2, 20);
    expect(result.character.level).toBe(3);
    expect(result.character.xp).toBe(80);
    expect(result.levelUps).toEqual([]);
  });

  it("xpFromEvents returns an integer (no fractional accumulation)", () => {
    const c = mkChar({ specialty: "Life Domain" });
    const events: SimEvent[] = [
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 5 },
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 5 },
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 5 },
    ];
    const xp = xpFromEvents(c, events);
    expect(Number.isInteger(xp)).toBe(true);
  });

  describe("xpMultiplierFor", () => {
    it("returns UTILITY_XP_LIFT (3.0) for Utility role + Utility-role event (regardless of specialty match)", () => {
      const thiefChar = mkChar({
        class: "Rogue", role: "Utility", specialty: "Thief",
      });
      // disarm_trap IS in Utility role set AND IS Thief specialty-core → 3.0 (floor fix)
      expect(xpMultiplierFor(thiefChar, true, true)).toBe(3.0);
      // save_pass IS in Utility role set, not Thief specialty-core → 3.0 (regular lift)
      expect(xpMultiplierFor(thiefChar, true, false)).toBe(3.0);
    });

    it("returns SPECIALTY_XP_BONUS (1.5) for non-Utility role + role/specialty match", () => {
      const championChar = mkChar({
        class: "Fighter", role: "DPS", specialty: "Champion",
      });
      // crit IS in DPS role set AND IS Champion specialty-core → 1.5
      expect(xpMultiplierFor(championChar, true, true)).toBe(1.5);
    });

    it("returns 1.0 for role-only or specialty-only (no compound)", () => {
      const championChar = mkChar({
        class: "Fighter", role: "DPS", specialty: "Champion",
      });
      // role-only (e.g. DPS hit on a non-Champion DPS would be true,false)
      expect(xpMultiplierFor(championChar, true, false)).toBe(1.0);
      // specialty-only (e.g. an event in specialty.coreEvents but not the role set)
      expect(xpMultiplierFor(championChar, false, true)).toBe(1.0);
    });

    it("returns 1.0 for Utility role + specialty-only event (floor fix is gated on role membership)", () => {
      // Utility character whose specialty-core event is NOT in the Utility role set
      // falls through to the 1.0 fallback. The floor fix only applies to events
      // that are in the Utility role set.
      const utilityChar = mkChar({
        class: "Rogue", role: "Utility", specialty: "Thief",
      });
      expect(xpMultiplierFor(utilityChar, false, true)).toBe(1.0);
    });
  });
});
