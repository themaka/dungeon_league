# Dungeon League — Design Spec

**Date:** 2026-04-11
**Status:** v1 design, pre-implementation

## Overview

Dungeon League is a fantasy-sports league where teams are made of D&D-style adventurers who "raid" procedurally generated dungeons each week. Managers draft characters, set weekly lineups, and watch their roster run simulated dungeons that emit scoring events and narrative highlights. The core emotional loop is: **draft → set lineup → advance week → read the highlights → check standings → repeat**.

v1 is a single-player web app where you manage one team against 5 AI managers in a short season, with the architecture built from day one to support real multiplayer, deeper simulation, human-authored content, and additional league formats as future work.

## Goals

- A playable, complete fantasy-sports loop (draft → season → playoffs → champion) that is actually fun solo.
- A hard architectural boundary between the **domain core** (simulation, scoring, highlights, content) and everything else, so v1 decisions can be upgraded later without rewrites.
- Determinism everywhere in the domain core — every run is seeded, reproducible, and testable.
- A content architecture that starts procedural but can trivially switch to hand-authored content packs before public release, avoiding any "AI-generated content" exposure.

## Non-Goals (v1)

- Real multiplayer with human managers. (Solo-vs-AI only.)
- Turn-based combat simulation. (Abstract statistical sim only.)
- Hand-authored character/dungeon content. (Procedural only, but schema designed.)
- Mobile-optimized UI. (Must not break on mobile; not polished.)
- Real auth / accounts. (Dev-mode login acceptable.)
- Trading, waivers, free-agent pickup UI.
- Scheduled background advancement. (Manual "Advance Week" button.)
- LLM-generated text of any kind.

## Tech Stack

