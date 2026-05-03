import { describe, it, expect } from "vitest";
import {
  DEFAULT_LEAGUE_SETTINGS,
  CLASS_ROLE_MAP,
  type Specialty,
  type EventKind,
  type EncounterType,
  type LeagueSettings,
  type Character,
} from "domain/types";

describe("domain types", () => {
  it("DEFAULT_LEAGUE_SETTINGS has all overhaul fields", () => {
    expect(DEFAULT_LEAGUE_SETTINGS.scoutingRuns).toBe(5);
    expect(DEFAULT_LEAGUE_SETTINGS.scoutingVisibility).toBe("full");
    expect(DEFAULT_LEAGUE_SETTINGS.startingLevel).toBe(3);
    expect(DEFAULT_LEAGUE_SETTINGS.targetLevel).toBe(13);
    expect(DEFAULT_LEAGUE_SETTINGS.maxLevel).toBe(20);
    expect(DEFAULT_LEAGUE_SETTINGS.seasonWeeks).toBe(10);
    expect(DEFAULT_LEAGUE_SETTINGS.playoffWeeks).toBe(3);
    expect(DEFAULT_LEAGUE_SETTINGS.encounterCount).toBe("5-8");
    expect(DEFAULT_LEAGUE_SETTINGS.characterPool).toBe(48);
    expect(DEFAULT_LEAGUE_SETTINGS.xpEnabled).toBe(true);
    expect(DEFAULT_LEAGUE_SETTINGS.preset).toBe("standard");
  });

  it("EventKind union includes new events", () => {
    const kinds: EventKind[] = [
      "buff", "buff_proc", "block", "taunt",
      "persuade", "deceive", "intimidate",
      "dispel", "channel", "arcane_surge",
      "multiattack", "sneak_attack", "smite", "rage", "revivify",
    ];
    expect(kinds.length).toBe(15);
  });

  it("EncounterType includes social and arcane", () => {
    const types: EncounterType[] = ["combat", "trap", "puzzle", "treasure", "social", "arcane"];
    expect(types.length).toBe(6);
  });

  it("Character has specialty/xp/abilityTiers fields", () => {
    const c: Character = {
      id: "x", name: "x", race: "Human", class: "Fighter", role: "DPS",
      specialty: "Champion",
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      level: 3, xp: 30, abilityTiers: [1],
      description: "",
    };
    expect(c.specialty).toBe("Champion");
    expect(c.abilityTiers).toEqual([1]);
  });

  it("CLASS_ROLE_MAP unchanged", () => {
    expect(CLASS_ROLE_MAP.Fighter).toBe("DPS");
    expect(CLASS_ROLE_MAP.Cleric).toBe("Healer");
  });
});
