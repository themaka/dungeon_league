import type { Character, Dungeon } from "domain/types";
import type { Rng } from "domain/rng";

export interface ContentSource {
  generateCharacters(count: number, rng: Rng): Character[];
  generateDungeon(week: number, matchupIndex: number, rng: Rng): Dungeon;
  getHighlightTemplates(): HighlightTemplateBundle;
}

export interface HighlightTemplateBundle {
  hit: string[];
  kill: string[];
  crit: string[];
  heal: string[];
  ko: string[];
  death: string[];
  disarm_trap: string[];
  find_treasure: string[];
  save_pass: string[];
  save_fail: string[];
  milestone: Record<string, string[]>;
}
