import { describe, it, expect } from "vitest";
import {
  abilitiesForCharacter,
  unlockTierForLevel,
  unlockedAbilities,
  hasAbility,
} from "domain/abilities";

describe("abilities", () => {
  it("unlockTierForLevel returns correct tier per spec", () => {
    expect(unlockTierForLevel(2)).toBe(0);
    expect(unlockTierForLevel(3)).toBe(1);
    expect(unlockTierForLevel(5)).toBe(1);
    expect(unlockTierForLevel(6)).toBe(2);
    expect(unlockTierForLevel(9)).toBe(3);
    expect(unlockTierForLevel(12)).toBe(4);
    expect(unlockTierForLevel(13)).toBe(5);
    expect(unlockTierForLevel(15)).toBe(6);
    expect(unlockTierForLevel(18)).toBe(7);
    expect(unlockTierForLevel(20)).toBe(8);
  });

  it("Champion Fighter has Improved Critical at tier 1", () => {
    const abs = abilitiesForCharacter("Fighter", "Champion", 3);
    expect(abs.some((a) => a.name === "Improved Critical")).toBe(true);
  });

  it("Life Domain Cleric unlocks Revivify at tier 2 (level 6)", () => {
    expect(hasAbility("Cleric", "Life Domain", 5, "Revivify")).toBe(false);
    expect(hasAbility("Cleric", "Life Domain", 6, "Revivify")).toBe(true);
  });

  it("unlockedAbilities lists all abilities up to current level", () => {
    const abs = unlockedAbilities("Fighter", "Champion", 6);
    expect(abs.length).toBeGreaterThanOrEqual(2);
    expect(abs.every((a) => a.tier <= 2)).toBe(true);
  });
});
