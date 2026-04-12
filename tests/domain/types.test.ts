import { describe, it, expect } from "vitest";
import {
  DEFAULT_LEAGUE_SETTINGS,
  CLASS_ROLE_MAP,
  type Character,
  type Stats,
} from "domain/types";

describe("domain types", () => {
  it("DEFAULT_LEAGUE_SETTINGS has correct values", () => {
    expect(DEFAULT_LEAGUE_SETTINGS.teamCount).toBe(6);
    expect(DEFAULT_LEAGUE_SETTINGS.rosterSize).toBe(6);
    expect(DEFAULT_LEAGUE_SETTINGS.activeSize).toBe(4);
    expect(DEFAULT_LEAGUE_SETTINGS.seasonWeeks).toBe(5);
    expect(DEFAULT_LEAGUE_SETTINGS.playoffWeeks).toBe(2);
  });

  it("CLASS_ROLE_MAP maps all 12 classes", () => {
    expect(Object.keys(CLASS_ROLE_MAP)).toHaveLength(12);
    expect(CLASS_ROLE_MAP.Paladin).toBe("Tank");
    expect(CLASS_ROLE_MAP.Cleric).toBe("Healer");
    expect(CLASS_ROLE_MAP.Rogue).toBe("Utility");
    expect(CLASS_ROLE_MAP.Fighter).toBe("DPS");
  });

  it("character type is structurally valid", () => {
    const stats: Stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const char: Character = {
      id: "test-1",
      name: "Test Hero",
      race: "Human",
      class: "Fighter",
      role: "DPS",
      stats,
      level: 1,
      description: "A test character.",
    };
    expect(char.id).toBe("test-1");
    expect(char.role).toBe("DPS");
  });
});
