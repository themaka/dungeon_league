# Dungeon League — Balance Overhaul Implementation Log

## Summary

**All 23 plan tasks complete + 12 review/balance fix-ups.** 35 commits ahead of `main` on branch `balance-overhaul`. 117/117 domain tests passing; 10/10 UI smoke tests passing. Service tests require a live Postgres DB to run.

The overhaul brings 5.5e SRD flavor to the sim while keeping the abstract model: 24 specialties layered onto 12 classes, level-scaled XP and abilities, new social/arcane encounters, charge-based buffs (bless/inspiration/revivify) with always-on auras (Aura of Protection, Guidance), tiered scoring multipliers, and 5 league presets (standard/quick/epic/champions/veterans).

## Branch Stats

- 35 commits ahead of main
- 43 files changed, +7,232 / −610 lines
- Plan: `docs/superpowers/plans/2026-05-03-balance-overhaul.md` (4,377 lines, 23 tasks)
- Spec: `docs/superpowers/specs/2026-05-03-balance-overhaul-design.md`

## Final Balance Harness

5 simulated standard-preset seasons:

| Role     | Avg / Game | Appearances |
|----------|-----------:|------------:|
| Tank     | 20.55      | 160         |
| Healer   | 15.35      | 100         |
| DPS      | 10.20      | 690         |
| Utility  | 9.89       | 250         |

**Tank/Healer parity gap: 25.3%** (target <30%) ✓

DPS appears low per-character but has 6.9× the appearances of Tank, so total DPS scoring contribution is in line. Tank-leading is consistent with the spec's "Tanks score on absorbed damage" buff (`damage_taken` 0.05 → 0.1 + 0.75x role mult).

## Major Pieces Landed

### Domain layer (pure, no I/O)

- **`domain/types.ts`** — Specialty union (24 values), expanded EventKind (+15 new), EncounterType +"social"/"arcane", Character.specialty/xp/abilityTiers, expanded LeagueSettings with 10 new fields, ScoutingReport, PresetName.
- **`domain/specialties.ts`** — 24 specialty definitions, CLASS_SPECIALTY_MAP, lookup helpers, startup self-check that throws if data drifts.
- **`domain/abilities.ts`** — Tier-based ability registry (84 abilities across 12 classes), `unlockTierForLevel`, `hasAbility`, `unlockedAbilities`. Includes Guidance for Shepherd Druid added during the buff refactor.
- **`domain/presets.ts`** — 5 named presets with `applyPreset(name, overrides)`.
- **`domain/themes.ts`** — Weighted encounter mix per dungeon theme (10 themes × 6 encounter types, each row sums to 100).
- **`domain/leveling.ts`** — XP_THRESHOLDS through level 20, ROLE_XP_EVENTS, `xpFromEvents` (with 1.5× specialty bonus, integer XP), `applyXpAndLevel`, exported STAT_BUMP_LEVELS / SCALING_LEVELS for cross-module consistency.
- **`domain/scoring.ts`** — Tiered role multipliers (core 0.75x / secondary 0.3x), 0.25x specialty bonus, all 26 EventKinds, revivify_save milestone with death-precondition guard.
- **`domain/scouting.ts`** — Pre-draft exhibition runs, deterministic via `seedFromIds(leagueId, "scout", runIdx)`, per-character report with avgPoints/specialtyProcRate/consistencyScore/projectedValue. Per-encounter-type subtotals exclude milestone inflation.
- **`domain/highlights.ts`** + **`domain/content/highlight-templates.ts`** — Templates for all 26 EventKinds; switch cases for revivify (priority 80), arcane_surge, smite ≥6, sneak_attack ≥6, buff, persuade/deceive/intimidate.

### Sim engine

