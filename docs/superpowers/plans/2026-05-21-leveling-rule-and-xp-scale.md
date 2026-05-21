# Leveling Rule + XP-Scale Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Floor×3.0 leveling rule with 3.5× pace calibration in `domain/leveling.ts`, plus the corrected `xpScaleFor` formula wired into `services/league-service.server.ts`. Resolves the leveling/scoring-coupling investigation and I5 from the 2026-05-03 balance-overhaul log.

**Architecture:** Two domain changes (`xpFromEvents` rule + new `xpScaleFor` helper) plus a one-line service wire-in. No schema, no migration, no rule versioning. The Floor×3.0 rule semantics are factored into a small `xpMultiplierFor` helper so the conditional logic reads as three named branches instead of nested if/else.

**Tech Stack:** TypeScript (strict), Vitest for unit tests, React Router v7 for the web app, Prisma for the DB. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-21-leveling-rule-and-xp-scale-design.md`

---

### Task 1: Introduce `xpMultiplierFor` helper + constants

**Files:**
- Modify: `domain/leveling.ts`
- Test: `tests/domain/leveling.test.ts`

- [ ] **Step 1: Write failing tests for the new helper**

Append to `tests/domain/leveling.test.ts` inside the `describe("leveling", ...)` block (before the closing `});`):

```ts
  describe("xpMultiplierFor", () => {
    it("returns UTILITY_XP_LIFT (3.0) for Utility role + Utility-role event (regardless of specialty match)", () => {
      const thiefChar = mkChar({
        class: "Rogue", role: "Utility", specialty: "Thief",
      });
      // disarm_trap IS in Utility role set AND IS Thief specialty-core → 3.0 (floor fix)
      expect(xpMultiplierFor(thiefChar, true, true)).toBe(3.0);
      // save_pass IS in Utility role set, not Thief specialty-core → 3.0 (regular lift)
      expect(xpMultiplierFor(thiefChar, true, false)).toBe(3.0);
    });

    it("returns SPECIALTY_XP_BONUS (1.5) for non-Utility role + role/specialty match", () => {
      const championChar = mkChar({
        class: "Fighter", role: "DPS", specialty: "Champion",
      });
      // crit IS in DPS role set AND IS Champion specialty-core → 1.5
      expect(xpMultiplierFor(championChar, true, true)).toBe(1.5);
    });

    it("returns 1.0 for role-only or specialty-only (no compound)", () => {
      const championChar = mkChar({
        class: "Fighter", role: "DPS", specialty: "Champion",
      });
      // role-only (e.g. DPS hit on a non-Champion DPS would be true,false)
      expect(xpMultiplierFor(championChar, true, false)).toBe(1.0);
      // specialty-only (e.g. an event in specialty.coreEvents but not the role set)
      expect(xpMultiplierFor(championChar, false, true)).toBe(1.0);
    });
  });
```

You will also need to add `xpMultiplierFor` to the imports at the top:

```ts
import {
  XP_THRESHOLDS,
  xpFromEvents,
  applyXpAndLevel,
  scaledThresholds,
  xpMultiplierFor,
} from "domain/leveling";
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/domain/leveling.test.ts`
Expected: `xpMultiplierFor is not a function` or import resolution error — confirms the helper does not exist yet.

- [ ] **Step 3: Add constants and helper to `domain/leveling.ts`**

Locate the existing constant near the top:

```ts
const SPECIALTY_XP_BONUS = 1.5;
```

Replace that block with:

```ts
const SPECIALTY_XP_BONUS = 1.5;
const UTILITY_XP_LIFT = 3.0;
const XP_AWARD_MULTIPLIER = 3.5;

export function xpMultiplierFor(
  character: Character,
  isRoleEvent: boolean,
  isSpecialtyCore: boolean,
): number {
  if (character.role === "Utility" && isRoleEvent) return UTILITY_XP_LIFT;
  if (isRoleEvent && isSpecialtyCore) return SPECIALTY_XP_BONUS;
  return 1.0;
}
```

Note: `XP_AWARD_MULTIPLIER` is unused at this step but added now so Task 2 can call it without re-editing constants.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/domain/leveling.test.ts`
Expected: all three new `xpMultiplierFor` tests pass; existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add domain/leveling.ts tests/domain/leveling.test.ts
git commit -m "$(cat <<'EOF'
feat(leveling): add xpMultiplierFor helper for Floor×3.0 rule

