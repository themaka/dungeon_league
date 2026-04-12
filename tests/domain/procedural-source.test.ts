import { describe, it, expect } from "vitest";
import { createRng } from "domain/rng";
import { ProceduralSource } from "domain/content/procedural-source";
import { CLASS_ROLE_MAP, type Character, type Race, type CharacterClass } from "domain/types";

describe("ProceduralSource — characters", () => {
  const rng = createRng(42);
  const source = new ProceduralSource();

  it("generates the requested number of characters", () => {
    const chars = source.generateCharacters(48, createRng(42));
    expect(chars).toHaveLength(48);
  });

  it("generates deterministic characters for the same seed", () => {
    const chars1 = source.generateCharacters(10, createRng(42));
    const chars2 = source.generateCharacters(10, createRng(42));
    expect(chars1).toEqual(chars2);
  });

  it("generates characters with valid fields", () => {
    const chars = source.generateCharacters(48, createRng(99));
    const validRaces: Race[] = [
      "Human", "Elf", "Dwarf", "Halfling", "Orc", "Gnome", "Tiefling", "Dragonborn",
    ];
    const validClasses: CharacterClass[] = [
      "Fighter", "Wizard", "Rogue", "Cleric", "Ranger", "Paladin",
      "Barbarian", "Bard", "Druid", "Warlock", "Monk", "Sorcerer",
    ];

    for (const char of chars) {
      expect(char.id).toBeTruthy();
      expect(char.name).toBeTruthy();
      expect(validRaces).toContain(char.race);
      expect(validClasses).toContain(char.class);
      expect(char.role).toBe(CLASS_ROLE_MAP[char.class]);
      expect(char.level).toBe(1);
      expect(char.description).toBeTruthy();

      for (const stat of Object.values(char.stats)) {
        expect(stat).toBeGreaterThanOrEqual(3);
        expect(stat).toBeLessThanOrEqual(18);
      }
    }
  });

  it("generates unique IDs", () => {
    const chars = source.generateCharacters(48, createRng(42));
    const ids = chars.map((c) => c.id);
    expect(new Set(ids).size).toBe(48);
  });

  it("generates unique names", () => {
    const chars = source.generateCharacters(48, createRng(42));
    const names = chars.map((c) => c.name);
    expect(new Set(names).size).toBe(48);
  });
});

describe("ProceduralSource — dungeons", () => {
  const source = new ProceduralSource();

  it("generates a dungeon with 5-8 encounters", () => {
    const dungeon = source.generateDungeon(1, 0, createRng(42));
    expect(dungeon.encounters.length).toBeGreaterThanOrEqual(5);
    expect(dungeon.encounters.length).toBeLessThanOrEqual(8);
  });

  it("generates deterministic dungeons for the same seed", () => {
    const d1 = source.generateDungeon(1, 0, createRng(42));
    const d2 = source.generateDungeon(1, 0, createRng(42));
    expect(d1).toEqual(d2);
  });

  it("last encounter is always a boss", () => {
    for (let seed = 0; seed < 50; seed++) {
      const dungeon = source.generateDungeon(1, 0, createRng(seed));
      const last = dungeon.encounters[dungeon.encounters.length - 1];
      expect(last.isBoss).toBe(true);
      expect(last.type).toBe("combat");
    }
  });

  it("generates a name, theme, and unique encounter IDs", () => {
    const dungeon = source.generateDungeon(3, 1, createRng(99));
    expect(dungeon.name).toBeTruthy();
    expect(dungeon.theme).toBeTruthy();
    expect(dungeon.id).toBeTruthy();
    const ids = dungeon.encounters.map((e) => e.id);
    expect(new Set(ids).size).toBe(dungeon.encounters.length);
  });

  it("encounter difficulties are between 1 and 10", () => {
    const dungeon = source.generateDungeon(1, 0, createRng(42));
    for (const enc of dungeon.encounters) {
      expect(enc.difficulty).toBeGreaterThanOrEqual(1);
      expect(enc.difficulty).toBeLessThanOrEqual(10);
    }
  });
});
