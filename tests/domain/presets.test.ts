import { describe, it, expect } from "vitest";
import { applyPreset, PRESETS } from "domain/presets";
import { DEFAULT_LEAGUE_SETTINGS } from "domain/types";

describe("presets", () => {
  it("PRESETS contains all 5 named presets", () => {
    expect(Object.keys(PRESETS).sort()).toEqual(
      ["champions", "epic", "quick", "standard", "veterans"],
    );
  });

  it("standard preset matches DEFAULT_LEAGUE_SETTINGS", () => {
    const s = applyPreset("standard");
    expect(s.startingLevel).toBe(3);
    expect(s.targetLevel).toBe(13);
    expect(s.seasonWeeks).toBe(10);
    expect(s.playoffWeeks).toBe(3);
    expect(s.scoutingRuns).toBe(5);
    expect(s.characterPool).toBe(48);
    expect(s.xpEnabled).toBe(true);
  });

  it("quick preset is short and shallow", () => {
    const s = applyPreset("quick");
    expect(s.targetLevel).toBe(9);
    expect(s.seasonWeeks).toBe(5);
    expect(s.playoffWeeks).toBe(2);
    expect(s.scoutingRuns).toBe(3);
  });

  it("epic preset is long and deep", () => {
    const s = applyPreset("epic");
    expect(s.targetLevel).toBe(20);
    expect(s.seasonWeeks).toBe(20);
    expect(s.playoffWeeks).toBe(4);
  });

  it("champions preset starts at level 20 with xp disabled", () => {
    const s = applyPreset("champions");
    expect(s.startingLevel).toBe(20);
    expect(s.xpEnabled).toBe(false);
    expect(s.characterPool).toBe(72);
    expect(s.scoutingRuns).toBe(15);
  });

  it("veterans preset starts at level 5", () => {
    const s = applyPreset("veterans");
    expect(s.startingLevel).toBe(5);
    expect(s.targetLevel).toBe(16);
    expect(s.scoutingRuns).toBe(15);
  });

  it("applyPreset preserves other defaults", () => {
    const s = applyPreset("standard");
    expect(s.teamCount).toBe(DEFAULT_LEAGUE_SETTINGS.teamCount);
    expect(s.rosterSize).toBe(DEFAULT_LEAGUE_SETTINGS.rosterSize);
    expect(s.activeSize).toBe(DEFAULT_LEAGUE_SETTINGS.activeSize);
  });
});