- **`domain/sim/abilities-runtime.ts`** — Class-aware attack stat lookup, crit range (Champion 19+ at tier 1, 18+ at tier 4, Fighter-class-guarded), multiattack count (Fighter/Monk level 6+), and ability gates: hasSneakAttack/Smite/Rage/Revivify/Bless/Inspiration/Aura/Guidance.
- **`domain/sim/buffs.ts`** — Charge-pool model: `BuffPools { bless, inspiration, revivify: Map<sourceId, charges> }`. Replaced the original BuffState/addBuff/consumeBuff machinery during the post-implementation refactor.
- **`domain/sim/encounters.ts`** — `rollCheck(char, stats, diff, "save"|"trap_save"|"skill", ...)` consumes buffs at roll time and emits buff_proc events crediting the source. resolveCombat handles class-aware multiattack/sneak attack/smite (0.4 probability gate)/rage; resolveTrap/Puzzle/Social/Arcane all use rollCheck. Auras (CHA mod) apply to all saves; guidance (+1d4) applies to trap saves; bless (+1d4) consumes a charge on saves; inspiration (+1d6) consumes a charge on skill checks.
- **`domain/sim/sim-engine.ts`** — Computes buff pools at matchup start (charges scale by `chargesForLevel(level)`: 1 at L3, 2 at L7, 3 at L13, 4 at L18). Pools are matchup-scoped, NOT per-encounter — fixed during refactor. Post-encounter revivify check restores dead allies to HP=5 and consumes one revivify charge.

### Persistence + service layer

- **`prisma/schema.prisma`** — Character.specialty/xp/abilityTiers, League.scoutingReports. Schema only; user must run `npx prisma db push` against their dev DB.
- **`services/league-service.server.ts`** — `createLeague` accepts `overrides: Partial<LeagueSettings> & { preset?: PresetName }`, applies preset, runs scouting, persists scoutingReports, writes specialty/xp/abilityTiers. `advanceWeek` projects Character with new fields, picks random theme per matchup, applies XP and level-ups via `applyXpAndLevel` after each matchup (gated on `xpEnabled`), updates persisted xp/level/stats/abilityTiers.
- **`services/draft-service.server.ts`** — `getDraftState` includes specialty + scouting payload, filtered by `scoutingVisibility` (full / partial = avgPoints only / hidden). `makeAIPick` projects Character with new fields.
- **`services/export-import.server.ts`** — `importLeague` writes specialty/xp/abilityTiers with back-compat defaults for old exports.

### UI

- **`app/components/character-card.tsx`** — Specialty in subtitle, level marker, unlocked abilities list (via `unlockedAbilities`), scouting summary panel with avgPoints/proc rate/projected value.
- **`app/routes/leagues.new.tsx`** — Preset `<select>` with all 5 options, validated and threaded to `createLeague`.
- **`app/components/play-by-play.tsx`** — EVENT_LABELS map covering all 26 EventKinds (icons + readable labels); revivify treated as dramatic with green tint and ✚ marker.

### Tooling

- **`scripts/balance-harness.ts`** — Multi-season role-parity harness using `applyPreset("standard")` + `ALL_THEMES`. Prints per-role averages and Tank/Healer parity gap; warns if gap > 30%.

## Notable Mid-Flight Fixes

These came out of code review iterations, not the original plan:

- **Specialty registry self-check** — IIFE at module load throws if `SPECIALTIES` and `CLASS_SPECIALTY_MAP` ever drift apart.
- **Closed ability data gaps** — Added Maneuvers (Battle Master), Fast Hands (Thief), Blade Flourish (Swords), Martial Arts (Monk class-wide) so every specialty has at least one ability and Shadow Monk isn't empty at tier 1.
- **Plan-error correction in stat bump levels** — Plan had STAT_BUMP_LEVELS and SCALING_LEVELS overlapping {4,7,10,16,19}; fixed to disjoint sets so each level grants exactly +1 stat. Updated plan doc to keep `procedural-source.statBumpsForLevel` consistent.
- **Integer XP enforcement** — `xpFromEvents` wraps the 1.5× specialty bonus in `Math.round` to avoid fractional XP accumulation on `Character.xp`.
- **Scoring `revivify_save` death-precondition guard** — Builds a deadIds set as events are walked; only awards the milestone when target had a prior death. Plus `multiattack ?? 1` → `?? 0` for default consistency.
- **`startingXp` from XP_THRESHOLDS** — Was hardcoded to `30` which broke veterans preset (level 5 should start at 70 XP, not 30). Now uses `XP_THRESHOLDS[startingLevel] ?? 0`.
- **`pointsByEventType` keyed by event kind** — Was incorrectly keyed by encounter type; field name now matches data. Per-encounter subtotals exclude milestone inflation.
- **Per-encounter buff-state scoping** — Originally `BuffState` was created once per dungeon; charges leaked across encounters. Fixed to per-encounter scope, then later replaced entirely by the matchup-scoped charge pool model.
- **`critRangeFor` Fighter class guard** — Type system allowed `class: "Wizard", specialty: "Champion"` to route through Fighter ability lookup; added `char.class === "Fighter"` precondition.
- **Smite probability gate restoration** — Initial implementer dropped the `rng.next() < 0.4` gate to make a single-seed test pass; restored it and converted the test to seed-loop pattern.

