export type Role = "Tank" | "Healer" | "DPS" | "Utility";

export type Race =
  | "Human" | "Elf" | "Dwarf" | "Halfling"
  | "Orc" | "Gnome" | "Tiefling" | "Dragonborn";

export type CharacterClass =
  | "Fighter" | "Wizard" | "Rogue" | "Cleric"
  | "Ranger" | "Paladin" | "Barbarian" | "Bard"
  | "Druid" | "Warlock" | "Monk" | "Sorcerer";

export type Specialty =
  | "Battle Master" | "Champion"
  | "Evoker" | "War Mage"
  | "Assassin" | "Thief"
  | "Life Domain" | "War Domain"
  | "Hunter" | "Gloom Stalker"
  | "Devotion" | "Vengeance"
  | "Berserker" | "Totem Warrior"
  | "Lore" | "Swords"
  | "Shepherd" | "Wildfire"
  | "Fiend" | "Hexblade"
  | "Open Hand" | "Shadow"
  | "Draconic" | "Wild Magic";

export interface Stats {
  str: number; dex: number; con: number;
  int: number; wis: number; cha: number;
}

export interface Character {
  id: string;
  name: string;
  race: Race;
  class: CharacterClass;
  role: Role;
  specialty: Specialty;
  stats: Stats;
  level: number;
  xp: number;
  abilityTiers: number[];
  description: string;
}

export interface Lineup {
  active: [string, string, string, string];
  bench: [string, string];
}

export interface Team {
  id: string;
  name: string;
  leagueId: string;
  managerId: string;
  managerType: "human" | "ai";
  roster: string[];
  lineup: Lineup;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface AIPersonality {
  name: string;
  priorityRoles: Role[];
  aggression: number;
  seed: number;
}

export type EncounterType = "combat" | "trap" | "puzzle" | "treasure" | "social" | "arcane";

export interface Encounter {
  id: string;
  type: EncounterType;
  name: string;
  difficulty: number;
  targetStats: (keyof Stats)[];
  isBoss: boolean;
}

export interface Dungeon {
  id: string;
  name: string;
  theme: string;
  encounters: Encounter[];
}

export type EventKind =
  | "hit" | "kill" | "crit"
  | "heal" | "damage_taken"
  | "save_pass" | "save_fail"
  | "disarm_trap" | "find_treasure"
  | "ko" | "death"
  | "buff" | "buff_proc"
  | "block" | "taunt"
  | "persuade" | "deceive" | "intimidate"
  | "dispel" | "channel" | "arcane_surge"
  | "multiattack" | "sneak_attack" | "smite" | "rage" | "revivify";

export interface SimEvent {
  kind: EventKind;
  encounterId: string;
  actorId: string;
  targetId?: string;
  amount?: number;
  crit?: boolean;
  meta?: Record<string, unknown>;
}

export type MilestoneKind =
  | "mvp_of_run" | "clutch_survivor" | "first_blood"
  | "boss_killer" | "flawless_run" | "total_party_wipe"
  | "revivify_save";

export interface Milestone {
  kind: MilestoneKind;
  actorId?: string;
}

export interface CharacterScore {
  characterId: string;
  basePoints: number;
  roleMultiplierPoints: number;
  specialtyBonusPoints: number;
  milestonePoints: number;
  totalPoints: number;
}

export interface ScoreResult {
  perCharacter: Map<string, CharacterScore>;
  milestones: Milestone[];
  teamTotal: number;
}

export interface DungeonRun {
  teamId: string;
  dungeonId: string;
  events: SimEvent[];
  score: ScoreResult;
  highlights: Highlight[];
}

export interface Highlight {
  kind: string;
  actorIds: string[];
  description: string;
  importance: "high" | "medium" | "low";
  points?: number;
}

export interface Matchup {
  id: string;
  week: number;
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
  dungeonId: string;
  homeRun?: DungeonRun;
  awayRun?: DungeonRun;
  winnerId?: string;
}

export type LeaguePhase = "draft" | "regular" | "playoffs" | "complete";

export type ScoutingVisibility = "full" | "partial" | "hidden";
export type DraftFormat = "snake" | "auction";
export type EncounterCount = "3-5" | "5-8" | "7-10";
export type PresetName = "standard" | "quick" | "epic" | "champions" | "veterans";

export interface ScoutingReport {
  characterId: string;
  runs: number;
  avgPoints: number;
  pointsByEventType: Record<string, number>;
  bestEncounterType: EncounterType;
  worstEncounterType: EncounterType;
  specialtyProcRate: number;
  consistencyScore: number;
  projectedValue: number;
}

export interface League {
  id: string;
  name: string;
  phase: LeaguePhase;
  currentWeek: number;
  teams: string[];
  characterPool: string[];
  settings: LeagueSettings;
  scoutingReports?: Record<string, ScoutingReport>;
}

export interface LeagueSettings {
  teamCount: number;
  rosterSize: number;
  activeSize: number;
  seasonWeeks: number;
  playoffWeeks: number;
  playoffTeams: number;
  draftFormat: DraftFormat;
  contentSource: "procedural";
  scoutingRuns: number;
  scoutingVisibility: ScoutingVisibility;
  startingLevel: number;
  targetLevel: number;
  maxLevel: number;
  encounterCount: EncounterCount;
  characterPool: number;
  xpEnabled: boolean;
  preset: PresetName;
}

export const DEFAULT_LEAGUE_SETTINGS: LeagueSettings = {
  teamCount: 6,
  rosterSize: 6,
  activeSize: 4,
  seasonWeeks: 10,
  playoffWeeks: 3,
  playoffTeams: 4,
  draftFormat: "snake",
  contentSource: "procedural",
  scoutingRuns: 5,
  scoutingVisibility: "full",
  startingLevel: 3,
  targetLevel: 13,
  maxLevel: 20,
  encounterCount: "5-8",
  characterPool: 48,
  xpEnabled: true,
  preset: "standard",
};

export const CLASS_ROLE_MAP: Record<CharacterClass, Role> = {
  Fighter: "DPS", Wizard: "DPS", Rogue: "Utility", Cleric: "Healer",
  Ranger: "DPS", Paladin: "Tank", Barbarian: "Tank", Bard: "Utility",
  Druid: "Healer", Warlock: "DPS", Monk: "DPS", Sorcerer: "DPS",
};
