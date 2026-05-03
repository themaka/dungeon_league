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
});