- **Framework:** React Router v7 (loaders/actions, full-stack React, TypeScript).
- **Language:** TypeScript throughout.
- **Database:** Postgres via Prisma.
- **Testing:** Vitest, with fast-check for property-based tests on the sim engine. Prisma test database for integration tests.
- **Deployment target:** Fly.io or Railway (not Netlify — stateful game with DB and future background jobs is a poor fit for Netlify's model). Vercel is also acceptable.

The domain core is **pure TypeScript with no framework imports** — no React, no Prisma, no React Router. It takes plain data in and returns plain data out, making it unit-testable at millisecond speeds and reusable by future non-web clients (CLI, Discord bot).

## Architecture

Three layers, with a hard boundary between the domain core and everything else.

```
┌─────────────────────────────────────────────────┐
│  Web UI  (React Router v7, TypeScript)          │
│  Pages: league, draft, matchup, team,           │
│  standings, character detail                    │
└────────────────┬────────────────────────────────┘
                 │ loaders / actions
┌────────────────▼────────────────────────────────┐
│  Application layer  (RR server routes)          │
│  Dev-mode auth, league lifecycle,               │
│  draft orchestration, lineup management,        │
│  export/import                                  │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Domain core  (pure TS, no framework)           │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Sim engine   │──▶ Scoring      │             │
│  │ emits events │  │ (pure func)  │             │
│  └──────────────┘  └──────┬───────┘             │
│  ┌──────────────┐  ┌──────▼───────┐             │
│  │ ContentSource│  │ Highlight    │             │
│  │ (pluggable)  │  │ generator    │             │
│  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐                               │
│  │ AI manager   │                               │
│  │ strategies   │                               │
│  └──────────────┘                               │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Persistence  (Postgres + Prisma)               │
└─────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Domain core is pure TypeScript.** No framework imports. Plain data in, plain data out. Enables millisecond unit tests, property-based testing, and reuse by future clients.

2. **Sim emits a stream of events; scoring is a pure reducer over those events.** An encounter does not know about fantasy points — it emits events like `{kind: "kill", actor, target, crit}`. The scoring module reduces the event stream into per-character points. The same event stream also feeds the highlight generator. This separation lets you tweak scoring without touching the sim.

3. **Everything in the domain core is seeded and deterministic.** The entire week-advancement is driven by a single seeded RNG (`leagueId + week` → seed). Same inputs always produce the same outputs. Never use `Math.random()` in the domain core. This is crucial for debugging, reproducing bugs, and writing tests that assert specific outcomes.

4. **`advanceWeek` is one function, one transaction.** If anything fails mid-advance, nothing persists. You either get a clean new week or the league stays exactly as it was.

5. **AI and human managers implement the same interface.** A `Manager` is a module that, given a team and game state, returns draft picks and weekly lineups. The rest of the system does not know whether a manager is human or AI. Adding real multiplayer later is adding a new `Manager` implementation, not rearchitecting.

6. **ContentSource is pluggable.** Characters, dungeons, and flavor strings come from a `ContentSource` interface. v1 ships with `ProceduralSource`. Pre-launch ships `AuthoredSource` (content packs). Future work adds `UserSeededSource` (user-supplied tables that feed procedural generation).

## Domain Model

### Entity Summary

```
League ──┬── 6 Teams ──┬── Manager (Human | AI)
         │             └── Roster (6 Characters)
         │                       └── Lineup (4 active, 2 bench)
         │
         ├── Season (7 weeks: 5 regular + 2 playoff)
         │     └── Week ──┬── 3 Matchups (Team vs Team)
         │                └── 3 Dungeons (one per matchup)
         │                       └── DungeonRun (per team)
         │                              └── EventLog → Score + Highlights
         │
         └── CharacterPool (36 drafted + undrafted free agents)
```

### Entities

- **League** — top-level container. Owns a season, a character pool, league settings, and a reference to its ContentSource. In v1 settings are mostly fixed defaults; the data model supports configurable settings from day one.

- **Team** — belongs to a league, has one manager (human or AI), a roster of 6 characters, and a current weekly lineup (4 active, 2 bench). Tracks W/L record, points for, points against.

- **Character** — immutable once generated in v1 (no XP, no leveling, no injuries). Fields: name, race, class, role (Tank / Healer / DPS / Utility), stats (STR/DEX/CON/INT/WIS/CHA), level, description/flavor text. Generated by the current ContentSource.

- **Manager** — interface with two methods:
  - `makeDraftPick(state) → Character` — pick from the undrafted pool.
  - `setLineup(roster, context) → Lineup` — choose 4 active from a 6-character roster, with knowledge of the upcoming dungeon.

  Implementations:
  - `HumanManager` — reads from DB / waits for user action.
  - `AIManager` — deterministic strategy given a "personality" seed (priority roles, aggression, risk tolerance). Not ML — just seeded heuristics.

- **Matchup** — two teams scheduled to face each other in a given week. Owns **one Dungeon** (both teams run the same dungeon, so scores are directly comparable) and two `DungeonRun`s. This design halves per-week sim work and enables a "they both faced this dungeon — here's how they did differently" narrative in the UI.

  Note: this diverges from real fantasy-sports scoring (where players face different opponents). The Matchup data model is designed so it could flip to "one dungeon per team" by changing one line, if the design ever needs revisiting.

- **Dungeon** — a named, themed sequence of 5-8 Encounters. Generated per week by the current ContentSource from templates + seeded RNG.

- **Encounter** — an atomic sim unit. Type (combat / trap / puzzle / treasure), difficulty, target stat(s), and a resolution function. v1 covers all content with a small handful of encounter types.

- **DungeonRun** — the result of one team running one dungeon. Contains the full event log, per-character points, party total, and derived highlights. Persisted so matchup pages can replay event streams without re-running the sim.

- **Event** — the atoms emitted by the sim. Shape: `{ kind, actor, target?, amount?, crit?, meta? }`. Consumed by both the scoring reducer and the highlight generator.

### Design Decisions

- **Same dungeon per matchup** (noted above). Intentional; reversible.
- **Characters are immutable in v1.** Adding mutable state later (XP, injuries, equipment) is easy; ripping it out is hard. Start simple.
- **Free agent pool exists in data from day one** even though v1 has no pickup UI. Adding pickup later is a feature, not a migration.
- **AI personalities are seeded strategy configs**, not ML. Deterministic, testable, instant.

## The Weekly Game Loop

The heart of the app. Everything else supports this one function.

### `advanceWeek(leagueId)`

```
1. Lock league state (no concurrent advances)
2. For each Matchup this week:
   a. Generate a Dungeon (ContentSource + seeded RNG)
   b. Ask both managers to setLineup(roster, context)
      — context includes the upcoming dungeon, so AI can
        favor fire-resistant characters for a Fire Crypt
   c. Run sim for Team A vs Dungeon → EventLog A
   d. Run sim for Team B vs Dungeon → EventLog B
   e. Score EventLog A → team A points + per-character stats
   f. Score EventLog B → team B points + per-character stats
   g. Determine matchup winner (higher total)
   h. Generate highlights from both event logs
3. Update standings (W/L, points for, points against)
4. Bump league.currentWeek
5. Persist everything in one DB transaction
6. Return a summary the UI can redirect to
```

### Properties

- **Deterministic and seedable.** Every RNG call in the domain core is seeded from `(leagueId, week, matchupId)`. Rerunning a week with the same inputs produces identical output.

- **The sim is a pure function.** `runDungeon(team, dungeon, rng) → Event[]`. No side effects, no I/O.

- **Lineup-setting happens inside the advance**, not before, because AI managers benefit from full knowledge of the upcoming dungeon. Human managers in v2 will set lineups in advance via the UI; `setLineup` for them just returns the saved value.

- **One advance = one transaction.** Partial state is impossible.

- **Manual advance in v1.** "Advance Week" is a button. Scheduled advancement is a future feature — adding it is adding a cron job that calls the same function.

- **Playoff weeks use a different matchup source but the same advance function.** Weeks 1-5 are round-robin; week 6 is semifinals (top 4 teams by standings); week 7 is the final (top 2). Eliminated teams still sim their own dungeon for interest/standings but don't affect the bracket.

## Scoring

Scoring is a pure function over the event log:

```
score(events, roster) → { perCharacter: {charId → points}, teamTotal: number }
```

### Base Event Values (v1 defaults, tunable)

| Event kind | Points | Notes |
|---|---|---|
| `hit` (damage dealt) | 0.1 per dmg | caps to avoid runaway |
| `kill` | +2 | +3 if boss |
| `crit` | +1 bonus | stacks with hit/kill |
| `heal` | 0.15 per hp | |
| `damage_taken` | 0.05 per dmg | tanks benefit |
| `save_pass` | +1 | trap/puzzle success |
| `save_fail` | -0.5 | |
| `disarm_trap` | +2 | |
| `find_treasure` | +3 | |
| `ko` (character downed) | -3 | |
| `death` | -5 | character unavailable rest of run |

### Role Multipliers

The multiplier applies to the subset of events that role "owns".

| Role | Multiplier | Events |
|---|---|---|
| Tank | ×1.5 | damage_taken, save_pass |
| Healer | ×1.5 | heal, save_pass |
| DPS | ×1.5 | hit, kill, crit |
| Utility | ×1.5 | disarm_trap, find_treasure, save_pass |

### Narrative Milestone Bonuses (end-of-run flat points)

| Milestone | Points | Condition |
|---|---|---|
| `mvp_of_run` | +5 | highest scorer in party |
| `clutch_survivor` | +3 | under 10% HP at end, still standing |
| `first_blood` | +1 | first kill of the run |
| `boss_killer` | +5 | dealt killing blow to boss |
| `flawless_run` | +3 party-wide | zero KOs |
| `total_party_wipe` | -10 party-wide | everyone died |

**All values are placeholders.** Balance is not a one-time task — it is an ongoing iteration loop driven by the balance harness (see Testing). Expect these numbers to change repeatedly.

## Highlights

The highlight generator is a pure function over the same event log:

```
generateHighlights(events, roster, dungeon) → Highlight[]
```

A `Highlight` is structured data: `{ kind, actors, description, importance }`.

### Selection Heuristics

- Every milestone bonus produces a highlight.
- Every crit is a candidate; keep the top N per run.
- Big heals and big hits (top percentile within the run) produce highlights.
- Death, KO, and last-survivor moments always highlight.
- First kill, last kill, boss phase transitions always highlight.

### Description Text

Descriptions are **templated**, not LLM-generated:

```
"{actor} crit the {target} for {amount} damage!"
```

Templates are **human-authored by you**, stored in the content pack alongside characters and dungeons. The sim fills in values — deterministic string interpolation, not generation. The final output is authored content with runtime data, unambiguously on the human-authored side of the line.

### Importance-Driven UI Density

Highlight `importance` drives UI treatment: high-importance highlights become big cards with flavor on the matchup page; low-importance ones become one-liners in a scrolling play-by-play feed. One data model, two presentations.

## Content Sources

The design concept that keeps v1 procedural while leaving an obvious path to hand-authored content for public release.

### The Interface

```
ContentSource
├── generateCharacters(count, rng) → Character[]
├── generateDungeon(week, rng) → Dungeon
└── getHighlightTemplates() → TemplateBundle
```

### Implementations

- **`ProceduralSource`** — v1 default. Template-based name tables, random stats (rolled or point-buy depending on league setting), random class/race weights, composed descriptions from snippets. Fast, infinite, obviously procedural.

- **`AuthoredSource`** — (pre-launch work, not v1) reads from a **Content Pack**: a versioned directory of YAML/JSON files containing hand-written characters, dungeons, encounter flavor, and highlight templates. Example character entry:

  ```yaml
  id: thorin_ironveil
  name: Thorin Ironveil
  race: Dwarf
  class: Paladin
  role: Tank
  stats: { str: 16, dex: 10, con: 15, int: 8, wis: 14, cha: 12 }
  description: "A grim-faced oathkeeper from the collapsed holds of Kharak Dûn..."
  author: "Maka"
  ```

  Every entry has an `author` field — content packs are versioned and attributable. At public release, you can list credits publicly. Data shape proves human authorship.

- **`UserSeededSource`** — (future feature) leagues can supply user-authored tables (names, races, classes, dungeon themes, encounter flavor). The source parameterizes the procedural generator with user-supplied data instead of defaults. Same interface, minimal new code.

### v1 Content Scope

- **Build `ProceduralSource` only.**
- **Design and document the content pack format** in this spec.
- **Implement the `ContentSource` interface** that both sources will satisfy.
- **Do not write authored packs yet** — that is pre-launch work.

By designing the interface now, "add authored content" becomes "write a file loader and a stack of YAML," not "rearchitect the content pipeline."

## League Configurable Options

All of these are fixed at v1 defaults but the data model treats them as league-creation parameters. Each one is a future feature, not a future rewrite.

| Setting | v1 default | Future options |
|---|---|---|
| Draft format | snake | auction, random |
| Roster shape | no position requirements | role slots required (1 Tank / 1 Healer / 2 DPS) |
| Character generation | rolled stats (procedural) | point-buy balanced, hand-authored pool, user-seeded |
| Matchup format | head-to-head | total-points ladder, gauntlet/survivor elimination |
| Matchup dungeons | same per matchup | separate per team |
| Manager mix | all-AI solo | mixed human+AI, all-human |
| Sim depth | abstract statistical | turn-based combat |
| Content source | procedural | authored pack, user-seeded |

## League & Season Structure

- **6 teams per league** (1 human + 5 AI).
- **7-week season**: 5 weeks regular season (round-robin pairings — each team plays all 5 others exactly once), 1 week semifinals (top 4 by standings), 1 week finals (top 2 survivors). Eliminated teams continue to sim their own dungeons during playoff weeks for consistency and amusement, but do not affect the bracket.
- **48 characters in the pool**: 36 drafted (6 rounds × 6 teams) + 12 free agents left in the pool. Free agents have no pickup UI in v1 but exist in the data model so adding pickup later is a feature, not a migration.

## Draft

- **Snake order**: picks reverse each round (1-6 in round 1, 6-1 in round 2, etc).
- **6 rounds** to fill 6-character rosters.
- **No position requirements** during draft. Role balance is emergent — you *want* a mix to score well, but the game does not force it.
- **AI picks are instant** in v1 (a "Continue" button advances them). Animation is a polish pass later.
- **Human picks** block the draft until the user clicks.

## Roster & Lineup

- **6 characters per roster**, of which **4 are active** (run the dungeon) and **2 are on the bench** (swap in/out weekly).
- **No position requirements for active lineup** in v1. All four can be DPS if you want. Scoring incentivizes balance without forcing it.
- **Lineups are set per week** before `advanceWeek` runs. For humans (v2), via UI. For AI, via `AIManager.setLineup(roster, context)`.

## UI Surfaces

Minimum set of screens to make v1 playable. Each is a React Router route.

| Route | Purpose |
|---|---|
| `/` | League list. "Create new league" button. Shows leagues belonging to the dev-mode user. |
| `/leagues/new` | League creation form. Pick a name; other settings use v1 defaults. Creates league, generates 36 characters, creates 6 teams (1 human + 5 AI), redirects to draft. |
| `/leagues/:id/draft` | Draft room. Snake order, current pick on the clock, undrafted pool filterable by role, roster building on the side. AI picks advance via "Continue" button. Complete → redirect to league home. |
| `/leagues/:id` | League home. Current week, standings table, this week's matchups, big "Advance Week" button. After advance, becomes "View Week N Results". Also hosts the "Download backup" export. |
| `/leagues/:id/teams/:teamId` | Team page. Roster view with lineup editor (4 active, 2 bench), per-character season stats. Read-only for opponent teams. |
| `/leagues/:id/matchups/:matchupId` | **The emotional payoff.** Dungeon that was run, both teams' scores, hero highlights as big cards, scrolling play-by-play, per-character stat breakdown. This is the page users want to share. |
| `/leagues/:id/characters/:charId` | Character detail. Stats, career log (every event), season totals. |

### Out of Scope for v1

- Real auth (dev-mode login only)
- Multi-league dashboards
- Free agent pickup UI
- Trade UI
- Notifications
- Polished mobile layouts (must not break on mobile; not polished)
- Replays / sim animations (play-by-play is a text feed)

### Visual Design

Lean into a **parchment / bestiary aesthetic** — serifed headings, textured off-white backgrounds, hand-illustrated feel, dungeon-log vibes — rather than slick modern SaaS. This is a TTRPG-adjacent product; flavor costs little and makes the app feel like somewhere users want to hang out. Revisit details when building actual screens.

## Persistence & Resilience

### Postgres as Source of Truth

All game state lives in Postgres. `advanceWeek` is transactional — if anything fails mid-advance, nothing persists. Partial advances are impossible.

### Export / Import League as JSON

- **Export:** "Download backup" button on the league page dumps the entire league — characters, teams, events, highlights, standings, settings — as a JSON file.
- **Import:** "Import league from JSON" on the league list restores a dump exactly.

Uses:
- Manual backups before risky changes (e.g., scoring tweaks).
- Debugging: share a specific league state across machines.
- Seeding test cases with real league snapshots.
- Migrating between dev databases.

Cheap to build because the domain model is already Prisma-mappable and JSON-serializable.

### LocalStorage Autosave for In-Progress UI State

Things the user is considering but has not submitted yet (draft hover selections, lineup edits not yet saved) are cached in `localStorage` keyed by `league:view:field`. A browser refresh or tab crash restores them. Not offline mode — just "don't lose the 30 seconds of work I just did."

### Out of Scope (v1)

- True offline play
- Cross-device sync
- Automatic cloud backups
- Multi-user concurrent editing

## Testing Approach

The domain core being pure, deterministic, and seedable is what makes this testable without pain.

### Unit Tests (the bulk of the suite)

- **Sim engine** — fed hand-crafted `(team, dungeon, seed)` inputs, asserts specific events in output. Property-based tests via fast-check: "over 1000 random dungeons, no character scores negative HP", "every dungeon terminates", "no event references a character not in the team".
- **Scoring** — fed event logs, asserts point totals. Tens of thousands of assertions per second (pure reducer).
- **Highlight generator** — fed event logs, asserts expected highlights are emitted in priority order.
- **AI manager strategies** — asserts AI with `priorityRoles: ["Tank"]` includes a tank when available, etc.
- **Character generator** — seeded generation is reproducible; assert distributions over large samples.

### Integration Tests

- **`advanceWeek` end-to-end** against a real Postgres test DB. Set up a seeded league, run advance, assert standings/highlights are persisted correctly. Small number of these — they are slower and higher-friction than unit tests.
- **Route loaders/actions** tested at the React Router route level. Draft, advance, lineup-edit actions return correct data and redirects.

### UI Tests

Minimal in v1. A smoke test that each key page renders without errors is enough. Full Playwright interaction tests are deferred until the UI stabilizes.

### Balance Harness (Not a Pass/Fail Test)

A script that generates N leagues, runs a full season on each, dumps score distributions, matchup margins, role/class winrates. Run after any scoring tweak to see whether numbers moved in the intended direction. **Worth building early** because balance iteration is a constant, ongoing activity — not a one-time task.

### Tooling

- **Vitest** — fast, TS-native, plays well with React Router.
- **fast-check** — property-based tests on the sim engine.
- **Prisma test DB** — via Docker or testcontainers.

## Future Features (explicitly out of scope for v1, but designed for)

- Real multiplayer with human managers + auth + invite flows
- Turn-based combat simulation (replaces sim engine implementation)
- Narrative scripted encounters (additional encounter type)
- Hand-authored content packs (`AuthoredSource`)
- User-seeded character generation (custom name/race/class tables)
- User-seeded themed dungeons
- Real-play feeds (log TTRPG session events as score input)
- Scheduled auto-advance (cron)
- Trading and waivers
- Free agent pickup UI
- Configurable league options UI (all settings in the table above)
- Gauntlet / survivor league mode
- Total-points ladder league mode
- Role-slot lineup requirements
- XP and character progression
- Injuries and equipment
- LLM-flavored highlight descriptions (optional, keyed off the same Highlight objects)
- API + CLI + Discord clients reusing the domain core
