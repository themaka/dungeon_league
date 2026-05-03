import { describe, it, expect } from "vitest";
import {
  SPECIALTIES,
  CLASS_SPECIALTY_MAP,
  specialtyForClass,
  primaryStatForSpecialty,
  isCoreEventForSpecialty,
} from "domain/specialties";
import type { CharacterClass, Specialty } from "domain/types";

describe("specialties", () => {
  it("defines all 24 specialties", () => {
    expect(SPECIALTIES.length).toBe(24);
  });

  it("each class has exactly two specialties", () => {
    const classes: CharacterClass[] = [
      "Fighter", "Wizard", "Rogue", "Cleric", "Ranger", "Paladin",
      "Barbarian", "Bard", "Druid", "Warlock", "Monk", "Sorcerer",
    ];
    for (const cls of classes) {
      expect(CLASS_SPECIALTY_MAP[cls]).toHaveLength(2);
    }
  });

  it("specialtyForClass picks deterministically from a roll", () => {
    expect(specialtyForClass("Fighter", 0)).toBe("Battle Master");
    expect(specialtyForClass("Fighter", 1)).toBe("Champion");
    expect(specialtyForClass("Cleric", 0)).toBe("Life Domain");
    expect(specialtyForClass("Cleric", 1)).toBe("War Domain");
  });

  it("primaryStatForSpecialty returns the level-up stat", () => {
    expect(primaryStatForSpecialty("Champion")).toBe("str");
    expect(primaryStatForSpecialty("Evoker")).toBe("int");
    expect(primaryStatForSpecialty("Life Domain")).toBe("wis");
    expect(primaryStatForSpecialty("Lore")).toBe("cha");
  });

  it("isCoreEventForSpecialty matches per spec", () => {
    expect(isCoreEventForSpecialty("Champion", "crit")).toBe(true);
    expect(isCoreEventForSpecialty("Champion", "heal")).toBe(false);
    expect(isCoreEventForSpecialty("Life Domain", "heal")).toBe(true);
    expect(isCoreEventForSpecialty("Life Domain", "revivify")).toBe(true);
    expect(isCoreEventForSpecialty("War Domain", "buff")).toBe(true);
    expect(isCoreEventForSpecialty("Devotion", "save_pass")).toBe(true);
  });
});