## Post-Implementation Balance Refactor

After the 23 plan tasks landed, the final whole-branch review surfaced three Critical issues. All addressed:

1. **Revivify dead code (C1)** — Plan wired `revivifyCharges` into `runDungeon` but no service caller passed any. Replaced with level-scaled charges computed at matchup start in `sim-engine.ts` (1 at L6, 2 at L7+, 3 at L13+, 4 at L18+); reset every matchup, no DB column needed.
2. **Buffs didn't modify rolls (C2)** — Originally bless/inspiration/aura/guidance only fired buff_proc events when allies happened to succeed; the `bonus` field was never read by `statCheck`. Refactored to `rollCheck` which consumes charges/auras at roll time, applies the bonus to the d20+stat result, and emits buff_proc on contribution. War Domain Cleric scoring shifted from "every combat hit" to "save/skill check assists" — much more in line with spec intent.
3. **DPS scoring rebalance (C3)** — Bumped `hit` 0.1→0.12 and boss `kill` 5→7. DPS rose from 8.73 → 10.20.

## Known Follow-Up Tickets (Non-Blocking)

From the final review, deferred to follow-up sessions:

- **I1: Sorcerer specialty differentiation** — `Draconic` and `Wild Magic` have identical `coreEvents` `["hit","arcane_surge"]`. Need distinct mechanics for Wild Magic's "high variance" theme (e.g., random bonus/penalty events).
- **I3: Hardcoded draft slot count** — `services/draft-service.server.ts:93` has `totalRosterSlots = 36`. Should be `settings.teamCount * settings.rosterSize`.
- **I4: `playoffTeams` setting unused** — Declared in LeagueSettings, never consulted; bracket size always 4. Either drive the bracket from this setting or remove it.
- **I5: `targetLevel` setting unused** — XP scale formula is `10 / seasonWeeks`, ignores targetLevel. Veterans preset (12 weeks, target level 16) currently gets less XP than standard. Formula should derive from `(targetLevelXP − startingLevelXP) / seasonWeeks`.
- **I6: Order-fragile revivify_save milestone** — Currently relies on death events being pushed before revivify in the events array. Add an explicit two-pass approach.
- **M1: Highlight template variety** — All 15 new event kinds have only 1 template each (vs 2 for the original 10). Consider 2-3 per kind for less repetition.
- **Buff event display** — Current model emits `buff_proc` only; the buffer never gets a `buff` event for "showing up". If display wants to show "Bless cast" alongside "Bless saved Bob", add lazy `buff` emission on first proc.
- **Service test infrastructure** — 15 service tests need a Postgres test DB or Prisma mocking layer. Until then CI can't validate the service-layer wiring.
- **Champions preset harness** — Balance harness only runs the standard preset. A second pass with `applyPreset("champions")` would verify level-20 characters with all 8 ability tiers don't break encounter resolution.

## Manual Verification Checklist

Before merging, recommend:

1. `npx prisma db push` against your dev Postgres to apply the schema changes.
2. `npm test -- tests/services/` — service tests should now pass with a real DB.
3. `npm run dev`; create a Champions league and try a draft to confirm 72 characters appear, all level 20 with all 8 ability tiers showing on cards.
4. Try a Quick Play league; advance through 5 weeks; confirm characters gain XP and level up between matchups.
5. Watch a matchup play-by-play; confirm new event icons render (smite, sneak_attack, multiattack, revivify especially).

## Architectural Notes

- **Determinism preserved end-to-end.** Same `leagueId` reproduces same scouting reports, same matchups, same XP outcomes. All RNG forks derive from `seedFromIds(...)`.
- **Pure domain core.** No service file imports leak into `domain/`. The sim still runs as `(lineup, charMap, dungeon, rng) => events`; persistence is purely service-layer concern.
- **Cross-module data integrity.** `procedural-source.ts` imports `STAT_BUMP_LEVELS` and `SCALING_LEVELS` from `leveling.ts` instead of duplicating them; `specialties.ts` self-checks at module load that data tables agree.
