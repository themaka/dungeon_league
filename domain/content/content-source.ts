import type { Character, Dungeon, EncounterCount, LeagueSettings } from "domain/types";
import type { Rng } from "domain/rng";

export interface ContentSource {
  generateCharacters(count: number, rng: Rng, settings: LeagueSettings): Character[];
  generateDungeon(
    week: number,
    matchupIndex: number,
    rng: Rng,
    theme: string,
    encounterCount: EncounterCount,
  ): Dungeon;
  getHighlightTemplates(): HighlightTemplateBundle;
}

export interface HighlightTemplateBundle {
  hit: string[]; kill: string[]; crit: string[]; heal: string[];
  ko: string[]; death: string[];
  disarm_trap: string[]; find_treasure: string[];
  save_pass: string[]; save_fail: string[];
  buff: string[]; buff_proc: string[]; block: string[]; taunt: string[];
  persuade: string[]; deceive: string[]; intimidate: string[];
  dispel: string[]; channel: string[]; arcane_surge: string[];
  multiattack: string[]; sneak_attack: string[]; smite: string[]; rage: string[]; revivify: string[];
  milestone: Record<string, string[]>;
}
