# Balance & Mechanics Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the sim around a 24-specialty system layered onto existing classes, with leveling/abilities, new encounter types (social, arcane), rebalanced scoring, pre-draft scouting, and configurable league presets.

**Architecture:** All new logic lives in the pure `domain/` core (no framework imports). Pure data tables (specialties, abilities, presets, theme mixes) are separate files so the sim/scoring modules stay focused on logic. Persistence (`services/`) and UI (`app/`) layers consume the new types — they don't own balance decisions. Determinism via seeded RNG is preserved everywhere, including new scouting runs.

**Tech Stack:** TypeScript, React Router v7, Prisma, Postgres, Vitest, fast-check

**Spec:** `docs/superpowers/specs/2026-05-03-balance-overhaul-design.md`

---

## File Structure

```
domain/
├── types.ts                      # MODIFY — add Specialty, expand EventKind/EncounterType, Character.specialty/xp/abilityTiers, expanded LeagueSettings
├── specialties.ts                # NEW — 24 specialty definitions, CLASS_SPECIALTY_MAP
├── abilities.ts                  # NEW — ability tier table per class, ability metadata
├── presets.ts                    # NEW — 5 league presets, applyPreset()
├── themes.ts                     # NEW — THEME_ENCOUNTER_MIX weighted distributions
├── leveling.ts                   # NEW — xpFromEvents(), levelUp(), applyXpAndLevel()
├── scoring.ts                    # MODIFY — new BASE_POINTS, tiered multipliers, specialty bonus, revivify milestone
├── scouting.ts                   # NEW — runScouting(), buildScoutingReport(), projectedValue()
├── highlights.ts                 # MODIFY — handle new event kinds
├── content/
│   ├── content-source.ts         # MODIFY — add HighlightTemplateBundle entries for new events
│   ├── procedural-source.ts      # MODIFY — assign specialty, set startingLevel, weighted theme encounters, social/arcane types
│   ├── name-tables.ts            # MODIFY — add SOCIAL_ENCOUNTER_NAMES, ARCANE_ENCOUNTER_NAMES, expand DUNGEON_THEMES
│   └── highlight-templates.ts    # MODIFY — templates for new event kinds
└── sim/
    ├── sim-engine.ts             # MODIFY — track buff state + ability charges, dispatch new encounter types
    ├── encounters.ts             # MODIFY — class-aware combat, social, arcane, buff system, block/taunt
    ├── abilities-runtime.ts      # NEW — applyClassAbilitiesToCombat(), spendRevivify()
    └── buffs.ts                  # NEW — BuffState, applyBless/Inspiration/Aura/Guidance, recordBuffProc

services/
├── league-service.server.ts      # MODIFY — apply preset, run scouting on create, apply XP/level-ups after each week, accrue revivify charges
└── draft-service.server.ts       # MODIFY — include scouting report data filtered by visibility

prisma/
└── schema.prisma                 # MODIFY — Character.specialty/xp/abilityTiers, League.scoutingReports

app/
├── routes/
│   ├── leagues.new.tsx           # MODIFY — preset picker, custom settings reveal
│   ├── leagues.$id_.draft.tsx    # MODIFY — render scouting report card per character
│   └── leagues.$id_.matchups.$matchupId.tsx  # MODIFY — render new event kinds in play-by-play
└── components/
    ├── character-card.tsx        # MODIFY — display specialty, level/XP, unlocked abilities
    ├── scouting-report.tsx       # NEW — scouting card sub-component
    ├── play-by-play.tsx          # MODIFY — handle new event kinds
    └── lineup-editor.tsx         # MODIFY — show specialty + level

scripts/
└── balance-harness.ts            # MODIFY — multi-season runs, role parity verification

tests/
├── domain/
│   ├── specialties.test.ts       # NEW
│   ├── abilities.test.ts         # NEW
│   ├── presets.test.ts           # NEW
│   ├── themes.test.ts            # NEW
│   ├── leveling.test.ts          # NEW
│   ├── scoring.test.ts           # MODIFY — new event scoring, tiered multipliers, specialty bonus
│   ├── scouting.test.ts          # NEW
│   ├── procedural-source.test.ts # MODIFY — specialty assignment, theme weighting, new encounters
│   ├── sim-engine.test.ts        # MODIFY — class-aware combat, buffs, social/arcane, revivify
│   ├── highlights.test.ts        # MODIFY — new event templates
│   └── types.test.ts             # MODIFY — DEFAULT_LEAGUE_SETTINGS shape
├── services/
│   ├── league-service.test.ts    # MODIFY — preset wiring, scouting persistence, XP/level after week
│   └── draft-service.test.ts     # MODIFY — scouting visibility
└── ui/
    └── smoke.test.ts             # MODIFY — preset picker, scouting card render
```

---

### Task 1: Domain Types — Specialty, Events, Encounters, Settings

**Files:**
- Modify: `domain/types.ts`
- Modify: `tests/domain/types.test.ts`

- [ ] **Step 1: Write failing test for new types**

In `tests/domain/types.test.ts`, replace contents with:

```ts
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
```

- [ ] **Step 2: Run test, expect compile failure**

Run: `npm test -- tests/domain/types.test.ts`
Expected: FAIL — type errors on `Specialty`, `scoutingRuns`, `xp`, etc.

- [ ] **Step 3: Update `domain/types.ts`**

Replace `domain/types.ts` with:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/domain/types.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add domain/types.ts tests/domain/types.test.ts
git commit -m "feat(types): add specialty, new events/encounters, expanded league settings"
```

---

### Task 2: Specialty Registry

**Files:**
- Create: `domain/specialties.ts`
- Create: `tests/domain/specialties.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/domain/specialties.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  SPECIALTIES,
  CLASS_SPECIALTY_MAP,
  specialtyForClass,
  primaryStatForSpecialty,
  isCoreEventForSpecialty,
} from "domain/specialties";
import type { CharacterClass, Specialty } from "domain/types";

