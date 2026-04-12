# Dungeon League v1 — Implementation Log

## Tasks Completed

### Task 1: Project Scaffolding
- Scaffolded React Router v7 + Prisma + Vitest project
- Fixed Vitest type reference in vite.config.ts
- Commits: `4d66fdb`, `6e02367`

### Task 2: Domain Types
- Created all domain type definitions (Character, Dungeon, SimEvent, ScoreResult, etc.)
- Commit: `3e53c38`

### Task 3: Seeded RNG
- Implemented mulberry32-based deterministic PRNG with fork(), rollStat(), shuffle()
- 8 tests
- Commit: `42f6d97`

### Tasks 4-5: ContentSource + ProceduralSource
- ContentSource interface, name tables (59 first names, 50 last names, dungeon themes, etc.)
- ProceduralSource with character generation (unique names, rolled stats) and dungeon generation (5-8 encounters, boss finale)
- 10 tests
- Commit: `f73341d`

### Task 6: Sim Engine
- Encounter resolution functions (combat, trap, puzzle, treasure)
- runDungeon() entry point with HP tracking, death/KO mechanics
- Fixed healing bug from plan (used correct `c.stats.con` vs wrong `char.stats.con`)
- 6 tests
- Commit: `858c6e2`

### Task 7: Scoring Module
- Pure scoring reducer with base points, role multipliers (x0.5), 6 milestone types
- Added clutch_survivor milestone (KO'd but not killed)
- Fixed test assertion: mvp + flawless_run stack to 8, not 5
- 9 tests
- Commit: `8b7ded7`

### Task 8: Highlight Generator
- Highlight generation with priority-based selection (max 10)
- Templated descriptions with placeholder substitution
- Updated ProceduralSource.getHighlightTemplates()
- 6 tests
- Commit: `00f66bc`

### Task 9: AI Manager
- AIManager class with personality-driven draft picks and lineup setting
- 5 AI personalities: Iron Wall, Glass Cannon, Balanced General, Treasure Hunter, Mystic Circle
- 5 tests
- Commit: `4e7657e`

### Task 10: Schedule Generator
- Round-robin (circle method) for 6 teams, 5 weeks
- Playoff bracket generation (semifinals + finals)
- 6 tests
- Commit: `cce34ce`

### Task 11: Prisma Schema
- Full DB schema (League, Team, Character, Lineup, Matchup)
- Prisma client singleton, dev-mode auth stub
- Adapted for Prisma 7 (datasource URL via prisma.config.ts)
- Commit: `96160dc`

### Task 12: League Service
- createLeague: 6 teams, 48 chars, round-robin schedule
- advanceWeek: full game loop with sim, scoring, highlights, standings, playoff generation
- Used @prisma/adapter-pg for Prisma 7 compatibility
- 3 integration tests
- Commit: `94a07e3`

### Task 13: Draft Service
- Snake draft orchestration (6 teams × 6 rounds = 36 picks)
- AI picks via AIManager with personality
- League transitions to "regular" phase after draft completes
- 3 integration tests
- Commit: `e6b0716`

### Infrastructure fix
- Serialized test file execution to avoid DB contention
- Commit: `de4e466`

## Current State
- **60 tests passing** (54 domain unit + 6 service integration)
- Domain core is pure TypeScript, no framework imports
- All domain functions are deterministic and seedable
- Postgres running in Docker at localhost:5432
- Next: UI layer (Tasks 14-19)
