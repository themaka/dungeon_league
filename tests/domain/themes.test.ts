import { describe, it, expect } from "vitest";
import { THEME_ENCOUNTER_MIX, pickEncounterType, ALL_THEMES } from "domain/themes";
import { createRng } from "domain/rng";

describe("themes", () => {
  it("ALL_THEMES contains the 10 spec themes", () => {
    expect(ALL_THEMES).toEqual([
      "undead", "fire", "shadow", "arcane", "demonic",
      "nature", "mechanical", "aquatic", "draconic", "ice",
    ]);
  });

  it("each theme mix sums to 100", () => {
    for (const theme of ALL_THEMES) {
      const mix = THEME_ENCOUNTER_MIX[theme];
      const total = mix.combat + mix.trap + mix.puzzle + mix.treasure + mix.social + mix.arcane;
      expect(total).toBe(100);
    }
  });

  it("arcane theme weights arcane encounters most heavily", () => {
    expect(THEME_ENCOUNTER_MIX.arcane.arcane).toBe(35);
  });

  it("mechanical theme weights traps most heavily", () => {
    expect(THEME_ENCOUNTER_MIX.mechanical.trap).toBe(30);
  });

  it("pickEncounterType returns weighted distribution over 10000 picks", () => {
    const rng = createRng(42);
    const counts = { combat: 0, trap: 0, puzzle: 0, treasure: 0, social: 0, arcane: 0 };
    for (let i = 0; i < 10000; i++) {
      counts[pickEncounterType("undead", rng)]++;
    }
    // undead: combat 40%, expect 35-45% range
    expect(counts.combat).toBeGreaterThan(3500);
    expect(counts.combat).toBeLessThan(4500);
    // social 5% — expect 350-650
    expect(counts.social).toBeGreaterThan(350);
    expect(counts.social).toBeLessThan(650);
  });
});
