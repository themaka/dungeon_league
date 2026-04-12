# Dungeon League v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable single-player fantasy sports league where D&D-style characters raid simulated dungeons, generating weekly scoring events and narrative highlights.

**Architecture:** Three-layer stack with a hard boundary between a pure TypeScript domain core (sim, scoring, highlights, content generation, AI manager) and the web/persistence layers. Domain core is deterministic and seedable — no side effects, no framework imports.

**Tech Stack:** React Router v7 + TypeScript + Postgres + Prisma + Vitest

---

## File Structure

```
dungeon_league/
├── app/                              # React Router v7 app
│   ├── root.tsx                      # Root layout, parchment aesthetic
│   ├── routes/
│   │   ├── _index.tsx                # / — League list
│   │   ├── leagues.new.tsx           # /leagues/new — Create league
│   │   ├── leagues.$id.tsx           # /leagues/:id — League home
│   │   ├── leagues.$id_.draft.tsx    # /leagues/:id/draft — Draft room
│   │   ├── leagues.$id_.teams.$teamId.tsx
│   │   ├── leagues.$id_.matchups.$matchupId.tsx
│   │   └── leagues.$id_.characters.$charId.tsx
│   ├── components/
│   │   ├── character-card.tsx
│   │   ├── standings-table.tsx
│   │   ├── highlight-card.tsx
│   │   ├── draft-pool.tsx
│   │   ├── lineup-editor.tsx
│   │   └── play-by-play.tsx
│   └── lib/
│       ├── db.server.ts              # Prisma client singleton
│       └── auth.server.ts            # Dev-mode auth stub
├── domain/                           # Pure TS domain core — NO framework imports
│   ├── types.ts                      # All domain types + event kinds
│   ├── rng.ts                        # Seeded PRNG (mulberry32)
│   ├── content/
│   │   ├── content-source.ts         # ContentSource interface
│   │   ├── procedural-source.ts      # v1 ProceduralSource implementation
│   │   ├── name-tables.ts            # Name/race/class tables for generation
│   │   └── highlight-templates.ts    # Templated highlight description strings
│   ├── sim/
│   │   ├── sim-engine.ts             # runDungeon() — top-level sim entry point
│   │   └── encounters.ts             # Per-encounter-type resolution functions
│   ├── scoring.ts                    # score() — pure reducer over event log
│   ├── highlights.ts                 # generateHighlights() — picks notable moments
│   ├── ai-manager.ts                 # AIManager — draft picks + lineup setting
│   └── schedule.ts                   # Round-robin + playoff matchup generation
├── services/                         # Application layer (Prisma-dependent)
│   ├── league-service.server.ts      # createLeague, advanceWeek
│   ├── draft-service.server.ts       # Draft orchestration
│   └── export-import.server.ts       # JSON export/import
├── prisma/
│   └── schema.prisma
├── tests/
│   ├── domain/
│   │   ├── rng.test.ts
│   │   ├── procedural-source.test.ts
│   │   ├── sim-engine.test.ts
│   │   ├── scoring.test.ts
│   │   ├── highlights.test.ts
│   │   ├── ai-manager.test.ts
│   │   └── schedule.test.ts
│   └── services/
│       ├── league-service.test.ts
│       └── draft-service.test.ts
├── scripts/
│   └── balance-harness.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── react-router.config.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `react-router.config.ts`, `app/root.tsx`, `app/routes/_index.tsx`, `app/lib/db.server.ts`, `prisma/schema.prisma`

- [ ] **Step 1: Initialize React Router v7 project**

```bash
cd /home/maka/GitHub/dungeon_league
npx create-react-router@latest . --no-git --no-install --overwrite
```

Accept defaults. This scaffolds the React Router v7 framework project.

- [ ] **Step 2: Install core dependencies**

```bash
npm install
npm install prisma @prisma/client
npm install -D vitest @vitest/coverage-v8 fast-check
```

- [ ] **Step 3: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and `.env` with a `DATABASE_URL` placeholder.

- [ ] **Step 4: Configure Vitest**

Add to `vite.config.ts`:

```ts
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
```

- [ ] **Step 5: Add path alias for domain core**

In `tsconfig.json`, add to `compilerOptions.paths`:

```json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./app/*"],
      "domain/*": ["./domain/*"],
      "services/*": ["./services/*"]
    }
  }
}
```

- [ ] **Step 6: Add test script to package.json**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 7: Create domain directory structure**

```bash
mkdir -p domain/content domain/sim services tests/domain tests/services scripts
```

- [ ] **Step 8: Verify scaffold runs**

```bash
npm run dev
```

Expected: dev server starts on port 5173 with the React Router welcome page.

- [ ] **Step 9: Run tests to verify Vitest is configured**

Create a smoke test `tests/domain/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold React Router v7 + Prisma + Vitest project"
```

---

### Task 2: Domain Types

**Files:**
- Create: `domain/types.ts`
- Test: `tests/domain/types.test.ts`

- [ ] **Step 1: Write the type definitions**

Create `domain/types.ts`:

```ts
export type Role = "Tank" | "Healer" | "DPS" | "Utility";

export type Race =
  | "Human"
  | "Elf"
  | "Dwarf"
  | "Halfling"
  | "Orc"
  | "Gnome"
  | "Tiefling"
  | "Dragonborn";

export type CharacterClass =
  | "Fighter"
  | "Wizard"
  | "Rogue"
  | "Cleric"
  | "Ranger"
  | "Paladin"
  | "Barbarian"
  | "Bard"
  | "Druid"
  | "Warlock"
  | "Monk"
  | "Sorcerer";

export interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface Character {
  id: string;
  name: string;
  race: Race;
  class: CharacterClass;
  role: Role;
  stats: Stats;
  level: number;
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

export type EncounterType = "combat" | "trap" | "puzzle" | "treasure";

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
  | "hit"
  | "kill"
  | "crit"
  | "heal"
  | "damage_taken"
  | "save_pass"
  | "save_fail"
  | "disarm_trap"
  | "find_treasure"
  | "ko"
  | "death";

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
  | "mvp_of_run"
  | "clutch_survivor"
  | "first_blood"
  | "boss_killer"
  | "flawless_run"
  | "total_party_wipe";

export interface Milestone {
  kind: MilestoneKind;
  actorId?: string;
}

export interface CharacterScore {
  characterId: string;
  basePoints: number;
  roleMultiplierPoints: number;
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

export interface League {
  id: string;
  name: string;
  phase: LeaguePhase;
  currentWeek: number;
  teams: string[];
  characterPool: string[];
  settings: LeagueSettings;
}

export interface LeagueSettings {
  teamCount: number;
  rosterSize: number;
  activeSize: number;
  seasonWeeks: number;
  playoffWeeks: number;
  draftFormat: "snake";
  contentSource: "procedural";
}

export const DEFAULT_LEAGUE_SETTINGS: LeagueSettings = {
  teamCount: 6,
  rosterSize: 6,
  activeSize: 4,
  seasonWeeks: 5,
  playoffWeeks: 2,
  draftFormat: "snake",
  contentSource: "procedural",
};

export const CLASS_ROLE_MAP: Record<CharacterClass, Role> = {
  Fighter: "DPS",
  Wizard: "DPS",
  Rogue: "Utility",
  Cleric: "Healer",
  Ranger: "DPS",
  Paladin: "Tank",
  Barbarian: "Tank",
  Bard: "Utility",
  Druid: "Healer",
  Warlock: "DPS",
  Monk: "DPS",
  Sorcerer: "DPS",
};
```

- [ ] **Step 2: Write a type assertion test**

Create `tests/domain/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_LEAGUE_SETTINGS,
  CLASS_ROLE_MAP,
  type Character,
  type Stats,
} from "domain/types";

describe("domain types", () => {
  it("DEFAULT_LEAGUE_SETTINGS has correct values", () => {
    expect(DEFAULT_LEAGUE_SETTINGS.teamCount).toBe(6);
    expect(DEFAULT_LEAGUE_SETTINGS.rosterSize).toBe(6);
    expect(DEFAULT_LEAGUE_SETTINGS.activeSize).toBe(4);
    expect(DEFAULT_LEAGUE_SETTINGS.seasonWeeks).toBe(5);
    expect(DEFAULT_LEAGUE_SETTINGS.playoffWeeks).toBe(2);
  });

  it("CLASS_ROLE_MAP maps all 12 classes", () => {
    expect(Object.keys(CLASS_ROLE_MAP)).toHaveLength(12);
    expect(CLASS_ROLE_MAP.Paladin).toBe("Tank");
    expect(CLASS_ROLE_MAP.Cleric).toBe("Healer");
    expect(CLASS_ROLE_MAP.Rogue).toBe("Utility");
    expect(CLASS_ROLE_MAP.Fighter).toBe("DPS");
  });

  it("character type is structurally valid", () => {
    const stats: Stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const char: Character = {
      id: "test-1",
      name: "Test Hero",
      race: "Human",
      class: "Fighter",
      role: "DPS",
      stats,
      level: 1,
      description: "A test character.",
    };
    expect(char.id).toBe("test-1");
    expect(char.role).toBe("DPS");
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass, including the new types tests.

- [ ] **Step 4: Commit**

```bash
git add domain/types.ts tests/domain/types.test.ts
git commit -m "feat: add domain type definitions"
```

---

### Task 3: Seeded RNG

**Files:**
- Create: `domain/rng.ts`
- Test: `tests/domain/rng.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/rng.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createRng } from "domain/rng";

describe("seeded RNG", () => {
  it("produces deterministic output for the same seed", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).toEqual(seq2);
  });

  it("produces different output for different seeds", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(99);
    const val1 = rng1.next();
    const val2 = rng2.next();
    expect(val1).not.toBe(val2);
  });

  it("next() returns values in [0, 1)", () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("nextInt(min, max) returns integers in [min, max]", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(1, 6);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it("pick() returns an element from the array", () => {
    const rng = createRng(55);
    const items = ["a", "b", "c", "d"];
    for (let i = 0; i < 100; i++) {
      const picked = rng.pick(items);
      expect(items).toContain(picked);
    }
  });

  it("shuffle() produces a deterministic permutation", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(rng1.shuffle(arr1)).toEqual(rng2.shuffle(arr2));
  });

  it("rollStat() produces values in [3, 18]", () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const val = rng.rollStat();
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThanOrEqual(18);
    }
  });

  it("fork() creates a child RNG that is deterministic but independent", () => {
    const parent1 = createRng(42);
    const parent2 = createRng(42);
    const child1 = parent1.fork("matchup-1");
    const child2 = parent2.fork("matchup-1");
    expect(child1.next()).toBe(child2.next());
    expect(parent1.next()).toBe(parent2.next());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/domain/rng.test.ts
```

Expected: FAIL — `createRng` does not exist.

- [ ] **Step 3: Implement the seeded RNG**

Create `domain/rng.ts`:

```ts
export interface Rng {
  next(): number;
  nextInt(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: T[]): T[];
  rollStat(): number;
  fork(label: string): Rng;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const raw = mulberry32(seed);

  const rng: Rng = {
    next: raw,

    nextInt(min: number, max: number): number {
      return min + Math.floor(raw() * (max - min + 1));
    },

    pick<T>(items: readonly T[]): T {
      return items[Math.floor(raw() * items.length)];
    },

    shuffle<T>(items: T[]): T[] {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(raw() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    rollStat(): number {
      const rolls = Array.from({ length: 4 }, () => rng.nextInt(1, 6));
      rolls.sort((a, b) => a - b);
      return rolls[1] + rolls[2] + rolls[3];
    },

    fork(label: string): Rng {
      const childSeed = seed ^ hashString(label);
      return createRng(childSeed);
    },
  };

  return rng;
}

export function seedFromIds(...ids: string[]): number {
  return hashString(ids.join(":"));
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/domain/rng.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add domain/rng.ts tests/domain/rng.test.ts
git commit -m "feat: add seeded deterministic RNG module"
```

---

### Task 4: ContentSource Interface + ProceduralSource (Characters)

**Files:**
- Create: `domain/content/content-source.ts`, `domain/content/name-tables.ts`, `domain/content/procedural-source.ts`
- Test: `tests/domain/procedural-source.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/procedural-source.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createRng } from "domain/rng";
import { ProceduralSource } from "domain/content/procedural-source";
import { CLASS_ROLE_MAP, type Character, type Race, type CharacterClass } from "domain/types";

describe("ProceduralSource — characters", () => {
  const rng = createRng(42);
  const source = new ProceduralSource();

  it("generates the requested number of characters", () => {
    const chars = source.generateCharacters(48, createRng(42));
    expect(chars).toHaveLength(48);
  });

  it("generates deterministic characters for the same seed", () => {
    const chars1 = source.generateCharacters(10, createRng(42));
    const chars2 = source.generateCharacters(10, createRng(42));
    expect(chars1).toEqual(chars2);
  });

  it("generates characters with valid fields", () => {
    const chars = source.generateCharacters(48, createRng(99));
    const validRaces: Race[] = [
      "Human", "Elf", "Dwarf", "Halfling", "Orc", "Gnome", "Tiefling", "Dragonborn",
    ];
    const validClasses: CharacterClass[] = [
      "Fighter", "Wizard", "Rogue", "Cleric", "Ranger", "Paladin",
      "Barbarian", "Bard", "Druid", "Warlock", "Monk", "Sorcerer",
    ];

    for (const char of chars) {
      expect(char.id).toBeTruthy();
      expect(char.name).toBeTruthy();
      expect(validRaces).toContain(char.race);
      expect(validClasses).toContain(char.class);
      expect(char.role).toBe(CLASS_ROLE_MAP[char.class]);
      expect(char.level).toBe(1);
      expect(char.description).toBeTruthy();

      for (const stat of Object.values(char.stats)) {
        expect(stat).toBeGreaterThanOrEqual(3);
        expect(stat).toBeLessThanOrEqual(18);
      }
    }
  });

  it("generates unique IDs", () => {
    const chars = source.generateCharacters(48, createRng(42));
    const ids = chars.map((c) => c.id);
    expect(new Set(ids).size).toBe(48);
  });

  it("generates unique names", () => {
    const chars = source.generateCharacters(48, createRng(42));
    const names = chars.map((c) => c.name);
    expect(new Set(names).size).toBe(48);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/domain/procedural-source.test.ts
```

Expected: FAIL — modules do not exist.

- [ ] **Step 3: Create the ContentSource interface**

Create `domain/content/content-source.ts`:

```ts
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
```

- [ ] **Step 4: Create name tables**

Create `domain/content/name-tables.ts`:

```ts
export const FIRST_NAMES = [
  "Thorin", "Lyra", "Gorim", "Seraphina", "Kaelen", "Brynn", "Drogath",
  "Elara", "Fenwick", "Isolde", "Jareth", "Kira", "Lorek", "Mira",
  "Nyx", "Orin", "Petra", "Quillan", "Rowan", "Sable", "Talon",
  "Uma", "Varek", "Wren", "Xander", "Yara", "Zephyr", "Aldric",
  "Bess", "Cedric", "Dahlia", "Eamon", "Freya", "Gareth", "Hilda",
  "Ignis", "Jorin", "Kael", "Luna", "Magnus", "Nessa", "Osric",
  "Pria", "Renn", "Sigrid", "Tova", "Ulric", "Vex", "Wynne",
  "Ash", "Bramble", "Cinder", "Dusk", "Ember", "Flint", "Gale",
  "Haven", "Ivy", "Jade",
];

export const LAST_NAMES = [
  "Ironveil", "Shadowmere", "Stonehelm", "Brightforge", "Ashwood",
  "Dawnstrider", "Nightwhisper", "Thornwall", "Frostpeak", "Goldleaf",
  "Darkwater", "Firebrand", "Silverthorn", "Stormcaller", "Wildheart",
  "Bonecrusher", "Starweaver", "Grimshaw", "Oakenheart", "Ravensong",
  "Blackthorn", "Copperfield", "Duskwalker", "Emberstrike", "Foxglove",
  "Greymane", "Hollowbone", "Ironwood", "Jadefall", "Kettleburn",
  "Longstrider", "Moonfire", "Nethersong", "Obsidian", "Pinewhisper",
  "Quicksilver", "Redthorn", "Sunforge", "Tidecaller", "Underhill",
  "Voidwalker", "Windrider", "Yarrow", "Zenith", "Ambervale",
  "Blightbane", "Crowfeather", "Deepforge", "Elderwood", "Flameguard",
];

export const DUNGEON_PREFIXES = [
  "The Sunken", "The Burning", "The Frozen", "The Shadow", "The Lost",
  "The Cursed", "The Ruined", "The Ancient", "The Forgotten", "The Twisted",
  "The Haunted", "The Flooded", "The Shattered", "The Crimson", "The Silent",
];

export const DUNGEON_NOUNS = [
  "Crypt", "Cavern", "Temple", "Mines", "Catacombs",
  "Fortress", "Labyrinth", "Sanctum", "Vault", "Depths",
  "Dungeon", "Lair", "Tomb", "Pit", "Warren",
];

export const DUNGEON_THEMES = [
  "undead", "fire", "ice", "shadow", "nature",
  "arcane", "demonic", "draconic", "mechanical", "aquatic",
];

export const ENCOUNTER_NAMES: Record<string, string[]> = {
  combat: [
    "Goblin Ambush", "Skeleton Patrol", "Orc Warband", "Spider Nest",
    "Wraith Encounter", "Bandit Highwaymen", "Troll Bridge", "Cultist Ritual",
    "Dire Wolf Pack", "Mimic Chest",
  ],
  trap: [
    "Poison Dart Hall", "Collapsing Floor", "Flame Jet Corridor",
    "Pendulum Blades", "Acid Pool", "Spike Pit", "Boulder Chase",
    "Rune Ward", "Gas Chamber", "Tripwire Net",
  ],
  puzzle: [
    "Runic Lock", "Pressure Plate Sequence", "Riddle of the Sphinx",
    "Mirror Maze", "Rotating Room", "Symbol Matching", "Weight Puzzle",
    "Elemental Alignment", "Constellation Dial", "Memory Tiles",
  ],
  treasure: [
    "Hidden Vault", "Dragon Hoard", "Sunken Chest", "Enchanted Armory",
    "Gem Cache", "Relic Chamber", "Golden Idol", "Crystal Garden",
    "Coin Fountain", "Trophy Hall",
  ],
};

export const BOSS_NAMES = [
  "The Lich King", "Magma Wyrm", "Shadow Reaver", "Frost Giant Jarl",
  "Beholder Tyrant", "Demon Prince", "Ancient Dragon", "Vampire Lord",
  "Mind Flayer Elder", "Golem Colossus",
];

export const DESCRIPTION_TEMPLATES = [
  "A {adjective} {race} {class} known for {trait}.",
  "Once a {background}, this {race} now walks the path of the {class}.",
  "A {adjective} {race} who {quirk}.",
  "{name} is a {race} {class}, {adjective} and {adjective2}.",
];

export const ADJECTIVES = [
  "battle-scarred", "sharp-eyed", "grim-faced", "silver-tongued", "iron-willed",
  "quick-footed", "broad-shouldered", "keen-minded", "fierce", "stoic",
  "cunning", "relentless", "quiet", "boisterous", "weathered",
];

export const ADJECTIVES_2 = [
  "feared by many", "respected by peers", "driven by vengeance",
  "seeking redemption", "hungry for glory", "haunted by the past",
  "loyal to a fault", "unpredictable in battle", "wise beyond their years",
];

export const TRAITS = [
  "their unbreakable resolve", "devastating critical strikes",
  "an uncanny ability to find traps", "healing even the gravest wounds",
  "never leaving a comrade behind", "always striking first",
  "their mastery of the arcane", "an instinct for treasure",
];

export const QUIRKS = [
  "never backs down from a challenge",
  "speaks to their weapon as if it were alive",
  "collects trophies from every dungeon",
  "always has a plan — and a backup plan",
  "fights with reckless abandon",
  "hums an eerie tune before each battle",
];

export const BACKGROUNDS = [
  "soldier", "scholar", "merchant", "hermit", "noble",
  "outcast", "gladiator", "priest", "thief", "sailor",
];
```

- [ ] **Step 5: Implement ProceduralSource (characters only for now)**

Create `domain/content/procedural-source.ts`:

```ts
import type { Character, CharacterClass, Race, Stats, Dungeon } from "domain/types";
import { CLASS_ROLE_MAP } from "domain/types";
import type { Rng } from "domain/rng";
import type { ContentSource, HighlightTemplateBundle } from "./content-source";
import {
  FIRST_NAMES, LAST_NAMES, ADJECTIVES, ADJECTIVES_2, TRAITS, QUIRKS,
  BACKGROUNDS, DESCRIPTION_TEMPLATES,
} from "./name-tables";

const ALL_RACES: Race[] = [
  "Human", "Elf", "Dwarf", "Halfling", "Orc", "Gnome", "Tiefling", "Dragonborn",
];

const ALL_CLASSES: CharacterClass[] = [
  "Fighter", "Wizard", "Rogue", "Cleric", "Ranger", "Paladin",
  "Barbarian", "Bard", "Druid", "Warlock", "Monk", "Sorcerer",
];

function generateDescription(
  rng: Rng,
  name: string,
  race: Race,
  charClass: CharacterClass,
): string {
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
    str: rng.rollStat(),
    dex: rng.rollStat(),
    con: rng.rollStat(),
    int: rng.rollStat(),
    wis: rng.rollStat(),
    cha: rng.rollStat(),
  };
}

export class ProceduralSource implements ContentSource {
  generateCharacters(count: number, rng: Rng): Character[] {
    const usedNames = new Set<string>();
    const characters: Character[] = [];

    const shuffledFirstNames = rng.shuffle([...FIRST_NAMES]);
    const shuffledLastNames = rng.shuffle([...LAST_NAMES]);

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
      const stats = rollStats(rng);

      characters.push({
        id: `char-${i}-${firstName.toLowerCase()}`,
        name: fullName,
        race,
        class: charClass,
        role,
        stats,
        level: 1,
        description: generateDescription(rng, fullName, race, charClass),
      });
    }

    return characters;
  }

  generateDungeon(_week: number, _matchupIndex: number, _rng: Rng): Dungeon {
    throw new Error("Not implemented yet — see Task 5");
  }

  getHighlightTemplates(): HighlightTemplateBundle {
    throw new Error("Not implemented yet — see Task 8");
  }
}
```

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/domain/procedural-source.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add domain/content/ tests/domain/procedural-source.test.ts
git commit -m "feat: add ContentSource interface and ProceduralSource character generation"
```

---

### Task 5: ProceduralSource Dungeon Generation

**Files:**
- Modify: `domain/content/procedural-source.ts`
- Test: `tests/domain/procedural-source.test.ts` (add dungeon tests)

- [ ] **Step 1: Write the failing dungeon tests**

Append to `tests/domain/procedural-source.test.ts`:

```ts
describe("ProceduralSource — dungeons", () => {
  const source = new ProceduralSource();

  it("generates a dungeon with 5-8 encounters", () => {
    const dungeon = source.generateDungeon(1, 0, createRng(42));
    expect(dungeon.encounters.length).toBeGreaterThanOrEqual(5);
    expect(dungeon.encounters.length).toBeLessThanOrEqual(8);
  });

  it("generates deterministic dungeons for the same seed", () => {
    const d1 = source.generateDungeon(1, 0, createRng(42));
    const d2 = source.generateDungeon(1, 0, createRng(42));
    expect(d1).toEqual(d2);
  });

  it("last encounter is always a boss", () => {
    for (let seed = 0; seed < 50; seed++) {
      const dungeon = source.generateDungeon(1, 0, createRng(seed));
      const last = dungeon.encounters[dungeon.encounters.length - 1];
      expect(last.isBoss).toBe(true);
      expect(last.type).toBe("combat");
    }
  });

  it("generates a name, theme, and unique encounter IDs", () => {
    const dungeon = source.generateDungeon(3, 1, createRng(99));
    expect(dungeon.name).toBeTruthy();
    expect(dungeon.theme).toBeTruthy();
    expect(dungeon.id).toBeTruthy();
    const ids = dungeon.encounters.map((e) => e.id);
    expect(new Set(ids).size).toBe(dungeon.encounters.length);
  });

  it("encounter difficulties are between 1 and 10", () => {
    const dungeon = source.generateDungeon(1, 0, createRng(42));
    for (const enc of dungeon.encounters) {
      expect(enc.difficulty).toBeGreaterThanOrEqual(1);
      expect(enc.difficulty).toBeLessThanOrEqual(10);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/domain/procedural-source.test.ts
```

Expected: New tests FAIL (dungeon generation throws "Not implemented yet").

- [ ] **Step 3: Implement dungeon generation**

Replace the `generateDungeon` method in `domain/content/procedural-source.ts`:

```ts
import {
  FIRST_NAMES, LAST_NAMES, ADJECTIVES, ADJECTIVES_2, TRAITS, QUIRKS,
  BACKGROUNDS, DESCRIPTION_TEMPLATES, DUNGEON_PREFIXES, DUNGEON_NOUNS,
  DUNGEON_THEMES, ENCOUNTER_NAMES, BOSS_NAMES,
} from "./name-tables";
import type { Character, CharacterClass, Race, Stats, Dungeon, Encounter, EncounterType } from "domain/types";

// ... (existing code) ...

  generateDungeon(week: number, matchupIndex: number, rng: Rng): Dungeon {
    const name = `${rng.pick(DUNGEON_PREFIXES)} ${rng.pick(DUNGEON_NOUNS)}`;
    const theme = rng.pick(DUNGEON_THEMES);
    const encounterCount = rng.nextInt(5, 8);

    const encounterTypes: EncounterType[] = ["combat", "trap", "puzzle", "treasure"];
    const statKeys: (keyof Stats)[] = ["str", "dex", "con", "int", "wis", "cha"];

    const encounters: Encounter[] = [];

    for (let i = 0; i < encounterCount - 1; i++) {
      const type = rng.pick(encounterTypes);
      encounters.push({
        id: `enc-w${week}-m${matchupIndex}-${i}`,
        type,
        name: rng.pick(ENCOUNTER_NAMES[type]),
        difficulty: rng.nextInt(1, 10),
        targetStats: [rng.pick(statKeys), rng.pick(statKeys)],
        isBoss: false,
      });
    }

    encounters.push({
      id: `enc-w${week}-m${matchupIndex}-boss`,
      type: "combat",
      name: rng.pick(BOSS_NAMES),
      difficulty: rng.nextInt(7, 10),
      targetStats: [rng.pick(statKeys), rng.pick(statKeys)],
      isBoss: true,
    });

    return {
      id: `dungeon-w${week}-m${matchupIndex}`,
      name,
      theme,
      encounters,
    };
  }
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/domain/procedural-source.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add domain/content/procedural-source.ts tests/domain/procedural-source.test.ts
git commit -m "feat: add procedural dungeon generation"
```

---

### Task 6: Sim Engine

**Files:**
- Create: `domain/sim/encounters.ts`, `domain/sim/sim-engine.ts`
- Test: `tests/domain/sim-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/sim-engine.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createRng } from "domain/rng";
import { runDungeon } from "domain/sim/sim-engine";
import { ProceduralSource } from "domain/content/procedural-source";
import type { Lineup, SimEvent } from "domain/types";

function makeTestSetup(seed: number) {
  const rng = createRng(seed);
  const source = new ProceduralSource();
  const chars = source.generateCharacters(6, createRng(seed + 1));
  const dungeon = source.generateDungeon(1, 0, createRng(seed + 2));
  const lineup: Lineup = {
    active: [chars[0].id, chars[1].id, chars[2].id, chars[3].id] as [string, string, string, string],
    bench: [chars[4].id, chars[5].id] as [string, string],
  };
  const charMap = new Map(chars.map((c) => [c.id, c]));
  return { rng, dungeon, lineup, charMap, chars };
}

describe("sim engine", () => {
  it("returns an array of events", () => {
    const { dungeon, lineup, charMap } = makeTestSetup(42);
    const events = runDungeon(lineup, charMap, dungeon, createRng(42));
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same seed", () => {
    const setup1 = makeTestSetup(42);
    const setup2 = makeTestSetup(42);
    const events1 = runDungeon(setup1.lineup, setup1.charMap, setup1.dungeon, createRng(99));
    const events2 = runDungeon(setup2.lineup, setup2.charMap, setup2.dungeon, createRng(99));
    expect(events1).toEqual(events2);
  });

  it("only emits events for active characters", () => {
    const { dungeon, lineup, charMap } = makeTestSetup(42);
    const events = runDungeon(lineup, charMap, dungeon, createRng(42));
    const activeSet = new Set(lineup.active);
    for (const event of events) {
      expect(activeSet.has(event.actorId)).toBe(true);
    }
  });

  it("emits valid event kinds", () => {
    const { dungeon, lineup, charMap } = makeTestSetup(42);
    const events = runDungeon(lineup, charMap, dungeon, createRng(42));
    const validKinds = new Set([
      "hit", "kill", "crit", "heal", "damage_taken",
      "save_pass", "save_fail", "disarm_trap", "find_treasure", "ko", "death",
    ]);
    for (const event of events) {
      expect(validKinds.has(event.kind)).toBe(true);
    }
  });

  it("events reference encounter IDs from the dungeon", () => {
    const { dungeon, lineup, charMap } = makeTestSetup(42);
    const events = runDungeon(lineup, charMap, dungeon, createRng(42));
    const encounterIds = new Set(dungeon.encounters.map((e) => e.id));
    for (const event of events) {
      expect(encounterIds.has(event.encounterId)).toBe(true);
    }
  });

  it("dead characters stop generating events after death", () => {
    let found = false;
    for (let seed = 0; seed < 200; seed++) {
      const { dungeon, lineup, charMap } = makeTestSetup(seed);
      const events = runDungeon(lineup, charMap, dungeon, createRng(seed));
      const deadChars = new Set<string>();
      for (const event of events) {
        if (event.kind === "death") deadChars.add(event.actorId);
        if (deadChars.has(event.actorId) && event.kind !== "death") {
          found = true;
          expect.unreachable("Dead character emitted a non-death event");
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/domain/sim-engine.test.ts
```

Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement encounter resolution**

Create `domain/sim/encounters.ts`:

```ts
import type { Character, Encounter, SimEvent, Stats } from "domain/types";
import type { Rng } from "domain/rng";

function statCheck(char: Character, targetStats: (keyof Stats)[], difficulty: number, rng: Rng): boolean {
  const relevantStat = Math.max(...targetStats.map((s) => char.stats[s]));
  const roll = rng.nextInt(1, 20);
  return roll + Math.floor((relevantStat - 10) / 2) >= difficulty + 10;
}

export function resolveCombat(
  chars: Character[],
  encounter: Encounter,
  rng: Rng,
  hp: Map<string, number>,
): SimEvent[] {
  const events: SimEvent[] = [];

  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;

    const isCrit = rng.nextInt(1, 20) === 20;
    let damage = rng.nextInt(3, 12) + Math.floor((char.stats.str - 10) / 2);
    if (isCrit) damage = Math.floor(damage * 1.5);

    events.push({
      kind: "hit",
      encounterId: encounter.id,
      actorId: char.id,
      targetId: encounter.id,
      amount: Math.max(damage, 1),
      crit: isCrit,
    });

    if (isCrit) {
      events.push({
        kind: "crit",
        encounterId: encounter.id,
        actorId: char.id,
        amount: damage,
      });
    }

    const damageTaken = Math.max(rng.nextInt(1, encounter.difficulty * 2) - Math.floor((char.stats.con - 10) / 2), 0);
    if (damageTaken > 0) {
      events.push({
        kind: "damage_taken",
        encounterId: encounter.id,
        actorId: char.id,
        amount: damageTaken,
      });

      const currentHp = hp.get(char.id)!;
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
      .filter((e) => e.kind === "hit")
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);

    if (totalDamage >= encounter.difficulty * 8) {
      const killer = rng.pick(aliveChars);
      events.push({
        kind: "kill",
        encounterId: encounter.id,
        actorId: killer.id,
        targetId: encounter.id,
        meta: { boss: encounter.isBoss },
      });
    }
  }

  if (chars.some((c) => c.role === "Healer" && (hp.get(c.id) ?? 0) > 0)) {
    const healer = chars.find((c) => c.role === "Healer" && (hp.get(c.id) ?? 0) > 0)!;
    const woundedChars = chars.filter((c) => {
      const currentHp = hp.get(c.id) ?? 0;
      const maxHp = 10 + c.stats.con;
      return currentHp > 0 && currentHp < maxHp;
    });
    if (woundedChars.length > 0) {
      const target = rng.pick(woundedChars);
      const healAmount = rng.nextInt(2, 8) + Math.floor((healer.stats.wis - 10) / 2);
      events.push({
        kind: "heal",
        encounterId: encounter.id,
        actorId: healer.id,
        targetId: target.id,
        amount: Math.max(healAmount, 1),
      });
      hp.set(target.id, (hp.get(target.id) ?? 0) + Math.max(healAmount, 1));
    }
  }

  return events;
}

export function resolveTrap(
  chars: Character[],
  encounter: Encounter,
  rng: Rng,
  hp: Map<string, number>,
): SimEvent[] {
  const events: SimEvent[] = [];

  const utilityChar = chars.find((c) => c.role === "Utility" && (hp.get(c.id) ?? 0) > 0);
  if (utilityChar && statCheck(utilityChar, encounter.targetStats, encounter.difficulty, rng)) {
    events.push({
      kind: "disarm_trap",
      encounterId: encounter.id,
      actorId: utilityChar.id,
    });
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

export function resolvePuzzle(
  chars: Character[],
  encounter: Encounter,
  rng: Rng,
  hp: Map<string, number>,
): SimEvent[] {
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

export function resolveTreasure(
  chars: Character[],
  encounter: Encounter,
  rng: Rng,
  hp: Map<string, number>,
): SimEvent[] {
  const events: SimEvent[] = [];
  const aliveChars = chars.filter((c) => (hp.get(c.id) ?? 0) > 0);
  if (aliveChars.length === 0) return events;

  const finder = rng.pick(aliveChars);
  events.push({
    kind: "find_treasure",
    encounterId: encounter.id,
    actorId: finder.id,
  });

  return events;
}
```

- [ ] **Step 4: Implement the sim engine**

Create `domain/sim/sim-engine.ts`:

```ts
import type { Character, Dungeon, Lineup, SimEvent } from "domain/types";
import type { Rng } from "domain/rng";
import { resolveCombat, resolveTrap, resolvePuzzle, resolveTreasure } from "./encounters";

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

  const allEvents: SimEvent[] = [];

  for (const encounter of dungeon.encounters) {
    const alive = activeChars.filter((c) => (hp.get(c.id) ?? 0) > 0);
    if (alive.length === 0) break;

    let events: SimEvent[];
    switch (encounter.type) {
      case "combat":
        events = resolveCombat(alive, encounter, rng, hp);
        break;
      case "trap":
        events = resolveTrap(alive, encounter, rng, hp);
        break;
      case "puzzle":
        events = resolvePuzzle(alive, encounter, rng, hp);
        break;
      case "treasure":
        events = resolveTreasure(alive, encounter, rng, hp);
        break;
    }

    allEvents.push(...events);
  }

  return allEvents;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/domain/sim-engine.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add domain/sim/ tests/domain/sim-engine.test.ts
git commit -m "feat: add sim engine with encounter resolution"
```

---

### Task 7: Scoring Module

**Files:**
- Create: `domain/scoring.ts`
- Test: `tests/domain/scoring.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/scoring.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { score } from "domain/scoring";
import type { SimEvent, Character } from "domain/types";

function makeChar(id: string, role: "Tank" | "Healer" | "DPS" | "Utility"): Character {
  return {
    id,
    name: `Test ${id}`,
    race: "Human",
    class: "Fighter",
    role,
    stats: { str: 14, dex: 12, con: 13, int: 10, wis: 10, cha: 10 },
    level: 1,
    description: "test",
  };
}

describe("scoring", () => {
  it("scores hit events at 0.1 per damage", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "hit", encounterId: "e1", actorId: "a", amount: 10 },
    ];
    const result = score(events, chars);
    expect(result.perCharacter.get("a")!.basePoints).toBe(1);
  });

  it("applies DPS role multiplier to hit events", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "hit", encounterId: "e1", actorId: "a", amount: 10 },
    ];
    const result = score(events, chars);
    expect(result.perCharacter.get("a")!.roleMultiplierPoints).toBeCloseTo(0.5);
  });

  it("applies Tank role multiplier to damage_taken", () => {
    const chars = [makeChar("t", "Tank")];
    const events: SimEvent[] = [
      { kind: "damage_taken", encounterId: "e1", actorId: "t", amount: 20 },
    ];
    const result = score(events, chars);
    expect(result.perCharacter.get("t")!.basePoints).toBe(1);
    expect(result.perCharacter.get("t")!.roleMultiplierPoints).toBeCloseTo(0.5);
  });

  it("scores kill at +2, boss kill at +3", () => {
    const chars = [makeChar("a", "DPS")];
    const normalKill: SimEvent[] = [
      { kind: "kill", encounterId: "e1", actorId: "a", meta: { boss: false } },
    ];
    const bossKill: SimEvent[] = [
      { kind: "kill", encounterId: "e1", actorId: "a", meta: { boss: true } },
    ];
    expect(score(normalKill, chars).perCharacter.get("a")!.basePoints).toBe(2);
    expect(score(bossKill, chars).perCharacter.get("a")!.basePoints).toBe(3);
  });

  it("scores ko at -3 and death at -5", () => {
    const chars = [makeChar("a", "DPS")];
    const ko: SimEvent[] = [{ kind: "ko", encounterId: "e1", actorId: "a" }];
    const death: SimEvent[] = [{ kind: "death", encounterId: "e1", actorId: "a" }];
    expect(score(ko, chars).perCharacter.get("a")!.basePoints).toBe(-3);
    expect(score(death, chars).perCharacter.get("a")!.basePoints).toBe(-5);
  });

  it("awards mvp_of_run milestone to highest scorer", () => {
    const chars = [makeChar("a", "DPS"), makeChar("b", "DPS")];
    const events: SimEvent[] = [
      { kind: "hit", encounterId: "e1", actorId: "a", amount: 100 },
      { kind: "hit", encounterId: "e1", actorId: "b", amount: 10 },
    ];
    const result = score(events, chars);
    expect(result.milestones).toContainEqual({ kind: "mvp_of_run", actorId: "a" });
    expect(result.perCharacter.get("a")!.milestonePoints).toBe(5);
  });

  it("awards flawless_run milestone when no KOs", () => {
    const chars = [makeChar("a", "DPS"), makeChar("b", "Tank")];
    const events: SimEvent[] = [
      { kind: "hit", encounterId: "e1", actorId: "a", amount: 10 },
    ];
    const result = score(events, chars);
    expect(result.milestones).toContainEqual({ kind: "flawless_run" });
    expect(result.perCharacter.get("a")!.milestonePoints).toBeGreaterThanOrEqual(3);
  });

  it("awards total_party_wipe when all die", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "death", encounterId: "e1", actorId: "a" },
    ];
    const result = score(events, chars);
    expect(result.milestones).toContainEqual({ kind: "total_party_wipe" });
  });

  it("teamTotal is sum of all character totals", () => {
    const chars = [makeChar("a", "DPS"), makeChar("b", "Healer")];
    const events: SimEvent[] = [
      { kind: "hit", encounterId: "e1", actorId: "a", amount: 10 },
      { kind: "heal", encounterId: "e1", actorId: "b", amount: 10 },
    ];
    const result = score(events, chars);
    const charTotal = Array.from(result.perCharacter.values()).reduce(
      (sum, c) => sum + c.totalPoints,
      0,
    );
    expect(result.teamTotal).toBeCloseTo(charTotal);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/domain/scoring.test.ts
```

Expected: FAIL — `score` does not exist.

- [ ] **Step 3: Implement scoring**

Create `domain/scoring.ts`:

```ts
import type { Character, CharacterScore, EventKind, Milestone, MilestoneKind, ScoreResult, SimEvent } from "./types";

const BASE_POINTS: Record<EventKind, number | ((e: SimEvent) => number)> = {
  hit: (e) => (e.amount ?? 0) * 0.1,
  kill: (e) => (e.meta?.boss ? 3 : 2),
  crit: 1,
  heal: (e) => (e.amount ?? 0) * 0.15,
  damage_taken: (e) => (e.amount ?? 0) * 0.05,
  save_pass: 1,
  save_fail: -0.5,
  disarm_trap: 2,
  find_treasure: 3,
  ko: -3,
  death: -5,
};

const ROLE_MULTIPLIED_EVENTS: Record<string, Set<EventKind>> = {
  Tank: new Set(["damage_taken", "save_pass"]),
  Healer: new Set(["heal", "save_pass"]),
  DPS: new Set(["hit", "kill", "crit"]),
  Utility: new Set(["disarm_trap", "find_treasure", "save_pass"]),
};

const ROLE_MULTIPLIER = 0.5;

function basePointsFor(event: SimEvent): number {
  const calc = BASE_POINTS[event.kind];
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
      milestonePoints: 0,
      totalPoints: 0,
    });
  }

  for (const event of events) {
    const cs = scores.get(event.actorId);
    if (!cs) continue;

    const base = basePointsFor(event);
    cs.basePoints += base;

    const char = charMap.get(event.actorId);
    if (char) {
      const multipliedEvents = ROLE_MULTIPLIED_EVENTS[char.role];
      if (multipliedEvents?.has(event.kind)) {
        cs.roleMultiplierPoints += base * ROLE_MULTIPLIER;
      }
    }
  }

  const milestones: Milestone[] = [];

  const hasKoOrDeath = events.some((e) => e.kind === "ko" || e.kind === "death");
  if (!hasKoOrDeath && events.length > 0) {
    milestones.push({ kind: "flawless_run" });
    for (const cs of scores.values()) {
      cs.milestonePoints += 3;
    }
  }

  const allDead = roster.every((c) => events.some((e) => e.kind === "death" && e.actorId === c.id));
  if (allDead) {
    milestones.push({ kind: "total_party_wipe" });
    for (const cs of scores.values()) {
      cs.milestonePoints += -10;
    }
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

  let mvpId: string | undefined;
  let mvpPoints = -Infinity;
  for (const cs of scores.values()) {
    const preMilestone = cs.basePoints + cs.roleMultiplierPoints;
    if (preMilestone > mvpPoints) {
      mvpPoints = preMilestone;
      mvpId = cs.characterId;
    }
  }
  if (mvpId && mvpPoints > 0) {
    milestones.push({ kind: "mvp_of_run", actorId: mvpId });
    const cs = scores.get(mvpId);
    if (cs) cs.milestonePoints += 5;
  }

  // clutch_survivor: if the event log shows a character took heavy damage
  // (had a KO event) but was not killed, they survived clutch.
  // In the abstract sim, we approximate this: if a character was KO'd
  // but not killed, they clutch-survived.
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
    cs.totalPoints = cs.basePoints + cs.roleMultiplierPoints + cs.milestonePoints;
    teamTotal += cs.totalPoints;
  }

  return { perCharacter: scores, milestones, teamTotal };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/domain/scoring.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add domain/scoring.ts tests/domain/scoring.test.ts
git commit -m "feat: add scoring module with role multipliers and milestones"
```

---

### Task 8: Highlight Generator

**Files:**
- Create: `domain/highlights.ts`, `domain/content/highlight-templates.ts`
- Modify: `domain/content/procedural-source.ts` (implement `getHighlightTemplates`)
- Test: `tests/domain/highlights.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/highlights.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateHighlights } from "domain/highlights";
import type { SimEvent, Character, Dungeon, Highlight } from "domain/types";

function makeChar(id: string, role: "Tank" | "Healer" | "DPS" | "Utility"): Character {
  return {
    id, name: `Hero ${id}`, race: "Human", class: "Fighter", role,
    stats: { str: 14, dex: 12, con: 13, int: 10, wis: 10, cha: 10 },
    level: 1, description: "test",
  };
}

const dungeon: Dungeon = {
  id: "d1", name: "Test Dungeon", theme: "undead",
  encounters: [
    { id: "e1", type: "combat", name: "Skeletons", difficulty: 5, targetStats: ["str"], isBoss: false },
    { id: "e2", type: "combat", name: "Lich", difficulty: 9, targetStats: ["int"], isBoss: true },
  ],
};

describe("highlight generator", () => {
  it("generates highlights for crit events", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "crit", encounterId: "e1", actorId: "a", amount: 15 },
    ];
    const highlights = generateHighlights(events, chars, dungeon);
    expect(highlights.some((h) => h.kind === "crit")).toBe(true);
  });

  it("generates highlights for kills", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "kill", encounterId: "e1", actorId: "a", meta: { boss: false } },
    ];
    const highlights = generateHighlights(events, chars, dungeon);
    expect(highlights.some((h) => h.kind === "kill")).toBe(true);
  });

  it("generates high-importance highlight for boss kills", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "kill", encounterId: "e2", actorId: "a", meta: { boss: true } },
    ];
    const highlights = generateHighlights(events, chars, dungeon);
    const bossHighlight = highlights.find((h) => h.kind === "boss_kill");
    expect(bossHighlight).toBeDefined();
    expect(bossHighlight!.importance).toBe("high");
  });

  it("generates highlight for death events", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "death", encounterId: "e1", actorId: "a" },
    ];
    const highlights = generateHighlights(events, chars, dungeon);
    expect(highlights.some((h) => h.kind === "death")).toBe(true);
  });

  it("highlights have descriptions", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "crit", encounterId: "e1", actorId: "a", amount: 20 },
      { kind: "kill", encounterId: "e1", actorId: "a", meta: { boss: false } },
    ];
    const highlights = generateHighlights(events, chars, dungeon);
    for (const h of highlights) {
      expect(h.description).toBeTruthy();
    }
  });

  it("limits highlights to ~10 per run", () => {
    const chars = [makeChar("a", "DPS"), makeChar("b", "Tank")];
    const events: SimEvent[] = [];
    for (let i = 0; i < 50; i++) {
      events.push({ kind: "crit", encounterId: "e1", actorId: "a", amount: 10 + i });
    }
    const highlights = generateHighlights(events, chars, dungeon);
    expect(highlights.length).toBeLessThanOrEqual(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/domain/highlights.test.ts
```

Expected: FAIL — `generateHighlights` does not exist.

- [ ] **Step 3: Create highlight templates**

Create `domain/content/highlight-templates.ts`:

```ts
import type { HighlightTemplateBundle } from "./content-source";

export const DEFAULT_HIGHLIGHT_TEMPLATES: HighlightTemplateBundle = {
  hit: [
    "{actor} landed a solid blow for {amount} damage!",
    "{actor} struck true, dealing {amount} damage.",
  ],
  kill: [
    "{actor} slew the {target}!",
    "{actor} delivered the killing blow to {target}.",
  ],
  crit: [
    "{actor} scored a devastating critical hit for {amount} damage!",
    "Critical strike! {actor} unleashed {amount} damage!",
  ],
  heal: [
    "{actor} healed {target} for {amount} HP.",
    "{actor} mended {target}'s wounds, restoring {amount} HP.",
  ],
  ko: [
    "{actor} was knocked unconscious!",
    "{actor} collapsed, overwhelmed by the onslaught.",
  ],
  death: [
    "{actor} has fallen! They will not continue this dungeon.",
    "{actor} met their end in the darkness.",
  ],
  disarm_trap: [
    "{actor} deftly disarmed the trap!",
    "{actor} spotted the danger and neutralized it.",
  ],
  find_treasure: [
    "{actor} discovered hidden treasure!",
    "{actor} unearthed a valuable cache!",
  ],
  save_pass: [
    "{actor} resisted the danger with ease.",
  ],
  save_fail: [
    "{actor} failed to avoid the hazard.",
  ],
  milestone: {
    mvp_of_run: ["{actor} was the Most Valuable Player of the run!"],
    clutch_survivor: ["{actor} survived by the skin of their teeth!"],
    first_blood: ["{actor} drew first blood!"],
    boss_killer: ["{actor} slew the dungeon boss!"],
    flawless_run: ["The party completed the dungeon without a single casualty!"],
    total_party_wipe: ["Total party wipe! The dungeon claimed every soul."],
  },
};
```

- [ ] **Step 4: Update ProceduralSource.getHighlightTemplates**

In `domain/content/procedural-source.ts`, replace the `getHighlightTemplates` method:

```ts
import { DEFAULT_HIGHLIGHT_TEMPLATES } from "./highlight-templates";

// ... existing code ...

  getHighlightTemplates(): HighlightTemplateBundle {
    return DEFAULT_HIGHLIGHT_TEMPLATES;
  }
```

- [ ] **Step 5: Implement highlight generator**

Create `domain/highlights.ts`:

```ts
import type { Character, Dungeon, Highlight, SimEvent } from "./types";
import { DEFAULT_HIGHLIGHT_TEMPLATES } from "./content/highlight-templates";

const MAX_HIGHLIGHTS = 10;

function findCharName(chars: Character[], id: string): string {
  return chars.find((c) => c.id === id)?.name ?? id;
}

function findEncounterName(dungeon: Dungeon, encounterId: string): string {
  return dungeon.encounters.find((e) => e.id === encounterId)?.name ?? encounterId;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

interface HighlightCandidate {
  highlight: Highlight;
  priority: number;
}

export function generateHighlights(
  events: SimEvent[],
  roster: Character[],
  dungeon: Dungeon,
): Highlight[] {
  const templates = DEFAULT_HIGHLIGHT_TEMPLATES;
  const candidates: HighlightCandidate[] = [];

  for (const event of events) {
    const actorName = findCharName(roster, event.actorId);
    const targetName = event.targetId
      ? findEncounterName(dungeon, event.targetId) || findCharName(roster, event.targetId)
      : "";
    const vars = {
      actor: actorName,
      target: targetName,
      amount: String(event.amount ?? 0),
    };

    switch (event.kind) {
      case "crit": {
        const tmpl = templates.crit[0] ?? "{actor} scored a critical hit!";
        candidates.push({
          highlight: {
            kind: "crit",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "medium",
          },
          priority: 5 + (event.amount ?? 0),
        });
        break;
      }
      case "kill": {
        const isBoss = !!event.meta?.boss;
        if (isBoss) {
          const tmpl = templates.milestone.boss_killer?.[0] ?? "{actor} slew the boss!";
          candidates.push({
            highlight: {
              kind: "boss_kill",
              actorIds: [event.actorId],
              description: fillTemplate(tmpl, vars),
              importance: "high",
            },
            priority: 100,
          });
        } else {
          const tmpl = templates.kill[0] ?? "{actor} slew {target}!";
          candidates.push({
            highlight: {
              kind: "kill",
              actorIds: [event.actorId],
              description: fillTemplate(tmpl, vars),
              importance: "medium",
            },
            priority: 10,
          });
        }
        break;
      }
      case "death": {
        const tmpl = templates.death[0] ?? "{actor} has fallen!";
        candidates.push({
          highlight: {
            kind: "death",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "high",
          },
          priority: 50,
        });
        break;
      }
      case "ko": {
        const tmpl = templates.ko[0] ?? "{actor} was knocked out!";
        candidates.push({
          highlight: {
            kind: "ko",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "medium",
          },
          priority: 20,
        });
        break;
      }
      case "heal": {
        if ((event.amount ?? 0) >= 8) {
          const tmpl = templates.heal[0] ?? "{actor} healed {target}!";
          candidates.push({
            highlight: {
              kind: "heal",
              actorIds: [event.actorId],
              description: fillTemplate(tmpl, vars),
              importance: "low",
            },
            priority: 3 + (event.amount ?? 0),
          });
        }
        break;
      }
      case "disarm_trap": {
        const tmpl = templates.disarm_trap[0] ?? "{actor} disarmed the trap!";
        candidates.push({
          highlight: {
            kind: "disarm_trap",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "medium",
          },
          priority: 15,
        });
        break;
      }
      case "find_treasure": {
        const tmpl = templates.find_treasure[0] ?? "{actor} found treasure!";
        candidates.push({
          highlight: {
            kind: "find_treasure",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "medium",
          },
          priority: 12,
        });
        break;
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.slice(0, MAX_HIGHLIGHTS).map((c) => c.highlight);
}
```

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/domain/highlights.test.ts
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add domain/highlights.ts domain/content/highlight-templates.ts tests/domain/highlights.test.ts domain/content/procedural-source.ts
git commit -m "feat: add highlight generator with templated descriptions"
```

---

### Task 9: AI Manager

**Files:**
- Create: `domain/ai-manager.ts`
- Test: `tests/domain/ai-manager.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/ai-manager.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AIManager } from "domain/ai-manager";
import { createRng } from "domain/rng";
import type { Character, AIPersonality, Dungeon } from "domain/types";

function makePool(): Character[] {
  const roles = ["Tank", "Healer", "DPS", "Utility"] as const;
  return Array.from({ length: 20 }, (_, i) => ({
    id: `char-${i}`,
    name: `Hero ${i}`,
    race: "Human" as const,
    class: "Fighter" as const,
    role: roles[i % 4],
    stats: { str: 10 + i, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    level: 1,
    description: `test ${i}`,
  }));
}

describe("AIManager", () => {
  const personality: AIPersonality = {
    name: "TankLover",
    priorityRoles: ["Tank", "Healer"],
    aggression: 0.7,
    seed: 42,
  };

  it("makeDraftPick returns a character from the available pool", () => {
    const ai = new AIManager(personality);
    const pool = makePool();
    const pick = ai.makeDraftPick(pool, [], createRng(42));
    expect(pool).toContain(pick);
  });

  it("prioritizes characters matching priority roles", () => {
    const ai = new AIManager(personality);
    const pool = makePool();
    const pick = ai.makeDraftPick(pool, [], createRng(42));
    expect(["Tank", "Healer"]).toContain(pick.role);
  });

  it("fills gaps in roster before doubling up on roles", () => {
    const ai = new AIManager(personality);
    const pool = makePool();
    const existingRoster = pool.filter((c) => c.role === "Tank").slice(0, 2);
    const pick = ai.makeDraftPick(pool.filter((c) => !existingRoster.includes(c)), existingRoster, createRng(42));
    expect(pick.role).toBe("Healer");
  });

  it("setLineup returns 4 active and 2 bench from a 6-char roster", () => {
    const ai = new AIManager(personality);
    const roster = makePool().slice(0, 6);
    const dungeon: Dungeon = {
      id: "d1", name: "Test", theme: "fire",
      encounters: [
        { id: "e1", type: "combat", name: "mob", difficulty: 5, targetStats: ["str"], isBoss: false },
      ],
    };
    const lineup = ai.setLineup(roster, dungeon, createRng(42));
    expect(lineup.active).toHaveLength(4);
    expect(lineup.bench).toHaveLength(2);
    const all = [...lineup.active, ...lineup.bench];
    expect(new Set(all).size).toBe(6);
  });

  it("setLineup is deterministic", () => {
    const ai = new AIManager(personality);
    const roster = makePool().slice(0, 6);
    const dungeon: Dungeon = {
      id: "d1", name: "Test", theme: "fire",
      encounters: [{ id: "e1", type: "combat", name: "mob", difficulty: 5, targetStats: ["str"], isBoss: false }],
    };
    const l1 = ai.setLineup(roster, dungeon, createRng(42));
    const l2 = ai.setLineup(roster, dungeon, createRng(42));
    expect(l1).toEqual(l2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/domain/ai-manager.test.ts
```

Expected: FAIL — `AIManager` does not exist.

- [ ] **Step 3: Implement AIManager**

Create `domain/ai-manager.ts`:

```ts
import type { AIPersonality, Character, Dungeon, Lineup, Stats } from "./types";
import type { Rng } from "./rng";

export class AIManager {
  constructor(private personality: AIPersonality) {}

  makeDraftPick(available: Character[], currentRoster: Character[], rng: Rng): Character {
    const ownedRoles = new Set(currentRoster.map((c) => c.role));
    const neededPriorityRoles = this.personality.priorityRoles.filter((r) => !ownedRoles.has(r));

    if (neededPriorityRoles.length > 0) {
      const candidates = available.filter((c) => neededPriorityRoles.includes(c.role));
      if (candidates.length > 0) {
        return this.pickByStat(candidates, rng);
      }
    }

    const priorityCandidates = available.filter((c) => this.personality.priorityRoles.includes(c.role));
    if (priorityCandidates.length > 0 && rng.next() < this.personality.aggression) {
      return this.pickByStat(priorityCandidates, rng);
    }

    return this.pickByStat(available, rng);
  }

  setLineup(roster: Character[], dungeon: Dungeon, rng: Rng): Lineup {
    const targetStats = new Set<keyof Stats>();
    for (const enc of dungeon.encounters) {
      for (const stat of enc.targetStats) {
        targetStats.add(stat);
      }
    }

    const scored = roster.map((char) => {
      let relevance = 0;
      for (const stat of targetStats) {
        relevance += char.stats[stat];
      }
      if (this.personality.priorityRoles.includes(char.role)) {
        relevance += 10;
      }
      relevance += rng.next() * 5;
      return { char, relevance };
    });

    scored.sort((a, b) => b.relevance - a.relevance);
    const active = scored.slice(0, 4).map((s) => s.char.id) as [string, string, string, string];
    const bench = scored.slice(4, 6).map((s) => s.char.id) as [string, string];

    return { active, bench };
  }

  private pickByStat(candidates: Character[], rng: Rng): Character {
    const sorted = [...candidates].sort((a, b) => {
      const aTotal = Object.values(a.stats).reduce((s, v) => s + v, 0);
      const bTotal = Object.values(b.stats).reduce((s, v) => s + v, 0);
      return bTotal - aTotal;
    });
    const topCount = Math.max(1, Math.ceil(sorted.length * 0.3));
    return rng.pick(sorted.slice(0, topCount));
  }
}

export const AI_PERSONALITIES: AIPersonality[] = [
  { name: "Iron Wall", priorityRoles: ["Tank", "Healer"], aggression: 0.8, seed: 1 },
  { name: "Glass Cannon", priorityRoles: ["DPS", "DPS"], aggression: 0.9, seed: 2 },
  { name: "Balanced General", priorityRoles: ["Tank", "DPS"], aggression: 0.5, seed: 3 },
  { name: "Treasure Hunter", priorityRoles: ["Utility", "DPS"], aggression: 0.6, seed: 4 },
  { name: "Mystic Circle", priorityRoles: ["Healer", "Utility"], aggression: 0.7, seed: 5 },
];
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/domain/ai-manager.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add domain/ai-manager.ts tests/domain/ai-manager.test.ts
git commit -m "feat: add AI manager with personality-driven draft and lineup strategies"
```

---

### Task 10: Schedule Generator

**Files:**
- Create: `domain/schedule.ts`
- Test: `tests/domain/schedule.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/schedule.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateRegularSeason, generatePlayoffMatchups } from "domain/schedule";

describe("schedule generator", () => {
  const teamIds = ["t1", "t2", "t3", "t4", "t5", "t6"];

  describe("regular season", () => {
    it("generates 5 weeks of matchups for 6 teams", () => {
      const schedule = generateRegularSeason(teamIds);
      expect(schedule).toHaveLength(5);
    });

    it("each week has 3 matchups", () => {
      const schedule = generateRegularSeason(teamIds);
      for (const week of schedule) {
        expect(week).toHaveLength(3);
      }
    });

    it("every team plays exactly once per week", () => {
      const schedule = generateRegularSeason(teamIds);
      for (const week of schedule) {
        const teams = week.flatMap((m) => [m.home, m.away]);
        expect(new Set(teams).size).toBe(6);
      }
    });

    it("every team plays every other team exactly once across the season", () => {
      const schedule = generateRegularSeason(teamIds);
      const matchupSet = new Set<string>();
      for (const week of schedule) {
        for (const matchup of week) {
          const key = [matchup.home, matchup.away].sort().join("-");
          expect(matchupSet.has(key)).toBe(false);
          matchupSet.add(key);
        }
      }
      expect(matchupSet.size).toBe(15);
    });
  });

  describe("playoffs", () => {
    it("generates semifinal matchups from top 4 teams", () => {
      const standings = ["t1", "t2", "t3", "t4", "t5", "t6"];
      const semis = generatePlayoffMatchups(standings, "semifinal");
      expect(semis).toHaveLength(2);
      expect(semis[0].home).toBe("t1");
      expect(semis[0].away).toBe("t4");
      expect(semis[1].home).toBe("t2");
      expect(semis[1].away).toBe("t3");
    });

    it("generates final matchup from 2 winners", () => {
      const finalists = ["t1", "t2"];
      const final = generatePlayoffMatchups(finalists, "final");
      expect(final).toHaveLength(1);
      expect(final[0].home).toBe("t1");
      expect(final[0].away).toBe("t2");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/domain/schedule.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement schedule generator**

Create `domain/schedule.ts`:

```ts
export interface ScheduleMatchup {
  home: string;
  away: string;
}

export function generateRegularSeason(teamIds: string[]): ScheduleMatchup[][] {
  const n = teamIds.length;
  const rounds: ScheduleMatchup[][] = [];

  const teams = [...teamIds];
  if (n % 2 !== 0) teams.push("BYE");
  const count = teams.length;
  const fixed = teams[0];
  const rotating = teams.slice(1);

  for (let round = 0; round < count - 1; round++) {
    const week: ScheduleMatchup[] = [];
    const current = [fixed, ...rotating];

    for (let i = 0; i < count / 2; i++) {
      const home = current[i];
      const away = current[count - 1 - i];
      if (home !== "BYE" && away !== "BYE") {
        week.push({ home, away });
      }
    }

    rounds.push(week);
    rotating.push(rotating.shift()!);
  }

  return rounds;
}

export function generatePlayoffMatchups(
  rankedTeamIds: string[],
  round: "semifinal" | "final",
): ScheduleMatchup[] {
  if (round === "final") {
    return [{ home: rankedTeamIds[0], away: rankedTeamIds[1] }];
  }

  const top4 = rankedTeamIds.slice(0, 4);
  return [
    { home: top4[0], away: top4[3] },
    { home: top4[1], away: top4[2] },
  ];
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/domain/schedule.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add domain/schedule.ts tests/domain/schedule.test.ts
git commit -m "feat: add round-robin and playoff schedule generator"
```

---

### Task 11: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the Prisma schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model League {
  id           String    @id @default(cuid())
  name         String
  phase        String    @default("draft")
  currentWeek  Int       @default(0)
  settings     Json      @default("{}")
  createdAt    DateTime  @default(now())

  teams        Team[]
  characters   Character[]
  matchups     Matchup[]
}

model Team {
  id             String   @id @default(cuid())
  name           String
  leagueId       String
  managerId      String
  managerType    String
  aiPersonality  Json?
  wins           Int      @default(0)
  losses         Int      @default(0)
  pointsFor      Float    @default(0)
  pointsAgainst  Float    @default(0)

  league         League   @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  roster         Character[] @relation("TeamRoster")
  lineups        Lineup[]
  homeMatchups   Matchup[] @relation("HomeTeam")
  awayMatchups   Matchup[] @relation("AwayTeam")
}

model Character {
  id          String   @id @default(cuid())
  externalId  String
  name        String
  race        String
  class       String
  role        String
  stats       Json
  level       Int      @default(1)
  description String

  leagueId    String
  league      League   @relation(fields: [leagueId], references: [id], onDelete: Cascade)

  teamId      String?
  team        Team?    @relation("TeamRoster", fields: [teamId], references: [id])

  draftOrder  Int?
}

model Lineup {
  id       String @id @default(cuid())
  teamId   String
  week     Int
  active   Json
  bench    Json

  team     Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, week])
}

model Matchup {
  id           String  @id @default(cuid())
  leagueId     String
  week         Int
  homeTeamId   String
  awayTeamId   String
  dungeonData  Json?
  homeRunData  Json?
  awayRunData  Json?
  winnerId     String?

  league       League  @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  homeTeam     Team    @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeam     Team    @relation("AwayTeam", fields: [awayTeamId], references: [id])

  @@index([leagueId, week])
}
```

- [ ] **Step 2: Create Prisma client singleton**

Create `app/lib/db.server.ts`:

```ts
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

declare global {
  var __db__: PrismaClient | undefined;
}

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient();
  }
  prisma = global.__db__;
}

export { prisma };
```

- [ ] **Step 3: Create dev-mode auth stub**

Create `app/lib/auth.server.ts`:

```ts
const DEV_USER_ID = "dev-user-1";
const DEV_USER_NAME = "Player One";

export function getCurrentUser() {
  return {
    id: DEV_USER_ID,
    name: DEV_USER_NAME,
  };
}
```

- [ ] **Step 4: Set up the database and generate client**

Update `.env` with your Postgres connection string, then:

```bash
npx prisma db push
npx prisma generate
```

Expected: Database schema created, Prisma client generated.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma app/lib/db.server.ts app/lib/auth.server.ts
git commit -m "feat: add Prisma schema and server utilities"
```

---

### Task 12: League Service (Create League + Advance Week)

**Files:**
- Create: `services/league-service.server.ts`
- Test: `tests/services/league-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/services/league-service.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createLeague, advanceWeek, getLeague } from "services/league-service.server";

const prisma = new PrismaClient();

describe("league service", () => {
  beforeEach(async () => {
    await prisma.lineup.deleteMany();
    await prisma.matchup.deleteMany();
    await prisma.character.deleteMany();
    await prisma.team.deleteMany();
    await prisma.league.deleteMany();
  });

  it("createLeague creates a league with 6 teams and 48 characters", async () => {
    const league = await createLeague("Test League", "dev-user-1");
    expect(league.name).toBe("Test League");
    expect(league.phase).toBe("draft");

    const teams = await prisma.team.findMany({ where: { leagueId: league.id } });
    expect(teams).toHaveLength(6);
    expect(teams.filter((t) => t.managerType === "human")).toHaveLength(1);
    expect(teams.filter((t) => t.managerType === "ai")).toHaveLength(5);

    const chars = await prisma.character.findMany({ where: { leagueId: league.id } });
    expect(chars).toHaveLength(48);
  });

  it("createLeague generates schedule matchups", async () => {
    const league = await createLeague("Test League", "dev-user-1");
    const matchups = await prisma.matchup.findMany({ where: { leagueId: league.id } });
    expect(matchups.filter((m) => m.week <= 5)).toHaveLength(15);
  });

  it("advanceWeek processes matchups and updates standings", async () => {
    const league = await createLeague("Advance Test", "dev-user-1");

    await prisma.league.update({
      where: { id: league.id },
      data: { phase: "regular", currentWeek: 1 },
    });

    const teams = await prisma.team.findMany({ where: { leagueId: league.id } });
    const chars = await prisma.character.findMany({ where: { leagueId: league.id } });

    for (const team of teams) {
      const teamChars = chars.filter((c) => c.teamId === team.id).slice(0, 6);
      if (teamChars.length >= 6) {
        await prisma.lineup.create({
          data: {
            teamId: team.id,
            week: 1,
            active: teamChars.slice(0, 4).map((c) => c.externalId),
            bench: teamChars.slice(4, 6).map((c) => c.externalId),
          },
        });
      }
    }

    const result = await advanceWeek(league.id);
    expect(result.week).toBe(1);

    const updatedTeams = await prisma.team.findMany({ where: { leagueId: league.id } });
    const totalWins = updatedTeams.reduce((sum, t) => sum + t.wins, 0);
    const totalLosses = updatedTeams.reduce((sum, t) => sum + t.losses, 0);
    expect(totalWins).toBe(3);
    expect(totalLosses).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/services/league-service.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement league service**

Create `services/league-service.server.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { ProceduralSource } from "domain/content/procedural-source";
import { createRng, seedFromIds } from "domain/rng";
import { runDungeon } from "domain/sim/sim-engine";
import { score } from "domain/scoring";
import { generateHighlights } from "domain/highlights";
import { AIManager, AI_PERSONALITIES } from "domain/ai-manager";
import { generateRegularSeason } from "domain/schedule";
import { DEFAULT_LEAGUE_SETTINGS, type Character, type Lineup } from "domain/types";

const prisma = new PrismaClient();
const contentSource = new ProceduralSource();

const AI_TEAM_NAMES = [
  "Shadow Syndicate", "Iron Legion", "Mystic Order",
  "Wild Hunt", "Crimson Vanguard",
];

export async function createLeague(name: string, userId: string) {
  const leagueId = crypto.randomUUID();
  const rng = createRng(seedFromIds(leagueId, "init"));
  const characters = contentSource.generateCharacters(48, rng);

  const league = await prisma.league.create({
    data: {
      id: leagueId,
      name,
      phase: "draft",
      currentWeek: 0,
      settings: DEFAULT_LEAGUE_SETTINGS as any,
    },
  });

  await prisma.character.createMany({
    data: characters.map((c) => ({
      externalId: c.id,
      name: c.name,
      race: c.race,
      class: c.class,
      role: c.role,
      stats: c.stats as any,
      level: c.level,
      description: c.description,
      leagueId: league.id,
    })),
  });

  const humanTeam = await prisma.team.create({
    data: {
      name: "Your Team",
      leagueId: league.id,
      managerId: userId,
      managerType: "human",
    },
  });

  const teamIds = [humanTeam.id];

  for (let i = 0; i < 5; i++) {
    const aiTeam = await prisma.team.create({
      data: {
        name: AI_TEAM_NAMES[i],
        leagueId: league.id,
        managerId: `ai-${i}`,
        managerType: "ai",
        aiPersonality: AI_PERSONALITIES[i] as any,
      },
    });
    teamIds.push(aiTeam.id);
  }

  const schedule = generateRegularSeason(teamIds);
  for (let weekIdx = 0; weekIdx < schedule.length; weekIdx++) {
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

export async function getLeague(id: string) {
  return prisma.league.findUniqueOrThrow({
    where: { id },
    include: {
      teams: { orderBy: { wins: "desc" } },
      matchups: { orderBy: { week: "asc" } },
    },
  });
}

export async function advanceWeek(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const week = league.currentWeek;

  const matchups = await prisma.matchup.findMany({
    where: { leagueId, week },
    include: { homeTeam: true, awayTeam: true },
  });

  const allChars = await prisma.character.findMany({ where: { leagueId } });
  const charByExtId = new Map(allChars.map((c) => [c.externalId, c]));

  const charMap = new Map<string, Character>();
  for (const c of allChars) {
    charMap.set(c.externalId, {
      id: c.externalId,
      name: c.name,
      race: c.race as any,
      class: c.class as any,
      role: c.role as any,
      stats: c.stats as any,
      level: c.level,
      description: c.description,
    });
  }

  for (const matchup of matchups) {
    const rng = createRng(seedFromIds(leagueId, String(week), matchup.id));
    const dungeon = contentSource.generateDungeon(week, 0, rng.fork("dungeon"));

    const processTeam = async (team: typeof matchup.homeTeam) => {
      let lineup = await prisma.lineup.findUnique({
        where: { teamId_week: { teamId: team.id, week } },
      });

      if (!lineup && team.managerType === "ai") {
        const teamChars = allChars.filter((c) => c.teamId === team.id);
        const rosterChars = teamChars.map((c) => charMap.get(c.externalId)!);
        const personality = team.aiPersonality as any;
        const ai = new AIManager(personality);
        const aiLineup = ai.setLineup(rosterChars, dungeon, rng.fork(`lineup-${team.id}`));
        lineup = await prisma.lineup.create({
          data: { teamId: team.id, week, active: aiLineup.active, bench: aiLineup.bench },
        });
      }

      if (!lineup) throw new Error(`No lineup for team ${team.id} week ${week}`);

      const lineupData: Lineup = {
        active: (lineup.active as string[]) as [string, string, string, string],
        bench: (lineup.bench as string[]) as [string, string],
      };

      const events = runDungeon(lineupData, charMap, dungeon, rng.fork(`sim-${team.id}`));
      const rosterChars = (lineup.active as string[]).map((id) => charMap.get(id)!);
      const scoreResult = score(events, rosterChars);
      const highlights = generateHighlights(events, rosterChars, dungeon);

      return { events, score: scoreResult, highlights, teamTotal: scoreResult.teamTotal };
    };

    const homeResult = await processTeam(matchup.homeTeam);
    const awayResult = await processTeam(matchup.awayTeam);

    const winnerId = homeResult.teamTotal >= awayResult.teamTotal
      ? matchup.homeTeamId
      : matchup.awayTeamId;
    const loserId = winnerId === matchup.homeTeamId
      ? matchup.awayTeamId
      : matchup.homeTeamId;

    await prisma.matchup.update({
      where: { id: matchup.id },
      data: {
        dungeonData: dungeon as any,
        homeRunData: {
          events: homeResult.events,
          score: {
            perCharacter: Object.fromEntries(homeResult.score.perCharacter),
            milestones: homeResult.score.milestones,
            teamTotal: homeResult.score.teamTotal,
          },
          highlights: homeResult.highlights,
        } as any,
        awayRunData: {
          events: awayResult.events,
          score: {
            perCharacter: Object.fromEntries(awayResult.score.perCharacter),
            milestones: awayResult.score.milestones,
            teamTotal: awayResult.score.teamTotal,
          },
          highlights: awayResult.highlights,
        } as any,
        winnerId,
      },
    });

    await prisma.team.update({
      where: { id: winnerId },
      data: {
        wins: { increment: 1 },
        pointsFor: { increment: winnerId === matchup.homeTeamId ? homeResult.teamTotal : awayResult.teamTotal },
        pointsAgainst: { increment: winnerId === matchup.homeTeamId ? awayResult.teamTotal : homeResult.teamTotal },
      },
    });

    await prisma.team.update({
      where: { id: loserId },
      data: {
        losses: { increment: 1 },
        pointsFor: { increment: loserId === matchup.homeTeamId ? homeResult.teamTotal : awayResult.teamTotal },
        pointsAgainst: { increment: loserId === matchup.homeTeamId ? awayResult.teamTotal : homeResult.teamTotal },
      },
    });
  }

  const nextWeek = week + 1;
  const settings = league.settings as any;
  const totalWeeks = settings.seasonWeeks + settings.playoffWeeks;
  const enteringPlayoffs = week === settings.seasonWeeks;
  const newPhase = nextWeek > totalWeeks ? "complete" : nextWeek > settings.seasonWeeks ? "playoffs" : "regular";

  if (enteringPlayoffs) {
    const teams = await prisma.team.findMany({
      where: { leagueId },
      orderBy: [{ wins: "desc" }, { pointsFor: "desc" }],
    });
    const rankedIds = teams.map((t) => t.id);

    const { generatePlayoffMatchups } = await import("domain/schedule");
    const semis = generatePlayoffMatchups(rankedIds, "semifinal");
    for (const m of semis) {
      await prisma.matchup.create({
        data: { leagueId, week: settings.seasonWeeks + 1, homeTeamId: m.home, awayTeamId: m.away },
      });
    }
  }

  if (week === settings.seasonWeeks + 1 && newPhase === "playoffs") {
    const semiMatchups = await prisma.matchup.findMany({
      where: { leagueId, week },
    });
    const winnerIds = semiMatchups
      .filter((m) => m.winnerId)
      .map((m) => m.winnerId!);
    if (winnerIds.length === 2) {
      const { generatePlayoffMatchups } = await import("domain/schedule");
      const finals = generatePlayoffMatchups(winnerIds, "final");
      for (const m of finals) {
        await prisma.matchup.create({
          data: { leagueId, week: settings.seasonWeeks + 2, homeTeamId: m.home, awayTeamId: m.away },
        });
      }
    }
  }

  await prisma.league.update({
    where: { id: leagueId },
    data: { currentWeek: nextWeek, phase: newPhase },
  });

  return { week, matchupCount: matchups.length };
}
```

- [ ] **Step 4: Run tests (requires running Postgres)**

```bash
npm test -- tests/services/league-service.test.ts
```

Expected: All tests pass (requires a running Postgres instance matching DATABASE_URL).

- [ ] **Step 5: Commit**

```bash
git add services/league-service.server.ts tests/services/league-service.test.ts
git commit -m "feat: add league service with createLeague and advanceWeek"
```

---

### Task 13: Draft Service

**Files:**
- Create: `services/draft-service.server.ts`
- Test: `tests/services/draft-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/services/draft-service.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createLeague } from "services/league-service.server";
import { getDraftState, makePick, makeAIPick } from "services/draft-service.server";

const prisma = new PrismaClient();

describe("draft service", () => {
  let leagueId: string;

  beforeEach(async () => {
    await prisma.lineup.deleteMany();
    await prisma.matchup.deleteMany();
    await prisma.character.deleteMany();
    await prisma.team.deleteMany();
    await prisma.league.deleteMany();

    const league = await createLeague("Draft Test", "dev-user-1");
    leagueId = league.id;
  });

  it("getDraftState returns correct initial state", async () => {
    const state = await getDraftState(leagueId);
    expect(state.currentPick).toBe(0);
    expect(state.totalPicks).toBe(36);
    expect(state.available).toHaveLength(48);
    expect(state.draftOrder).toHaveLength(36);
  });

  it("makePick assigns character to team and advances pick", async () => {
    const state = await getDraftState(leagueId);
    const currentTeamId = state.draftOrder[0].teamId;
    const charId = state.available[0].id;

    await makePick(leagueId, currentTeamId, charId);

    const updated = await getDraftState(leagueId);
    expect(updated.currentPick).toBe(1);
    expect(updated.available.find((c) => c.id === charId)).toBeUndefined();
  });

  it("makeAIPick selects a character for the AI team", async () => {
    const state = await getDraftState(leagueId);
    const aiTeamEntry = state.draftOrder.find((d) => d.managerType === "ai");
    if (!aiTeamEntry) return;

    const pick = await makeAIPick(leagueId);
    expect(pick).toBeTruthy();

    const updated = await getDraftState(leagueId);
    expect(updated.currentPick).toBeGreaterThan(state.currentPick);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/services/draft-service.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement draft service**

Create `services/draft-service.server.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { AIManager } from "domain/ai-manager";
import { createRng, seedFromIds } from "domain/rng";
import type { Character } from "domain/types";

const prisma = new PrismaClient();

function generateSnakeDraftOrder(teamIds: string[], rounds: number): { teamId: string; round: number; pick: number }[] {
  const order: { teamId: string; round: number; pick: number }[] = [];
  let pickNum = 0;

  for (let round = 0; round < rounds; round++) {
    const roundOrder = round % 2 === 0 ? teamIds : [...teamIds].reverse();
    for (const teamId of roundOrder) {
      order.push({ teamId, round, pick: pickNum++ });
    }
  }

  return order;
}

export async function getDraftState(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const teams = await prisma.team.findMany({ where: { leagueId } });
  const characters = await prisma.character.findMany({ where: { leagueId } });

  const available = characters.filter((c) => c.teamId === null);
  const drafted = characters.filter((c) => c.teamId !== null);

  const teamIds = teams.map((t) => t.id);
  const settings = league.settings as any;
  const draftOrder = generateSnakeDraftOrder(teamIds, settings.rosterSize);
  const currentPick = drafted.length;

  return {
    leagueId,
    currentPick,
    totalPicks: draftOrder.length,
    draftOrder: draftOrder.map((d) => ({
      ...d,
      managerType: teams.find((t) => t.id === d.teamId)!.managerType,
    })),
    available: available.map((c) => ({
      id: c.id,
      externalId: c.externalId,
      name: c.name,
      race: c.race,
      class: c.class,
      role: c.role,
      stats: c.stats,
      level: c.level,
      description: c.description,
    })),
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      managerType: t.managerType,
      roster: characters.filter((c) => c.teamId === t.id),
    })),
  };
}

export async function makePick(leagueId: string, teamId: string, characterDbId: string) {
  const character = await prisma.character.findUniqueOrThrow({ where: { id: characterDbId } });
  if (character.teamId) throw new Error("Character already drafted");
  if (character.leagueId !== leagueId) throw new Error("Character not in this league");

  const drafted = await prisma.character.count({ where: { leagueId, teamId: { not: null } } });

  await prisma.character.update({
    where: { id: characterDbId },
    data: { teamId, draftOrder: drafted },
  });

  const totalRosterSlots = 36;
  if (drafted + 1 >= totalRosterSlots) {
    await prisma.league.update({
      where: { id: leagueId },
      data: { phase: "regular", currentWeek: 1 },
    });
  }

  return character;
}

export async function makeAIPick(leagueId: string) {
  const state = await getDraftState(leagueId);
  if (state.currentPick >= state.totalPicks) return null;

  const currentDraftSlot = state.draftOrder[state.currentPick];
  const team = state.teams.find((t) => t.id === currentDraftSlot.teamId);
  if (!team || team.managerType !== "ai") return null;

  const aiTeam = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
  const personality = aiTeam.aiPersonality as any;
  const ai = new AIManager(personality);

  const rng = createRng(seedFromIds(leagueId, "draft", String(state.currentPick)));

  const availableChars: Character[] = state.available.map((c) => ({
    id: c.externalId,
    name: c.name,
    race: c.race as any,
    class: c.class as any,
    role: c.role as any,
    stats: c.stats as any,
    level: c.level,
    description: c.description,
  }));

  const rosterChars: Character[] = team.roster.map((c) => ({
    id: c.externalId,
    name: c.name,
    race: c.race as any,
    class: c.class as any,
    role: c.role as any,
    stats: c.stats as any,
    level: c.level,
    description: c.description,
  }));

  const pick = ai.makeDraftPick(availableChars, rosterChars, rng);
  const dbChar = state.available.find((c) => c.externalId === pick.id);
  if (!dbChar) throw new Error("AI picked unavailable character");

  await makePick(leagueId, team.id, dbChar.id);
  return pick;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/services/draft-service.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/draft-service.server.ts tests/services/draft-service.test.ts
git commit -m "feat: add draft service with snake draft and AI picks"
```

---

### Task 14: UI — Root Layout and League List

**Files:**
- Modify: `app/root.tsx`
- Modify: `app/routes/_index.tsx`
- Create: `app/app.css` (or modify existing styles)

- [ ] **Step 1: Create the root layout with parchment aesthetic**

Replace `app/root.tsx`:

```tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="app-container">
          <header className="app-header">
            <a href="/" className="logo">Dungeon League</a>
          </header>
          <main className="app-main">{children}</main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
```

- [ ] **Step 2: Add base CSS with parchment aesthetic**

Create `app/app.css`:

```css
:root {
  --parchment: #f4e8c1;
  --parchment-dark: #d4c5a0;
  --ink: #2c1810;
  --ink-light: #5a3e2b;
  --accent: #8b1a1a;
  --accent-light: #c44d4d;
  --gold: #b8860b;
  --shadow: rgba(44, 24, 16, 0.15);
  --font-body: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
  --font-heading: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  background: var(--parchment);
  color: var(--ink);
  min-height: 100vh;
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 29px,
      rgba(44, 24, 16, 0.03) 30px
    );
}

.app-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1rem;
}

.app-header {
  padding: 1.5rem 0;
  border-bottom: 2px solid var(--ink-light);
  margin-bottom: 2rem;
}

.logo {
  font-family: var(--font-heading);
  font-size: 2rem;
  font-weight: bold;
  color: var(--accent);
  text-decoration: none;
  letter-spacing: 0.05em;
}

.app-main {
  padding-bottom: 3rem;
}

h1, h2, h3 {
  font-family: var(--font-heading);
  color: var(--ink);
  margin-bottom: 0.75rem;
}

h1 { font-size: 1.75rem; }
h2 { font-size: 1.35rem; border-bottom: 1px solid var(--parchment-dark); padding-bottom: 0.5rem; }
h3 { font-size: 1.1rem; }

a { color: var(--accent); }
a:hover { color: var(--accent-light); }

.btn {
  display: inline-block;
  padding: 0.6rem 1.2rem;
  background: var(--accent);
  color: var(--parchment);
  border: none;
  border-radius: 4px;
  font-family: var(--font-body);
  font-size: 1rem;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s;
}

.btn:hover { background: var(--accent-light); }

.btn-gold {
  background: var(--gold);
}

.btn-gold:hover {
  background: #9a7209;
}

.card {
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid var(--parchment-dark);
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 4px var(--shadow);
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

th, td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--parchment-dark);
}

th {
  font-weight: bold;
  color: var(--ink-light);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--ink-light);
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
  font-weight: bold;
}

.badge-tank { background: #4a6fa5; color: white; }
.badge-healer { background: #2e8b57; color: white; }
.badge-dps { background: #b8860b; color: white; }
.badge-utility { background: #7b68ee; color: white; }
```

- [ ] **Step 3: Create the league list page**

Replace `app/routes/_index.tsx`:

```tsx
import { Link, useLoaderData } from "react-router";
import { prisma } from "~/lib/db.server";
import type { Route } from "./+types/_index";

export async function loader() {
  const leagues = await prisma.league.findMany({
    orderBy: { createdAt: "desc" },
    include: { teams: { where: { managerType: "human" } } },
  });

  return { leagues };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { leagues } = loaderData;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1>Your Leagues</h1>
        <Link to="/leagues/new" className="btn">New League</Link>
      </div>

      {leagues.length === 0 ? (
        <div className="empty-state">
          <h2>No leagues yet</h2>
          <p>Create your first league to start drafting a team of adventurers.</p>
        </div>
      ) : (
        <div>
          {leagues.map((league) => (
            <Link key={league.id} to={`/leagues/${league.id}`} style={{ textDecoration: "none" }}>
              <div className="card">
                <h3>{league.name}</h3>
                <p style={{ color: "var(--ink-light)", fontSize: "0.9rem" }}>
                  Phase: {league.phase} &middot; Week {league.currentWeek}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Open http://localhost:5173 — should show "Your Leagues" with "New League" button and empty state. Parchment aesthetic visible.

- [ ] **Step 5: Commit**

```bash
git add app/root.tsx app/routes/_index.tsx app/app.css
git commit -m "feat: add root layout and league list page with parchment aesthetic"
```

---

### Task 15: UI — Create League and Draft Room

**Files:**
- Create: `app/routes/leagues.new.tsx`, `app/routes/leagues.$id_.draft.tsx`, `app/components/draft-pool.tsx`, `app/components/character-card.tsx`

- [ ] **Step 1: Create league page**

Create `app/routes/leagues.new.tsx`:

```tsx
import { Form, redirect } from "react-router";
import { createLeague } from "services/league-service.server";
import { getCurrentUser } from "~/lib/auth.server";
import type { Route } from "./+types/leagues.new";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("League name required");

  const user = getCurrentUser();
  const league = await createLeague(name.trim(), user.id);
  return redirect(`/leagues/${league.id}/draft`);
}

export default function NewLeague() {
  return (
    <div>
      <h1>Create New League</h1>
      <Form method="post" className="card" style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="name" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
            League Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Enter league name..."
            style={{
              width: "100%",
              padding: "0.5rem",
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
              border: "1px solid var(--parchment-dark)",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.5)",
            }}
          />
        </div>
        <button type="submit" className="btn">Create &amp; Start Draft</button>
      </Form>
    </div>
  );
}
```

- [ ] **Step 2: Create character card component**

Create `app/components/character-card.tsx`:

```tsx
interface CharacterCardProps {
  character: {
    id: string;
    name: string;
    race: string;
    class: string;
    role: string;
    stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
    level: number;
    description: string;
  };
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
}

export function CharacterCard({ character, onClick, selected, compact }: CharacterCardProps) {
  const roleClass = `badge badge-${character.role.toLowerCase()}`;

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
          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", fontStyle: "italic" }}>
            {character.description}
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the draft pool filter component**

Create `app/components/draft-pool.tsx`:

```tsx
import { useState } from "react";
import { CharacterCard } from "./character-card";

interface DraftPoolProps {
  characters: any[];
  onPick: (charId: string) => void;
  isMyTurn: boolean;
}

export function DraftPool({ characters, onPick, isMyTurn }: DraftPoolProps) {
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filtered = roleFilter === "all"
    ? characters
    : characters.filter((c) => c.role === roleFilter);

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {["all", "Tank", "Healer", "DPS", "Utility"].map((role) => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={roleFilter === role ? "btn" : "btn"}
            style={{
              padding: "0.3rem 0.8rem",
              fontSize: "0.85rem",
              opacity: roleFilter === role ? 1 : 0.6,
            }}
          >
            {role === "all" ? "All" : role}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {filtered.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            onClick={isMyTurn ? () => onPick(char.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the draft room page**

Create `app/routes/leagues.$id_.draft.tsx`:

```tsx
import { useLoaderData, useFetcher } from "react-router";
import { getDraftState, makePick, makeAIPick } from "services/draft-service.server";
import { getCurrentUser } from "~/lib/auth.server";
import { DraftPool } from "~/components/draft-pool";
import { CharacterCard } from "~/components/character-card";
import { redirect } from "react-router";
import type { Route } from "./+types/leagues.$id_.draft";

export async function loader({ params }: Route.LoaderArgs) {
  const state = await getDraftState(params.id);
  const user = getCurrentUser();

  if (state.currentPick >= state.totalPicks) {
    return redirect(`/leagues/${params.id}`);
  }

  const currentSlot = state.draftOrder[state.currentPick];
  const humanTeam = state.teams.find(
    (t) => t.managerType === "human"
  );

  return {
    ...state,
    isMyTurn: currentSlot?.teamId === humanTeam?.id,
    currentTeamName: state.teams.find((t) => t.id === currentSlot?.teamId)?.name ?? "Unknown",
    humanTeamId: humanTeam?.id,
    myRoster: humanTeam?.roster ?? [],
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "pick") {
    const charId = formData.get("characterId") as string;
    const teamId = formData.get("teamId") as string;
    await makePick(params.id, teamId, charId);
  } else if (intent === "ai-pick") {
    await makeAIPick(params.id);
  }

  const state = await getDraftState(params.id);
  if (state.currentPick >= state.totalPicks) {
    return redirect(`/leagues/${params.id}`);
  }

  return null;
}

export default function DraftRoom({ loaderData }: Route.ComponentProps) {
  const data = loaderData;
  const fetcher = useFetcher();

  const handlePick = (charId: string) => {
    fetcher.submit(
      { intent: "pick", characterId: charId, teamId: data.humanTeamId! },
      { method: "post" },
    );
  };

  const handleAIPick = () => {
    fetcher.submit({ intent: "ai-pick" }, { method: "post" });
  };

  return (
    <div>
      <h1>Draft Room</h1>
      <div style={{ marginBottom: "1rem" }} className="card">
        <p>
          Pick {data.currentPick + 1} of {data.totalPicks} &mdash;{" "}
          <strong>{data.currentTeamName}</strong>
          {data.isMyTurn ? " (Your pick!)" : "'s turn"}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem" }}>
        <div>
          <h2>Available Characters ({data.available.length})</h2>
          {data.isMyTurn ? (
            <DraftPool
              characters={data.available}
              onPick={handlePick}
              isMyTurn={true}
            />
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p>Waiting for <strong>{data.currentTeamName}</strong> to pick...</p>
              <button onClick={handleAIPick} className="btn" style={{ marginTop: "1rem" }}>
                Continue
              </button>
            </div>
          )}
        </div>

        <div>
          <h2>Your Roster ({data.myRoster.length}/6)</h2>
          {data.myRoster.length === 0 ? (
            <p style={{ color: "var(--ink-light)", fontSize: "0.9rem" }}>No characters drafted yet.</p>
          ) : (
            data.myRoster.map((char: any) => (
              <CharacterCard key={char.id} character={char} compact />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Create a new league from the home page. Verify:
- League creation redirects to draft room.
- Draft pool shows 48 characters.
- "Continue" button advances AI picks.
- Clicking a character when it's your turn drafts them.
- Your roster builds up on the right side.
- Draft completes and redirects to league home after 36 picks.

- [ ] **Step 6: Commit**

```bash
git add app/routes/leagues.new.tsx app/routes/leagues.\$id_.draft.tsx app/components/draft-pool.tsx app/components/character-card.tsx
git commit -m "feat: add create league page and draft room UI"
```

---

### Task 16: UI — League Home and Standings

**Files:**
- Create: `app/routes/leagues.$id.tsx`, `app/components/standings-table.tsx`

- [ ] **Step 1: Create standings table component**

Create `app/components/standings-table.tsx`:

```tsx
interface Team {
  id: string;
  name: string;
  managerType: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export function StandingsTable({ teams, leagueId }: { teams: Team[]; leagueId: string }) {
  const sorted = [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>W</th>
          <th>L</th>
          <th>PF</th>
          <th>PA</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((team, i) => (
          <tr key={team.id}>
            <td>{i + 1}</td>
            <td>
              <a href={`/leagues/${leagueId}/teams/${team.id}`}>
                {team.name}
                {team.managerType === "human" ? " (You)" : ""}
              </a>
            </td>
            <td>{team.wins}</td>
            <td>{team.losses}</td>
            <td>{team.pointsFor.toFixed(1)}</td>
            <td>{team.pointsAgainst.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Create league home page**

Create `app/routes/leagues.$id.tsx`:

```tsx
import { Link, useFetcher, useLoaderData } from "react-router";
import { getLeague, advanceWeek } from "services/league-service.server";
import { StandingsTable } from "~/components/standings-table";
import type { Route } from "./+types/leagues.$id";

export async function loader({ params }: Route.LoaderArgs) {
  const league = await getLeague(params.id);
  return { league };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "advance") {
    await advanceWeek(params.id);
  }

  return null;
}

export default function LeagueHome({ loaderData }: Route.ComponentProps) {
  const { league } = loaderData;
  const fetcher = useFetcher();

  const currentWeekMatchups = league.matchups.filter((m) => m.week === league.currentWeek);
  const pastWeeks = [...new Set(league.matchups.filter((m) => m.winnerId).map((m) => m.week))].sort(
    (a, b) => b - a,
  );

  const canAdvance = league.phase === "regular" || league.phase === "playoffs";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{league.name}</h1>
        <span style={{ color: "var(--ink-light)" }}>
          {league.phase === "complete" ? "Season Complete" : `Week ${league.currentWeek} — ${league.phase}`}
        </span>
      </div>

      {league.phase === "draft" && (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <p>Draft in progress.</p>
          <Link to={`/leagues/${league.id}/draft`} className="btn" style={{ marginTop: "1rem" }}>
            Go to Draft Room
          </Link>
        </div>
      )}

      {canAdvance && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2>Week {league.currentWeek} Matchups</h2>
          {currentWeekMatchups.length > 0 ? (
            <div>
              {currentWeekMatchups.map((m) => {
                const home = league.teams.find((t) => t.id === m.homeTeamId);
                const away = league.teams.find((t) => t.id === m.awayTeamId);
                return (
                  <div key={m.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{home?.name ?? "?"}</span>
                    <span style={{ color: "var(--ink-light)" }}>vs</span>
                    <span>{away?.name ?? "?"}</span>
                    {m.winnerId && (
                      <Link to={`/leagues/${league.id}/matchups/${m.id}`} className="btn" style={{ fontSize: "0.85rem", padding: "0.3rem 0.8rem" }}>
                        View
                      </Link>
                    )}
                  </div>
                );
              })}

              {!currentWeekMatchups.some((m) => m.winnerId) && (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="advance" />
                  <button type="submit" className="btn btn-gold" style={{ marginTop: "1rem", width: "100%" }}>
                    Advance Week {league.currentWeek}
                  </button>
                </fetcher.Form>
              )}
            </div>
          ) : (
            <p style={{ color: "var(--ink-light)" }}>No matchups scheduled for this week.</p>
          )}
        </div>
      )}

      <h2>Standings</h2>
      <StandingsTable teams={league.teams as any} leagueId={league.id} />

      {pastWeeks.length > 0 && (
        <div>
          <h2>Past Weeks</h2>
          {pastWeeks.map((week) => {
            const weekMatchups = league.matchups.filter((m) => m.week === week && m.winnerId);
            return (
              <div key={week} style={{ marginBottom: "1rem" }}>
                <h3>Week {week}</h3>
                {weekMatchups.map((m) => {
                  const home = league.teams.find((t) => t.id === m.homeTeamId);
                  const away = league.teams.find((t) => t.id === m.awayTeamId);
                  const winner = league.teams.find((t) => t.id === m.winnerId);
                  return (
                    <Link key={m.id} to={`/leagues/${league.id}/matchups/${m.id}`} style={{ textDecoration: "none" }}>
                      <div className="card" style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{home?.name} vs {away?.name}</span>
                        <span style={{ color: "var(--gold)", fontWeight: "bold" }}>Winner: {winner?.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to a league. Should see standings table, current week matchups, and "Advance Week" button. Click advance — standings should update, matchup results should appear as clickable links.

- [ ] **Step 4: Commit**

```bash
git add app/routes/leagues.\$id.tsx app/components/standings-table.tsx
git commit -m "feat: add league home page with standings and week advancement"
```

---

### Task 17: UI — Team Page and Lineup Editor

**Files:**
- Create: `app/routes/leagues.$id_.teams.$teamId.tsx`, `app/components/lineup-editor.tsx`

- [ ] **Step 1: Create lineup editor component**

Create `app/components/lineup-editor.tsx`:

```tsx
import { CharacterCard } from "./character-card";

interface LineupEditorProps {
  roster: any[];
  active: string[];
  bench: string[];
  onSwap: (activeId: string, benchId: string) => void;
  readOnly?: boolean;
}

export function LineupEditor({ roster, active, bench, onSwap, readOnly }: LineupEditorProps) {
  const activeChars = active.map((id) => roster.find((c) => c.externalId === id)).filter(Boolean);
  const benchChars = bench.map((id) => roster.find((c) => c.externalId === id)).filter(Boolean);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
      <div>
        <h3>Active (4)</h3>
        {activeChars.map((char: any) => (
          <div key={char.id} style={{ position: "relative" }}>
            <CharacterCard character={char} compact />
            {!readOnly && benchChars.length > 0 && (
              <div style={{ marginTop: "-0.5rem", marginBottom: "0.5rem" }}>
                {benchChars.map((bc: any) => (
                  <button
                    key={bc.id}
                    onClick={() => onSwap(char.externalId, bc.externalId)}
                    className="btn"
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", marginRight: "0.25rem" }}
                  >
                    Swap with {bc.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div>
        <h3>Bench (2)</h3>
        {benchChars.map((char: any) => (
          <CharacterCard key={char.id} character={char} compact />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create team page**

Create `app/routes/leagues.$id_.teams.$teamId.tsx`:

```tsx
import { useLoaderData, useFetcher } from "react-router";
import { prisma } from "~/lib/db.server";
import { LineupEditor } from "~/components/lineup-editor";
import { CharacterCard } from "~/components/character-card";
import type { Route } from "./+types/leagues.$id_.teams.$teamId";

export async function loader({ params }: Route.LoaderArgs) {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: params.teamId },
    include: { roster: true },
  });

  const league = await prisma.league.findUniqueOrThrow({ where: { id: params.id } });

  const latestLineup = await prisma.lineup.findFirst({
    where: { teamId: params.teamId },
    orderBy: { week: "desc" },
  });

  return {
    team,
    league,
    lineup: latestLineup
      ? { active: latestLineup.active as string[], bench: latestLineup.bench as string[] }
      : null,
    isHuman: team.managerType === "human",
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "swap") {
    const activeId = formData.get("activeId") as string;
    const benchId = formData.get("benchId") as string;
    const league = await prisma.league.findUniqueOrThrow({ where: { id: params.id } });

    const lineup = await prisma.lineup.findFirst({
      where: { teamId: params.teamId },
      orderBy: { week: "desc" },
    });

    if (lineup) {
      const active = lineup.active as string[];
      const bench = lineup.bench as string[];
      const newActive = active.map((id) => (id === activeId ? benchId : id));
      const newBench = bench.map((id) => (id === benchId ? activeId : id));

      await prisma.lineup.upsert({
        where: { teamId_week: { teamId: params.teamId!, week: league.currentWeek } },
        update: { active: newActive, bench: newBench },
        create: { teamId: params.teamId!, week: league.currentWeek, active: newActive, bench: newBench },
      });
    }
  }

  return null;
}

export default function TeamPage({ loaderData }: Route.ComponentProps) {
  const { team, league, lineup, isHuman } = loaderData;
  const fetcher = useFetcher();

  const handleSwap = (activeId: string, benchId: string) => {
    fetcher.submit(
      { intent: "swap", activeId, benchId },
      { method: "post" },
    );
  };

  return (
    <div>
      <h1>{team.name} {isHuman ? "(Your Team)" : ""}</h1>
      <p style={{ color: "var(--ink-light)", marginBottom: "1.5rem" }}>
        {team.wins}W - {team.losses}L &middot; PF: {team.pointsFor.toFixed(1)} &middot; PA: {team.pointsAgainst.toFixed(1)}
      </p>

      {lineup ? (
        <LineupEditor
          roster={team.roster}
          active={lineup.active}
          bench={lineup.bench}
          onSwap={handleSwap}
          readOnly={!isHuman}
        />
      ) : (
        <div>
          <h2>Roster</h2>
          {team.roster.map((char: any) => (
            <CharacterCard key={char.id} character={char} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to a team page. Should show roster, lineup (active/bench), and swap buttons for the human team. Opponent teams should be read-only.

- [ ] **Step 4: Commit**

```bash
git add app/routes/leagues.\$id_.teams.\$teamId.tsx app/components/lineup-editor.tsx
git commit -m "feat: add team page with lineup editor"
```

---

### Task 18: UI — Matchup Page with Highlights

**Files:**
- Create: `app/routes/leagues.$id_.matchups.$matchupId.tsx`, `app/components/highlight-card.tsx`, `app/components/play-by-play.tsx`

- [ ] **Step 1: Create highlight card component**

Create `app/components/highlight-card.tsx`:

```tsx
interface HighlightCardProps {
  highlight: {
    kind: string;
    actorIds: string[];
    description: string;
    importance: "high" | "medium" | "low";
  };
}

export function HighlightCard({ highlight }: HighlightCardProps) {
  const borderColor = highlight.importance === "high"
    ? "var(--accent)"
    : highlight.importance === "medium"
    ? "var(--gold)"
    : "var(--parchment-dark)";

  return (
    <div
      className="card"
      style={{
        borderLeft: `4px solid ${borderColor}`,
        padding: highlight.importance === "high" ? "1.25rem" : "0.75rem",
        fontSize: highlight.importance === "low" ? "0.9rem" : "1rem",
      }}
    >
      <p>{highlight.description}</p>
      <span style={{ fontSize: "0.75rem", color: "var(--ink-light)", textTransform: "uppercase" }}>
        {highlight.kind.replace("_", " ")}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create play-by-play component**

Create `app/components/play-by-play.tsx`:

```tsx
interface PlayByPlayProps {
  events: {
    kind: string;
    actorId: string;
    targetId?: string;
    amount?: number;
    encounterId: string;
  }[];
  characterNames: Record<string, string>;
}

export function PlayByPlay({ events, characterNames }: PlayByPlayProps) {
  const getName = (id: string) => characterNames[id] ?? id;

  return (
    <div style={{ maxHeight: 400, overflowY: "auto" }}>
      {events.map((event, i) => (
        <div
          key={i}
          style={{
            padding: "0.3rem 0",
            borderBottom: "1px solid var(--parchment-dark)",
            fontSize: "0.85rem",
          }}
        >
          <span style={{ color: "var(--ink-light)", marginRight: "0.5rem" }}>
            [{event.kind}]
          </span>
          <strong>{getName(event.actorId)}</strong>
          {event.targetId && <span> &rarr; {getName(event.targetId)}</span>}
          {event.amount != null && <span> ({event.amount})</span>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create matchup page**

Create `app/routes/leagues.$id_.matchups.$matchupId.tsx`:

```tsx
import { useLoaderData } from "react-router";
import { prisma } from "~/lib/db.server";
import { HighlightCard } from "~/components/highlight-card";
import { PlayByPlay } from "~/components/play-by-play";
import type { Route } from "./+types/leagues.$id_.matchups.$matchupId";

export async function loader({ params }: Route.LoaderArgs) {
  const matchup = await prisma.matchup.findUniqueOrThrow({
    where: { id: params.matchupId },
    include: { homeTeam: true, awayTeam: true },
  });

  const characters = await prisma.character.findMany({
    where: { leagueId: params.id },
  });

  const charNames: Record<string, string> = {};
  for (const c of characters) {
    charNames[c.externalId] = c.name;
  }

  return { matchup, charNames };
}

export default function MatchupPage({ loaderData }: Route.ComponentProps) {
  const { matchup, charNames } = loaderData;
  const dungeon = matchup.dungeonData as any;
  const homeRun = matchup.homeRunData as any;
  const awayRun = matchup.awayRunData as any;

  if (!homeRun || !awayRun) {
    return <div className="card">This matchup hasn't been played yet.</div>;
  }

  const allHighlights = [
    ...(homeRun.highlights ?? []),
    ...(awayRun.highlights ?? []),
  ].sort((a: any, b: any) => {
    const imp = { high: 3, medium: 2, low: 1 };
    return (imp[b.importance as keyof typeof imp] ?? 0) - (imp[a.importance as keyof typeof imp] ?? 0);
  });

  return (
    <div>
      <h1>{dungeon?.name ?? "Dungeon"}</h1>
      <p style={{ color: "var(--ink-light)", marginBottom: "1.5rem" }}>
        Theme: {dungeon?.theme} &middot; {dungeon?.encounters?.length ?? 0} encounters
      </p>

      <div className="card" style={{ textAlign: "center", padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          <div>
            <h2>{matchup.homeTeam.name}</h2>
            <div style={{ fontSize: "2rem", fontWeight: "bold", color: matchup.winnerId === matchup.homeTeamId ? "var(--gold)" : "var(--ink-light)" }}>
              {homeRun.score?.teamTotal?.toFixed(1)}
            </div>
          </div>
          <span style={{ fontSize: "1.5rem", color: "var(--ink-light)" }}>vs</span>
          <div>
            <h2>{matchup.awayTeam.name}</h2>
            <div style={{ fontSize: "2rem", fontWeight: "bold", color: matchup.winnerId === matchup.awayTeamId ? "var(--gold)" : "var(--ink-light)" }}>
              {awayRun.score?.teamTotal?.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      <h2>Highlights</h2>
      {allHighlights.map((h: any, i: number) => (
        <HighlightCard key={i} highlight={h} />
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1.5rem" }}>
        <div>
          <h2>{matchup.homeTeam.name} — Play by Play</h2>
          <PlayByPlay events={homeRun.events ?? []} characterNames={charNames} />
        </div>
        <div>
          <h2>{matchup.awayTeam.name} — Play by Play</h2>
          <PlayByPlay events={awayRun.events ?? []} characterNames={charNames} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1.5rem" }}>
        <div>
          <h2>{matchup.homeTeam.name} — Character Stats</h2>
          <table>
            <thead>
              <tr><th>Character</th><th>Base</th><th>Role</th><th>Milestone</th><th>Total</th></tr>
            </thead>
            <tbody>
              {Object.entries(homeRun.score?.perCharacter ?? {}).map(([id, cs]: any) => (
                <tr key={id}>
                  <td>{charNames[cs.characterId] ?? cs.characterId}</td>
                  <td>{cs.basePoints?.toFixed(1)}</td>
                  <td>{cs.roleMultiplierPoints?.toFixed(1)}</td>
                  <td>{cs.milestonePoints?.toFixed(1)}</td>
                  <td style={{ fontWeight: "bold" }}>{cs.totalPoints?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>{matchup.awayTeam.name} — Character Stats</h2>
          <table>
            <thead>
              <tr><th>Character</th><th>Base</th><th>Role</th><th>Milestone</th><th>Total</th></tr>
            </thead>
            <tbody>
              {Object.entries(awayRun.score?.perCharacter ?? {}).map(([id, cs]: any) => (
                <tr key={id}>
                  <td>{charNames[cs.characterId] ?? cs.characterId}</td>
                  <td>{cs.basePoints?.toFixed(1)}</td>
                  <td>{cs.roleMultiplierPoints?.toFixed(1)}</td>
                  <td>{cs.milestonePoints?.toFixed(1)}</td>
                  <td style={{ fontWeight: "bold" }}>{cs.totalPoints?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

Navigate to a completed matchup. Should see:
- Dungeon name and theme.
- Score comparison with winner highlighted in gold.
- Highlights sorted by importance.
- Play-by-play feeds for both teams.
- Per-character stat breakdowns.

- [ ] **Step 5: Commit**

```bash
git add app/routes/leagues.\$id_.matchups.\$matchupId.tsx app/components/highlight-card.tsx app/components/play-by-play.tsx
git commit -m "feat: add matchup page with highlights and play-by-play"
```

---

### Task 19: UI — Character Detail

**Files:**
- Create: `app/routes/leagues.$id_.characters.$charId.tsx`

- [ ] **Step 1: Create character detail page**

Create `app/routes/leagues.$id_.characters.$charId.tsx`:

```tsx
import { useLoaderData } from "react-router";
import { prisma } from "~/lib/db.server";
import type { Route } from "./+types/leagues.$id_.characters.$charId";

export async function loader({ params }: Route.LoaderArgs) {
  const character = await prisma.character.findUniqueOrThrow({
    where: { id: params.charId },
    include: { team: true },
  });

  const matchups = await prisma.matchup.findMany({
    where: { leagueId: params.id, winnerId: { not: null } },
    orderBy: { week: "asc" },
  });

  const weeklyStats: { week: number; points: number; events: any[] }[] = [];
  for (const matchup of matchups) {
    for (const runData of [matchup.homeRunData, matchup.awayRunData]) {
      if (!runData) continue;
      const run = runData as any;
      const charScore = run.score?.perCharacter?.[character.externalId];
      if (charScore) {
        const charEvents = (run.events ?? []).filter(
          (e: any) => e.actorId === character.externalId,
        );
        weeklyStats.push({
          week: matchup.week,
          points: charScore.totalPoints,
          events: charEvents,
        });
      }
    }
  }

  return { character, weeklyStats };
}

export default function CharacterDetail({ loaderData }: Route.ComponentProps) {
  const { character, weeklyStats } = loaderData;
  const stats = character.stats as any;
  const roleClass = `badge badge-${character.role.toLowerCase()}`;

  const seasonTotal = weeklyStats.reduce((sum, w) => sum + w.points, 0);

  return (
    <div>
      <h1>{character.name}</h1>
      <div style={{ marginBottom: "1rem" }}>
        <span className={roleClass}>{character.role}</span>
        <span style={{ marginLeft: "0.5rem", color: "var(--ink-light)" }}>
          {character.race} {character.class} &middot; Level {character.level}
        </span>
      </div>

      <div className="card">
        <p style={{ fontStyle: "italic" }}>{character.description}</p>
      </div>

      <h2>Stats</h2>
      <div className="card" style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        {Object.entries(stats).map(([key, val]) => (
          <div key={key} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--ink-light)" }}>{key}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{val as number}</div>
          </div>
        ))}
      </div>

      {character.team && (
        <p style={{ marginTop: "1rem", color: "var(--ink-light)" }}>
          Drafted by: <strong>{character.team.name}</strong>
        </p>
      )}

      <h2>Season Performance</h2>
      <p style={{ marginBottom: "0.75rem" }}>
        Season total: <strong>{seasonTotal.toFixed(1)} pts</strong> across {weeklyStats.length} weeks
      </p>

      {weeklyStats.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Points</th>
              <th>Key Events</th>
            </tr>
          </thead>
          <tbody>
            {weeklyStats.map((w) => (
              <tr key={w.week}>
                <td>Week {w.week}</td>
                <td style={{ fontWeight: "bold" }}>{w.points.toFixed(1)}</td>
                <td style={{ fontSize: "0.85rem", color: "var(--ink-light)" }}>
                  {w.events.slice(0, 5).map((e: any) => e.kind).join(", ")}
                  {w.events.length > 5 ? ` +${w.events.length - 5} more` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: "var(--ink-light)" }}>No games played yet.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to a character page. Should show name, stats, role badge, team, and weekly performance log.

- [ ] **Step 3: Commit**

```bash
git add app/routes/leagues.\$id_.characters.\$charId.tsx
git commit -m "feat: add character detail page with season performance"
```

---

### Task 20: Export / Import

**Files:**
- Create: `services/export-import.server.ts`
- Modify: `app/routes/leagues.$id.tsx` (add export button)
- Create: `app/routes/leagues.import.tsx`

- [ ] **Step 1: Implement export/import service**

Create `services/export-import.server.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function exportLeague(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
    include: {
      teams: true,
      characters: true,
      matchups: true,
    },
  });

  const lineups = await prisma.lineup.findMany({
    where: { teamId: { in: league.teams.map((t) => t.id) } },
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    league: {
      id: league.id,
      name: league.name,
      phase: league.phase,
      currentWeek: league.currentWeek,
      settings: league.settings,
    },
    teams: league.teams,
    characters: league.characters,
    matchups: league.matchups,
    lineups,
  };
}

export async function importLeague(data: any) {
  if (data.version !== 1) throw new Error("Unsupported export version");

  const league = await prisma.league.create({
    data: {
      id: data.league.id,
      name: `${data.league.name} (imported)`,
      phase: data.league.phase,
      currentWeek: data.league.currentWeek,
      settings: data.league.settings as any,
    },
  });

  for (const team of data.teams) {
    await prisma.team.create({
      data: {
        id: team.id,
        name: team.name,
        leagueId: league.id,
        managerId: team.managerId,
        managerType: team.managerType,
        aiPersonality: team.aiPersonality,
        wins: team.wins,
        losses: team.losses,
        pointsFor: team.pointsFor,
        pointsAgainst: team.pointsAgainst,
      },
    });
  }

  for (const char of data.characters) {
    await prisma.character.create({
      data: {
        id: char.id,
        externalId: char.externalId,
        name: char.name,
        race: char.race,
        class: char.class,
        role: char.role,
        stats: char.stats,
        level: char.level,
        description: char.description,
        leagueId: league.id,
        teamId: char.teamId,
        draftOrder: char.draftOrder,
      },
    });
  }

  for (const matchup of data.matchups) {
    await prisma.matchup.create({
      data: {
        id: matchup.id,
        leagueId: league.id,
        week: matchup.week,
        homeTeamId: matchup.homeTeamId,
        awayTeamId: matchup.awayTeamId,
        dungeonData: matchup.dungeonData,
        homeRunData: matchup.homeRunData,
        awayRunData: matchup.awayRunData,
        winnerId: matchup.winnerId,
      },
    });
  }

  for (const lineup of data.lineups) {
    await prisma.lineup.create({
      data: {
        teamId: lineup.teamId,
        week: lineup.week,
        active: lineup.active,
        bench: lineup.bench,
      },
    });
  }

  return league;
}
```

- [ ] **Step 2: Add export route to league home**

Add to the existing `app/routes/leagues.$id.tsx` action handler:

```ts
import { exportLeague } from "services/export-import.server";

// In the action function, add:
  if (intent === "export") {
    const data = await exportLeague(params.id);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="league-${params.id}.json"`,
      },
    });
  }
```

Add an export button to the league home JSX, next to the league title:

```tsx
<fetcher.Form method="post" style={{ display: "inline" }}>
  <input type="hidden" name="intent" value="export" />
  <button type="submit" className="btn" style={{ fontSize: "0.85rem", padding: "0.3rem 0.8rem" }}>
    Download Backup
  </button>
</fetcher.Form>
```

- [ ] **Step 3: Create import page**

Create `app/routes/leagues.import.tsx`:

```tsx
import { Form, redirect } from "react-router";
import { importLeague } from "services/export-import.server";
import type { Route } from "./+types/leagues.import";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");

  const text = await file.text();
  const data = JSON.parse(text);
  const league = await importLeague(data);

  return redirect(`/leagues/${league.id}`);
}

export default function ImportLeague() {
  return (
    <div>
      <h1>Import League</h1>
      <Form method="post" encType="multipart/form-data" className="card" style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="file" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
            League JSON File
          </label>
          <input id="file" name="file" type="file" accept=".json" required />
        </div>
        <button type="submit" className="btn">Import League</button>
      </Form>
    </div>
  );
}
```

- [ ] **Step 4: Add import link to league list page**

In `app/routes/_index.tsx`, add next to the "New League" button:

```tsx
<Link to="/leagues/import" className="btn" style={{ marginLeft: "0.5rem", opacity: 0.8 }}>Import</Link>
```

- [ ] **Step 5: Verify in browser**

Export a league, delete it, re-import, and verify the data is intact.

- [ ] **Step 6: Commit**

```bash
git add services/export-import.server.ts app/routes/leagues.import.tsx app/routes/leagues.\$id.tsx app/routes/_index.tsx
git commit -m "feat: add league export/import functionality"
```

---

### Task 21: Balance Harness

**Files:**
- Create: `scripts/balance-harness.ts`

- [ ] **Step 1: Create the balance harness script**

Create `scripts/balance-harness.ts`:

```ts
import { createRng } from "../domain/rng";
import { ProceduralSource } from "../domain/content/procedural-source";
import { runDungeon } from "../domain/sim/sim-engine";
import { score } from "../domain/scoring";
import type { Character, Lineup } from "../domain/types";

const LEAGUES = 100;
const WEEKS = 5;
const TEAMS_PER_LEAGUE = 6;

const source = new ProceduralSource();

interface RoleStats {
  totalPoints: number;
  count: number;
  avgPoints: number;
}

const roleStats: Record<string, RoleStats> = {
  Tank: { totalPoints: 0, count: 0, avgPoints: 0 },
  Healer: { totalPoints: 0, count: 0, avgPoints: 0 },
  DPS: { totalPoints: 0, count: 0, avgPoints: 0 },
  Utility: { totalPoints: 0, count: 0, avgPoints: 0 },
};

const scoreDistribution: number[] = [];
const marginDistribution: number[] = [];

for (let league = 0; league < LEAGUES; league++) {
  const rng = createRng(league);
  const chars = source.generateCharacters(48, rng.fork("chars"));
  const charMap = new Map<string, Character>(chars.map((c) => [c.id, c]));

  const teams: { chars: Character[]; lineup: Lineup }[] = [];
  for (let t = 0; t < TEAMS_PER_LEAGUE; t++) {
    const teamChars = chars.slice(t * 6, (t + 1) * 6);
    teams.push({
      chars: teamChars,
      lineup: {
        active: [teamChars[0].id, teamChars[1].id, teamChars[2].id, teamChars[3].id] as [string, string, string, string],
        bench: [teamChars[4].id, teamChars[5].id] as [string, string],
      },
    });
  }

  for (let week = 0; week < WEEKS; week++) {
    for (let m = 0; m < 3; m++) {
      const dungeon = source.generateDungeon(week, m, rng.fork(`d-${week}-${m}`));

      const scores: number[] = [];
      for (const team of [teams[m * 2], teams[m * 2 + 1]]) {
        if (!team) continue;
        const events = runDungeon(team.lineup, charMap, dungeon, rng.fork(`sim-${week}-${m}`));
        const result = score(events, team.chars.slice(0, 4));

        scores.push(result.teamTotal);
        scoreDistribution.push(result.teamTotal);

        for (const cs of result.perCharacter.values()) {
          const char = charMap.get(cs.characterId);
          if (char && roleStats[char.role]) {
            roleStats[char.role].totalPoints += cs.totalPoints;
            roleStats[char.role].count += 1;
          }
        }
      }

      if (scores.length === 2) {
        marginDistribution.push(Math.abs(scores[0] - scores[1]));
      }
    }
  }
}

for (const role of Object.keys(roleStats)) {
  const rs = roleStats[role];
  rs.avgPoints = rs.count > 0 ? rs.totalPoints / rs.count : 0;
}

console.log("\n=== BALANCE HARNESS REPORT ===\n");
console.log(`Simulated ${LEAGUES} leagues x ${WEEKS} weeks = ${LEAGUES * WEEKS * 3} matchups\n`);

console.log("Role Average Points Per Game:");
for (const [role, stats] of Object.entries(roleStats)) {
  console.log(`  ${role.padEnd(8)} ${stats.avgPoints.toFixed(2)} (${stats.count} appearances)`);
}

const sortedScores = scoreDistribution.sort((a, b) => a - b);
const median = sortedScores[Math.floor(sortedScores.length / 2)];
const mean = sortedScores.reduce((a, b) => a + b, 0) / sortedScores.length;
const min = sortedScores[0];
const max = sortedScores[sortedScores.length - 1];

console.log("\nTeam Score Distribution:");
console.log(`  Min: ${min.toFixed(1)}, Median: ${median.toFixed(1)}, Mean: ${mean.toFixed(1)}, Max: ${max.toFixed(1)}`);

const sortedMargins = marginDistribution.sort((a, b) => a - b);
const marginMedian = sortedMargins[Math.floor(sortedMargins.length / 2)];
const blowouts = sortedMargins.filter((m) => m > mean * 0.5).length;

console.log("\nMatchup Margin Distribution:");
console.log(`  Median margin: ${marginMedian.toFixed(1)}`);
console.log(`  Blowouts (>50% of mean score): ${blowouts} / ${sortedMargins.length} (${((blowouts / sortedMargins.length) * 100).toFixed(1)}%)`);

console.log("\n=== END REPORT ===\n");
```

- [ ] **Step 2: Run the balance harness**

```bash
npx tsx scripts/balance-harness.ts
```

Expected: Report prints role averages, score distributions, and margin analysis. This is informational — no pass/fail.

- [ ] **Step 3: Commit**

```bash
git add scripts/balance-harness.ts
git commit -m "feat: add balance harness script for scoring analysis"
```

---

### Task 22: Clean Up and Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All unit and integration tests pass.

- [ ] **Step 2: Start dev server and full playthrough**

```bash
npm run dev
```

Walk through the entire loop:
1. Create a new league from `/`.
2. Complete the draft (pick 6 characters, advance AI picks).
3. On league home, click "Advance Week" for weeks 1-5.
4. View matchup pages with highlights and play-by-play.
5. Check team pages and character details.
6. Export the league, delete, re-import.

- [ ] **Step 3: Fix any issues found during playthrough**

Address any bugs discovered during the browser walkthrough.

- [ ] **Step 4: Remove smoke test**

```bash
rm tests/domain/smoke.test.ts
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```
