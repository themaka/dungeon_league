import { describe, it, expect } from "vitest";
import {
  XP_THRESHOLDS,
  xpFromEvents,
  applyXpAndLevel,
  scaledThresholds,
  xpMultiplierFor,
  xpScaleFor,
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

  it("applies 1.5x specialty bonus on aligned events (non-Utility)", () => {
    // Life Domain Healer: heal IS in Healer role set AND IS specialty-core → 1.5x
    // War Domain Healer:  heal IS in Healer role set, NOT specialty-core → 1.0x
    // base XP for heal amount=10: max(1, floor(10/4)) = 2
    // aligned per-event = round(2 * 1.5) = 3 ; total before calibration = 3
    //                   → final = round(3 * 3.5) = 11
    // offspec per-event = round(2 * 1.0) = 2 ; total before calibration = 2
    //                   → final = round(2 * 3.5) = 7
    const aligned = mkChar({ specialty: "Life Domain" });
    const offspec = mkChar({ specialty: "War Domain" });
    const events: SimEvent[] = [
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 10 },
    ];
    expect(xpFromEvents(aligned, events)).toBe(11);
    expect(xpFromEvents(offspec, events)).toBe(7);
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

  describe("Floor×3.0 + 3.5x calibration", () => {
    it("applies UTILITY_XP_LIFT (3.0) plus 3.5x calibration on a Bard Lore persuade", () => {
      // Bard Lore is Utility role; persuade is in Utility role set AND IS Lore specialty-core.
      // base XP for persuade: 2
      // per-event mult: 3.0 (UTILITY_XP_LIFT — Utility chars always get ≥ 3.0× on Utility role events)
      // per-event = round(2 * 3.0) = 6 ; total = 6 ; final = round(6 * 3.5) = 21
      const bardLore = mkChar({
        class: "Bard", role: "Utility", specialty: "Lore",
      });
      const events: SimEvent[] = [
        { kind: "persuade", encounterId: "e", actorId: "c1" },
      ];
      expect(xpFromEvents(bardLore, events)).toBe(21);
    });

    it("applies UTILITY_XP_LIFT to Rogue Thief on disarm_trap (the floor-fix case)", () => {
      // Thief specialty events (disarm_trap, find_treasure) ARE Utility-role events.
      // Under the old NoBon+UtilLift rule, the `else if` bypassed them — Thief stayed at L2.
      // Floor fix: Utility role events for Utility chars always get 3.0x.
      // base XP for disarm_trap: 2
      // per-event = round(2 * 3.0) = 6 ; total = 6 ; final = round(6 * 3.5) = 21
      const thief = mkChar({
        class: "Rogue", role: "Utility", specialty: "Thief",
      });
      const events: SimEvent[] = [
        { kind: "disarm_trap", encounterId: "e", actorId: "c1" },
      ];
      expect(xpFromEvents(thief, events)).toBe(21);
    });

    it("applies 3.5x calibration to a Fighter Champion crit (non-Utility specialty bonus preserved)", () => {
      // crit IS in DPS role set AND IS Champion specialty-core → mult 1.5
      // base XP for crit: 2
      // per-event = round(2 * 1.5) = 3 ; total = 3 ; final = round(3 * 3.5) = 11
      const champion = mkChar({
        class: "Fighter", role: "DPS", specialty: "Champion",
      });
      const events: SimEvent[] = [
        { kind: "crit", encounterId: "e", actorId: "c1" },
      ];
      expect(xpFromEvents(champion, events)).toBe(11);
    });

    it("broadened eligibility: counts specialty-core events outside the role set (no role bonus)", () => {
      // Vengeance Paladin (Tank role); smite IS specialty-core but NOT in Tank role set.
      // Without broadened eligibility, this event would be skipped.
      // With broadened: counted at mult 1.0 (specialty-only, no compound).
      // base XP for smite amount=8: max(1, floor(8/4)) = 2
      // per-event = round(2 * 1.0) = 2 ; total = 2 ; final = round(2 * 3.5) = 7
      const veng = mkChar({
        class: "Paladin", role: "Tank", specialty: "Vengeance",
      });
      const events: SimEvent[] = [
        { kind: "smite", encounterId: "e", actorId: "c1", amount: 8 },
      ];
      expect(xpFromEvents(veng, events)).toBe(7);
    });
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

  describe("xpScaleFor", () => {
    it("returns 1.0 for Standard preset shape (L3 → L13, 10 weeks)", () => {
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 13, seasonWeeks: 10 }))
        .toBeCloseTo(1.0, 3);
    });

    it("returns ~1.129 for Quick preset shape (L3 → L9, 5 weeks)", () => {
      // (350 * 5) / (155 * 10) = 1.129
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 9, seasonWeeks: 5 }))
        .toBeCloseTo(1.129, 3);
    });

    it("returns ~0.764 for Veterans preset shape (L5 → L16, 12 weeks)", () => {
      // (350 * 12) / (550 * 10) = 0.7636
      expect(xpScaleFor({ startingLevel: 5, targetLevel: 16, seasonWeeks: 12 }))
        .toBeCloseTo(0.764, 3);
    });

    it("returns ~0.631 for Epic preset shape (L3 → L20, 20 weeks)", () => {
      // (350 * 20) / (1110 * 10) = 0.6306
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 20, seasonWeeks: 20 }))
        .toBeCloseTo(0.631, 3);
    });

    it("returns 1.0 guard when targetLevel === startingLevel (Champions)", () => {
      expect(xpScaleFor({ startingLevel: 20, targetLevel: 20, seasonWeeks: 10 }))
        .toBe(1.0);
    });

    it("returns 1.0 guard when targetLevel is out of range", () => {
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 99, seasonWeeks: 10 }))
        .toBe(1.0);
    });

    it("returns 1.0 guard when startingLevel is out of range", () => {
      expect(xpScaleFor({ startingLevel: 0, targetLevel: 13, seasonWeeks: 10 }))
        .toBe(1.0);
    });

    it("returns 1.0 guard when seasonWeeks is 0 or negative", () => {
      // Defensive guard — preserves the Math.max(1, ...) protection that the
      // service-layer caller used to perform inline. Custom presets or test
      // fixtures could accidentally hit this.
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 13, seasonWeeks: 0 }))
        .toBe(1.0);
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 13, seasonWeeks: -5 }))
        .toBe(1.0);
    });

    it("returns 1.0 guard when seasonWeeks is undefined / null / NaN (malformed input)", () => {
      // Preserves the defensive `?? 10` clamp from the old service-layer formula.
      // LeagueSettings.seasonWeeks is typed as number, but DB rows or test
      // fixtures could produce nullish values.
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 13, seasonWeeks: undefined as unknown as number }))
        .toBe(1.0);
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 13, seasonWeeks: null as unknown as number }))
        .toBe(1.0);
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 13, seasonWeeks: NaN }))
        .toBe(1.0);
    });
  });
});
