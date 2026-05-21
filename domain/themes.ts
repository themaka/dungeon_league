import type { EncounterType } from "./types";
import type { Rng } from "./rng";

export type DungeonTheme =
  | "undead" | "fire" | "shadow" | "arcane" | "demonic"
  | "nature" | "mechanical" | "aquatic" | "draconic" | "ice";

export const ALL_THEMES: DungeonTheme[] = [
  "undead", "fire", "shadow", "arcane", "demonic",
  "nature", "mechanical", "aquatic", "draconic", "ice",
];

export type EncounterWeights = Record<EncounterType, number>;

export const THEME_ENCOUNTER_MIX: Record<DungeonTheme, EncounterWeights> = {
  undead:     { combat: 40, trap: 15, puzzle: 10, treasure: 15, social: 5,  arcane: 15 },
  fire:       { combat: 45, trap: 20, puzzle: 5,  treasure: 15, social: 5,  arcane: 10 },
  shadow:     { combat: 30, trap: 15, puzzle: 10, treasure: 10, social: 10, arcane: 25 },
  arcane:     { combat: 20, trap: 10, puzzle: 15, treasure: 10, social: 10, arcane: 35 },
  demonic:    { combat: 40, trap: 10, puzzle: 5,  treasure: 10, social: 15, arcane: 20 },
  nature:     { combat: 25, trap: 20, puzzle: 15, treasure: 20, social: 10, arcane: 10 },
  mechanical: { combat: 25, trap: 30, puzzle: 20, treasure: 15, social: 5,  arcane: 5  },
  aquatic:    { combat: 30, trap: 20, puzzle: 10, treasure: 20, social: 5,  arcane: 15 },
  draconic:   { combat: 40, trap: 10, puzzle: 10, treasure: 20, social: 10, arcane: 10 },
  ice:        { combat: 35, trap: 20, puzzle: 10, treasure: 15, social: 5,  arcane: 15 },
};

export function pickEncounterType(theme: string, rng: Rng): EncounterType {
  const mix = THEME_ENCOUNTER_MIX[theme as DungeonTheme] ?? THEME_ENCOUNTER_MIX.undead;
  const roll = rng.next() * 100;
  let acc = 0;
  const order: EncounterType[] = ["combat", "trap", "puzzle", "treasure", "social", "arcane"];
  for (const type of order) {
    acc += mix[type];
    if (roll < acc) return type;
  }
  return "combat";
}
