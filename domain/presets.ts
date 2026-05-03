import { DEFAULT_LEAGUE_SETTINGS, type LeagueSettings, type PresetName } from "./types";

type PresetOverride = Partial<LeagueSettings>;

export const PRESETS: Record<PresetName, PresetOverride> = {
  standard: {
    preset: "standard",
    startingLevel: 3,
    targetLevel: 13,
    seasonWeeks: 10,
    playoffWeeks: 3,
    scoutingRuns: 5,
    characterPool: 48,
    xpEnabled: true,
  },
  quick: {
    preset: "quick",
    startingLevel: 3,
    targetLevel: 9,
    seasonWeeks: 5,
    playoffWeeks: 2,
    scoutingRuns: 3,
    characterPool: 48,
    xpEnabled: true,
  },
  epic: {
    preset: "epic",
    startingLevel: 3,
    targetLevel: 20,
    seasonWeeks: 20,
    playoffWeeks: 4,
    scoutingRuns: 5,
    characterPool: 48,
    xpEnabled: true,
  },
  champions: {
    preset: "champions",
    startingLevel: 20,
    targetLevel: 20,
    seasonWeeks: 10,
    playoffWeeks: 3,
    scoutingRuns: 15,
    characterPool: 72,
    xpEnabled: false,
  },
  veterans: {
    preset: "veterans",
    startingLevel: 5,
    targetLevel: 16,
    seasonWeeks: 12,
    playoffWeeks: 3,
    scoutingRuns: 15,
    characterPool: 48,
    xpEnabled: true,
  },
};

export function applyPreset(
  name: PresetName,
  overrides: Partial<LeagueSettings> = {},
): LeagueSettings {
  return {
    ...DEFAULT_LEAGUE_SETTINGS,
    ...PRESETS[name],
    ...overrides,
  };
}
