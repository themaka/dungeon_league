# Dungeon League v1 — Implementation Log

## Summary

**All 22 tasks complete.** 59 tests passing. Production build succeeds. Full-stack fantasy sports league app with:
- Deterministic sim engine + scoring + highlights
- Snake draft with AI managers
- 7 React Router pages with parchment aesthetic
- Export/import for league backups
- Balance harness for scoring iteration

## Tasks Completed

### Task 1: Project Scaffolding
- Scaffolded React Router v7 + Prisma 7 + Vitest + Tailwind CSS
- Fixed Vitest type reference in vite.config.ts
- Commits: `4d66fdb`, `6e02367`

### Task 2: Domain Types
- All domain type definitions (Character, Dungeon, SimEvent, ScoreResult, etc.)
- Commit: `3e53c38`

### Task 3: Seeded RNG
- Mulberry32 PRNG with fork(), rollStat(), shuffle(), seedFromIds()
- 8 tests
- Commit: `42f6d97`

### Tasks 4-5: ContentSource + ProceduralSource
- ContentSource interface, name tables, ProceduralSource
- Character gen (unique names, rolled stats) + dungeon gen (5-8 encounters, boss finale)
- 10 tests
- Commit: `f73341d`

### Task 6: Sim Engine
- Encounter resolution (combat, trap, puzzle, treasure)
- runDungeon() with HP tracking, death/KO mechanics
- Fixed healing bug from plan (`c.stats.con` vs `char.stats.con`)
- 6 tests
- Commit: `858c6e2`

### Task 7: Scoring Module
- Pure reducer with base points, role multipliers (x0.5), 6 milestones
- Includes clutch_survivor (KO'd but survived)
- Fixed test: mvp + flawless_run stack to 8, not 5
- 9 tests
- Commit: `8b7ded7`

### Task 8: Highlight Generator
- Priority-based selection (max 10), templated descriptions
- Commit: `00f66bc`

### Task 9: AI Manager
- 5 personalities: Iron Wall, Glass Cannon, Balanced General, Treasure Hunter, Mystic Circle
- Personality-driven draft picks + dungeon-aware lineup setting
- 5 tests
- Commit: `4e7657e`

### Task 10: Schedule Generator
- Round-robin (circle method) for 6 teams, playoff bracket (semis + finals)
- 6 tests
- Commit: `cce34ce`

### Task 11: Prisma Schema
- Models: League, Team, Character, Lineup, Matchup
- Prisma client singleton with PrismaPg adapter (Prisma 7)
- Dev-mode auth stub
- Commit: `96160dc`

### Task 12: League Service
- createLeague: 6 teams, 48 chars, round-robin schedule
- advanceWeek: full game loop (sim → score → highlights → standings → playoffs)
- 3 integration tests
- Commit: `94a07e3`

### Task 13: Draft Service
- Snake draft (6 teams × 6 rounds = 36 picks)
- AI picks via AIManager with personality
- 3 integration tests
- Commit: `e6b0716`

### Task 14: Root Layout + League List
- Parchment aesthetic CSS, serif fonts, themed variables
- League list page with empty state
- Commit: `f325e66`

### Task 15: Create League + Draft Room
- League creation form → redirect to draft
- Draft room: character pool with role filters, AI "Continue" button, roster sidebar
- CharacterCard and DraftPool components
- Commit: `13e09d2`

### Task 16: League Home + Standings
- Standings table (W/L/PF/PA), "Advance Week" button
- Current and past week matchup links
- Commit: `d6c49ec`

### Task 17: Team Page + Lineup Editor
- Roster view with active (4) / bench (2) lineup
- Swap buttons for human team, read-only for AI
- Commit: `4594d3a`

### Task 18: Matchup Page
- Score comparison, highlights sorted by importance
- Side-by-side play-by-play feeds and per-character stat tables
- Commit: `f0d3556`

### Task 19: Character Detail
- Stats, description, draft team, weekly performance log
- Commit: `1f08407`

### Task 20: Export/Import
- JSON export (full league state), import with fresh IDs
- Download backup button on league home, import page
- Commit: `0f3ebd5`

### Task 21: Balance Harness
- 100 leagues × 5 weeks simulation, role averages, score/margin distributions
- Initial findings: Healers score ~50% higher than Tanks (balance iteration needed)
- Commit: `3f6f64e`

### Task 22: Final Cleanup
- Removed smoke test, fixed Vitest deprecation warning
- Commit: `8b9b098`

## Balance Report (from harness)

```
Role Average Points Per Game:
  Tank     6.14
  Healer   9.10
  DPS      6.45
  Utility  8.10

Team Score Distribution:
  Min: -47.2, Median: 28.4, Mean: 28.4, Max: 65.9

Matchup Margin Distribution:
  Median margin: 5.7
  Blowouts (>50% of mean score): 19.7%
```

**Known balance issues:** Healers overscored, negative team scores possible (TPK penalty too harsh?), ~20% blowout rate.

## Post-Implementation Fixes (from first playtest)

- **Default lineup for human teams** (`1ad303c`) — advanceWeek no longer throws if the human hasn't set a lineup; defaults to first 4 characters active.
- **Heal target name resolution** (`64927f8`) — Highlight generator was checking encounter names before character names, so heal targets showed raw IDs. Fixed lookup order.
- **Export download** (`64927f8`) — Moved export from fetcher action to a resource route (`/leagues/:id/export`) so the browser handles the file download.
- **Play-by-play encounter names** (`33a887f`) — Added encounter name map so hits/kills show "Goblin Ambush" instead of "enc-w1-m0-0".
- **Export filename** (`fc94f03`) — Download filename uses league name instead of ID.

## Open Issues (from playtest)

1. **Team naming** — Players can't name their team (hardcoded "Your Team")
2. **Highlights missing team context** — No indication which team a highlighted character belongs to
3. **Stat table missing role column** — Points breakdown shows "Role" column but not what role each character is
4. **Save highlights lack context** — Generic "resisted the danger" instead of naming the encounter (future feature)

## Technical Notes

- **Prisma 7 adaptation:** Required `@prisma/adapter-pg` + `pg` driver. No `url` in schema datasource (moved to `prisma.config.ts`).
- **Test serialization:** Integration tests must run sequentially (`fileParallelism: false`) to avoid DB contention.
- **React Router v7 routing:** Uses explicit `app/routes.ts` config, not file-convention routing.
