import { describe, it, expect } from "vitest";
import { ProceduralSource } from "domain/content/procedural-source";
import { createRng } from "domain/rng";
import { CLASS_SPECIALTY_MAP } from "domain/specialties";
import { DEFAULT_LEAGUE_SETTINGS } from "domain/types";

describe("ProceduralSource", () => {
  it("generateCharacters sets startingLevel and assigns valid specialty", () => {
    const src = new ProceduralSource();
    const chars = src.generateCharacters(48, createRng(1), DEFAULT_LEAGUE_SETTINGS);
    expect(chars.length).toBe(48);
    for (const c of chars) {
      expect(c.level).toBe(3);
      expect(c.xp).toBe(30);
      expect(c.abilityTiers).toContain(1);
      const allowed = CLASS_SPECIALTY_MAP[c.class];
      expect(allowed).toContain(c.specialty);
    }
  });

  it("respects startingLevel from settings", () => {
    const src = new ProceduralSource();
    const settings = { ...DEFAULT_LEAGUE_SETTINGS, startingLevel: 20 };
    const chars = src.generateCharacters(12, createRng(2), settings);
    for (const c of chars) {
      expect(c.level).toBe(20);
      expect(c.abilityTiers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });

  it("generateDungeon respects theme encounter weights", () => {
    const src = new ProceduralSource();
    const counts: Record<string, number> = { combat: 0, trap: 0, puzzle: 0, treasure: 0, social: 0, arcane: 0 };
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed);
      const dungeon = src.generateDungeon(1, 0, rng, "arcane", "5-8");
      for (const e of dungeon.encounters) counts[e.type]++;
    }
    expect(counts.arcane).toBeGreaterThan(counts.trap);
  });

  it("generateDungeon respects encounterCount setting", () => {
    const src = new ProceduralSource();
    const small = src.generateDungeon(1, 0, createRng(7), "fire", "3-5");
    const large = src.generateDungeon(1, 0, createRng(7), "fire", "7-10");
    expect(small.encounters.length).toBeLessThanOrEqual(5);
    expect(large.encounters.length).toBeGreaterThanOrEqual(7);
  });

  it("generateDungeon assigns theme to dungeon", () => {
    const src = new ProceduralSource();
    const dungeon = src.generateDungeon(1, 0, createRng(3), "shadow", "5-8");
    expect(dungeon.theme).toBe("shadow");
  });

  it("characters at startingLevel 5 begin with 70 XP (veterans preset)", () => {
    const src = new ProceduralSource();
    const settings = { ...DEFAULT_LEAGUE_SETTINGS, startingLevel: 5 };
    const chars = src.generateCharacters(6, createRng(11), settings);
    for (const c of chars) {
      expect(c.level).toBe(5);
      expect(c.xp).toBe(70);
    }
  });

  it("characters at startingLevel 1 begin with 0 XP", () => {
    const src = new ProceduralSource();
    const settings = { ...DEFAULT_LEAGUE_SETTINGS, startingLevel: 1 };
    const chars = src.generateCharacters(4, createRng(13), settings);
    for (const c of chars) {
      expect(c.level).toBe(1);
      expect(c.xp).toBe(0);
    }
  });
});