Introduces UTILITY_XP_LIFT (3.0) and XP_AWARD_MULTIPLIER (3.5)
constants plus the xpMultiplierFor helper that picks per-event
multipliers (3.0/1.5/1.0) based on role and specialty match.

The helper is not yet called by xpFromEvents — Task 2 wires it in
and applies the calibration multiplier.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Apply Floor×3.0 rule + 3.5× calibration to `xpFromEvents`

**Files:**
- Modify: `domain/leveling.ts`
- Test: `tests/domain/leveling.test.ts`

- [ ] **Step 1: Update the existing "1.5x specialty bonus" test for new expected values**

In `tests/domain/leveling.test.ts`, locate this test (around line 41-50):

```ts
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
```

Replace it with a version that asserts concrete post-calibration values (the rounding interaction makes ratio assertions fragile):

```ts
  it("applies 1.5x specialty bonus on aligned events (non-Utility)", () => {
    // Life Domain Healer: heal IS in Healer role set AND IS specialty-core → 1.5x
    // War Domain Healer:  heal IS in Healer role set, NOT specialty-core → 1.0x
    // base XP for heal amount=10: max(1, floor(10/4)) = 2
    // aligned per-event = round(2 * 1.5) = 3 ; total before calibration = 3
    //                   → final = round(3 * 3.5) = 11
    // offspec per-event = round(2 * 1.0) = 2 ; total before calibration = 2
    //                   → final = round(2 * 3.5) = 7
    const aligned = mkChar({ specialty: "Life Domain" });
    const offspec = mkChar({ specialty: "War Domain" });
    const events: SimEvent[] = [
      { kind: "heal", encounterId: "e", actorId: "c1", amount: 10 },
    ];
    expect(xpFromEvents(aligned, events)).toBe(11);
    expect(xpFromEvents(offspec, events)).toBe(7);
  });
```

- [ ] **Step 2: Add new tests for Floor×3.0 + calibration behavior**

Append to the `describe("leveling", ...)` block (before its closing `});`):

```ts
  describe("Floor×3.0 + 3.5x calibration", () => {
    it("applies UTILITY_XP_LIFT (3.0) plus 3.5x calibration on a Bard Lore persuade", () => {
      // Bard Lore is Utility role; persuade is in Utility role set AND IS Lore specialty-core.
      // base XP for persuade: 2
      // per-event mult: 3.0 (Utility floor fix)
      // per-event = round(2 * 3.0) = 6 ; total = 6 ; final = round(6 * 3.5) = 21
      const bardLore = mkChar({
        class: "Bard", role: "Utility", specialty: "Lore",
      });
      const events: SimEvent[] = [
        { kind: "persuade", encounterId: "e", actorId: "c1" },
      ];
      expect(xpFromEvents(bardLore, events)).toBe(21);
    });

    it("applies UTILITY_XP_LIFT to Rogue Thief on disarm_trap (the floor-fix case)", () => {
      // Thief specialty events (disarm_trap, find_treasure) ARE Utility-role events.
      // Under the old NoBon+UtilLift rule, the `else if` bypassed them — Thief stayed at L2.
      // Floor fix: Utility role events for Utility chars always get 3.0x.
      // base XP for disarm_trap: 2
      // per-event = round(2 * 3.0) = 6 ; total = 6 ; final = round(6 * 3.5) = 21
      const thief = mkChar({
        class: "Rogue", role: "Utility", specialty: "Thief",
      });
      const events: SimEvent[] = [
        { kind: "disarm_trap", encounterId: "e", actorId: "c1" },
      ];
      expect(xpFromEvents(thief, events)).toBe(21);
    });

    it("applies 3.5x calibration to a Fighter Champion crit (non-Utility specialty bonus preserved)", () => {
      // crit IS in DPS role set AND IS Champion specialty-core → mult 1.5
      // base XP for crit: 2
      // per-event = round(2 * 1.5) = 3 ; total = 3 ; final = round(3 * 3.5) = 11
      const champion = mkChar({
        class: "Fighter", role: "DPS", specialty: "Champion",
      });
      const events: SimEvent[] = [
        { kind: "crit", encounterId: "e", actorId: "c1" },
      ];
      expect(xpFromEvents(champion, events)).toBe(11);
    });

    it("broadened eligibility: counts specialty-core events outside the role set (no role bonus)", () => {
      // Vengeance Paladin (Tank role); smite IS specialty-core but NOT in Tank role set.
      // Without broadened eligibility, this event would be skipped.
      // With broadened: counted at mult 1.0 (specialty-only, no compound).
      // base XP for smite amount=8: max(1, floor(8/4)) = 2
      // per-event = round(2 * 1.0) = 2 ; total = 2 ; final = round(2 * 3.5) = 7
      const veng = mkChar({
        class: "Paladin", role: "Tank", specialty: "Vengeance",
      });
      const events: SimEvent[] = [
        { kind: "smite", encounterId: "e", actorId: "c1", amount: 8 },
      ];
      expect(xpFromEvents(veng, events)).toBe(7);
    });
  });
```

