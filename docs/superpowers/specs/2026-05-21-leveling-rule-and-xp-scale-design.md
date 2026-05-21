# Leveling Rule + XP-Scale Fix — Design

**Date:** 2026-05-21
**Branch:** `balance-overhaul`
**Resolves:** Leveling/scoring coupling investigation + I5 (`targetLevel` setting unused), both from `docs/superpowers/logs/2026-05-03-balance-overhaul-log.md`.

## Summary

Lock in the leveling rule chosen by the sandbox tuning round and fix the long-broken XP-scale formula so the `targetLevel` setting actually affects pacing.

Two production changes:

1. **Replace the XP-credit rule** in `domain/leveling.ts` (`xpFromEvents`) with "Floor×3.0" — broadened eligibility (specialty-core OR role-core counts), no compound bonus when both match, and a 3.0× lift on every Utility role event for Utility characters (the "floor fix" that also reaches specialty-core Utility events like the Thief's `disarm_trap`/`find_treasure`).
2. **Replace the XP-scale formula** in `services/league-service.server.ts` so per-preset pacing reflects each preset's actual `(startingLevel, targetLevel, seasonWeeks)`. A global `XP_AWARD_MULTIPLIER = 3.5` calibrates so Standard preset characters approximately reach `targetLevel` by season end.

No schema changes, no migration, no rule versioning. The change applies to all leagues from this commit forward.

## Background

The 2026-05-03 balance overhaul shipped 35+ commits resolving 23 plan tasks plus follow-ups. The implementation log (`docs/superpowers/logs/2026-05-03-balance-overhaul-log.md`) closed with two open items in the leveling area:

- **Leveling/scoring coupling investigation:** the original rule (`xpFromEvents` with 1.5× specialty bonus) only credited XP for events in the character's role set. Off-role specialties (Vengeance Paladin Tank, Berserker Tank, Swords Bard Utility, Assassin Rogue Utility, etc.) scored in two buckets but earned XP from only one, producing season point↔XP Pearson r=0.40. The investigation built a comparison harness (`scripts/leveling-comparison.ts`) and an interactive sandbox (`app/routes/sandbox.leveling.tsx`) but deferred the production rule change.
- **I5: `targetLevel` setting unused.** The XP-scale formula was `xpScale = 10 / seasonWeeks` — independent of `startingLevel`/`targetLevel`. Veterans (start L5, target L16, 12 weeks) got *less* XP relative to threshold than Standard (start L3, target L13, 10 weeks), despite needing to progress through more levels.

This spec resolves both. The decisions below were made over a tuning session on 2026-05-19/21 using the harness with extended Utility-multiplier variants and a floor-fix variant.

## Decisions (with rationale)

### D1: Floor×3.0 as the leveling rule

The rule semantics:

- An event credits XP to a character if it's in their role's `ROLE_XP_EVENTS` set **or** in their specialty's `coreEvents` (broadened eligibility — both buckets count).
- Multiplier per event is picked by `xpMultiplierFor`:
  - **3.0×** if the character's role is Utility *and* the event is in the Utility role set (the floor fix — applies whether or not the event is also specialty-core).
  - **1.5×** if the event is *both* role-core and specialty-core (the historic specialty bonus, preserved for non-Utility characters).
  - **1.0×** otherwise.

**Why Floor×3.0 vs alternatives:** The harness compared the current rule, Broadened (1.5× compound on specialty-core), Brd-NoBon (broadened eligibility without compound bonus), Util×{1.5,1.75,2.0,2.5,3.0,3.5,4.0} lifts, Floor×{3.0,3.5} variants, and a Milestone (flat-per-matchup) baseline. Floor×3.0 was on the Pareto frontier:

| Variant | r (pts ↔ XP) | Utility mean | Notes |
|---|:---:|---:|---|
| Current | 0.556 | 18 | r low, Utility floor (mean 18) |
| Util×3.0 | 0.701 | 59 | r dropping, Thief still at L2 |
| **Floor×3.0** | **0.710** | **63** | dominates Util×3.0 on every metric |
| Floor×3.5 | 0.663 | 75 | best Utility but bigger r hit |
| Util×4.0 | 0.638 | 73 | worst r in the candidate set |

The Floor variant beats its non-floor counterpart on r, on Utility mean XP, on coefficient-of-variation, and uniquely fixes the Rogue Thief floor — Thief's specialty events (`disarm_trap`, `find_treasure`) are *Utility-role events*, so the regular UtilLift `else if` branch bypasses them. Using `max(SPECIALTY_BONUS, UTILITY_LIFT)` instead lifts Thief from L2 → L3 across season-length runs.

### D2: 3.5× global XP award multiplier

The harness measured Floor×3.0 yields **9.63 XP per matchup** in the sandbox (8-week playoff structure, 6 teams, 4 active). Standard preset active characters play ~11 matchups (10 reg + ~1 playoff). The target rate to reach L13 from L3 over 11 matchups is 350/11 ≈ 32 XP/matchup. Calibration ratio: 32/9.63 ≈ 3.3.

We round to **3.5×** because:
- Cleaner constant.
- Small over-shoot (active Standard characters land at L13-L14 vs L4-L5 today) is generous.
- The whole point of the change is to make `targetLevel` meaningful — slight over-shoot is preferable to slight under-shoot.

This is a ~3.5× XP-rate increase versus today. **This is a deliberate, visible-to-players change.** Anyone used to "characters reach L4-5 by season end in Standard" will see them reach L13. That's the intended effect.

### D3: XP-scale formula derived from `(startingLevel, targetLevel, seasonWeeks)`

Replace the current `xpScale = 10 / seasonWeeks` with:

```ts
xpScale = ((XP[13] - XP[3]) * seasonWeeks) / ((XP[targetLevel] - XP[startingLevel]) * 10)
```

Read: "Standard's required XP-per-matchup ÷ this preset's required XP-per-matchup." Inverted because `scaledThresholds` multiplies thresholds — higher `xpScale` means *harder* leveling, so presets that need to progress through *more* XP-range need a *lower* `xpScale`.

| Preset | start → target | weeks | xpScale | meaning |
|---|---:|---:|---:|---|
| Standard | L3 → L13 | 10 | **1.000** | baseline |
| Quick | L3 → L9 | 5 | **1.129** | slightly harder (Quick over-shoots L9 otherwise) |
| Veterans | L5 → L16 | 12 | **0.764** | easier (needs to reach deeper levels) |
| Epic | L3 → L20 | 20 | **0.631** | easiest (needs to reach max level) |
| Champions | L20 → L20 | 10 | **1.000** | guarded (Champions disables XP) |

Combined with the 3.5× XP-award multiplier, simulated reach per preset (mean active char):

| Preset | XP earned | start XP | end XP | scaled target threshold | reaches |
|---|---:|---:|---:|---:|:---:|
| Standard | 371 | 30 | 401 | 380 | **L13** ✓ |
| Quick | 219 | 30 | 249 | 209 | **L9** ✓ |
| Veterans | 438 | 70 | 508 | 473 | **L16** ✓ (just) |
| Epic | 708 | 30 | 738 | 718 | **L20** ✓ (just) |

### D4: No migration, no rule versioning

The rule applies to all leagues from this commit forward. Past XP is preserved as-credited (`Character.xp` is a stored scalar, not a derivation). In-flight leagues experience an XP regime shift at their next `advanceWeek` — characters start earning ~3.5× the per-event XP plus the Floor lift. This is one-way monotonic (no character loses XP) and visible primarily as faster level-ups for the remainder of the season.

No schema change, no `League.levelingRule` discriminator, no feature flag.

### D5: Keep sandbox + harness as audit trail

`app/routes/sandbox.leveling.tsx` and `scripts/leveling-comparison.ts` stay as-is. They've surfaced two non-trivial findings already (the leveling-rule decision and the Thief floor) and the next tuning round will be cheaper if they're maintained. A one-line comment in each points to this spec as the authoritative "what we picked and why" record.

The harness's experimental Utility×{1.5–4.0} and Floor×{3.0,3.5} variants stay in the file — they're the decision audit trail.

The sandbox's experimental toggles (`healerMultiHeal`, `healerHitSecondary`, force-balanced lineups, playoff structure) remain sandbox-only. They're separate decisions for a separate session.

## Implementation Outline

### `domain/leveling.ts` changes

Add three top-level constants and one helper:

```ts
const SPECIALTY_XP_BONUS = 1.5;   // existing — preserved for non-Utility specialty matches
const UTILITY_XP_LIFT = 3.0;      // new — Floor×3.0 multiplier for Utility role events
const XP_AWARD_MULTIPLIER = 3.5;  // new — pace calibration; calibrated 2026-05-21

function xpMultiplierFor(
  character: Character,
  isRoleEvent: boolean,
  isSpecialtyCore: boolean,
): number {
  if (character.role === "Utility" && isRoleEvent) return UTILITY_XP_LIFT;
  if (isRoleEvent && isSpecialtyCore) return SPECIALTY_XP_BONUS;
  return 1.0;
}
```

Rewrite `xpFromEvents`:

```ts
export function xpFromEvents(character: Character, events: SimEvent[]): number {
  let total = 0;
  const roleSet = ROLE_XP_EVENTS[character.role];
  for (const event of events) {
    if (event.actorId !== character.id) continue;
    const isRoleEvent = roleSet.has(event.kind);
    const isSpecialtyCore = isCoreEventForSpecialty(character.specialty, event.kind);
    if (!isRoleEvent && !isSpecialtyCore) continue;
    const base = xpAmountForEvent(event);
    const mult = xpMultiplierFor(character, isRoleEvent, isSpecialtyCore);
    total += Math.round(base * mult);
  }
  return Math.round(total * XP_AWARD_MULTIPLIER);
}
```

Add exported helper:

```ts
export function xpScaleFor(
  settings: Pick<LeagueSettings, "startingLevel" | "targetLevel" | "seasonWeeks">,
): number {
  const baselineRange = XP_THRESHOLDS[13] - XP_THRESHOLDS[3];
  const baselineWeeks = 10;
  const startXp = XP_THRESHOLDS[settings.startingLevel];
  const targetXp = XP_THRESHOLDS[settings.targetLevel];
  if (startXp === undefined || targetXp === undefined) return 1.0;
  const presetRange = targetXp - startXp;
  if (presetRange <= 0) return 1.0;
  return (baselineRange * settings.seasonWeeks) / (presetRange * baselineWeeks);
}
```

### `services/league-service.server.ts` change

One line, replacing the hardcoded formula at line ~229:

```diff
-      const xpScale = 10 / Math.max(1, leagueSettings.seasonWeeks ?? 10);
+      const xpScale = xpScaleFor(leagueSettings);
```

Plus an import of `xpScaleFor` from `domain/leveling`.

### Tests

New/extended tests in `tests/domain/leveling.test.ts`:

- `xpMultiplierFor` returns 3.0 for Utility role + Utility role event (whether or not specialty-core).
- `xpMultiplierFor` returns 1.5 for non-Utility role+specialty match.
- `xpMultiplierFor` returns 1.0 for role-only or specialty-only.
- `xpFromEvents` for a Bard Lore with `persuade` events yields the expected total (covers floor fix + calibration arithmetic).
- `xpFromEvents` for a Rogue Thief with `disarm_trap` events yields 3.0× × base × 3.5 (covers Thief-floor fix specifically).
- `xpFromEvents` for a Fighter Champion with `crit` events yields 1.5× × base × 3.5 (covers preserved non-Utility specialty bonus).
- `xpScaleFor` returns 1.0 (Standard), ~1.129 (Quick), ~0.764 (Veterans), ~0.631 (Epic), 1.0 (Champions — `targetLevel === startingLevel`).
- `xpScaleFor` returns 1.0 guard when `targetLevel > 20` or other out-of-range input.

Existing tests that assert XP totals will need expected-value updates (numeric only — no intent changes). Found by running the suite after the rule change lands.

### Harness + sandbox

Add a one-line comment block at the top of both:

```
// Rule chosen 2026-05-21: Floor×3.0 + 3.5× pace calibration.
// See docs/superpowers/specs/2026-05-21-leveling-rule-and-xp-scale-design.md
```

No behavior change. All variants stay in the harness as the decision audit trail.

### Documentation

- This spec at `docs/superpowers/specs/2026-05-21-leveling-rule-and-xp-scale-design.md`.
- Append a closure note to `docs/superpowers/logs/2026-05-03-balance-overhaul-log.md` marking the leveling/scoring-coupling investigation and I5 as resolved.

## Risk

- **In-flight leagues:** characters earn ~3.5× the per-event XP plus the Floor lift starting at the next `advanceWeek`. One-way monotonic; no character loses XP. Faster level-ups for the rest of the season. Acceptable for this project — no in-flight leagues require preserved pacing.
- **Test churn:** any test asserting specific XP totals fails until expected values are updated. Resolution is mechanical.
- **Out-of-range `targetLevel`:** `xpScaleFor` guards by returning 1.0 if either threshold lookup is undefined or if the range is non-positive.
- **Champions preset:** `xpEnabled=false`, so `xpScaleFor` output is never consumed. Guard returns 1.0 as a defensive default.

## Commit Plan

Three commits on `balance-overhaul`:

1. `feat(leveling): Floor×3.0 rule + 3.5× pace calibration + xpScaleFor` — domain + service + tests + harness/sandbox comment headers.
2. `docs(leveling): spec for leveling rule + xp-scale fix` — this file.
3. `docs(log): mark leveling/scoring-coupling investigation resolved` — closure note on the balance-overhaul log.

## Out of Scope

- Adjusting any of the experimental sandbox toggles (`healerMultiHeal`, `healerHitSecondary`, force-balanced lineups, sandbox playoff structure) to production behavior.
- Tank/Healer XP gap (Tank mean 90, Healer 51 = 43% gap, exceeds the 25% scoring-parity target). Surfaced by the harness; tracked for a future tuning round.
- Sorcerer specialty differentiation (I1), `playoffTeams` setting (I4), revivify_save ordering (I6), highlight variety (M1), consolation matchups, service-test infrastructure. All deferred per the 2026-05-03 log.

## Open Question — None

All design decisions are locked. Proceed to implementation planning.