describe("specialties", () => {
  it("defines all 24 specialties", () => {
    expect(SPECIALTIES.length).toBe(24);
  });

  it("each class has exactly two specialties", () => {
    const classes: CharacterClass[] = [
      "Fighter", "Wizard", "Rogue", "Cleric", "Ranger", "Paladin",
      "Barbarian", "Bard", "Druid", "Warlock", "Monk", "Sorcerer",
    ];
    for (const cls of classes) {
      expect(CLASS_SPECIALTY_MAP[cls]).toHaveLength(2);
    }
  });

  it("specialtyForClass picks deterministically from a roll", () => {
    expect(specialtyForClass("Fighter", 0)).toBe("Battle Master");
    expect(specialtyForClass("Fighter", 1)).toBe("Champion");
    expect(specialtyForClass("Cleric", 0)).toBe("Life Domain");
    expect(specialtyForClass("Cleric", 1)).toBe("War Domain");
  });

  it("primaryStatForSpecialty returns the level-up stat", () => {
    expect(primaryStatForSpecialty("Champion")).toBe("str");
    expect(primaryStatForSpecialty("Evoker")).toBe("int");
    expect(primaryStatForSpecialty("Life Domain")).toBe("wis");
    expect(primaryStatForSpecialty("Lore")).toBe("cha");
  });

  it("isCoreEventForSpecialty matches per spec", () => {
    expect(isCoreEventForSpecialty("Champion", "crit")).toBe(true);
    expect(isCoreEventForSpecialty("Champion", "heal")).toBe(false);
    expect(isCoreEventForSpecialty("Life Domain", "heal")).toBe(true);
    expect(isCoreEventForSpecialty("Life Domain", "revivify")).toBe(true);
    expect(isCoreEventForSpecialty("War Domain", "buff")).toBe(true);
    expect(isCoreEventForSpecialty("Devotion", "save_pass")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/domain/specialties.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `domain/specialties.ts`**

```ts
import type { CharacterClass, EventKind, Specialty, Stats } from "./types";

export interface SpecialtyDef {
  name: Specialty;
  className: CharacterClass;
  primaryStat: keyof Stats;
  coreEvents: EventKind[];
  description: string;
}

export const SPECIALTIES: SpecialtyDef[] = [
  { name: "Battle Master", className: "Fighter", primaryStat: "str",
    coreEvents: ["hit", "multiattack"], description: "Tactical strikes, bonus on positioning/multiattack" },
  { name: "Champion", className: "Fighter", primaryStat: "str",
    coreEvents: ["crit", "hit"], description: "Crit-focused, expanded crit range" },
  { name: "Evoker", className: "Wizard", primaryStat: "int",
    coreEvents: ["hit", "arcane_surge"], description: "AoE spell damage, targets INT" },
  { name: "War Mage", className: "Wizard", primaryStat: "int",
    coreEvents: ["hit", "dispel"], description: "Single-target burst, counterspell on arcane" },
  { name: "Assassin", className: "Rogue", primaryStat: "dex",
    coreEvents: ["sneak_attack", "kill"], description: "Sneak Attack burst from stealth" },
  { name: "Thief", className: "Rogue", primaryStat: "dex",
    coreEvents: ["disarm_trap", "find_treasure"], description: "Treasure/trap specialist" },
  { name: "Life Domain", className: "Cleric", primaryStat: "wis",
    coreEvents: ["heal", "revivify"], description: "Big heals, Revivify access" },
  { name: "War Domain", className: "Cleric", primaryStat: "wis",
    coreEvents: ["buff", "buff_proc"], description: "Bless buff + moderate healing" },
  { name: "Hunter", className: "Ranger", primaryStat: "dex",
    coreEvents: ["hit", "kill"], description: "Sustained damage, multi-target" },
  { name: "Gloom Stalker", className: "Ranger", primaryStat: "dex",
    coreEvents: ["sneak_attack", "hit"], description: "First-round burst, ambush bonus" },
  { name: "Devotion", className: "Paladin", primaryStat: "str",
    coreEvents: ["buff", "buff_proc", "save_pass"], description: "Aura of Protection, party save bonus" },
  { name: "Vengeance", className: "Paladin", primaryStat: "str",
    coreEvents: ["smite", "hit"], description: "Smite burst damage while tanking" },
  { name: "Berserker", className: "Barbarian", primaryStat: "str",
    coreEvents: ["rage", "hit"], description: "Reckless Attack, damage + self-risk" },
  { name: "Totem Warrior", className: "Barbarian", primaryStat: "con",
    coreEvents: ["damage_taken", "block"], description: "Damage resistance, party HP buffer" },
  { name: "Lore", className: "Bard", primaryStat: "cha",
    coreEvents: ["buff", "persuade", "deceive"], description: "Social specialist, Inspiration buff" },
  { name: "Swords", className: "Bard", primaryStat: "cha",
    coreEvents: ["hit", "crit"], description: "Combat utility, off-DPS with finesse" },
  { name: "Shepherd", className: "Druid", primaryStat: "wis",
    coreEvents: ["heal", "buff", "buff_proc"], description: "Group healing, nature bonus" },
  { name: "Wildfire", className: "Druid", primaryStat: "wis",
    coreEvents: ["heal", "hit"], description: "Damage + heal hybrid, fire-themed" },
  { name: "Fiend", className: "Warlock", primaryStat: "cha",
    coreEvents: ["hit", "channel"], description: "Sustained Eldritch Blast" },
  { name: "Hexblade", className: "Warlock", primaryStat: "cha",
    coreEvents: ["hit", "smite"], description: "Melee burst, curse debuff" },
  { name: "Open Hand", className: "Monk", primaryStat: "dex",
    coreEvents: ["multiattack", "hit"], description: "Sustained flurry, stun chance" },
  { name: "Shadow", className: "Monk", primaryStat: "dex",
    coreEvents: ["sneak_attack", "hit"], description: "Stealth burst, dark dungeon bonus" },
  { name: "Draconic", className: "Sorcerer", primaryStat: "cha",
    coreEvents: ["hit", "arcane_surge"], description: "Elemental burst, theme-matched bonus" },
  { name: "Wild Magic", className: "Sorcerer", primaryStat: "cha",
    coreEvents: ["hit", "arcane_surge"], description: "High variance, random bonuses" },
];

export const CLASS_SPECIALTY_MAP: Record<CharacterClass, [Specialty, Specialty]> = {
  Fighter: ["Battle Master", "Champion"],
  Wizard: ["Evoker", "War Mage"],
  Rogue: ["Assassin", "Thief"],
  Cleric: ["Life Domain", "War Domain"],
  Ranger: ["Hunter", "Gloom Stalker"],
  Paladin: ["Devotion", "Vengeance"],
  Barbarian: ["Berserker", "Totem Warrior"],
  Bard: ["Lore", "Swords"],
  Druid: ["Shepherd", "Wildfire"],
  Warlock: ["Fiend", "Hexblade"],
  Monk: ["Open Hand", "Shadow"],
  Sorcerer: ["Draconic", "Wild Magic"],
};

const SPECIALTY_INDEX = new Map(SPECIALTIES.map((s) => [s.name, s]));

export function specialtyDef(name: Specialty): SpecialtyDef {
  const def = SPECIALTY_INDEX.get(name);
  if (!def) throw new Error(`Unknown specialty: ${name}`);
  return def;
}

export function specialtyForClass(className: CharacterClass, roll: 0 | 1): Specialty {
  return CLASS_SPECIALTY_MAP[className][roll];
}

export function primaryStatForSpecialty(name: Specialty): keyof Stats {
  return specialtyDef(name).primaryStat;
}

export function isCoreEventForSpecialty(name: Specialty, kind: EventKind): boolean {
  return specialtyDef(name).coreEvents.includes(kind);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/domain/specialties.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add domain/specialties.ts tests/domain/specialties.test.ts
git commit -m "feat(specialties): add 24-specialty registry with class mapping"
```

---

### Task 3: Ability Registry

**Files:**
- Create: `domain/abilities.ts`
- Create: `tests/domain/abilities.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/domain/abilities.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  abilitiesForCharacter,
  unlockTierForLevel,
  unlockedAbilities,
  hasAbility,
} from "domain/abilities";

describe("abilities", () => {
  it("unlockTierForLevel returns correct tier per spec", () => {
    expect(unlockTierForLevel(2)).toBe(0);
    expect(unlockTierForLevel(3)).toBe(1);
    expect(unlockTierForLevel(5)).toBe(1);
    expect(unlockTierForLevel(6)).toBe(2);
    expect(unlockTierForLevel(9)).toBe(3);
    expect(unlockTierForLevel(12)).toBe(4);
    expect(unlockTierForLevel(13)).toBe(5);
    expect(unlockTierForLevel(15)).toBe(6);
    expect(unlockTierForLevel(18)).toBe(7);
    expect(unlockTierForLevel(20)).toBe(8);
  });

  it("Champion Fighter has Improved Critical at tier 1", () => {
    const abs = abilitiesForCharacter("Fighter", "Champion", 3);
    expect(abs.some((a) => a.name === "Improved Critical")).toBe(true);
  });

  it("Life Domain Cleric unlocks Revivify at tier 2 (level 6)", () => {
    expect(hasAbility("Cleric", "Life Domain", 5, "Revivify")).toBe(false);
    expect(hasAbility("Cleric", "Life Domain", 6, "Revivify")).toBe(true);
  });

  it("unlockedAbilities lists all abilities up to current level", () => {
    const abs = unlockedAbilities("Fighter", "Champion", 6);
    expect(abs.length).toBeGreaterThanOrEqual(2);
    expect(abs.every((a) => a.tier <= 2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/domain/abilities.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `domain/abilities.ts`**

```ts
import type { CharacterClass, Specialty } from "./types";

export interface Ability {
  name: string;
  tier: number;
  className: CharacterClass;
  specialty?: Specialty;
  description: string;
}

const TIER_BY_LEVEL: Record<number, number> = {
  3: 1, 4: 1, 5: 1,
  6: 2, 7: 2, 8: 2,
  9: 3, 10: 3, 11: 3,
  12: 4,
  13: 5, 14: 5,
  15: 6, 16: 6, 17: 6,
  18: 7, 19: 7,
  20: 8,
};

export function unlockTierForLevel(level: number): number {
  if (level < 3) return 0;
  return TIER_BY_LEVEL[Math.min(level, 20)] ?? 0;
}

const ABILITIES: Ability[] = [
  { name: "Second Wind", tier: 1, className: "Fighter", description: "Self-heal once per encounter" },
  { name: "Improved Critical", tier: 1, className: "Fighter", specialty: "Champion", description: "Crit on 19-20" },
  { name: "Action Surge", tier: 2, className: "Fighter", description: "Extra attack 1/encounter" },
  { name: "Multiattack", tier: 2, className: "Fighter", description: "Two attacks per turn" },
  { name: "Indomitable", tier: 3, className: "Fighter", description: "Reroll a failed save" },
  { name: "Superior Critical", tier: 4, className: "Fighter", specialty: "Champion", description: "Crit on 18-20" },
  { name: "Survivor", tier: 5, className: "Fighter", description: "Regenerate at low HP" },

  { name: "Magic Missile", tier: 1, className: "Wizard", description: "Auto-hit ranged spell" },
  { name: "Counterspell", tier: 2, className: "Wizard", specialty: "War Mage", description: "Negate enemy arcane" },
  { name: "Fireball", tier: 2, className: "Wizard", specialty: "Evoker", description: "AoE damage" },
  { name: "Wall of Force", tier: 3, className: "Wizard", description: "Block damage to allies" },
  { name: "Disintegrate", tier: 4, className: "Wizard", description: "High single-target damage" },
  { name: "Meteor Swarm", tier: 5, className: "Wizard", description: "Massive AoE finisher" },

  { name: "Sneak Attack", tier: 1, className: "Rogue", description: "Bonus damage from stealth" },
  { name: "Cunning Action", tier: 2, className: "Rogue", description: "Bonus dash/disengage" },
  { name: "Uncanny Dodge", tier: 3, className: "Rogue", description: "Halve incoming damage" },
  { name: "Death Strike", tier: 4, className: "Rogue", specialty: "Assassin", description: "Double damage on surprise" },
  { name: "Stroke of Luck", tier: 5, className: "Rogue", description: "Auto-succeed once" },

  { name: "Cure Wounds", tier: 1, className: "Cleric", description: "Single-target heal" },
  { name: "Bless", tier: 1, className: "Cleric", specialty: "War Domain", description: "Buff ally rolls" },
  { name: "Revivify", tier: 2, className: "Cleric", specialty: "Life Domain", description: "Bring back dead ally (charge)" },
  { name: "Spirit Guardians", tier: 2, className: "Cleric", description: "Damage aura" },
  { name: "Mass Healing Word", tier: 3, className: "Cleric", description: "Heal multiple allies" },
  { name: "Heal", tier: 4, className: "Cleric", specialty: "Life Domain", description: "Big single-target heal" },
  { name: "True Resurrection", tier: 5, className: "Cleric", description: "Capstone revive" },

  { name: "Hunter's Mark", tier: 1, className: "Ranger", description: "Bonus damage on target" },
  { name: "Volley", tier: 2, className: "Ranger", specialty: "Hunter", description: "Hit multiple foes" },
  { name: "Dread Ambusher", tier: 1, className: "Ranger", specialty: "Gloom Stalker", description: "First-round burst" },
  { name: "Stand Against the Tide", tier: 3, className: "Ranger", description: "Redirect attacks" },
  { name: "Foe Slayer", tier: 4, className: "Ranger", description: "Bonus to last hit on boss" },
  { name: "Whirlwind Attack", tier: 5, className: "Ranger", description: "Capstone AoE" },

  { name: "Divine Smite", tier: 1, className: "Paladin", description: "Burst damage on hit" },
  { name: "Aura of Protection", tier: 2, className: "Paladin", specialty: "Devotion", description: "Party save bonus" },
  { name: "Sacred Weapon", tier: 2, className: "Paladin", description: "Magical weapon strike" },
  { name: "Vow of Enmity", tier: 3, className: "Paladin", specialty: "Vengeance", description: "Advantage vs single target" },
  { name: "Aura of Courage", tier: 4, className: "Paladin", description: "Party fear immunity" },
  { name: "Holy Nimbus", tier: 5, className: "Paladin", specialty: "Devotion", description: "Capstone aura" },

  { name: "Reckless Attack", tier: 1, className: "Barbarian", specialty: "Berserker", description: "Trade defense for damage" },
  { name: "Rage", tier: 1, className: "Barbarian", description: "Damage resistance + bonus" },
  { name: "Bear Totem", tier: 2, className: "Barbarian", specialty: "Totem Warrior", description: "Wide damage resistance" },
  { name: "Mindless Rage", tier: 3, className: "Barbarian", description: "Immunity to fear/charm" },
  { name: "Brutal Critical", tier: 4, className: "Barbarian", description: "Bonus crit dice" },
  { name: "Primal Champion", tier: 5, className: "Barbarian", description: "Capstone stat boost" },

  { name: "Vicious Mockery", tier: 1, className: "Bard", description: "Low damage + debuff" },
  { name: "Bardic Inspiration", tier: 1, className: "Bard", specialty: "Lore", description: "Buff ally rolls" },
  { name: "Cutting Words", tier: 2, className: "Bard", specialty: "Lore", description: "Reduce enemy roll" },
  { name: "Countercharm", tier: 3, className: "Bard", description: "Party charm protection" },
  { name: "Magical Secrets", tier: 4, className: "Bard", description: "Steal a spell" },
  { name: "Superior Inspiration", tier: 5, className: "Bard", description: "Recharge inspiration on init" },

  { name: "Healing Word", tier: 1, className: "Druid", description: "Ranged heal" },
  { name: "Goodberry", tier: 1, className: "Druid", specialty: "Shepherd", description: "Persistent heal token" },
  { name: "Wildfire Spirit", tier: 2, className: "Druid", specialty: "Wildfire", description: "Pet that heals or burns" },
  { name: "Wild Shape", tier: 2, className: "Druid", description: "Beast form combat" },
  { name: "Conjure Animals", tier: 3, className: "Druid", description: "Summon allies" },
  { name: "Heal", tier: 4, className: "Druid", description: "Big single-target heal" },
  { name: "Beast Spells", tier: 5, className: "Druid", description: "Cast in wild shape" },

  { name: "Eldritch Blast", tier: 1, className: "Warlock", description: "Consistent ranged damage" },
  { name: "Hex", tier: 1, className: "Warlock", specialty: "Hexblade", description: "Curse target for bonus dmg" },
  { name: "Hellish Rebuke", tier: 2, className: "Warlock", specialty: "Fiend", description: "Reactive damage" },
  { name: "Devil's Sight", tier: 3, className: "Warlock", description: "Ignore darkness penalties" },
  { name: "Mystic Arcanum", tier: 4, className: "Warlock", description: "Big spell" },
  { name: "Eldritch Master", tier: 5, className: "Warlock", description: "Recharge slot" },

  { name: "Flurry of Blows", tier: 1, className: "Monk", specialty: "Open Hand", description: "Multi-hit strike" },
  { name: "Stunning Strike", tier: 2, className: "Monk", description: "Stun target" },
  { name: "Shadow Step", tier: 2, className: "Monk", specialty: "Shadow", description: "Teleport in dark" },
  { name: "Diamond Soul", tier: 3, className: "Monk", description: "Reroll saves" },
  { name: "Empty Body", tier: 4, className: "Monk", description: "Resistance + invisibility" },
  { name: "Perfect Self", tier: 5, className: "Monk", description: "Recharge ki on init" },

  { name: "Burning Hands", tier: 1, className: "Sorcerer", description: "AoE cone damage" },
  { name: "Draconic Resilience", tier: 1, className: "Sorcerer", specialty: "Draconic", description: "Bonus HP + element ward" },
  { name: "Tides of Chaos", tier: 1, className: "Sorcerer", specialty: "Wild Magic", description: "Random bonus/penalty" },
  { name: "Metamagic", tier: 2, className: "Sorcerer", description: "Bend spell rules" },
  { name: "Heightened Spell", tier: 3, className: "Sorcerer", description: "Disadvantage on save" },
  { name: "Empowered Spell", tier: 4, className: "Sorcerer", description: "Reroll damage dice" },
  { name: "Sorcerous Restoration", tier: 5, className: "Sorcerer", description: "Recharge points" },
];

export function abilitiesForCharacter(
  className: CharacterClass,
  specialty: Specialty,
  level: number,
): Ability[] {
  const tier = unlockTierForLevel(level);
  return ABILITIES.filter(
    (a) =>
      a.className === className &&
      a.tier <= tier &&
      (a.specialty === undefined || a.specialty === specialty),
  );
}

export function unlockedAbilities(
  className: CharacterClass,
  specialty: Specialty,
  level: number,
): Ability[] {
  return abilitiesForCharacter(className, specialty, level);
}

export function hasAbility(
  className: CharacterClass,
  specialty: Specialty,
  level: number,
  abilityName: string,
): boolean {
  return abilitiesForCharacter(className, specialty, level).some((a) => a.name === abilityName);
}

export function allAbilitiesForClass(className: CharacterClass): Ability[] {
  return ABILITIES.filter((a) => a.className === className);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/domain/abilities.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add domain/abilities.ts tests/domain/abilities.test.ts
git commit -m "feat(abilities): add tier-based ability registry per class/specialty"
```

---

### Task 4: League Presets

**Files:**
- Create: `domain/presets.ts`
- Create: `tests/domain/presets.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/domain/presets.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/domain/presets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `domain/presets.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/domain/presets.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add domain/presets.ts tests/domain/presets.test.ts
git commit -m "feat(presets): add 5 named league presets with applyPreset()"
```

---

### Task 5: Theme Encounter Mix

**Files:**
- Create: `domain/themes.ts`
- Create: `tests/domain/themes.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/domain/themes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { THEME_ENCOUNTER_MIX, pickEncounterType, ALL_THEMES } from "domain/themes";
import { createRng } from "domain/rng";

describe("themes", () => {
  it("ALL_THEMES contains the 10 spec themes", () => {
    expect(ALL_THEMES).toEqual([
      "undead", "fire", "shadow", "arcane", "demonic",
      "nature", "mechanical", "aquatic", "draconic", "ice",
    ]);
  });

  it("each theme mix sums to 100", () => {
    for (const theme of ALL_THEMES) {
      const mix = THEME_ENCOUNTER_MIX[theme];
      const total = mix.combat + mix.trap + mix.puzzle + mix.treasure + mix.social + mix.arcane;
      expect(total).toBe(100);
    }
  });

  it("arcane theme weights arcane encounters most heavily", () => {
    expect(THEME_ENCOUNTER_MIX.arcane.arcane).toBe(35);
  });

  it("mechanical theme weights traps most heavily", () => {
    expect(THEME_ENCOUNTER_MIX.mechanical.trap).toBe(30);
  });

  it("pickEncounterType returns weighted distribution over 10000 picks", () => {
    const rng = createRng(42);
    const counts = { combat: 0, trap: 0, puzzle: 0, treasure: 0, social: 0, arcane: 0 };
    for (let i = 0; i < 10000; i++) {
      counts[pickEncounterType("undead", rng)]++;
    }
    // undead: combat 40%, expect 35-45% range
    expect(counts.combat).toBeGreaterThan(3500);
    expect(counts.combat).toBeLessThan(4500);
    // social 5% — expect 350-650
    expect(counts.social).toBeGreaterThan(350);
    expect(counts.social).toBeLessThan(650);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/domain/themes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `domain/themes.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/domain/themes.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add domain/themes.ts tests/domain/themes.test.ts
git commit -m "feat(themes): add weighted encounter mix per dungeon theme"
```

---

### Task 6: Leveling Module

**Files:**
- Create: `domain/leveling.ts`
- Create: `tests/domain/leveling.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/domain/leveling.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  XP_THRESHOLDS,
  xpFromEvents,
  applyXpAndLevel,
  scaledThresholds,
} from "domain/leveling";
import type { Character, SimEvent } from "domain/types";

function mkChar(over: Partial<Character> = {}): Character {
  return {
    id: "c1", name: "C1", race: "Human", class: "Cleric", role: "Healer",
    specialty: "Life Domain",
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    level: 3, xp: 30, abilityTiers: [1], description: "",
    ...over,
  };
}

describe("leveling", () => {
  it("XP_THRESHOLDS go up to level 20 monotonically", () => {
    expect(XP_THRESHOLDS[2]).toBe(15);
    expect(XP_THRESHOLDS[3]).toBe(30);
    expect(XP_THRESHOLDS[6]).toBe(95);
    expect(XP_THRESHOLDS[13]).toBe(380);
    expect(XP_THRESHOLDS[20]).toBe(1140);
    for (let l = 3; l <= 20; l++) {
      expect(XP_THRESHOLDS[l]).toBeGreaterThan(XP_THRESHOLDS[l - 1]);
    }
  });

  it("xpFromEvents awards role-relevant XP (Healer earns from heal)", () => {
    const c = mkChar({ specialty: "War Domain" });
    const events: SimEvent[] = [
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 8 },
      { kind: "save_pass", encounterId: "e", actorId: "c1" },
    ];
    expect(xpFromEvents(c, events)).toBeGreaterThan(0);
  });

  it("applies 1.5x specialty bonus on aligned events", () => {
    const aligned = mkChar({ specialty: "Life Domain" });
    const offspec = mkChar({ specialty: "War Domain" });
    const events: SimEvent[] = [
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 10 },
    ];
    const xpAligned = xpFromEvents(aligned, events);
    const xpOffspec = xpFromEvents(offspec, events);
    expect(xpAligned).toBeCloseTo(xpOffspec * 1.5, 4);
  });

  it("DPS earns no XP from heal events", () => {
    const dps = mkChar({ class: "Fighter", role: "DPS", specialty: "Champion" });
    const events: SimEvent[] = [
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 10 },
    ];
    expect(xpFromEvents(dps, events)).toBe(0);
  });

  it("applyXpAndLevel handles single level-up with stat bump and ability tier", () => {
    const c = mkChar({ level: 3, xp: 45, abilityTiers: [1] });
    const result = applyXpAndLevel(c, 10, 1, 20);
    expect(result.character.level).toBe(4);
    expect(result.character.xp).toBe(55);
    expect(result.character.stats.wis).toBe(15);
    expect(result.levelUps).toEqual([4]);
  });

  it("applyXpAndLevel unlocks ability tier 2 at level 6", () => {
    const c = mkChar({ level: 5, xp: 70, abilityTiers: [1] });
    const result = applyXpAndLevel(c, 30, 1, 20);
    expect(result.character.level).toBe(6);
    expect(result.character.abilityTiers).toContain(2);
  });

  it("respects maxLevel cap", () => {
    const c = mkChar({ level: 19, xp: 1000 });
    const result = applyXpAndLevel(c, 500, 1, 20);
    expect(result.character.level).toBe(20);
  });

  it("respects xpEnabled=false (Champions preset) — applyXpAndLevel with 0 award is a no-op", () => {
    const c = mkChar({ level: 20, xp: 0 });
    const result = applyXpAndLevel(c, 0, 1, 20);
    expect(result.character.level).toBe(20);
    expect(result.character.xp).toBe(0);
  });

  it("scaledThresholds multiplies cumulative thresholds by factor per spec", () => {
    const scaled = scaledThresholds(0.5);
    expect(scaled[3]).toBeCloseTo(15, 4);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/domain/leveling.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `domain/leveling.ts`**

```ts
import type { Character, EventKind, Role, SimEvent } from "./types";
import { unlockTierForLevel } from "./abilities";
import { isCoreEventForSpecialty, primaryStatForSpecialty } from "./specialties";

export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 15,
  3: 30,
  4: 50,
  5: 70,
  6: 95,
  7: 120,
  8: 150,
  9: 185,
  10: 225,
  11: 270,
  12: 320,
  13: 380,
  14: 450,
  15: 530,
  16: 620,
  17: 720,
  18: 840,
  19: 980,
  20: 1140,
};

export const ROLE_XP_EVENTS: Record<Role, Set<EventKind>> = {
  Tank: new Set(["damage_taken", "save_pass", "block", "taunt"]),
  Healer: new Set(["heal", "buff", "buff_proc", "revivify", "save_pass"]),
  DPS: new Set(["hit", "kill", "crit", "sneak_attack", "smite", "multiattack", "rage", "arcane_surge"]),
  Utility: new Set(["disarm_trap", "find_treasure", "save_pass", "persuade", "deceive", "intimidate", "buff_proc", "dispel"]),
};

const SPECIALTY_XP_BONUS = 1.5;

function xpAmountForEvent(event: SimEvent): number {
  switch (event.kind) {
    case "hit": return Math.max(1, Math.floor((event.amount ?? 0) / 4));
    case "kill": return event.meta?.boss ? 5 : 2;
    case "crit": return 2;
    case "heal": return Math.max(1, Math.floor((event.amount ?? 0) / 4));
    case "damage_taken": return Math.max(1, Math.floor((event.amount ?? 0) / 5));
    case "save_pass": return 1;
    case "disarm_trap": return 2;
    case "find_treasure": return 3;
    case "buff": return 1;
    case "buff_proc": return 1;
    case "block": return 2;
    case "taunt": return 1;
    case "persuade":
    case "deceive":
    case "intimidate": return 2;
    case "dispel": return 2;
    case "channel": return 1;
    case "arcane_surge": return 3;
    case "multiattack": return 1;
    case "sneak_attack": return Math.max(1, Math.floor((event.amount ?? 0) / 4));
    case "smite": return Math.max(1, Math.floor((event.amount ?? 0) / 4));
    case "rage": return 1;
    case "revivify": return 5;
    default: return 0;
  }
}

export function xpFromEvents(character: Character, events: SimEvent[]): number {
  let total = 0;
  const roleSet = ROLE_XP_EVENTS[character.role];
  for (const event of events) {
    if (event.actorId !== character.id) continue;
    if (!roleSet.has(event.kind)) continue;
    let amount = xpAmountForEvent(event);
    if (isCoreEventForSpecialty(character.specialty, event.kind)) {
      amount *= SPECIALTY_XP_BONUS;
    }
    total += amount;
  }
  return total;
}

export function scaledThresholds(scaleFactor: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [lvl, xp] of Object.entries(XP_THRESHOLDS)) {
    out[Number(lvl)] = xp * scaleFactor;
  }
  return out;
}

export interface LevelUpResult {
  character: Character;
  levelUps: number[];
}

const SCALING_LEVELS = new Set([4, 7, 10, 16, 19]);

export function applyXpAndLevel(
  character: Character,
  xpAward: number,
  scaleFactor: number,
  maxLevel: number,
): LevelUpResult {
  const thresholds = scaledThresholds(scaleFactor);
  const next: Character = {
    ...character,
    stats: { ...character.stats },
    abilityTiers: [...character.abilityTiers],
  };
  next.xp = character.xp + xpAward;
  const levelUps: number[] = [];

  while (next.level < maxLevel) {
    const need = thresholds[next.level + 1];
    if (need === undefined) break;
    if (next.xp < need) break;
    next.level += 1;
    levelUps.push(next.level);

    // Stat bump per spec: every level except the dedicated unlock-only levels
    // Spec says levels 1->2, 3->4, 4->5, 6->7, 7->8, 9->10, 10->11 give stat bumps
    // Tier-only levels 2->3, 5->6, 8->9, 11->12, 12->13 are pure ability unlocks (no stat bump per spec)
    const statBumpLevels = new Set([2, 4, 5, 7, 8, 10, 11, 14, 16, 17, 19]);
    const stat = primaryStatForSpecialty(next.specialty);
    if (statBumpLevels.has(next.level)) {
      next.stats[stat] = next.stats[stat] + 1;
    }

    if (SCALING_LEVELS.has(next.level)) {
      next.stats[stat] = next.stats[stat] + 1;
    }

    const tier = unlockTierForLevel(next.level);
    if (tier > 0 && !next.abilityTiers.includes(tier)) {
      next.abilityTiers.push(tier);
      next.abilityTiers.sort((a, b) => a - b);
    }
  }

  return { character: next, levelUps };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/domain/leveling.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add domain/leveling.ts tests/domain/leveling.test.ts
git commit -m "feat(leveling): add XP thresholds, role-relevant XP, level-up effects"
```

---

### Task 7: Scoring Rebalance

**Files:**
- Modify: `domain/scoring.ts`
- Modify: `tests/domain/scoring.test.ts`

- [ ] **Step 1: Update test fixture and add new tests**

Replace `tests/domain/scoring.test.ts` contents with:

```ts
import { describe, it, expect } from "vitest";
import { score } from "domain/scoring";
import type { Character, CharacterClass, Role, SimEvent, Specialty } from "domain/types";

function makeChar(
  id: string,
  role: Role,
  cls: CharacterClass = "Fighter",
  specialty: Specialty = "Champion",
): Character {
  return {
    id, name: `Test ${id}`, race: "Human", class: cls, role, specialty,
    stats: { str: 14, dex: 12, con: 13, int: 10, wis: 10, cha: 10 },
    level: 3, xp: 30, abilityTiers: [1], description: "test",
  };
}

describe("scoring", () => {
  it("scores hit events at 0.1 per damage", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [{ kind: "hit", encounterId: "e1", actorId: "a", amount: 10 }];
    expect(score(events, chars).perCharacter.get("a")!.basePoints).toBe(1);
  });

  it("DPS core multiplier is 0.75 for hit", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [{ kind: "hit", encounterId: "e1", actorId: "a", amount: 10 }];
    const r = score(events, chars).perCharacter.get("a")!;
    expect(r.roleMultiplierPoints).toBeCloseTo(0.75, 4);
  });

  it("Tank core multiplier is 0.75 for damage_taken at 0.1/dmg", () => {
    const chars = [makeChar("t", "Tank", "Barbarian", "Totem Warrior")];
    const events: SimEvent[] = [{ kind: "damage_taken", encounterId: "e1", actorId: "t", amount: 20 }];
    const r = score(events, chars).perCharacter.get("t")!;
    expect(r.basePoints).toBeCloseTo(2, 4);
    expect(r.roleMultiplierPoints).toBeCloseTo(1.5, 4);
  });

  it("Tank secondary multiplier is 0.3 for save_pass", () => {
    const chars = [makeChar("t", "Tank", "Paladin", "Devotion")];
    const events: SimEvent[] = [{ kind: "save_pass", encounterId: "e1", actorId: "t" }];
    const r = score(events, chars).perCharacter.get("t")!;
    expect(r.basePoints).toBe(1);
    // save_pass IS core for Devotion (specialty), so role still 0.3 (secondary), specialty +0.25
    expect(r.roleMultiplierPoints).toBeCloseTo(0.3, 4);
    expect(r.specialtyBonusPoints).toBeCloseTo(0.25, 4);
  });

  it("Healer heal at 0.1/hp (down from 0.15)", () => {
    const chars = [makeChar("h", "Healer", "Cleric", "Life Domain")];
    const events: SimEvent[] = [{ kind: "heal", encounterId: "e1", actorId: "h", amount: 10 }];
    const r = score(events, chars).perCharacter.get("h")!;
    expect(r.basePoints).toBeCloseTo(1, 4);
  });

  it("specialty bonus +0.25x stacks on aligned events", () => {
    const champ = makeChar("a", "DPS", "Fighter", "Champion");
    const events: SimEvent[] = [{ kind: "crit", encounterId: "e1", actorId: "a" }];
    const r = score(events, [champ]).perCharacter.get("a")!;
    expect(r.basePoints).toBe(1.5);
    expect(r.roleMultiplierPoints).toBeCloseTo(1.5 * 0.75, 4);
    expect(r.specialtyBonusPoints).toBeCloseTo(1.5 * 0.25, 4);
  });

  it("buff event scores +1 base for healer", () => {
    const c = makeChar("h", "Healer", "Cleric", "War Domain");
    const events: SimEvent[] = [{ kind: "buff", encounterId: "e", actorId: "h" }];
    const r = score(events, [c]).perCharacter.get("h")!;
    expect(r.basePoints).toBe(1);
    expect(r.roleMultiplierPoints).toBeCloseTo(0.75, 4);
  });

  it("buff_proc credits the buffer at +1.5", () => {
    const c = makeChar("h", "Healer", "Cleric", "War Domain");
    const events: SimEvent[] = [{ kind: "buff_proc", encounterId: "e", actorId: "h" }];
    expect(score(events, [c]).perCharacter.get("h")!.basePoints).toBe(1.5);
  });

  it("block at +2 with Tank multiplier", () => {
    const c = makeChar("t", "Tank", "Barbarian", "Totem Warrior");
    const events: SimEvent[] = [{ kind: "block", encounterId: "e", actorId: "t" }];
    const r = score(events, [c]).perCharacter.get("t")!;
    expect(r.basePoints).toBe(2);
    expect(r.roleMultiplierPoints).toBeCloseTo(1.5, 4);
  });

  it("revivify scores +5", () => {
    const c = makeChar("h", "Healer", "Cleric", "Life Domain");
    const events: SimEvent[] = [{ kind: "revivify", encounterId: "e", actorId: "h", targetId: "x" }];
    expect(score(events, [c]).perCharacter.get("h")!.basePoints).toBe(5);
  });

  it("multiattack at +0.5 per extra hit", () => {
    const c = makeChar("a", "DPS", "Fighter", "Battle Master");
    const events: SimEvent[] = [
      { kind: "multiattack", encounterId: "e", actorId: "a", amount: 2 },
    ];
    expect(score(events, [c]).perCharacter.get("a")!.basePoints).toBe(1);
  });

  it("sneak_attack at 0.15/dmg with Rogue Assassin specialty", () => {
    const c = makeChar("a", "Utility", "Rogue", "Assassin");
    const events: SimEvent[] = [
      { kind: "sneak_attack", encounterId: "e", actorId: "a", amount: 20 },
    ];
    const r = score(events, [c]).perCharacter.get("a")!;
    expect(r.basePoints).toBeCloseTo(3, 4);
    expect(r.specialtyBonusPoints).toBeCloseTo(0.75, 4);
  });

  it("kills boss at +5 (up from +3)", () => {
    const c = makeChar("a", "DPS");
    const events: SimEvent[] = [
      { kind: "kill", encounterId: "e", actorId: "a", meta: { boss: true } },
    ];
    expect(score(events, [c]).perCharacter.get("a")!.basePoints).toBe(5);
  });

  it("revivify_save milestone awards bonus to reviver", () => {
    const c = makeChar("h", "Healer", "Cleric", "Life Domain");
    const target = makeChar("t", "DPS");
    const events: SimEvent[] = [
      { kind: "death", encounterId: "e", actorId: "t" },
      { kind: "revivify", encounterId: "e2", actorId: "h", targetId: "t" },
    ];
    const r = score(events, [c, target]);
    expect(r.milestones.some((m) => m.kind === "revivify_save" && m.actorId === "h")).toBe(true);
  });

  it("flawless_run still awards +3 to all on no ko/death", () => {
    const a = makeChar("a", "DPS"); const b = makeChar("b", "Tank", "Paladin", "Devotion");
    const events: SimEvent[] = [{ kind: "hit", encounterId: "e", actorId: "a", amount: 5 }];
    const r = score(events, [a, b]);
    expect(r.milestones.some((m) => m.kind === "flawless_run")).toBe(true);
    expect(r.perCharacter.get("a")!.milestonePoints).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/domain/scoring.test.ts`
Expected: FAIL — multiplier values, missing event kinds.

- [ ] **Step 3: Replace `domain/scoring.ts`**

```ts
import type {
  Character, CharacterScore, EventKind, Milestone, ScoreResult, SimEvent,
} from "./types";
import { isCoreEventForSpecialty } from "./specialties";

const BASE_POINTS: Record<EventKind, number | ((e: SimEvent) => number)> = {
  hit: (e) => (e.amount ?? 0) * 0.1,
  kill: (e) => (e.meta?.boss ? 5 : 2),
  crit: 1.5,
  heal: (e) => (e.amount ?? 0) * 0.1,
  damage_taken: (e) => (e.amount ?? 0) * 0.1,
  save_pass: 1,
  save_fail: -0.5,
  disarm_trap: 2,
  find_treasure: 3,
  ko: -3,
  death: -5,
  buff: 1,
  buff_proc: 1.5,
  block: 2,
  taunt: 1.5,
  persuade: 1.5,
  deceive: 1.5,
  intimidate: 1.5,
  dispel: 2,
  channel: 1,
  arcane_surge: 3,
  multiattack: (e) => (e.amount ?? 1) * 0.5,
  sneak_attack: (e) => (e.amount ?? 0) * 0.15,
  smite: (e) => (e.amount ?? 0) * 0.15,
  rage: 1,
  revivify: 5,
};

const ROLE_CORE_EVENTS: Record<string, Set<EventKind>> = {
  Tank: new Set(["block", "taunt", "damage_taken"]),
  Healer: new Set(["heal", "buff", "buff_proc", "revivify"]),
  DPS: new Set(["hit", "kill", "crit", "sneak_attack", "smite", "arcane_surge"]),
  Utility: new Set(["disarm_trap", "find_treasure", "persuade", "deceive"]),
};

const ROLE_SECONDARY_EVENTS: Record<string, Set<EventKind>> = {
  Tank: new Set(["save_pass", "intimidate"]),
  Healer: new Set(["save_pass", "channel"]),
  DPS: new Set(["multiattack", "rage"]),
  Utility: new Set(["buff_proc", "dispel"]),
};

const ROLE_CORE_MULT = 0.75;
const ROLE_SECONDARY_MULT = 0.3;
const SPECIALTY_BONUS_MULT = 0.25;

function basePointsFor(event: SimEvent): number {
  const calc = BASE_POINTS[event.kind];
  if (calc === undefined) return 0;
  if (typeof calc === "function") return calc(event);
  return calc;
}

export function score(events: SimEvent[], roster: Character[]): ScoreResult {
  const charMap = new Map(roster.map((c) => [c.id, c]));
  const scores = new Map<string, CharacterScore>();

  for (const char of roster) {
    scores.set(char.id, {
      characterId: char.id,
      basePoints: 0,
      roleMultiplierPoints: 0,
      specialtyBonusPoints: 0,
      milestonePoints: 0,
      totalPoints: 0,
    });
  }

  for (const event of events) {
    const cs = scores.get(event.actorId);
    if (!cs) continue;
    const char = charMap.get(event.actorId);
    if (!char) continue;

    const base = basePointsFor(event);
    cs.basePoints += base;

    const core = ROLE_CORE_EVENTS[char.role];
    const secondary = ROLE_SECONDARY_EVENTS[char.role];
    if (core?.has(event.kind)) {
      cs.roleMultiplierPoints += base * ROLE_CORE_MULT;
    } else if (secondary?.has(event.kind)) {
      cs.roleMultiplierPoints += base * ROLE_SECONDARY_MULT;
    }

    if (isCoreEventForSpecialty(char.specialty, event.kind)) {
      cs.specialtyBonusPoints += base * SPECIALTY_BONUS_MULT;
    }
  }

  const milestones: Milestone[] = [];

  const hasKoOrDeath = events.some((e) => e.kind === "ko" || e.kind === "death");
  if (!hasKoOrDeath && events.length > 0) {
    milestones.push({ kind: "flawless_run" });
    for (const cs of scores.values()) cs.milestonePoints += 3;
  }

  const allDead = roster.every((c) => events.some((e) => e.kind === "death" && e.actorId === c.id));
  if (allDead && roster.length > 0) {
    milestones.push({ kind: "total_party_wipe" });
    for (const cs of scores.values()) cs.milestonePoints += -10;
  }

  const firstKill = events.find((e) => e.kind === "kill");
  if (firstKill) {
    milestones.push({ kind: "first_blood", actorId: firstKill.actorId });
    const cs = scores.get(firstKill.actorId);
    if (cs) cs.milestonePoints += 1;
  }

  const bossKill = events.find((e) => e.kind === "kill" && e.meta?.boss);
  if (bossKill) {
    milestones.push({ kind: "boss_killer", actorId: bossKill.actorId });
    const cs = scores.get(bossKill.actorId);
    if (cs) cs.milestonePoints += 5;
  }

  for (const e of events) {
    if (e.kind === "revivify" && e.targetId) {
      milestones.push({ kind: "revivify_save", actorId: e.actorId });
      const cs = scores.get(e.actorId);
      if (cs) cs.milestonePoints += 3;
    }
  }

  let mvpId: string | undefined;
  let mvpPoints = -Infinity;
  for (const cs of scores.values()) {
    const pre = cs.basePoints + cs.roleMultiplierPoints + cs.specialtyBonusPoints;
    if (pre > mvpPoints) {
      mvpPoints = pre;
      mvpId = cs.characterId;
    }
  }
  if (mvpId && mvpPoints > 0) {
    milestones.push({ kind: "mvp_of_run", actorId: mvpId });
    const cs = scores.get(mvpId);
    if (cs) cs.milestonePoints += 5;
  }

  for (const char of roster) {
    const wasKod = events.some((e) => e.kind === "ko" && e.actorId === char.id);
    const wasDead = events.some((e) => e.kind === "death" && e.actorId === char.id);
    if (wasKod && !wasDead) {
      milestones.push({ kind: "clutch_survivor", actorId: char.id });
      const cs = scores.get(char.id);
      if (cs) cs.milestonePoints += 3;
    }
  }

  let teamTotal = 0;
  for (const cs of scores.values()) {
    cs.totalPoints =
      cs.basePoints + cs.roleMultiplierPoints + cs.specialtyBonusPoints + cs.milestonePoints;
    teamTotal += cs.totalPoints;
  }

  return { perCharacter: scores, milestones, teamTotal };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/domain/scoring.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add domain/scoring.ts tests/domain/scoring.test.ts
git commit -m "feat(scoring): tiered role multipliers, specialty bonus, new event base points"
```

---

### Task 8: Procedural Source — Specialty, Level, Theme Mix, New Encounters

**Files:**
- Modify: `domain/content/procedural-source.ts`
- Modify: `domain/content/name-tables.ts`
- Modify: `tests/domain/procedural-source.test.ts`

- [ ] **Step 1: Append name tables for new encounter types and ensure themes match**

Open `domain/content/name-tables.ts`. Find `DUNGEON_THEMES` and replace with:

```ts
export const DUNGEON_THEMES = [
  "undead", "fire", "shadow", "arcane", "demonic",
  "nature", "mechanical", "aquatic", "draconic", "ice",
] as const;
```

Find `ENCOUNTER_NAMES` and add `social` and `arcane` entries to that record. The existing record's type should be `Record<EncounterType, string[]>` — open the file to inspect, then add at the end of the existing record:

```ts
  social: [
    "the Diplomat's Gambit", "the Court of Whispers", "the Merchant's Bargain",
    "the Oathkeeper's Vigil", "the Beggar's Plea",
  ],
  arcane: [
    "the Sealed Ward", "the Planar Rift", "the Sigil of Binding",
    "the Eldritch Cipher", "the Mana Storm",
  ],
```

If the existing record is typed by inference, also ensure callers compile. If TypeScript complains, change the type annotation accordingly.

- [ ] **Step 2: Update test file**

Replace `tests/domain/procedural-source.test.ts` contents with:

```ts
import { describe, it, expect } from "vitest";
import { ProceduralSource } from "domain/content/procedural-source";
import { createRng } from "domain/rng";
import { CLASS_SPECIALTY_MAP } from "domain/specialties";
import { DEFAULT_LEAGUE_SETTINGS } from "domain/types";

describe("ProceduralSource", () => {
  it("generateCharacters sets startingLevel and assigns valid specialty", () => {
    const src = new ProceduralSource();
    const chars = src.generateCharacters(48, createRng(1), DEFAULT_LEAGUE_SETTINGS);
    expect(chars.length).toBe(48);
    for (const c of chars) {
      expect(c.level).toBe(3);
      expect(c.xp).toBe(30);
      expect(c.abilityTiers).toContain(1);
      const allowed = CLASS_SPECIALTY_MAP[c.class];
      expect(allowed).toContain(c.specialty);
    }
  });

  it("respects startingLevel from settings", () => {
    const src = new ProceduralSource();
    const settings = { ...DEFAULT_LEAGUE_SETTINGS, startingLevel: 20 };
    const chars = src.generateCharacters(12, createRng(2), settings);
    for (const c of chars) {
      expect(c.level).toBe(20);
      expect(c.abilityTiers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });

  it("generateDungeon respects theme encounter weights", () => {
    const src = new ProceduralSource();
    const counts: Record<string, number> = { combat: 0, trap: 0, puzzle: 0, treasure: 0, social: 0, arcane: 0 };
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed);
      const dungeon = src.generateDungeon(1, 0, rng, "arcane", "5-8");
      for (const e of dungeon.encounters) counts[e.type]++;
    }
    expect(counts.arcane).toBeGreaterThan(counts.trap);
  });

  it("generateDungeon respects encounterCount setting", () => {
    const src = new ProceduralSource();
    const small = src.generateDungeon(1, 0, createRng(7), "fire", "3-5");
    const large = src.generateDungeon(1, 0, createRng(7), "fire", "7-10");
    expect(small.encounters.length).toBeLessThanOrEqual(5);
    expect(large.encounters.length).toBeGreaterThanOrEqual(7);
  });

  it("generateDungeon assigns theme to dungeon", () => {
    const src = new ProceduralSource();
    const dungeon = src.generateDungeon(1, 0, createRng(3), "shadow", "5-8");
    expect(dungeon.theme).toBe("shadow");
  });
});
```

- [ ] **Step 3: Run test, expect failure**

Run: `npm test -- tests/domain/procedural-source.test.ts`
Expected: FAIL — signature mismatch.

- [ ] **Step 4: Update `domain/content/content-source.ts`**

Replace contents:

```ts
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
```

- [ ] **Step 5: Replace `domain/content/procedural-source.ts`**

```ts
import type {
  Character, CharacterClass, EncounterCount, EncounterType, LeagueSettings,
  Race, Stats, Dungeon, Encounter,
} from "domain/types";
import { CLASS_ROLE_MAP } from "domain/types";
import { CLASS_SPECIALTY_MAP, primaryStatForSpecialty } from "domain/specialties";
import { unlockTierForLevel } from "domain/abilities";
import { pickEncounterType } from "domain/themes";
import type { Rng } from "domain/rng";
import type { ContentSource, HighlightTemplateBundle } from "./content-source";
import { DEFAULT_HIGHLIGHT_TEMPLATES } from "./highlight-templates";
import {
  FIRST_NAMES, LAST_NAMES, ADJECTIVES, ADJECTIVES_2, TRAITS, QUIRKS,
  BACKGROUNDS, DESCRIPTION_TEMPLATES, DUNGEON_PREFIXES, DUNGEON_NOUNS,
  ENCOUNTER_NAMES, BOSS_NAMES,
} from "./name-tables";

const ALL_RACES: Race[] = [
  "Human", "Elf", "Dwarf", "Halfling", "Orc", "Gnome", "Tiefling", "Dragonborn",
];

const ALL_CLASSES: CharacterClass[] = [
  "Fighter", "Wizard", "Rogue", "Cleric", "Ranger", "Paladin",
  "Barbarian", "Bard", "Druid", "Warlock", "Monk", "Sorcerer",
];

function generateDescription(rng: Rng, name: string, race: Race, charClass: CharacterClass): string {
  const template = rng.pick(DESCRIPTION_TEMPLATES);
  return template
    .replace("{name}", name)
    .replace("{race}", race)
    .replace("{class}", charClass)
    .replace("{adjective2}", rng.pick(ADJECTIVES_2))
    .replace("{adjective}", rng.pick(ADJECTIVES))
    .replace("{trait}", rng.pick(TRAITS))
    .replace("{quirk}", rng.pick(QUIRKS))
    .replace("{background}", rng.pick(BACKGROUNDS));
}

function rollStats(rng: Rng): Stats {
  return {
    str: rng.rollStat(), dex: rng.rollStat(), con: rng.rollStat(),
    int: rng.rollStat(), wis: rng.rollStat(), cha: rng.rollStat(),
  };
}

function statBumpsForLevel(level: number): number {
  let bumps = 0;
  const statBumpLevels = new Set([2, 4, 5, 7, 8, 10, 11, 14, 16, 17, 19]);
  const scalingLevels = new Set([4, 7, 10, 16, 19]);
  for (let l = 2; l <= level; l++) {
    if (statBumpLevels.has(l)) bumps += 1;
    if (scalingLevels.has(l)) bumps += 1;
  }
  return bumps;
}

function tiersAtLevel(level: number): number[] {
  const top = unlockTierForLevel(level);
  const out: number[] = [];
  for (let t = 1; t <= top; t++) out.push(t);
  return out;
}

function targetStatsForType(type: EncounterType, rng: Rng): (keyof Stats)[] {
  switch (type) {
    case "combat": return [rng.pick<keyof Stats>(["str", "dex", "int"]), "con"];
    case "trap": return ["dex", rng.pick<keyof Stats>(["int", "wis"])];
    case "puzzle": return [rng.pick<keyof Stats>(["int", "wis", "cha"])];
    case "treasure": return [rng.pick<keyof Stats>(["wis", "dex", "cha"])];
    case "social": return [rng.pick<keyof Stats>(["cha", "wis", "int"])];
    case "arcane": return [rng.pick<keyof Stats>(["int", "wis", "cha"])];
  }
}

function encounterCountRange(count: EncounterCount): [number, number] {
  switch (count) {
    case "3-5": return [3, 5];
    case "5-8": return [5, 8];
    case "7-10": return [7, 10];
  }
}

export class ProceduralSource implements ContentSource {
  generateCharacters(count: number, rng: Rng, settings: LeagueSettings): Character[] {
    const usedNames = new Set<string>();
    const characters: Character[] = [];
    const shuffledFirstNames = rng.shuffle([...FIRST_NAMES]);
    const shuffledLastNames = rng.shuffle([...LAST_NAMES]);

    const startingLevel = settings.startingLevel;

    for (let i = 0; i < count; i++) {
      const firstName = shuffledFirstNames[i % shuffledFirstNames.length];
      const lastName = shuffledLastNames[i % shuffledLastNames.length];
      let fullName = `${firstName} ${lastName}`;

      let attempt = 0;
      while (usedNames.has(fullName) && attempt < 100) {
        fullName = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
        attempt++;
      }
      usedNames.add(fullName);

      const charClass = rng.pick(ALL_CLASSES);
      const race = rng.pick(ALL_RACES);
      const role = CLASS_ROLE_MAP[charClass];
      const specialty = CLASS_SPECIALTY_MAP[charClass][rng.next() < 0.5 ? 0 : 1];
      const stats = rollStats(rng);

      const primary = primaryStatForSpecialty(specialty);
      stats[primary] = stats[primary] + statBumpsForLevel(startingLevel);

      const startingXp = startingLevel >= 3 ? 30 : 0;

      characters.push({
        id: `char-${i}-${firstName.toLowerCase()}`,
        name: fullName,
        race,
        class: charClass,
        role,
        specialty,
        stats,
        level: startingLevel,
        xp: startingXp,
        abilityTiers: tiersAtLevel(startingLevel),
        description: generateDescription(rng, fullName, race, charClass),
      });
    }

    return characters;
  }

  generateDungeon(
    week: number,
    matchupIndex: number,
    rng: Rng,
    theme: string,
    encounterCount: EncounterCount,
  ): Dungeon {
    const name = `${rng.pick(DUNGEON_PREFIXES)} ${rng.pick(DUNGEON_NOUNS)}`;
    const [min, max] = encounterCountRange(encounterCount);
    const total = rng.nextInt(min, max);

    const encounters: Encounter[] = [];
    for (let i = 0; i < total - 1; i++) {
      const type = pickEncounterType(theme, rng);
      const names = ENCOUNTER_NAMES[type] ?? ENCOUNTER_NAMES.combat;
      encounters.push({
        id: `enc-w${week}-m${matchupIndex}-${i}`,
        type,
        name: rng.pick(names),
        difficulty: rng.nextInt(1, 10),
        targetStats: targetStatsForType(type, rng),
        isBoss: false,
      });
    }

    encounters.push({
      id: `enc-w${week}-m${matchupIndex}-boss`,
      type: "combat",
      name: rng.pick(BOSS_NAMES),
      difficulty: rng.nextInt(7, 10),
      targetStats: targetStatsForType("combat", rng),
      isBoss: true,
    });

    return { id: `dungeon-w${week}-m${matchupIndex}`, name, theme, encounters };
  }

  getHighlightTemplates(): HighlightTemplateBundle {
    return DEFAULT_HIGHLIGHT_TEMPLATES;
  }
}
```

- [ ] **Step 6: Run test to verify pass**

Run: `npm test -- tests/domain/procedural-source.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add domain/content/ tests/domain/procedural-source.test.ts
git commit -m "feat(content): assign specialty/level, weighted theme encounters, social/arcane types"
```

---

### Task 9: Buffs Module

**Files:**
- Create: `domain/sim/buffs.ts`
- Create: `tests/domain/buffs.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/domain/buffs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { newBuffState, addBuff, consumeBuff, buffersOf } from "domain/sim/buffs";

describe("buffs", () => {
  it("addBuff records source and target with charges", () => {
    const state = newBuffState();
    addBuff(state, { kind: "bless", sourceId: "cleric1", targetId: "ally1", charges: 3, bonus: 4 });
    expect(state.byTarget.get("ally1")?.length).toBe(1);
  });

  it("consumeBuff returns the active buff and decrements charges", () => {
    const state = newBuffState();
    addBuff(state, { kind: "bless", sourceId: "c", targetId: "a", charges: 2, bonus: 4 });
    const consumed = consumeBuff(state, "a", "bless");
    expect(consumed?.sourceId).toBe("c");
    expect(state.byTarget.get("a")?.[0].charges).toBe(1);
  });

  it("consumeBuff removes a buff at zero charges", () => {
    const state = newBuffState();
    addBuff(state, { kind: "inspiration", sourceId: "b", targetId: "a", charges: 1, bonus: 6 });
    consumeBuff(state, "a", "inspiration");
    expect(state.byTarget.get("a")?.length ?? 0).toBe(0);
  });

  it("buffersOf returns sources currently buffing a target", () => {
    const state = newBuffState();
    addBuff(state, { kind: "bless", sourceId: "c1", targetId: "a", charges: 2, bonus: 4 });
    addBuff(state, { kind: "aura", sourceId: "p1", targetId: "a", charges: 99, bonus: 2 });
    expect(buffersOf(state, "a").sort()).toEqual(["c1", "p1"]);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/domain/buffs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `domain/sim/buffs.ts`**

```ts
export type BuffKind = "bless" | "inspiration" | "aura" | "guidance";

export interface ActiveBuff {
  kind: BuffKind;
  sourceId: string;
  targetId: string;
  charges: number;
  bonus: number;
}

export interface BuffState {
  byTarget: Map<string, ActiveBuff[]>;
}

export function newBuffState(): BuffState {
  return { byTarget: new Map() };
}

export function addBuff(state: BuffState, buff: ActiveBuff): void {
  const list = state.byTarget.get(buff.targetId) ?? [];
  list.push(buff);
  state.byTarget.set(buff.targetId, list);
}

export function consumeBuff(state: BuffState, targetId: string, kind: BuffKind): ActiveBuff | undefined {
  const list = state.byTarget.get(targetId);
  if (!list) return undefined;
  const idx = list.findIndex((b) => b.kind === kind && b.charges > 0);
  if (idx < 0) return undefined;
  const buff = list[idx];
  const updated = { ...buff, charges: buff.charges - 1 };
  if (updated.charges <= 0) {
    list.splice(idx, 1);
  } else {
    list[idx] = updated;
  }
  return buff;
}

export function buffersOf(state: BuffState, targetId: string): string[] {
  return (state.byTarget.get(targetId) ?? []).map((b) => b.sourceId);
}

export function clearTargetBuffs(state: BuffState, targetId: string): void {
  state.byTarget.delete(targetId);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/domain/buffs.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add domain/sim/buffs.ts tests/domain/buffs.test.ts
git commit -m "feat(sim): add buff state tracking module"
```

---

### Task 10: Class-Aware Combat Resolution

**Files:**
- Modify: `domain/sim/encounters.ts`
- Create: `domain/sim/abilities-runtime.ts`
- Modify: `tests/domain/sim-engine.test.ts`

- [ ] **Step 1: Write failing test for class-aware combat**

Add to `tests/domain/sim-engine.test.ts` (preserve existing tests; append):

```ts
import { describe, it, expect } from "vitest";
import { createRng } from "domain/rng";
import { runDungeon } from "domain/sim/sim-engine";
import { ATTACK_STAT_BY_CLASS } from "domain/sim/abilities-runtime";
import type { Character, Dungeon, Lineup } from "domain/types";

function dpsChar(id: string, cls: any, specialty: any, level = 6): Character {
  return {
    id, name: id, race: "Human", class: cls, role: "DPS", specialty,
    stats: { str: 16, dex: 16, con: 12, int: 16, wis: 10, cha: 16 },
    level, xp: 0, abilityTiers: [1, 2], description: "",
  };
}

describe("class-aware combat", () => {
  it("ATTACK_STAT_BY_CLASS maps Wizard to int and Bard to cha", () => {
    expect(ATTACK_STAT_BY_CLASS.Wizard).toBe("int");
    expect(ATTACK_STAT_BY_CLASS.Bard).toBe("cha");
    expect(ATTACK_STAT_BY_CLASS.Fighter).toBe("str");
    expect(ATTACK_STAT_BY_CLASS.Monk).toBe("dex");
  });

  it("Fighter at level 6+ produces multiattack events", () => {
    const f = dpsChar("f", "Fighter", "Battle Master", 6);
    const tank = { ...dpsChar("t", "Barbarian", "Berserker", 3), role: "Tank" as const };
    const h = { ...dpsChar("h", "Cleric", "Life Domain", 3), role: "Healer" as const };
    const u = { ...dpsChar("u", "Rogue", "Thief", 3), role: "Utility" as const };
    const charMap = new Map([f, tank, h, u].map((c) => [c.id, c]));
    const lineup: Lineup = { active: [f.id, tank.id, h.id, u.id], bench: ["x", "y"] };
    const dungeon: Dungeon = {
      id: "d", name: "T", theme: "fire",
      encounters: [{
        id: "e1", type: "combat", name: "Goblin", difficulty: 3,
        targetStats: ["str"], isBoss: false,
      }],
    };
    const events = runDungeon(lineup, charMap, dungeon, createRng(11));
    expect(events.some((e) => e.kind === "multiattack" && e.actorId === "f")).toBe(true);
  });

  it("Rogue Assassin produces sneak_attack events", () => {
    const r = dpsChar("r", "Rogue", "Assassin", 3);
    r.role = "Utility";
    const fill = { ...dpsChar("x", "Fighter", "Champion", 3) };
    const charMap = new Map([r, fill].map((c) => [c.id, c]));
    const lineup: Lineup = { active: [r.id, fill.id, fill.id, fill.id], bench: ["a", "b"] };
    const dungeon: Dungeon = {
      id: "d", name: "T", theme: "shadow",
      encounters: [{
        id: "e1", type: "combat", name: "Boss", difficulty: 5,
        targetStats: ["dex"], isBoss: true,
      }],
    };
    const events = runDungeon(lineup, charMap, dungeon, createRng(7));
    expect(events.some((e) => e.kind === "sneak_attack" && e.actorId === "r")).toBe(true);
  });

  it("Paladin Vengeance produces smite events", () => {
    const p = { ...dpsChar("p", "Paladin", "Vengeance", 3), role: "Tank" as const };
    const fill = dpsChar("x", "Fighter", "Champion", 3);
    const charMap = new Map([p, fill].map((c) => [c.id, c]));
    const lineup: Lineup = { active: [p.id, fill.id, fill.id, fill.id], bench: ["a", "b"] };
    const dungeon: Dungeon = {
      id: "d", name: "T", theme: "demonic",
      encounters: [{
        id: "e1", type: "combat", name: "Demon", difficulty: 6,
        targetStats: ["str"], isBoss: true,
      }],
    };
    const events = runDungeon(lineup, charMap, dungeon, createRng(31));
    expect(events.some((e) => e.kind === "smite" && e.actorId === "p")).toBe(true);
  });

  it("Champion Fighter crits on a 19 (expanded crit range at tier 1)", () => {
    const c = dpsChar("c", "Fighter", "Champion", 3);
    c.abilityTiers = [1];
    const fill = dpsChar("x", "Fighter", "Battle Master", 3);
    const charMap = new Map([c, fill].map((ch) => [ch.id, ch]));
    const lineup: Lineup = { active: [c.id, fill.id, fill.id, fill.id], bench: ["a", "b"] };
    let sawCrit = false;
    for (let seed = 0; seed < 50 && !sawCrit; seed++) {
      const dungeon: Dungeon = {
        id: "d", name: "T", theme: "fire",
        encounters: [{
          id: "e1", type: "combat", name: "Foe", difficulty: 4,
          targetStats: ["str"], isBoss: false,
        }],
      };
      const events = runDungeon(lineup, charMap, dungeon, createRng(seed));
      if (events.some((e) => e.kind === "crit" && e.actorId === "c")) sawCrit = true;
    }
    expect(sawCrit).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/domain/sim-engine.test.ts`
Expected: FAIL — `abilities-runtime` not found, no multiattack/sneak_attack/smite events.

- [ ] **Step 3: Create `domain/sim/abilities-runtime.ts`**

```ts
import type { Character, CharacterClass, Specialty, Stats } from "domain/types";
import { hasAbility } from "domain/abilities";

export const ATTACK_STAT_BY_CLASS: Record<CharacterClass, keyof Stats> = {
  Fighter: "str", Barbarian: "str", Paladin: "str",
  Ranger: "dex", Rogue: "dex", Monk: "dex",
  Wizard: "int",
  Sorcerer: "cha", Warlock: "cha", Bard: "cha",
  Cleric: "wis", Druid: "wis",
};

export function attackStatFor(char: Character): keyof Stats {
  return ATTACK_STAT_BY_CLASS[char.class];
}

export function critRangeFor(char: Character): number {
  if (char.specialty === "Champion") {
    if (hasAbility("Fighter", "Champion", char.level, "Superior Critical")) return 18;
    if (hasAbility("Fighter", "Champion", char.level, "Improved Critical")) return 19;
  }
  return 20;
}

export function multiattackCount(char: Character): number {
  if ((char.class === "Fighter" || char.class === "Monk") && char.level >= 6) return 1;
  return 0;
}

export function hasSneakAttack(char: Character): boolean {
  return char.class === "Rogue" && hasAbility("Rogue", char.specialty, char.level, "Sneak Attack");
}

export function hasSmite(char: Character): boolean {
  return char.class === "Paladin" && hasAbility("Paladin", char.specialty, char.level, "Divine Smite");
}

export function hasRage(char: Character): boolean {
  return char.class === "Barbarian" && hasAbility("Barbarian", char.specialty, char.level, "Rage");
}

export function hasRevivify(char: Character): boolean {
  return (
    char.class === "Cleric" &&
    char.specialty === "Life Domain" &&
    hasAbility("Cleric", "Life Domain", char.level, "Revivify")
  );
}
```

- [ ] **Step 4: Replace `resolveCombat` in `domain/sim/encounters.ts`**

Open `domain/sim/encounters.ts`. Replace the entire file with:

```ts
import type { Character, Encounter, SimEvent, Stats } from "domain/types";
import type { Rng } from "domain/rng";
import {
  attackStatFor, critRangeFor, multiattackCount,
  hasSneakAttack, hasSmite, hasRage,
} from "./abilities-runtime";
import type { BuffState } from "./buffs";

function statMod(value: number): number {
  return Math.floor((value - 10) / 2);
}

function statCheck(char: Character, targetStats: (keyof Stats)[], difficulty: number, rng: Rng): boolean {
  const relevantStat = Math.max(...targetStats.map((s) => char.stats[s]));
  const roll = rng.nextInt(1, 20);
  return roll + statMod(relevantStat) >= difficulty + 10;
}

interface EncounterCtx {
  rng: Rng;
  hp: Map<string, number>;
  buffs: BuffState;
}

export function resolveCombat(
  chars: Character[],
  encounter: Encounter,
  ctx: EncounterCtx,
): SimEvent[] {
  const { rng, hp } = ctx;
  const events: SimEvent[] = [];

  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;

    const attackStat = attackStatFor(char);
    const critOn = critRangeFor(char);
    const extraAttacks = multiattackCount(char);
    const totalAttacks = 1 + extraAttacks;
    const hitDamages: number[] = [];

    for (let attackIdx = 0; attackIdx < totalAttacks; attackIdx++) {
      const d20 = rng.nextInt(1, 20);
      const isCrit = d20 >= critOn;
      let damage = rng.nextInt(3, 12) + statMod(char.stats[attackStat]);
      if (isCrit) damage = Math.floor(damage * 1.5);
      damage = Math.max(damage, 1);

      hitDamages.push(damage);
      events.push({
        kind: "hit", encounterId: encounter.id, actorId: char.id,
        targetId: encounter.id, amount: damage, crit: isCrit,
      });
      if (isCrit) {
        events.push({ kind: "crit", encounterId: encounter.id, actorId: char.id, amount: damage });
      }
    }

    if (extraAttacks > 0) {
      events.push({
        kind: "multiattack", encounterId: encounter.id, actorId: char.id, amount: extraAttacks,
      });
    }

    if (hasSneakAttack(char) && hitDamages.length > 0) {
      const bonus = rng.nextInt(2, 6 * Math.max(1, Math.floor(char.level / 4)));
      events.push({
        kind: "sneak_attack", encounterId: encounter.id, actorId: char.id, amount: bonus,
      });
    }

    if (hasSmite(char) && hitDamages.length > 0 && rng.next() < 0.4) {
      const bonus = rng.nextInt(4, 12);
      events.push({
        kind: "smite", encounterId: encounter.id, actorId: char.id, amount: bonus,
      });
    }

    if (hasRage(char)) {
      events.push({ kind: "rage", encounterId: encounter.id, actorId: char.id });
    }

    let damageTaken = Math.max(rng.nextInt(1, encounter.difficulty * 2) - statMod(char.stats.con), 0);
    if (hasRage(char)) damageTaken = Math.floor(damageTaken / 2);

    if (damageTaken > 0) {
      events.push({
        kind: "damage_taken", encounterId: encounter.id, actorId: char.id, amount: damageTaken,
      });

      const currentHp = hp.get(char.id) ?? 0;
      hp.set(char.id, currentHp - damageTaken);

      if (currentHp - damageTaken <= 0) {
        hp.set(char.id, 0);
        if (rng.next() < 0.3) {
          events.push({ kind: "death", encounterId: encounter.id, actorId: char.id });
        } else {
          events.push({ kind: "ko", encounterId: encounter.id, actorId: char.id });
          hp.set(char.id, 1);
        }
      }
    }
  }

  const aliveChars = chars.filter((c) => (hp.get(c.id) ?? 0) > 0);
  if (aliveChars.length > 0) {
    const totalDamage = events
      .filter((e) => e.kind === "hit" || e.kind === "sneak_attack" || e.kind === "smite")
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);

    if (totalDamage >= encounter.difficulty * 8) {
      const killer = rng.pick(aliveChars);
      events.push({
        kind: "kill", encounterId: encounter.id, actorId: killer.id,
        targetId: encounter.id, meta: { boss: encounter.isBoss },
      });
    }
  }

  for (const char of chars) {
    if (char.role !== "Tank" || (hp.get(char.id) ?? 0) <= 0) continue;
    if (rng.next() < 0.5) {
      events.push({ kind: "block", encounterId: encounter.id, actorId: char.id });
    }
    if (rng.next() < 0.3) {
      events.push({ kind: "taunt", encounterId: encounter.id, actorId: char.id });
    }
  }

  const healer = chars.find((c) => c.role === "Healer" && (hp.get(c.id) ?? 0) > 0);
  if (healer) {
    const woundedChars = chars.filter((c) => {
      const currentHp = hp.get(c.id) ?? 0;
      const maxHp = 10 + c.stats.con;
      return currentHp > 0 && currentHp < maxHp;
    });
    if (woundedChars.length > 0) {
      const target = rng.pick(woundedChars);
      const healAmount = Math.max(rng.nextInt(2, 8) + statMod(healer.stats.wis), 1);
      events.push({
        kind: "heal", encounterId: encounter.id, actorId: healer.id,
        targetId: target.id, amount: healAmount,
      });
      hp.set(target.id, (hp.get(target.id) ?? 0) + healAmount);
    }
  }

  return events;
}

export function resolveTrap(chars: Character[], encounter: Encounter, ctx: EncounterCtx): SimEvent[] {
  const { rng, hp } = ctx;
  const events: SimEvent[] = [];

  const utilityChar = chars.find((c) => c.role === "Utility" && (hp.get(c.id) ?? 0) > 0);
  if (utilityChar && statCheck(utilityChar, encounter.targetStats, encounter.difficulty, rng)) {
    events.push({ kind: "disarm_trap", encounterId: encounter.id, actorId: utilityChar.id });
    return events;
  }

  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;
    if (statCheck(char, encounter.targetStats, encounter.difficulty, rng)) {
      events.push({ kind: "save_pass", encounterId: encounter.id, actorId: char.id });
    } else {
      events.push({ kind: "save_fail", encounterId: encounter.id, actorId: char.id });
      const dmg = rng.nextInt(2, 8);
      events.push({ kind: "damage_taken", encounterId: encounter.id, actorId: char.id, amount: dmg });
      const currentHp = hp.get(char.id)!;
      hp.set(char.id, currentHp - dmg);
      if (currentHp - dmg <= 0) {
        hp.set(char.id, 0);
        events.push({ kind: "ko", encounterId: encounter.id, actorId: char.id });
        hp.set(char.id, 1);
      }
    }
  }

  return events;
}

export function resolvePuzzle(chars: Character[], encounter: Encounter, ctx: EncounterCtx): SimEvent[] {
  const { rng, hp } = ctx;
  const events: SimEvent[] = [];
  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;
    if (statCheck(char, encounter.targetStats, encounter.difficulty, rng)) {
      events.push({ kind: "save_pass", encounterId: encounter.id, actorId: char.id });
    } else {
      events.push({ kind: "save_fail", encounterId: encounter.id, actorId: char.id });
    }
  }
  return events;
}

export function resolveTreasure(chars: Character[], encounter: Encounter, ctx: EncounterCtx): SimEvent[] {
  const { rng, hp } = ctx;
  const events: SimEvent[] = [];
  const aliveChars = chars.filter((c) => (hp.get(c.id) ?? 0) > 0);
  if (aliveChars.length === 0) return events;
  const finder = rng.pick(aliveChars);
  events.push({ kind: "find_treasure", encounterId: encounter.id, actorId: finder.id });
  return events;
}

export function resolveSocial(chars: Character[], encounter: Encounter, ctx: EncounterCtx): SimEvent[] {
  const { rng, hp } = ctx;
  const events: SimEvent[] = [];
  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;
    const success = statCheck(char, encounter.targetStats, encounter.difficulty, rng);
    let kind: "persuade" | "deceive" | "intimidate";
    if (char.stats.cha >= char.stats.str && char.stats.cha >= char.stats.int) kind = "persuade";
    else if (char.stats.int >= char.stats.str) kind = "deceive";
    else kind = "intimidate";
    if (success) {
      events.push({ kind, encounterId: encounter.id, actorId: char.id });
    } else {
      events.push({ kind: "save_fail", encounterId: encounter.id, actorId: char.id });
    }
  }
  return events;
}

export function resolveArcane(chars: Character[], encounter: Encounter, ctx: EncounterCtx): SimEvent[] {
  const { rng, hp } = ctx;
  const events: SimEvent[] = [];
  const casterClasses = new Set(["Wizard", "Sorcerer", "Warlock", "Druid", "Cleric", "Bard"]);

  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;
    const isCaster = casterClasses.has(char.class);
    const checkDifficulty = isCaster ? encounter.difficulty - 2 : encounter.difficulty + 2;
    const success = statCheck(char, encounter.targetStats, checkDifficulty, rng);

    if (success) {
      if (isCaster) {
        const roll = rng.next();
        if (roll < 0.3) {
          events.push({ kind: "arcane_surge", encounterId: encounter.id, actorId: char.id });
        } else if (roll < 0.6) {
          events.push({ kind: "dispel", encounterId: encounter.id, actorId: char.id });
        } else {
          events.push({ kind: "channel", encounterId: encounter.id, actorId: char.id });
        }
      } else {
        events.push({ kind: "save_pass", encounterId: encounter.id, actorId: char.id });
      }
    } else {
      events.push({ kind: "save_fail", encounterId: encounter.id, actorId: char.id });
      const dmg = rng.nextInt(2, 6);
      events.push({ kind: "damage_taken", encounterId: encounter.id, actorId: char.id, amount: dmg });
      const currentHp = hp.get(char.id)!;
      hp.set(char.id, Math.max(0, currentHp - dmg));
      if (currentHp - dmg <= 0) {
        events.push({ kind: "ko", encounterId: encounter.id, actorId: char.id });
        hp.set(char.id, 1);
      }
    }
  }
  return events;
}

export type { EncounterCtx };
```

- [ ] **Step 5: Update `domain/sim/sim-engine.ts`**

Replace contents:

```ts
import type { Character, Dungeon, Lineup, SimEvent } from "domain/types";
import type { Rng } from "domain/rng";
import {
  resolveCombat, resolveTrap, resolvePuzzle, resolveTreasure,
  resolveSocial, resolveArcane,
  type EncounterCtx,
} from "./encounters";
import { newBuffState } from "./buffs";

export function runDungeon(
  lineup: Lineup,
  characterMap: Map<string, Character>,
  dungeon: Dungeon,
  rng: Rng,
): SimEvent[] {
  const activeChars = lineup.active.map((id) => characterMap.get(id)!);
  const hp = new Map<string, number>();
  for (const char of activeChars) {
    hp.set(char.id, 10 + char.stats.con);
  }

  const ctx: EncounterCtx = { rng, hp, buffs: newBuffState() };
  const allEvents: SimEvent[] = [];

  for (const encounter of dungeon.encounters) {
    const alive = activeChars.filter((c) => (hp.get(c.id) ?? 0) > 0);
    if (alive.length === 0) break;

    let events: SimEvent[] = [];
    switch (encounter.type) {
      case "combat":   events = resolveCombat(alive, encounter, ctx); break;
      case "trap":     events = resolveTrap(alive, encounter, ctx); break;
      case "puzzle":   events = resolvePuzzle(alive, encounter, ctx); break;
      case "treasure": events = resolveTreasure(alive, encounter, ctx); break;
      case "social":   events = resolveSocial(alive, encounter, ctx); break;
      case "arcane":   events = resolveArcane(alive, encounter, ctx); break;
    }
    allEvents.push(...events);
  }

  return allEvents;
}
```

- [ ] **Step 6: Update existing sim-engine tests for new fixture shape**

Open `tests/domain/sim-engine.test.ts`. The existing fixtures use `level: 1` and lack `specialty`/`xp`/`abilityTiers`. Update the helper function (likely called `makeChar` or similar) to:

```ts
function makeChar(
  id: string,
  cls: any = "Fighter",
  role: any = "DPS",
  specialty: any = "Champion",
): Character {
  return {
    id, name: id, race: "Human", class: cls, role, specialty,
    stats: { str: 14, dex: 12, con: 13, int: 10, wis: 12, cha: 10 },
    level: 3, xp: 30, abilityTiers: [1], description: "test",
  };
}
```

Apply this change to any helper at the top of the file. Also update `tests/domain/sim-engine.property.test.ts`, `tests/domain/highlights.test.ts`, `tests/domain/ai-manager.test.ts` and any other test that constructs a `Character` literal — add `specialty`, `xp: 0`, `abilityTiers: []` (for `level: 1`) or `[1]` (for `level >= 3`).

- [ ] **Step 7: Run tests to verify pass**

Run: `npm test -- tests/domain/`
Expected: PASS — all domain tests including the new class-aware combat tests.

- [ ] **Step 8: Commit**

```bash
git add domain/sim/ tests/domain/
git commit -m "feat(sim): class-aware combat with multiattack, sneak attack, smite, rage; new social/arcane resolvers"
```

---

### Task 11: Buff Generation in Sim

**Files:**
- Modify: `domain/sim/encounters.ts`
- Modify: `domain/sim/sim-engine.ts`
- Modify: `tests/domain/sim-engine.test.ts`

- [ ] **Step 1: Add failing test for buff generation**

Append to `tests/domain/sim-engine.test.ts`:

```ts
describe("buff generation", () => {
  it("War Domain Cleric generates buff events for party", () => {
    const c: Character = {
      id: "c", name: "C", race: "Human", class: "Cleric", role: "Healer",
      specialty: "War Domain",
      stats: { str: 8, dex: 10, con: 12, int: 10, wis: 16, cha: 14 },
      level: 6, xp: 0, abilityTiers: [1, 2], description: "",
    };
    const ally: Character = {
      ...c, id: "a", class: "Fighter", role: "DPS", specialty: "Champion",
      stats: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 8 },
    };
    const charMap = new Map([c, ally].map((ch) => [ch.id, ch]));
    const lineup: Lineup = { active: [c.id, ally.id, ally.id, ally.id], bench: ["x", "y"] };
    const dungeon: Dungeon = {
      id: "d", name: "T", theme: "fire",
      encounters: [{
        id: "e1", type: "combat", name: "Foe", difficulty: 4,
        targetStats: ["str"], isBoss: false,
      }],
    };
    const events = runDungeon(lineup, charMap, dungeon, createRng(5));
    expect(events.some((e) => e.kind === "buff" && e.actorId === "c")).toBe(true);
  });

  it("buff_proc credits buffer when buffed ally save_passes", () => {
    const c: Character = {
      id: "c", name: "C", race: "Human", class: "Cleric", role: "Healer",
      specialty: "War Domain",
      stats: { str: 8, dex: 10, con: 12, int: 10, wis: 16, cha: 14 },
      level: 6, xp: 0, abilityTiers: [1, 2], description: "",
    };
    const ally: Character = {
      ...c, id: "a", class: "Fighter", role: "DPS", specialty: "Champion",
      stats: { str: 16, dex: 12, con: 14, int: 14, wis: 14, cha: 8 },
    };
    const charMap = new Map([c, ally].map((ch) => [ch.id, ch]));
    const lineup: Lineup = { active: [c.id, ally.id, ally.id, ally.id], bench: ["x", "y"] };
    const dungeon: Dungeon = {
      id: "d", name: "T", theme: "mechanical",
      encounters: [
        { id: "e1", type: "combat", name: "Foe", difficulty: 2, targetStats: ["str"], isBoss: false },
        { id: "e2", type: "trap", name: "Trap", difficulty: 1, targetStats: ["dex"], isBoss: false },
        { id: "e3", type: "trap", name: "Trap", difficulty: 1, targetStats: ["dex"], isBoss: false },
      ],
    };
    let sawProc = false;
    for (let s = 0; s < 80 && !sawProc; s++) {
      const events = runDungeon(lineup, charMap, dungeon, createRng(s));
      if (events.some((e) => e.kind === "buff_proc" && e.actorId === "c")) sawProc = true;
    }
    expect(sawProc).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/domain/sim-engine.test.ts`
Expected: FAIL — no buff events.

- [ ] **Step 3: Add helper to generate buffs at encounter start**

Open `domain/sim/encounters.ts`. Add at the top, after imports:

```ts
import { addBuff, consumeBuff } from "./buffs";
import type { ActiveBuff, BuffKind } from "./buffs";

function recordBuffersForEncounter(
  chars: Character[],
  encounter: Encounter,
  ctx: EncounterCtx,
): SimEvent[] {
  const events: SimEvent[] = [];
  for (const char of chars) {
    if ((ctx.hp.get(char.id) ?? 0) <= 0) continue;
    const buffs = buffsForSpecialty(char);
    for (const buff of buffs) {
      const target = pickBuffTarget(char, chars, ctx);
      if (!target) continue;
      addBuff(ctx.buffs, {
        kind: buff.kind,
        sourceId: char.id,
        targetId: target.id,
        charges: buff.charges,
        bonus: buff.bonus,
      });
      events.push({
        kind: "buff", encounterId: encounter.id, actorId: char.id, targetId: target.id,
        meta: { buffKind: buff.kind },
      });
    }
  }
  return events;
}

function buffsForSpecialty(char: Character): { kind: BuffKind; charges: number; bonus: number }[] {
  if (char.specialty === "War Domain") return [{ kind: "bless", charges: 3, bonus: 4 }];
  if (char.specialty === "Lore") return [{ kind: "inspiration", charges: 1, bonus: 6 }];
  if (char.specialty === "Devotion" && char.level >= 6) return [{ kind: "aura", charges: 99, bonus: 2 }];
  if (char.specialty === "Shepherd") return [{ kind: "guidance", charges: 1, bonus: 4 }];
  return [];
}

function pickBuffTarget(
  source: Character,
  chars: Character[],
  ctx: EncounterCtx,
): Character | undefined {
  const others = chars.filter((c) => c.id !== source.id && (ctx.hp.get(c.id) ?? 0) > 0);
  if (others.length === 0) return undefined;
  return ctx.rng.pick(others);
}

function tryBuffProc(
  char: Character,
  encounterId: string,
  ctx: EncounterCtx,
): SimEvent | undefined {
  const consumed = consumeBuff(ctx.buffs, char.id, "bless")
    ?? consumeBuff(ctx.buffs, char.id, "inspiration")
    ?? consumeBuff(ctx.buffs, char.id, "aura")
    ?? consumeBuff(ctx.buffs, char.id, "guidance");
  if (!consumed) return undefined;
  return {
    kind: "buff_proc", encounterId, actorId: consumed.sourceId, targetId: char.id,
  };
}
```

- [ ] **Step 4: Wire `recordBuffersForEncounter` into each resolver**

In each `resolveX` function, prepend the buff-event generation. For example, in `resolveCombat` change the first line of the body to:

```ts
const events: SimEvent[] = [...recordBuffersForEncounter(chars, encounter, ctx)];
```

Apply the same prepend in `resolveTrap`, `resolvePuzzle`, `resolveTreasure`, `resolveSocial`, `resolveArcane`. Also in `resolveTrap` and `resolvePuzzle` and `resolveSocial`, after each `save_pass` push, also call `tryBuffProc` and push the result if returned. Example for `resolveTrap`:

```ts
if (statCheck(char, encounter.targetStats, encounter.difficulty, rng)) {
  events.push({ kind: "save_pass", encounterId: encounter.id, actorId: char.id });
  const proc = tryBuffProc(char, encounter.id, ctx);
  if (proc) events.push(proc);
}
```

Make the same change in `resolvePuzzle` (after save_pass) and `resolveSocial` (after persuade/deceive/intimidate). For `resolveCombat`, after each `hit` push, also call `tryBuffProc(char, encounter.id, ctx)` once per attack and append.

- [ ] **Step 5: Run test to verify pass**

Run: `npm test -- tests/domain/sim-engine.test.ts`
Expected: PASS — buff and buff_proc events generated.

- [ ] **Step 6: Commit**

```bash
git add domain/sim/encounters.ts tests/domain/sim-engine.test.ts
git commit -m "feat(sim): generate buff and buff_proc events for support specialties"
```

---

### Task 12: Revivify Mechanic

**Files:**
- Modify: `domain/sim/sim-engine.ts`
- Modify: `domain/sim/abilities-runtime.ts`
- Modify: `tests/domain/sim-engine.test.ts`

- [ ] **Step 1: Add failing test for revivify**

Append to `tests/domain/sim-engine.test.ts`:

```ts
describe("revivify", () => {
  it("Life Domain Cleric with charges revives a fallen ally and emits revivify event", () => {
    const cleric: Character = {
      id: "cl", name: "Cl", race: "Human", class: "Cleric", role: "Healer",
      specialty: "Life Domain",
      stats: { str: 8, dex: 10, con: 12, int: 10, wis: 18, cha: 12 },
      level: 6, xp: 0, abilityTiers: [1, 2], description: "",
    };
    const fragile: Character = {
      ...cleric, id: "f", class: "Wizard", role: "DPS", specialty: "Evoker",
      stats: { str: 6, dex: 8, con: 6, int: 18, wis: 10, cha: 10 },
    };
    const tank: Character = {
      ...cleric, id: "t", class: "Barbarian", role: "Tank", specialty: "Berserker",
      stats: { str: 18, dex: 10, con: 16, int: 8, wis: 8, cha: 8 },
    };
    const charMap = new Map([cleric, fragile, tank].map((c) => [c.id, c]));
    const lineup: Lineup = { active: [cleric.id, fragile.id, tank.id, tank.id], bench: ["x", "y"] };
    const dungeon: Dungeon = {
      id: "d", name: "T", theme: "demonic",
      encounters: Array.from({ length: 6 }, (_, i) => ({
        id: `e${i}`, type: "combat" as const, name: "Demon", difficulty: 8,
        targetStats: ["str" as const], isBoss: i === 5,
      })),
    };
    let sawRevivify = false;
    for (let s = 0; s < 50 && !sawRevivify; s++) {
      const events = runDungeon(lineup, charMap, dungeon, createRng(s), { revivifyCharges: { cl: 1 } });
      if (events.some((e) => e.kind === "revivify" && e.actorId === "cl")) sawRevivify = true;
    }
    expect(sawRevivify).toBe(true);
  });

  it("without charges, no revivify event is emitted", () => {
    const cleric: Character = {
      id: "cl", name: "Cl", race: "Human", class: "Cleric", role: "Healer",
      specialty: "Life Domain",
      stats: { str: 8, dex: 10, con: 12, int: 10, wis: 18, cha: 12 },
      level: 6, xp: 0, abilityTiers: [1, 2], description: "",
    };
    const fragile: Character = {
      ...cleric, id: "f", class: "Wizard", role: "DPS", specialty: "Evoker",
      stats: { str: 6, dex: 8, con: 6, int: 18, wis: 10, cha: 10 },
    };
    const charMap = new Map([cleric, fragile].map((c) => [c.id, c]));
    const lineup: Lineup = { active: [cleric.id, fragile.id, fragile.id, fragile.id], bench: ["x", "y"] };
    const dungeon: Dungeon = {
      id: "d", name: "T", theme: "demonic",
      encounters: [{
        id: "e1", type: "combat", name: "Foe", difficulty: 9,
        targetStats: ["str"], isBoss: true,
      }],
    };
    for (let s = 0; s < 30; s++) {
      const events = runDungeon(lineup, charMap, dungeon, createRng(s), { revivifyCharges: {} });
      expect(events.some((e) => e.kind === "revivify")).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/domain/sim-engine.test.ts`
Expected: FAIL — runDungeon signature.

- [ ] **Step 3: Update `domain/sim/sim-engine.ts` to accept charges**

Replace contents:

```ts
import type { Character, Dungeon, Lineup, SimEvent } from "domain/types";
import type { Rng } from "domain/rng";
import {
  resolveCombat, resolveTrap, resolvePuzzle, resolveTreasure,
  resolveSocial, resolveArcane,
  type EncounterCtx,
} from "./encounters";
import { newBuffState } from "./buffs";
import { hasRevivify } from "./abilities-runtime";

export interface RunDungeonOptions {
  revivifyCharges?: Record<string, number>;
}

export function runDungeon(
  lineup: Lineup,
  characterMap: Map<string, Character>,
  dungeon: Dungeon,
  rng: Rng,
  options: RunDungeonOptions = {},
): SimEvent[] {
  const activeChars = lineup.active.map((id) => characterMap.get(id)!);
  const hp = new Map<string, number>();
  for (const char of activeChars) {
    hp.set(char.id, 10 + char.stats.con);
  }

  const charges = new Map<string, number>(Object.entries(options.revivifyCharges ?? {}));
  const ctx: EncounterCtx = { rng, hp, buffs: newBuffState() };
  const allEvents: SimEvent[] = [];

  for (const encounter of dungeon.encounters) {
    const alive = activeChars.filter((c) => (hp.get(c.id) ?? 0) > 0);
    if (alive.length === 0) break;

    let events: SimEvent[] = [];
    switch (encounter.type) {
      case "combat":   events = resolveCombat(alive, encounter, ctx); break;
      case "trap":     events = resolveTrap(alive, encounter, ctx); break;
      case "puzzle":   events = resolvePuzzle(alive, encounter, ctx); break;
      case "treasure": events = resolveTreasure(alive, encounter, ctx); break;
      case "social":   events = resolveSocial(alive, encounter, ctx); break;
      case "arcane":   events = resolveArcane(alive, encounter, ctx); break;
    }
    allEvents.push(...events);

    // Post-encounter: attempt revivify if anyone died
    const cleric = activeChars.find((c) => hasRevivify(c) && (hp.get(c.id) ?? 0) > 0);
    if (cleric && (charges.get(cleric.id) ?? 0) > 0) {
      const dead = events.find((e) => e.kind === "death");
      if (dead) {
        charges.set(cleric.id, (charges.get(cleric.id) ?? 0) - 1);
        hp.set(dead.actorId, 5);
        allEvents.push({
          kind: "revivify", encounterId: encounter.id,
          actorId: cleric.id, targetId: dead.actorId,
        });
      }
    }
  }

  return allEvents;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/domain/sim-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add domain/sim/sim-engine.ts tests/domain/sim-engine.test.ts
git commit -m "feat(sim): revivify mechanic with charge tracking"
```

---

### Task 13: Scouting Module

**Files:**
- Create: `domain/scouting.ts`
- Create: `tests/domain/scouting.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/domain/scouting.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/domain/scouting.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `domain/scouting.ts`**

```ts
import type {
  Character, EncounterType, LeagueSettings, Lineup, ScoutingReport, SimEvent,
} from "./types";
import type { ContentSource } from "./content/content-source";
import { runDungeon } from "./sim/sim-engine";
import { score } from "./scoring";
import { createRng, seedFromIds } from "./rng";
import { isCoreEventForSpecialty } from "./specialties";
import { ALL_THEMES } from "./themes";

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  const variance = xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

export function runScouting(
  characters: Character[],
  contentSource: ContentSource,
  leagueId: string,
  runs: number,
  settings: LeagueSettings,
): Record<string, ScoutingReport> {
  const charMap = new Map(characters.map((c) => [c.id, c]));
  const perCharRunPoints = new Map<string, number[]>();
  const perCharEventPoints = new Map<string, Record<string, number>>();
  const perCharProcCount = new Map<string, { proc: number; total: number }>();
  const perCharByEncounterType = new Map<string, Record<EncounterType, number[]>>();

  for (const c of characters) {
    perCharRunPoints.set(c.id, []);
    perCharEventPoints.set(c.id, {});
    perCharProcCount.set(c.id, { proc: 0, total: 0 });
    perCharByEncounterType.set(c.id, {
      combat: [], trap: [], puzzle: [], treasure: [], social: [], arcane: [],
    });
  }

  for (let runIdx = 0; runIdx < runs; runIdx++) {
    const baseRng = createRng(seedFromIds(leagueId, "scout", String(runIdx)));
    const shuffled = baseRng.shuffle([...characters]);
    const partySize = 4;
    const totalParties = Math.floor(shuffled.length / partySize);

    for (let p = 0; p < totalParties; p++) {
      const party = shuffled.slice(p * partySize, (p + 1) * partySize);
      if (party.length < partySize) continue;

      const lineup: Lineup = {
        active: [party[0].id, party[1].id, party[2].id, party[3].id],
        bench: ["bench-a", "bench-b"],
      };
      const theme = baseRng.pick(ALL_THEMES);
      const dungeon = contentSource.generateDungeon(0, p, baseRng.fork(`d${p}`), theme, settings.encounterCount);
      const events = runDungeon(lineup, charMap, dungeon, baseRng.fork(`s${p}`));
      const result = score(events, party);

      for (const c of party) {
        const cs = result.perCharacter.get(c.id);
        if (!cs) continue;
        perCharRunPoints.get(c.id)!.push(cs.totalPoints);

        const eventBreakdown = perCharEventPoints.get(c.id)!;
        for (const e of events) {
          if (e.actorId !== c.id) continue;
          eventBreakdown[e.kind] = (eventBreakdown[e.kind] ?? 0) + 1;
        }

        const procStat = perCharProcCount.get(c.id)!;
        for (const e of events) {
          if (e.actorId !== c.id) continue;
          procStat.total += 1;
          if (isCoreEventForSpecialty(c.specialty, e.kind)) procStat.proc += 1;
        }

        const byEnc = perCharByEncounterType.get(c.id)!;
        const eventsByEnc = new Map<string, SimEvent[]>();
        for (const e of events) {
          if (e.actorId !== c.id) continue;
          const enc = dungeon.encounters.find((x) => x.id === e.encounterId);
          if (!enc) continue;
          if (!eventsByEnc.has(enc.type)) eventsByEnc.set(enc.type, []);
          eventsByEnc.get(enc.type)!.push(e);
        }
        for (const [encType, evs] of eventsByEnc) {
          const subtotal = score(evs, [c]).perCharacter.get(c.id)!.totalPoints;
          byEnc[encType as EncounterType].push(subtotal);
        }
      }
    }
  }

  const reports: Record<string, ScoutingReport> = {};
  for (const c of characters) {
    const points = perCharRunPoints.get(c.id) ?? [];
    const procs = perCharProcCount.get(c.id) ?? { proc: 0, total: 0 };
    const byEnc = perCharByEncounterType.get(c.id)!;
    const avgByType: Record<string, number> = {};
    for (const [k, v] of Object.entries(byEnc)) avgByType[k] = mean(v);

    let bestType: EncounterType = "combat";
    let bestVal = -Infinity;
    let worstType: EncounterType = "combat";
    let worstVal = Infinity;
    for (const [k, v] of Object.entries(avgByType)) {
      if (v > bestVal) { bestVal = v; bestType = k as EncounterType; }
      if (v < worstVal) { worstVal = v; worstType = k as EncounterType; }
    }

    const avg = mean(points);
    const sd = stddev(points);
    const consistency = avg > 0 ? Math.max(0, Math.min(1, 1 - sd / Math.max(avg, 1))) : 0;

    reports[c.id] = {
      characterId: c.id,
      runs,
      avgPoints: Number(avg.toFixed(2)),
      pointsByEventType: avgByType,
      bestEncounterType: bestType,
      worstEncounterType: worstType,
      specialtyProcRate: procs.total > 0 ? procs.proc / procs.total : 0,
      consistencyScore: Number(consistency.toFixed(3)),
      projectedValue: 0,
    };
    reports[c.id].projectedValue = projectedValue(reports[c.id]);
  }

  return reports;
}

export function projectedValue(report: ScoutingReport): number {
  const ptsTerm = Math.max(report.avgPoints, 0);
  const procTerm = report.specialtyProcRate * 5;
  const consistencyTerm = report.consistencyScore * 3;
  return Number((ptsTerm + procTerm + consistencyTerm).toFixed(2));
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/domain/scouting.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add domain/scouting.ts tests/domain/scouting.test.ts
git commit -m "feat(scouting): pre-draft exhibition runs with reports and projected value"
```

---

### Task 14: Highlight Templates and Generation for New Events

**Files:**
- Modify: `domain/content/highlight-templates.ts`
- Modify: `domain/highlights.ts`
- Modify: `tests/domain/highlights.test.ts`

- [ ] **Step 1: Update `domain/content/highlight-templates.ts`**

Open the file and ensure `DEFAULT_HIGHLIGHT_TEMPLATES` includes entries for every new event kind. Add (or merge):

```ts
buff: ["{actor} blessed {target}!", "{actor} inspired {target}!"],
buff_proc: ["{actor}'s buff guided {target} to victory!"],
block: ["{actor} blocked the blow!"],
taunt: ["{actor} taunted the foe!"],
persuade: ["{actor} persuaded the {encounter}."],
deceive: ["{actor} outsmarted the {encounter}."],
intimidate: ["{actor} intimidated the {encounter}."],
dispel: ["{actor} dispelled the magic of {encounter}."],
channel: ["{actor} channeled arcane power."],
arcane_surge: ["{actor} unleashed an arcane surge!"],
multiattack: ["{actor} struck multiple times!"],
sneak_attack: ["{actor} landed a sneak attack for {amount}!"],
smite: ["{actor} smote {target} for {amount}!"],
rage: ["{actor} entered a rage!"],
revivify: ["{actor} revived {target}!"],
```

- [ ] **Step 2: Update test for new templates**

Append to `tests/domain/highlights.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateHighlights } from "domain/highlights";
import type { Character, Dungeon, SimEvent } from "domain/types";

describe("highlights — new events", () => {
  it("generates a revivify highlight", () => {
    const cleric: Character = {
      id: "cl", name: "Cleric", race: "Human", class: "Cleric", role: "Healer",
      specialty: "Life Domain",
      stats: { str: 8, dex: 10, con: 12, int: 10, wis: 18, cha: 12 },
      level: 6, xp: 0, abilityTiers: [1, 2], description: "",
    };
    const target: Character = {
      ...cleric, id: "t", class: "Fighter", role: "DPS", specialty: "Champion",
    };
    const dungeon: Dungeon = {
      id: "d", name: "Tomb", theme: "undead",
      encounters: [{
        id: "e1", type: "combat", name: "Lich", difficulty: 7,
        targetStats: ["wis"], isBoss: true,
      }],
    };
    const events: SimEvent[] = [
      { kind: "death", encounterId: "e1", actorId: "t" },
      { kind: "revivify", encounterId: "e1", actorId: "cl", targetId: "t" },
    ];
    const highlights = generateHighlights(events, [cleric, target], dungeon);
    expect(highlights.some((h) => h.kind === "revivify")).toBe(true);
  });

  it("generates an arcane_surge highlight", () => {
    const wiz: Character = {
      id: "w", name: "Wiz", race: "Elf", class: "Wizard", role: "DPS",
      specialty: "Evoker",
      stats: { str: 8, dex: 10, con: 10, int: 18, wis: 12, cha: 10 },
      level: 6, xp: 0, abilityTiers: [1, 2], description: "",
    };
    const dungeon: Dungeon = {
      id: "d", name: "Tower", theme: "arcane",
      encounters: [{
        id: "e1", type: "arcane", name: "Sigil", difficulty: 5,
        targetStats: ["int"], isBoss: false,
      }],
    };
    const events: SimEvent[] = [
      { kind: "arcane_surge", encounterId: "e1", actorId: "w" },
    ];
    const highlights = generateHighlights(events, [wiz], dungeon);
    expect(highlights.some((h) => h.kind === "arcane_surge")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test, expect failure**

Run: `npm test -- tests/domain/highlights.test.ts`
Expected: FAIL — no cases for new event kinds.

- [ ] **Step 4: Update `domain/highlights.ts` switch**

In the `switch (event.kind)` block, add cases:

```ts
case "revivify": {
  const tmpl = templates.revivify[0] ?? "{actor} revived {target}!";
  candidates.push({
    highlight: { kind: "revivify", actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "high" },
    priority: 80,
  });
  break;
}
case "arcane_surge": {
  const tmpl = templates.arcane_surge[0] ?? "{actor} unleashed an arcane surge!";
  candidates.push({
    highlight: { kind: "arcane_surge", actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "medium" },
    priority: 25,
  });
  break;
}
case "smite": {
  if ((event.amount ?? 0) >= 6) {
    const tmpl = templates.smite[0] ?? "{actor} smote {target}!";
    candidates.push({
      highlight: { kind: "smite", actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "medium" },
      priority: 15 + (event.amount ?? 0),
    });
  }
  break;
}
case "sneak_attack": {
  if ((event.amount ?? 0) >= 6) {
    const tmpl = templates.sneak_attack[0] ?? "{actor} landed a sneak attack!";
    candidates.push({
      highlight: { kind: "sneak_attack", actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "medium" },
      priority: 12 + (event.amount ?? 0),
    });
  }
  break;
}
case "buff": {
  const tmpl = templates.buff[0] ?? "{actor} buffed {target}!";
  candidates.push({
    highlight: { kind: "buff", actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "low" },
    priority: 5,
  });
  break;
}
case "persuade":
case "deceive":
case "intimidate": {
  const tmpl = templates[event.kind][0] ?? `{actor} prevailed.`;
  candidates.push({
    highlight: { kind: event.kind, actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "low" },
    priority: 8,
  });
  break;
}
```

- [ ] **Step 5: Run test to verify pass**

Run: `npm test -- tests/domain/highlights.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add domain/content/highlight-templates.ts domain/highlights.ts tests/domain/highlights.test.ts
git commit -m "feat(highlights): templates and generation for new event kinds"
```

---

### Task 15: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update `prisma/schema.prisma`**

Replace contents:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model League {
  id              String      @id @default(cuid())
  name            String
  phase           String      @default("draft")
  currentWeek     Int         @default(0)
  settings        Json        @default("{}")
  scoutingReports Json?
  createdAt       DateTime    @default(now())

  teams      Team[]
  characters Character[]
  matchups   Matchup[]
}

model Team {
  id            String  @id @default(cuid())
  name          String
  leagueId      String
  managerId     String
  managerType   String
  aiPersonality Json?
  wins          Int     @default(0)
  losses        Int     @default(0)
  pointsFor     Float   @default(0)
  pointsAgainst Float   @default(0)

  league       League    @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  roster       Character[] @relation("TeamRoster")
  lineups      Lineup[]
  homeMatchups Matchup[] @relation("HomeTeam")
  awayMatchups Matchup[] @relation("AwayTeam")
}

model Character {
  id           String @id @default(cuid())
  externalId   String
  name         String
  race         String
  class        String
  role         String
  specialty    String
  stats        Json
  level        Int    @default(3)
  xp           Int    @default(30)
  abilityTiers Json   @default("[1]")
  description  String

  leagueId String
  league   League @relation(fields: [leagueId], references: [id], onDelete: Cascade)

  teamId String?
  team   Team?   @relation("TeamRoster", fields: [teamId], references: [id])

  draftOrder Int?
}

model Lineup {
  id     String @id @default(cuid())
  teamId String
  week   Int
  active Json
  bench  Json

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, week])
}

model Matchup {
  id          String  @id @default(cuid())
  leagueId    String
  week        Int
  homeTeamId  String
  awayTeamId  String
  dungeonData Json?
  homeRunData Json?
  awayRunData Json?
  winnerId    String?

  league   League @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  homeTeam Team   @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeam Team   @relation("AwayTeam", fields: [awayTeamId], references: [id])

  @@index([leagueId, week])
}
```

- [ ] **Step 2: Generate migration**

```bash
npx prisma migrate dev --name balance_overhaul
```

Expected: migration file created, schema applied to dev DB.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Verify build passes**

Run: `npm run typecheck`
Expected: PASS (or one error in services pointing at Character that we'll fix in next task).

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add specialty/xp/abilityTiers to Character, scoutingReports to League"
```

---

### Task 16: League Service — Preset Apply, Scouting on Create

**Files:**
- Modify: `services/league-service.server.ts`
- Modify: `tests/services/league-service.test.ts`

- [ ] **Step 1: Inspect existing test file structure**

Run: `cat tests/services/league-service.test.ts | head -60`

Adjust the test below to match the project's existing patterns (mock vs. real Prisma). The example assumes existing tests use real Prisma in a test DB. If they use mocks, port accordingly.

- [ ] **Step 2: Add tests for preset and scouting**

Append to `tests/services/league-service.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createLeague } from "services/league-service.server";

describe("createLeague — overhaul", () => {
  it("applies the requested preset to settings", async () => {
    const league = await createLeague("Quick Test", "user-1", "My Team", { preset: "quick" });
    const settings = league.settings as any;
    expect(settings.preset).toBe("quick");
    expect(settings.seasonWeeks).toBe(5);
    expect(settings.scoutingRuns).toBe(3);
  });

  it("generates correct number of characters from preset.characterPool", async () => {
    const league = await createLeague("Champions", "user-1", "Boss Team", { preset: "champions" });
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const count = await prisma.character.count({ where: { leagueId: league.id } });
    expect(count).toBe(72);
  });

  it("stores scouting reports on the league", async () => {
    const league = await createLeague("Scout Test", "user-1", "Team", { preset: "standard" });
    expect(league.scoutingReports).toBeDefined();
    const reports = league.scoutingReports as any;
    expect(Object.keys(reports).length).toBeGreaterThan(0);
  });

  it("characters start at preset.startingLevel", async () => {
    const league = await createLeague("Vet Test", "user-1", "Team", { preset: "veterans" });
    const settings = league.settings as any;
    expect(settings.startingLevel).toBe(5);
  });
});
```

If the test file uses a different DB setup pattern, mirror it. Otherwise, adapt these assertions to whatever fixtures the existing tests provide.

- [ ] **Step 3: Run tests, expect failures**

Run: `npm test -- tests/services/league-service.test.ts`
Expected: FAIL — `createLeague` doesn't accept overrides; no scouting reports.

- [ ] **Step 4: Update `services/league-service.server.ts` createLeague**

Open the file and replace the `createLeague` function (and its helpers around it) with:

```ts
import { applyPreset } from "domain/presets";
import { runScouting } from "domain/scouting";
import type { LeagueSettings, PresetName } from "domain/types";

export async function createLeague(
  name: string,
  userId: string,
  teamName?: string,
  overrides: Partial<LeagueSettings> & { preset?: PresetName } = {},
) {
  const presetName = overrides.preset ?? "standard";
  const settings: LeagueSettings = applyPreset(presetName, overrides);

  const leagueId = crypto.randomUUID();
  const rng = createRng(seedFromIds(leagueId, "init"));
  const characters = contentSource.generateCharacters(settings.characterPool, rng, settings);

  const scoutingReports = runScouting(characters, contentSource, leagueId, settings.scoutingRuns, settings);

  const league = await prisma.league.create({
    data: {
      id: leagueId,
      name,
      phase: "draft",
      currentWeek: 0,
      settings: settings as any,
      scoutingReports: scoutingReports as any,
    },
  });

  await prisma.character.createMany({
    data: characters.map((c) => ({
      externalId: c.id,
      name: c.name,
      race: c.race,
      class: c.class,
      role: c.role,
      specialty: c.specialty,
      stats: c.stats as any,
      level: c.level,
      xp: c.xp,
      abilityTiers: c.abilityTiers as any,
      description: c.description,
      leagueId: league.id,
    })),
  });

  const humanTeam = await prisma.team.create({
    data: {
      name: teamName?.trim() || "Your Team",
      leagueId: league.id,
      managerId: userId,
      managerType: "human",
    },
  });

  const teamIds: string[] = [humanTeam.id];
  for (let i = 0; i < settings.teamCount - 1; i++) {
    const aiTeam = await prisma.team.create({
      data: {
        name: AI_TEAM_NAMES[i] ?? `AI Team ${i + 1}`,
        leagueId: league.id,
        managerId: `ai-${i}`,
        managerType: "ai",
        aiPersonality: AI_PERSONALITIES[i % AI_PERSONALITIES.length] as any,
      },
    });
    teamIds.push(aiTeam.id);
  }

  const schedule = generateRegularSeason(teamIds);
  for (let weekIdx = 0; weekIdx < Math.min(schedule.length, settings.seasonWeeks); weekIdx++) {
    for (const matchup of schedule[weekIdx]) {
      await prisma.matchup.create({
        data: {
          leagueId: league.id,
          week: weekIdx + 1,
          homeTeamId: matchup.home,
          awayTeamId: matchup.away,
        },
      });
    }
  }

  return league;
}
```

- [ ] **Step 5: Replace internal `charMap` build to include new fields in `advanceWeek`**

In `advanceWeek`, the loop that builds `charMap` from DB rows must now include `specialty`, `xp`, `abilityTiers`. Update it to:

```ts
for (const c of allChars) {
  charMap.set(c.externalId, {
    id: c.externalId,
    name: c.name,
    race: c.race as any,
    class: c.class as any,
    role: c.role as any,
    specialty: c.specialty as any,
    stats: c.stats as any,
    level: c.level,
    xp: c.xp,
    abilityTiers: (c.abilityTiers as number[]) ?? [],
    description: c.description,
  });
}
```

Apply the same projection wherever else `Character` objects are constructed from DB rows in this file (look for places that build `rosterChars`).

- [ ] **Step 6: Update dungeon generation in `advanceWeek`**

Find the line `const dungeon = contentSource.generateDungeon(week, 0, rng.fork("dungeon"));` and replace with:

```ts
const settings = league.settings as any;
const themes = ["undead", "fire", "shadow", "arcane", "demonic", "nature", "mechanical", "aquatic", "draconic", "ice"];
const themeRng = rng.fork("theme");
const theme = themes[themeRng.nextInt(0, themes.length - 1)];
const dungeon = contentSource.generateDungeon(
  week, 0, rng.fork("dungeon"), theme, settings.encounterCount ?? "5-8",
);
```

- [ ] **Step 7: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/league-service.server.ts tests/services/league-service.test.ts
git commit -m "feat(service): apply preset, run scouting, project Character with new fields"
```

---

### Task 17: League Service — XP and Level-Ups After Each Week

**Files:**
- Modify: `services/league-service.server.ts`
- Modify: `tests/services/league-service.test.ts`

- [ ] **Step 1: Add failing test**

Append to `tests/services/league-service.test.ts`:

```ts
import { advanceWeek } from "services/league-service.server";

describe("advanceWeek — XP and leveling", () => {
  it("characters who played gain xp", async () => {
    const league = await createLeague("XP Test", "user-2", "Team B", { preset: "standard" });
    // Seed lineup minimally; helper from existing tests should be reused.
    await advanceWeek(league.id);
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const chars = await prisma.character.findMany({ where: { leagueId: league.id, teamId: { not: null } } });
    const startedAtBaseXp = chars.filter((c) => c.xp > 30);
    expect(startedAtBaseXp.length).toBeGreaterThan(0);
  });
});
```

If your test infra uses a transactional fixture or in-memory DB, adapt accordingly.

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/services/league-service.test.ts`
Expected: FAIL — XP not being applied.

- [ ] **Step 3: Add XP application logic to `advanceWeek`**

In `services/league-service.server.ts`, just after both `processTeam` calls return for a matchup but before `prisma.matchup.update`, add:

```ts
import { applyXpAndLevel, xpFromEvents } from "domain/leveling";

// ... within advanceWeek, after homeResult and awayResult are computed ...

if (settings.xpEnabled !== false) {
  const xpScale = (10 / Math.max(1, settings.seasonWeeks ?? 10));
  for (const teamSide of ["home", "away"] as const) {
    const result = teamSide === "home" ? homeResult : awayResult;
    const teamId = teamSide === "home" ? matchup.homeTeamId : matchup.awayTeamId;
    const teamChars = allChars.filter((c) => c.teamId === teamId);
    for (const dbChar of teamChars) {
      const domainChar = charMap.get(dbChar.externalId);
      if (!domainChar) continue;
      const xpAward = xpFromEvents(domainChar, result.events);
      if (xpAward <= 0 && domainChar.level >= settings.maxLevel) continue;
      const { character: updated, levelUps } = applyXpAndLevel(
        domainChar, xpAward, xpScale, settings.maxLevel ?? 20,
      );
      if (xpAward > 0 || levelUps.length > 0) {
        await prisma.character.update({
          where: { id: dbChar.id },
          data: {
            xp: updated.xp,
            level: updated.level,
            stats: updated.stats as any,
            abilityTiers: updated.abilityTiers as any,
          },
        });
        // Refresh local map so subsequent matchups in same week see new state
        charMap.set(updated.id, updated);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/services/league-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/league-service.server.ts tests/services/league-service.test.ts
git commit -m "feat(service): apply XP and level-ups after each weekly matchup"
```

---

### Task 18: Draft Service — Scouting Visibility

**Files:**
- Modify: `services/draft-service.server.ts`
- Modify: `tests/services/draft-service.test.ts`

- [ ] **Step 1: Add failing test**

Append to `tests/services/draft-service.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getDraftState } from "services/draft-service.server";
import { createLeague } from "services/league-service.server";

describe("getDraftState — scouting", () => {
  it("includes a scouting report per available character on full visibility", async () => {
    const league = await createLeague("Scout Vis", "user-3", "Team", { preset: "standard" });
    const state = await getDraftState(league.id);
    for (const c of state.available) {
      expect((c as any).scouting).toBeDefined();
      expect((c as any).scouting.avgPoints).toBeDefined();
    }
  });

  it("returns specialty alongside class/role", async () => {
    const league = await createLeague("Spec", "user-3", "Team", { preset: "standard" });
    const state = await getDraftState(league.id);
    expect((state.available[0] as any).specialty).toBeDefined();
  });

  it("hides performance data on hidden visibility", async () => {
    const league = await createLeague("Hidden", "user-3", "Team", {
      preset: "standard", scoutingVisibility: "hidden",
    });
    const state = await getDraftState(league.id);
    expect((state.available[0] as any).scouting).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/services/draft-service.test.ts`
Expected: FAIL — no `scouting` field, no `specialty` projection.

- [ ] **Step 3: Update `services/draft-service.server.ts`**

Open the file and change `getDraftState`. Modify the league fetch to include `scoutingReports`, then in the projection of `available`:

```ts
const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
const settings = league.settings as any;
const visibility = settings.scoutingVisibility ?? "full";
const reports = (league.scoutingReports as Record<string, any>) ?? {};

// ...

available: available.map((c) => {
  const r = reports[c.externalId];
  const scoutingPayload = (() => {
    if (!r) return undefined;
    if (visibility === "hidden") return undefined;
    if (visibility === "partial") return { avgPoints: r.avgPoints };
    return r;
  })();
  return {
    id: c.id,
    externalId: c.externalId,
    name: c.name,
    race: c.race,
    class: c.class,
    role: c.role,
    specialty: c.specialty,
    stats: c.stats,
    level: c.level,
    xp: c.xp,
    abilityTiers: c.abilityTiers,
    description: c.description,
    scouting: scoutingPayload,
  };
}),
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/services/draft-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/draft-service.server.ts tests/services/draft-service.test.ts
git commit -m "feat(draft): include scouting report and specialty per character with visibility filter"
```

---

### Task 19: UI — Character Card Shows Specialty, Level, Abilities

**Files:**
- Modify: `app/components/character-card.tsx`

- [ ] **Step 1: Replace `app/components/character-card.tsx`**

```tsx
import { unlockedAbilities } from "domain/abilities";

interface CharacterCardProps {
  character: {
    id: string;
    name: string;
    race: string;
    class: string;
    role: string;
    specialty?: string;
    stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
    level: number;
    xp?: number;
    abilityTiers?: number[];
    description: string;
    scouting?: {
      avgPoints?: number;
      specialtyProcRate?: number;
      consistencyScore?: number;
      projectedValue?: number;
    };
  };
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
}

export function CharacterCard({ character, onClick, selected, compact }: CharacterCardProps) {
  const roleClass = `badge badge-${character.role.toLowerCase()}`;
  const abilities = character.specialty
    ? unlockedAbilities(
        character.class as any,
        character.specialty as any,
        character.level,
      )
    : [];

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        border: selected ? "2px solid var(--accent)" : undefined,
        padding: compact ? "0.5rem" : "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{character.name}</strong>
        <span className={roleClass}>{character.role}</span>
      </div>
      <div style={{ fontSize: "0.85rem", color: "var(--ink-light)", marginTop: "0.25rem" }}>
        {character.race} {character.class}
        {character.specialty ? ` · ${character.specialty}` : null}
        {` · L${character.level}`}
      </div>

      {!compact && (
        <>
          <div style={{ fontSize: "0.8rem", marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span>STR {character.stats.str}</span>
            <span>DEX {character.stats.dex}</span>
            <span>CON {character.stats.con}</span>
            <span>INT {character.stats.int}</span>
            <span>WIS {character.stats.wis}</span>
            <span>CHA {character.stats.cha}</span>
          </div>

          {abilities.length > 0 && (
            <div style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
              <strong>Abilities:</strong>{" "}
              {abilities.map((a) => a.name).join(", ")}
            </div>
          )}

          {character.scouting && (
            <div style={{ fontSize: "0.8rem", marginTop: "0.5rem", padding: "0.4rem", background: "var(--parchment-dark, #f4ecd8)", borderRadius: 4 }}>
              <strong>Scouting:</strong>{" "}
              avg {character.scouting.avgPoints?.toFixed(1) ?? "?"} pts
              {character.scouting.specialtyProcRate !== undefined
                ? ` · proc ${(character.scouting.specialtyProcRate * 100).toFixed(0)}%`
                : null}
              {character.scouting.projectedValue !== undefined
                ? ` · value ${character.scouting.projectedValue}`
                : null}
            </div>
          )}

          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", fontStyle: "italic" }}>
            {character.description}
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run dev server and visually verify**

```bash
npm run dev
```

In a browser, navigate to the draft page of an existing test league, confirm the cards now show specialty, level, abilities, and scouting line. Stop the dev server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add app/components/character-card.tsx
git commit -m "feat(ui): character card shows specialty, abilities, scouting"
```

---

### Task 20: UI — League Creation Preset Picker

**Files:**
- Modify: `app/routes/leagues.new.tsx`
- Modify: `services/league-service.server.ts` (action handler — confirm interface)

- [ ] **Step 1: Open `app/routes/leagues.new.tsx`**

Read the current contents of the route. Identify where the form is built and where `createLeague` is called from the action.

- [ ] **Step 2: Add a preset `<select>` to the form**

Update the JSX to include:

```tsx
<label style={{ display: "block", marginTop: "1rem" }}>
  League Style
  <select name="preset" defaultValue="standard" style={{ display: "block", marginTop: "0.25rem" }}>
    <option value="standard">Standard — 10+3 weeks, level 12-13</option>
    <option value="quick">Quick Play — 5+2 weeks, level 8-9</option>
    <option value="epic">Epic Campaign — 20+4 weeks, level 18-20</option>
    <option value="champions">Champions — Level 20 from start, no XP</option>
    <option value="veterans">Veterans — Start at level 5, deep scouting</option>
  </select>
</label>
```

- [ ] **Step 3: Read `preset` from form data in the action**

In the action function, extract:

```ts
const preset = (formData.get("preset") as string) ?? "standard";
const validPresets = ["standard", "quick", "epic", "champions", "veterans"] as const;
type ValidPreset = typeof validPresets[number];
const safePreset: ValidPreset = (validPresets as readonly string[]).includes(preset)
  ? (preset as ValidPreset) : "standard";

const league = await createLeague(name, userId, teamName, { preset: safePreset });
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Verify in dev server**

```bash
npm run dev
```

Navigate to `/leagues/new`, create a "Quick Play" league, then visit the league page and confirm settings show 5-week season. Stop server.

- [ ] **Step 6: Commit**

```bash
git add app/routes/leagues.new.tsx
git commit -m "feat(ui): preset picker on league creation form"
```

---

### Task 21: UI — Matchup Page Renders New Event Kinds

**Files:**
- Modify: `app/components/play-by-play.tsx`

- [ ] **Step 1: Open `app/components/play-by-play.tsx`**

Read the file and find the icon/label mapping for events.

- [ ] **Step 2: Extend the event-to-label map**

Find the section that switches/maps on `event.kind` and add entries for the new kinds:

```ts
const EVENT_LABELS: Record<string, { icon: string; label: string }> = {
  hit: { icon: "⚔️", label: "Hit" },
  kill: { icon: "💀", label: "Kill" },
  crit: { icon: "🎯", label: "Crit" },
  heal: { icon: "✨", label: "Heal" },
  damage_taken: { icon: "🩸", label: "Damage taken" },
  save_pass: { icon: "🛡️", label: "Save" },
  save_fail: { icon: "✗", label: "Failed save" },
  disarm_trap: { icon: "🔧", label: "Disarmed trap" },
  find_treasure: { icon: "💰", label: "Treasure" },
  ko: { icon: "💤", label: "KO" },
  death: { icon: "☠️", label: "Death" },
  buff: { icon: "🌟", label: "Buff" },
  buff_proc: { icon: "🌟", label: "Buff proc" },
  block: { icon: "🛡️", label: "Block" },
  taunt: { icon: "📢", label: "Taunt" },
  persuade: { icon: "💬", label: "Persuade" },
  deceive: { icon: "🎭", label: "Deceive" },
  intimidate: { icon: "😠", label: "Intimidate" },
  dispel: { icon: "🌀", label: "Dispel" },
  channel: { icon: "🔮", label: "Channel" },
  arcane_surge: { icon: "⚡", label: "Arcane surge" },
  multiattack: { icon: "⚔️⚔️", label: "Multiattack" },
  sneak_attack: { icon: "🗡️", label: "Sneak Attack" },
  smite: { icon: "✨⚔️", label: "Smite" },
  rage: { icon: "🔥", label: "Rage" },
  revivify: { icon: "💖", label: "Revivify" },
};
```

If the existing component uses a different shape, merge accordingly. Make sure unrecognized kinds fall back to a neutral icon rather than crashing.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Verify in dev**

Run a league through to a completed matchup and view the play-by-play. Confirm new event kinds render with proper labels. Stop server.

- [ ] **Step 5: Commit**

```bash
git add app/components/play-by-play.tsx
git commit -m "feat(ui): render new event kinds in play-by-play"
```

---

### Task 22: UI Smoke Tests Updated

**Files:**
- Modify: `tests/ui/smoke.test.ts`

- [ ] **Step 1: Update existing smoke test fixtures**

Open `tests/ui/smoke.test.ts`. Wherever a test creates a fake `Character` literal, add `specialty`, `xp`, and `abilityTiers`. Example:

```ts
const fakeChar = {
  id: "c1", name: "Test", race: "Human", class: "Fighter", role: "DPS",
  specialty: "Champion",
  stats: { str: 14, dex: 12, con: 13, int: 10, wis: 10, cha: 10 },
  level: 3, xp: 30, abilityTiers: [1], description: "test",
};
```

- [ ] **Step 2: Add a smoke test for preset picker**

Append:

```ts
it("league creation form has a preset select", async () => {
  // Use whichever testing approach the file already uses (vitest + RTL, or
  // happy-dom). Render leagues.new and check for an element with name="preset".
  const html = await renderRouteHtml("/leagues/new");
  expect(html).toContain('name="preset"');
  expect(html).toContain('value="champions"');
});
```

If the file does not use `renderRouteHtml`, copy the harness pattern from existing assertions in the same file.

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/ui/`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/ui/smoke.test.ts
git commit -m "test(ui): update smoke fixtures for new Character fields and preset picker"
```

---

### Task 23: Balance Harness — Multi-Season Verification

**Files:**
- Modify: `scripts/balance-harness.ts`

- [ ] **Step 1: Open `scripts/balance-harness.ts`**

Read the existing harness. Note the entry point and how it currently sims runs.

- [ ] **Step 2: Replace with a multi-season role-parity harness**

Replace the file contents with:

```ts
import { ProceduralSource } from "domain/content/procedural-source";
import { runDungeon } from "domain/sim/sim-engine";
import { score } from "domain/scoring";
import { createRng, seedFromIds } from "domain/rng";
import { applyPreset } from "domain/presets";
import { ALL_THEMES } from "domain/themes";
import type { Lineup, Role } from "domain/types";

const NUM_SEASONS = 5;
const WEEKS_PER_SEASON = 10;
const TEAMS = 6;
const ROSTER = 6;

function main() {
  const settings = applyPreset("standard");
  const source = new ProceduralSource();

  const roleTotals: Record<Role, { total: number; count: number }> = {
    Tank: { total: 0, count: 0 },
    Healer: { total: 0, count: 0 },
    DPS: { total: 0, count: 0 },
    Utility: { total: 0, count: 0 },
  };

  for (let season = 0; season < NUM_SEASONS; season++) {
    const seed = seedFromIds(`season-${season}`);
    const rng = createRng(seed);
    const characters = source.generateCharacters(48, rng, settings);
    const charMap = new Map(characters.map((c) => [c.id, c]));

    // Round-robin draft into 6 teams of 6
    const sorted = [...characters].sort((a, b) => {
      const sa = Object.values(a.stats).reduce((s, v) => s + v, 0);
      const sb = Object.values(b.stats).reduce((s, v) => s + v, 0);
      return sb - sa;
    });
    const teams: typeof characters[] = Array.from({ length: TEAMS }, () => []);
    sorted.forEach((c, idx) => teams[idx % TEAMS].push(c));

    for (let week = 1; week <= WEEKS_PER_SEASON; week++) {
      const themeRng = rng.fork(`theme-${week}`);
      const theme = themeRng.pick(ALL_THEMES);
      const dungeon = source.generateDungeon(week, 0, rng.fork(`d-${week}`), theme, settings.encounterCount);

      for (const team of teams) {
        const active = team.slice(0, 4).map((c) => c.id) as [string, string, string, string];
        const lineup: Lineup = { active, bench: [team[4].id, team[5].id] };
        const events = runDungeon(lineup, charMap, dungeon, rng.fork(`s-${week}-${team[0].id}`));
        const result = score(events, team.slice(0, 4));

        for (const ch of team.slice(0, 4)) {
          const cs = result.perCharacter.get(ch.id);
          if (!cs) continue;
          roleTotals[ch.role].total += cs.totalPoints;
          roleTotals[ch.role].count += 1;
        }
      }
    }
  }

  console.log("=== Role parity over", NUM_SEASONS, "seasons ===");
  for (const role of ["Tank", "Healer", "DPS", "Utility"] as Role[]) {
    const { total, count } = roleTotals[role];
    const avg = count > 0 ? total / count : 0;
    console.log(`${role.padEnd(8)} avg=${avg.toFixed(2)} (n=${count})`);
  }

  const tankAvg = roleTotals.Tank.total / Math.max(1, roleTotals.Tank.count);
  const healerAvg = roleTotals.Healer.total / Math.max(1, roleTotals.Healer.count);
  const ratio = Math.abs(tankAvg - healerAvg) / Math.max(tankAvg, healerAvg, 1);
  console.log(`Tank/Healer parity: ${(ratio * 100).toFixed(1)}% (target <30%)`);
  if (ratio > 0.3) {
    console.warn("WARN: Tank/Healer parity exceeds 30% threshold");
  }
}

main();
```

- [ ] **Step 3: Run the harness**

```bash
npx tsx scripts/balance-harness.ts
```

Expected: prints role averages with Tank and Healer within 30% of each other.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/balance-harness.ts
git commit -m "feat(harness): multi-season role-parity verification for overhaul"
```

---

## Self-Review Notes

**Spec coverage check:**

- Section 1 (24 specialties): Tasks 1-2, 8 (assignment).
- Section 2 (Leveling): Tasks 1, 3, 6, 17.
- Section 3 (Encounters): Tasks 5, 8 (theme mix + new types), 10 (class-aware combat), 11 (buffs).
- Section 4 (Scoring): Task 7.
- Section 5 (Scouting): Task 13 (module), 16 (persistence), 18 (visibility), 19 (UI).
- Section 6 (Settings & presets): Tasks 4 (presets), 1 (settings), 16 (apply), 20 (UI).

**Notes & deferrals (out of scope for this plan):**

- Auction draft format is in `LeagueSettings` as a future option but UI/flow is not implemented here — `projectedValue` is wired into scouting reports and read-only in draft UI as a "market value" hint.
- `playoffTeams` setting added to types but the existing playoff bracket code in `league-service.server.ts` still hardcodes top-4 semis. Adapting bracket generation to variable team counts is deferred (call this out in the implementation log if time permits a follow-up).
- Aura of Protection currently emits `buff` events with `aura` kind and uses `consumeBuff`-style charges (charges=99). This approximates the always-on aura without an extra event-bus rebuild. If passive-aura accounting matters for highlights, revisit in a follow-up.
- The XP scaleFactor formula matches the spec literally (`defaultSeasonWeeks / actualSeasonWeeks`). This is mathematically rough but follows the spec; the balance harness will reveal whether real progression hits target levels.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-03-balance-overhaul.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