- [ ] **Step 3: Run tests to verify expected failures**

Run: `npm test -- tests/domain/leveling.test.ts`
Expected: the updated "1.5x specialty bonus" test FAILS (currently `xpAligned=3, xpOffspec=2`, not 11/7); the four new tests in the `Floor×3.0 + 3.5x calibration` block also FAIL. These failures confirm the existing rule is still in place.

- [ ] **Step 4: Refactor `xpFromEvents` to use the helper and apply calibration**

In `domain/leveling.ts`, locate `xpFromEvents` (lines 66-79):

```ts
export function xpFromEvents(character: Character, events: SimEvent[]): number {
  let total = 0;
  const roleSet = ROLE_XP_EVENTS[character.role];
  for (const event of events) {
    if (event.actorId !== character.id) continue;
    if (!roleSet.has(event.kind)) continue;
    let amount = xpAmountForEvent(event);
    if (isCoreEventForSpecialty(character.specialty, event.kind)) {
      amount = Math.round(amount * SPECIALTY_XP_BONUS);
    }
    total += amount;
  }
  return total;
}
```

Replace with:

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

Two changes versus the original:
1. Broadened eligibility — events are counted if EITHER in the role set OR specialty-core (was: role-only).
2. Multiplier picked by `xpMultiplierFor` (Floor×3.0 for Utility role events, 1.5× for non-Utility role+specialty, else 1.0). Final total multiplied by `XP_AWARD_MULTIPLIER` (3.5).

- [ ] **Step 5: Run all tests to verify pass**

Run: `npm test -- tests/domain/leveling.test.ts`
Expected: all leveling tests pass (existing + updated + new). Specifically check:
- "applies 1.5x specialty bonus on aligned events (non-Utility)" — passes
- The four new `Floor×3.0 + 3.5x calibration` tests — pass
- "xpFromEvents awards role-relevant XP (Healer earns from heal)" — passes
- "DPS earns no XP from heal events" — passes
- "xpFromEvents returns an integer (no fractional accumulation)" — passes

- [ ] **Step 6: Run full test suite to catch downstream breakage**

Run: `npm test`
Expected: all domain tests pass. If `tests/domain/scoring.test.ts`, `tests/domain/sim-engine.test.ts`, or any other test asserts XP totals, update the expected numbers to match the new rule (calibration multiplier × 3.5). If a failure isn't an XP-total assertion, stop and investigate before changing the test.

- [ ] **Step 7: Commit**

