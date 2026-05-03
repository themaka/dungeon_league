import { describe, it, expect } from "vitest";
import { runScouting, projectedValue } from "domain/scouting";
import { ProceduralSource } from "domain/content/procedural-source";
import { createRng } from "domain/rng";
import { DEFAULT_LEAGUE_SETTINGS } from "domain/types";

describe("scouting", () => {
  it("runScouting produces a report per character", () => {
    const src = new ProceduralSource();
    const chars = src.generateCharacters(12, createRng(1), DEFAULT_LEAGUE_SETTINGS);
    const reports = runScouting(chars, src, "league-1", 5, DEFAULT_LEAGUE_SETTINGS);
    expect(Object.keys(reports).length).toBe(12);
    for (const c of chars) {
      const r = reports[c.id];
      expect(r).toBeDefined();
      expect(r.runs).toBe(5);
      expect(typeof r.avgPoints).toBe("number");
      expect(r.specialtyProcRate).toBeGreaterThanOrEqual(0);
      expect(r.specialtyProcRate).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic — same seed yields same reports", () => {
    const src = new ProceduralSource();
    const chars = src.generateCharacters(8, createRng(42), DEFAULT_LEAGUE_SETTINGS);
    const a = runScouting(chars, src, "league-x", 3, DEFAULT_LEAGUE_SETTINGS);
    const b = runScouting(chars, src, "league-x", 3, DEFAULT_LEAGUE_SETTINGS);
    for (const c of chars) {
      expect(a[c.id].avgPoints).toBe(b[c.id].avgPoints);
    }
  });

  it("projectedValue is a non-negative number", () => {
    const src = new ProceduralSource();
    const chars = src.generateCharacters(6, createRng(7), DEFAULT_LEAGUE_SETTINGS);
    const reports = runScouting(chars, src, "L", 5, DEFAULT_LEAGUE_SETTINGS);
    for (const c of chars) {
      expect(projectedValue(reports[c.id])).toBeGreaterThanOrEqual(0);
    }
  });

  it("pointsByEventType is keyed by event kind, not encounter type", () => {
    const src = new ProceduralSource();
    const chars = src.generateCharacters(8, createRng(99), DEFAULT_LEAGUE_SETTINGS);
    const reports = runScouting(chars, src, "L", 5, DEFAULT_LEAGUE_SETTINGS);
    // Find at least one character whose breakdown contains an event-kind key
    const someReport = Object.values(reports).find((r) => Object.keys(r.pointsByEventType).length > 0);
    expect(someReport).toBeDefined();
    if (someReport) {
      const keys = Object.keys(someReport.pointsByEventType);
      // Event kinds, not encounter types
      const validEventKinds = new Set([
        "hit", "kill", "crit", "heal", "damage_taken", "save_pass", "save_fail",
        "disarm_trap", "find_treasure", "ko", "death",
        "buff", "buff_proc", "block", "taunt",
        "persuade", "deceive", "intimidate",
        "dispel", "channel", "arcane_surge",
        "multiattack", "sneak_attack", "smite", "rage", "revivify",
      ]);
      const encounterTypes = new Set(["combat", "trap", "puzzle", "treasure", "social", "arcane"]);
      // Should contain at least one event-kind key, not encounter-type keys
      expect(keys.some((k) => validEventKinds.has(k))).toBe(true);
      expect(keys.every((k) => !encounterTypes.has(k))).toBe(true);
    }
  });
});