```bash
git add domain/leveling.ts tests/domain/leveling.test.ts
git commit -m "$(cat <<'EOF'
feat(leveling): Floor×3.0 rule + 3.5× pace calibration

- xpFromEvents now uses xpMultiplierFor to apply Floor×3.0 (Utility
  role events for Utility chars always get 3.0×, fixing the Thief
  floor where specialty-core Utility events were bypassed) and the
  3.5× XP_AWARD_MULTIPLIER calibration so targetLevel is reachable.
- Eligibility broadened: events count if either in role set OR
  specialty-core (was: role set only). Off-role specialties
  (Vengeance Tank, Berserker Tank, Swords Bard, Assassin Rogue, etc.)
  now earn XP from their specialty events.
- Existing "1.5x specialty bonus" test rewritten to assert concrete
  post-calibration values (ratio assertions were rounding-fragile).

Spec: docs/superpowers/specs/2026-05-21-leveling-rule-and-xp-scale-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add `xpScaleFor` exported helper

**Files:**
- Modify: `domain/leveling.ts`
- Test: `tests/domain/leveling.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/domain/leveling.test.ts`:

```ts
  describe("xpScaleFor", () => {
    it("returns 1.0 for Standard preset shape (L3 → L13, 10 weeks)", () => {
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 13, seasonWeeks: 10 }))
        .toBeCloseTo(1.0, 3);
    });

    it("returns ~1.129 for Quick preset shape (L3 → L9, 5 weeks)", () => {
      // (350 * 5) / (155 * 10) = 1.129
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 9, seasonWeeks: 5 }))
        .toBeCloseTo(1.129, 3);
    });

    it("returns ~0.764 for Veterans preset shape (L5 → L16, 12 weeks)", () => {
      // (350 * 12) / (550 * 10) = 0.7636
      expect(xpScaleFor({ startingLevel: 5, targetLevel: 16, seasonWeeks: 12 }))
        .toBeCloseTo(0.764, 3);
    });

    it("returns ~0.631 for Epic preset shape (L3 → L20, 20 weeks)", () => {
      // (350 * 20) / (1110 * 10) = 0.6306
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 20, seasonWeeks: 20 }))
        .toBeCloseTo(0.631, 3);
    });

    it("returns 1.0 guard when targetLevel === startingLevel (Champions)", () => {
      expect(xpScaleFor({ startingLevel: 20, targetLevel: 20, seasonWeeks: 10 }))
        .toBe(1.0);
    });

    it("returns 1.0 guard when targetLevel is out of range", () => {
      expect(xpScaleFor({ startingLevel: 3, targetLevel: 99, seasonWeeks: 10 }))
        .toBe(1.0);
    });

    it("returns 1.0 guard when startingLevel is out of range", () => {
      expect(xpScaleFor({ startingLevel: 0, targetLevel: 13, seasonWeeks: 10 }))
        .toBe(1.0);
    });
  });
```

Add `xpScaleFor` to the imports at the top:

```ts
import {
  XP_THRESHOLDS,
  xpFromEvents,
  applyXpAndLevel,
  scaledThresholds,
  xpMultiplierFor,
  xpScaleFor,
} from "domain/leveling";
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/domain/leveling.test.ts`
Expected: import resolution error — `xpScaleFor` does not exist.

- [ ] **Step 3: Implement `xpScaleFor` in `domain/leveling.ts`**

Add a new import at the top of `domain/leveling.ts` (the file currently only imports types, but `LeagueSettings` is needed):

```ts
import type { Character, EventKind, LeagueSettings, Role, SimEvent } from "./types";
```

(Replace the existing `import type { Character, EventKind, Role, SimEvent } from "./types";` line.)

Append the new function near the end of the file (after `applyXpAndLevel`):

```ts
export function xpScaleFor(
  settings: Pick<LeagueSettings, "startingLevel" | "targetLevel" | "seasonWeeks">,
): number {
  const baselineRange = XP_THRESHOLDS[13] - XP_THRESHOLDS[3];   // 350
  const baselineWeeks = 10;
  const startXp = XP_THRESHOLDS[settings.startingLevel];
  const targetXp = XP_THRESHOLDS[settings.targetLevel];
  if (startXp === undefined || targetXp === undefined) return 1.0;
  const presetRange = targetXp - startXp;
  if (presetRange <= 0) return 1.0;
  return (baselineRange * settings.seasonWeeks) / (presetRange * baselineWeeks);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/domain/leveling.test.ts`
Expected: all seven new `xpScaleFor` tests pass; all other leveling tests still pass.

- [ ] **Step 5: Commit**

```bash
git add domain/leveling.ts tests/domain/leveling.test.ts
git commit -m "$(cat <<'EOF'
feat(leveling): xpScaleFor derives scale from preset settings

Replaces the static 10/seasonWeeks scale (which ignored targetLevel)
with a formula that takes startingLevel + targetLevel + seasonWeeks
into account. Standard preset stays at xpScale=1.0 (baseline); other
presets get scaled so that, combined with the 3.5× XP_AWARD_MULTIPLIER
from the prior commit, characters approximate their declared
targetLevel by season end.

Guards: returns 1.0 for Champions (targetLevel === startingLevel) or
any out-of-range level lookup.

Resolves I5 from docs/superpowers/logs/2026-05-03-balance-overhaul-log.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire `xpScaleFor` into `services/league-service.server.ts`

**Files:**
- Modify: `services/league-service.server.ts`

- [ ] **Step 1: Update the import**

At line 13 of `services/league-service.server.ts`:

```ts
import { applyXpAndLevel, xpFromEvents } from "domain/leveling";
```

Change to:

```ts
import { applyXpAndLevel, xpFromEvents, xpScaleFor } from "domain/leveling";
```

- [ ] **Step 2: Replace the hardcoded formula**

At line 229 of `services/league-service.server.ts`:

```ts
      const xpScale = 10 / Math.max(1, leagueSettings.seasonWeeks ?? 10);
```

Change to:

```ts
      const xpScale = xpScaleFor(leagueSettings);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. `xpScaleFor` accepts `Pick<LeagueSettings, "startingLevel" | "targetLevel" | "seasonWeeks">` and `leagueSettings` has all three properties.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass. Service-layer tests that require a real DB may skip or fail with a connection error — that's pre-existing per the 2026-05-03 log and not caused by this change.

- [ ] **Step 5: Commit**

```bash
git add services/league-service.server.ts
git commit -m "$(cat <<'EOF'
feat(league-service): use xpScaleFor for preset-aware XP pacing

Replaces the line-229 formula `10 / seasonWeeks` with xpScaleFor(),
so the targetLevel setting actually affects per-preset pacing. Quick
gets slightly harder thresholds (1.13), Veterans easier (0.76), Epic
easiest (0.63). Standard stays at 1.0 (baseline).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add provenance comments to harness and sandbox

**Files:**
- Modify: `scripts/leveling-comparison.ts`
- Modify: `app/routes/sandbox.leveling.tsx`

- [ ] **Step 1: Add comment header to the harness**

At the very top of `scripts/leveling-comparison.ts` (before the existing imports), insert:

```ts
// Rule chosen 2026-05-21: Floor×3.0 (Broadened-NoBonus + Utility floor-fix at 3.0×)
// plus 3.5× XP_AWARD_MULTIPLIER pace calibration. The variants below
// (Util×{1.5..4.0}, Floor×{3.0, 3.5}) are the decision audit trail.
// See docs/superpowers/specs/2026-05-21-leveling-rule-and-xp-scale-design.md
```

- [ ] **Step 2: Add comment header to the sandbox**

At the very top of `app/routes/sandbox.leveling.tsx` (before the existing imports), insert:

```ts
// Tuning sandbox for leveling rules. Production rule chosen 2026-05-21:
// Floor×3.0 + 3.5× calibration. This route stays as a lab for future
// tuning rounds — its experimental toggles (healerMultiHeal,
// healerHitSecondary, force-balanced lineups, playoff structure) remain
// sandbox-only.
// See docs/superpowers/specs/2026-05-21-leveling-rule-and-xp-scale-design.md
```

- [ ] **Step 3: Verify the files still build/type-check**

Run: `npx tsc --noEmit`
Expected: no errors (comments don't affect types).

- [ ] **Step 4: Commit**

```bash
git add scripts/leveling-comparison.ts app/routes/sandbox.leveling.tsx
git commit -m "$(cat <<'EOF'
chore(harness,sandbox): provenance comments pointing to leveling spec

Adds a header comment to both files identifying the rule chosen
on 2026-05-21 and linking to the design doc. Useful for the next
tuning round so the audit-trail variants (Util×N, Floor×N) read
as "history" rather than "what should we use?".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Append closure note to balance-overhaul log

**Files:**
- Modify: `docs/superpowers/logs/2026-05-03-balance-overhaul-log.md`

- [ ] **Step 1: Append closure section to the log**

Open `docs/superpowers/logs/2026-05-03-balance-overhaul-log.md` and append at the very end:

```markdown

## Leveling Rule + I5 Resolved (2026-05-21)

The leveling/scoring-coupling investigation and I5 (`targetLevel` setting unused) are now resolved on `balance-overhaul`. See `docs/superpowers/specs/2026-05-21-leveling-rule-and-xp-scale-design.md` for the design, rationale, and harness data.

**Shipped:**

- **Floor×3.0 leveling rule** in `domain/leveling.ts` — broadened eligibility (specialty-core OR role-core counts), no compound bonus when both match, 3.0× lift on every Utility role event for Utility characters (the floor fix that reaches Thief specialty events).
- **3.5× XP_AWARD_MULTIPLIER** pace calibration — final season point↔XP Pearson r=0.71 (vs 0.40 under the old rule), Utility role mean XP 63 (vs 18), all four primary presets approximate their declared `targetLevel` by season end.
- **`xpScaleFor` formula** in `domain/leveling.ts`, wired into `services/league-service.server.ts`. Standard 1.0, Quick 1.13, Veterans 0.76, Epic 0.63, Champions 1.0 (guard).

**Not migrated:** in-flight league XP is preserved as-credited; the new rule applies from the next `advanceWeek` onward.

**Sandbox + harness:** kept as audit trail (`scripts/leveling-comparison.ts`, `app/routes/sandbox.leveling.tsx`). Their experimental knobs (healer toggles, force-balanced lineups, sandbox playoff structure) remain sandbox-only — separate decisions for separate sessions.

**Tank/Healer XP gap still open:** Tank mean 90, Healer 51 (~43% gap) — surfaced by the harness, deferred to a future tuning round.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/logs/2026-05-03-balance-overhaul-log.md
git commit -m "$(cat <<'EOF'
docs(log): mark leveling/scoring-coupling investigation + I5 resolved

Closes out two open items from the balance-overhaul log by linking
to the 2026-05-21 leveling-rule spec and summarizing what shipped:
Floor×3.0 rule, 3.5× pace calibration, xpScaleFor formula.
Tank/Healer XP gap remains open for a future tuning round.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification Checklist (run after all tasks complete)

- [ ] `npm test` — full suite passes (modulo pre-existing service-test DB requirement).
- [ ] `npx tsc --noEmit` — no type errors.
- [ ] `git log --oneline -6` — shows the six new commits on `balance-overhaul`:
  - `feat(leveling): add xpMultiplierFor helper for Floor×3.0 rule`
  - `feat(leveling): Floor×3.0 rule + 3.5× pace calibration`
  - `feat(leveling): xpScaleFor derives scale from preset settings`
  - `feat(league-service): use xpScaleFor for preset-aware XP pacing`
  - `chore(harness,sandbox): provenance comments pointing to leveling spec`
  - `docs(log): mark leveling/scoring-coupling investigation + I5 resolved`
- [ ] `npx tsx scripts/leveling-comparison.ts` — still runs to completion. Floor×3.0 line should still show r≈0.71 and Utility mean ≈63 (the harness's `Current` mode now reflects the new production rule — that's intentional, since `xpCurrent` calls the live `xpFromEvents`).
  - **Note:** if the harness's `Current` row no longer matches "old rule" baseline because `xpFromEvents` changed, that's expected — the harness will need its `Current` variant renamed or removed in a follow-up, but it doesn't have to happen as part of this plan.

## Self-Review Findings

Pass-through review of this plan against the spec:

- ✅ D1 (Floor×3.0 rule) — Tasks 1 + 2 implement the helper and apply it in `xpFromEvents`.
- ✅ D2 (3.5× XP_AWARD_MULTIPLIER) — Task 1 declares the constant; Task 2 applies it.
- ✅ D3 (xpScaleFor formula) — Task 3 implements; Task 4 wires it in.
- ✅ D4 (no migration / no rule versioning) — no plan task touches schema or rule discriminators.
- ✅ D5 (sandbox + harness retention) — Task 5 adds comment headers, no behavior change.
- ✅ Tests for `xpMultiplierFor` — Task 1.
- ✅ Tests for Floor×3.0 rule (Bard Lore persuade, Rogue Thief disarm_trap, Fighter Champion crit, Vengeance Paladin smite for broadened eligibility) — Task 2.
- ✅ Tests for `xpScaleFor` (Standard/Quick/Veterans/Epic + Champions guard + out-of-range guards) — Task 3.
- ✅ Existing test update (`applies 1.5x specialty bonus on aligned events`) — Task 2, Step 1.
- ✅ Provenance comments — Task 5.
- ✅ Log closure note — Task 6.
- ✅ Commit plan aligns with spec's commits 1 and 3 (commit 2 was the spec doc itself, already on the branch as `96d502a`).
