# Dungeon League — Balance & Mechanics Overhaul Design

**Date:** 2026-05-03
**Status:** In progress (brainstorming)

## Overview

A balance/mechanics overhaul that brings 5.5e SRD flavor to the sim while keeping it abstract (no turn-by-turn combat). The specialty system is the central organizing concept -- everything hangs off it.

## Design Approach

**Approach 2: Top-Down Specialty System.** Keep the abstract sim model but rework it around specialties as the central mechanic. Each character's specialty defines: which events they generate, what stats they roll against, how they scale with level, and what abilities they unlock. SRD flavor comes through ability names and class identity, but the underlying math stays simpler than real 5e.

## Key Pillars

1. **24 specialties** (2 per class) giving characters a secondary scoring focus
2. **Leveling** (progressive XP, ~level 12-13 max per season) with stat growth + specialty scaling + ability unlocks (4-5 tiers per class)
3. **Class-specific abilities** inspired by SRD (Reckless Attack, Aura of Protection, Revivify, Sneak Attack, etc.)
4. **Richer encounter resolution** where classes interact differently with the same encounter
5. **New encounter types** (social, arcane) to give more classes moments to shine
6. **Revivify** as a charge-based ability (builds charges over weeks played)
7. **Rebalanced scoring** so tanks don't penalize healers, buffs are scorable events
8. **Simulated scouting data** pre-draft exhibition runs so players have stats to evaluate
9. **Flexible season length** (default 10 regular + 2-3 playoff weeks, configurable)

## Design Decisions

- Role stays fixed per class (Cleric = Healer). Specialty adds individual flavor *within* the role.
- Characters start at **level 3** with tier 1 ability already unlocked (from scouting phase).
- Death penalty is just missed XP (no additional punishment). Revivify can bring characters back mid-run.
- Revivify uses a **charge system** -- builds up charges over weeks played (e.g., one charge per 3 weeks at high enough level). Creates strategic choice of when to spend.
- Scouting runs default to **3-5** (high variance, gut-feel drafting). Configurable up to 10-20 for "veterans league" style.
- Season length configurable via league settings. XP curve targets level 12-13 for a character playing every week of the default season.
- Multiple draft formats supported by scouting data: snake (default), auction (budget + bidding using projected values), pre-ranked.

## Section 1: Character Identity Model

**Structure:**
```
Class -> Role (broad archetype, unchanged)
Class -> 2 possible Specialties (assigned at character generation)
Character = Role + Specialty + Stats + Level
```

Each character gets one of their class's two specialties at generation. This is their identity for the season.

### The 24 Specialties

| Class | Role | Specialty A | Specialty B |
|-------|------|-------------|-------------|
| Fighter | DPS | *Battle Master* (tactical strikes, bonus on positioning/multiattack) | *Champion* (crit-focused, expanded crit range) |
| Wizard | DPS | *Evoker* (AoE spell damage, targets INT) | *War Mage* (single-target burst, counterspell on arcane encounters) |
| Rogue | Utility | *Assassin* (Sneak Attack burst from stealth, first-strike bonus) | *Thief* (treasure/trap specialist, bonus find/disarm) |
| Cleric | Healer | *Life Domain* (big heals, Revivify access) | *War Domain* (Bless buff + moderate healing) |
| Ranger | DPS | *Hunter* (sustained damage, multi-target) | *Gloom Stalker* (first-round burst, ambush bonus) |
| Paladin | Tank | *Devotion* (Aura of Protection, party save bonus) | *Vengeance* (Smite burst damage while tanking) |
| Barbarian | Tank | *Berserker* (Reckless Attack, damage + self-risk) | *Totem Warrior* (damage resistance, party HP buffer) |
| Bard | Utility | *Lore* (social encounter specialist, Inspiration buff) | *Swords* (combat utility, off-DPS with finesse) |
| Druid | Healer | *Shepherd* (group healing, nature encounter bonus) | *Wildfire* (damage + heal hybrid, fire-themed) |
| Warlock | DPS | *Fiend* (sustained Eldritch Blast, dark encounters) | *Hexblade* (melee burst, curse debuff on targets) |
| Monk | DPS | *Open Hand* (sustained flurry, stun chance) | *Shadow* (stealth burst, bonus in dark/shadow dungeons) |
| Sorcerer | DPS | *Draconic* (elemental burst, theme-matched dungeon bonus) | *Wild Magic* (high variance, random bonus/penalty events) |

## Section 2: Leveling System

**XP Source:** Characters earn XP from role-relevant events during dungeon runs (tracked separately from fantasy points).

### XP Earning by Role

- **Tank:** XP from damage_taken, save_pass, party protection events
- **Healer:** XP from heal, buff, revivify events
- **DPS:** XP from hit, kill, crit events
- **Utility:** XP from disarm_trap, find_treasure, save_pass, social events

**Specialty bonus:** Events that align with your specialty earn 1.5x XP.

### Progressive Thresholds

| Level | Cumulative XP | XP for this level | What happens |
|-------|--------------|-------------------|--------------|
| 1->2 | 15 | 15 | Stat bump (+1 to primary) |
| 2->3 | 30 | 15 | **Ability unlock tier 1** |
| 3->4 | 50 | 20 | Stat bump + specialty scaling |
| 4->5 | 70 | 20 | Stat bump |
| 5->6 | 95 | 25 | **Ability unlock tier 2** |
| 6->7 | 120 | 25 | Stat bump + specialty scaling |
| 7->8 | 150 | 30 | Stat bump |
| 8->9 | 185 | 35 | **Ability unlock tier 3** |
| 9->10 | 225 | 40 | Stat bump + specialty scaling |
| 10->11 | 270 | 45 | Stat bump |
| 11->12 | 320 | 50 | **Ability unlock tier 4** |
| 12->13 | 380 | 60 | **Ability unlock tier 5** (capstone) |

### Level-Up Effects

- **Stat bumps:** +1 to the stat most relevant to the character's specialty (e.g., Champion Fighter gets STR, Evoker Wizard gets INT).
- **Specialty scaling:** At levels 4, 7, 10 the specialty's numbers improve (heal dice get bigger, crit range expands, Sneak Attack damage grows).
- **Ability unlocks:** At levels 3 (pre-draft), 6, 9, 12, 13 -- recognizable SRD abilities that change how the character interacts with encounters.

### Starting Level

Characters start at **level 3** (post-scouting exhibitions). They enter the draft with tier 1 ability already unlocked. This means:
- 4 ability unlock tiers remain during the season (tiers 2-5)
- A character playing every week of a 10-week regular season + 2 playoff weeks needs to average ~25 XP/week to reach level 12-13
- Bench time, death, and missed weeks create meaningful level gaps

## Section 3: Encounter System

### 6 Encounter Types

| Type | Primary stats | Who shines |
|------|--------------|------------|
| **Combat** | STR, DEX, INT (depends on class) | DPS, Tanks (absorb), off-DPS specialties |
| **Trap** | DEX, INT, WIS | Utility (disarm), everyone (saves) |
| **Puzzle** | INT, WIS, CHA | Utility, casters, Bards |
| **Treasure** | WIS, DEX, CHA | Utility (find), anyone (luck) |
| **Social** (new) | CHA, WIS, INT | Bards, Paladins, Warlocks, Clerics |
| **Arcane** (new) | INT, WIS, CHA | Wizards, Sorcerers, Warlocks, Druids |

### Class-Aware Combat Resolution

Characters attack using their class attack stat instead of everyone using STR:

| Class | Attack stat | Damage style |
|-------|------------|--------------|
| Fighter | STR | Multiattack (2 hits at level 6+) |
| Barbarian | STR | Heavy single hit + Rage bonus |
| Paladin | STR | Moderate hit + Smite burst |
| Ranger | DEX | Moderate hit + bonus vs. boss/beast |
| Rogue | DEX | Single hit + Sneak Attack bonus (high single-target) |
| Monk | DEX | Flurry (3 smaller hits) |
| Wizard | INT | Spell (targets encounter's weak stat) |
| Sorcerer | INT/CHA | Spell + Metamagic variance |
| Warlock | CHA | Eldritch Blast (consistent moderate damage) |
| Bard | CHA | Vicious Mockery (low damage) + Inspiration buff to ally |
| Cleric | WIS | Sacred Flame (low-moderate damage) + heal |
| Druid | WIS | Nature spell + off-heal |

### Buff Events (New)

A new event kind: `buff`. Generated by support-oriented specialties.

| Ability | Who | Effect in sim | Scoring |
|---------|-----|---------------|---------|
| **Bless** | War Domain Cleric | +1d4 to next 3 party save rolls | Buffer scores per successful save made by blessed allies |
| **Inspiration** | Lore Bard | +1d6 to one ally's next roll | Buffer scores if inspired ally succeeds |
| **Aura of Protection** | Devotion Paladin | Passive +CHA mod to party saves | Paladin scores per party save_pass within aura |
| **Guidance** | Shepherd Druid | +1d4 to one ally's ability check | Buffer scores on success |

Buffers score reactively -- their points come from allies succeeding. A good buffer on a team with high-stat DPS characters is more valuable than on a weak team. Draft synergy matters.

### Social Encounter Resolution

Social encounters test CHA, WIS, or INT. Resolution:

1. Each alive character makes a check against the encounter difficulty
2. Characters with social specialties (Lore Bard, War Domain Cleric w/ Bless) get advantage or bonuses
3. New events: `persuade`, `deceive`, `intimidate` -- scored like `save_pass` but with role multipliers for Utility and Healer
4. Failure isn't HP damage -- it's a **time penalty** (fewer remaining encounters in the dungeon, reducing total scoring opportunities)

### Arcane Encounter Resolution

Magical challenges -- wards, magical puzzles, planar rifts. Tests INT, WIS, CHA.

1. Casters get advantage or bonus dice
2. Non-casters can still attempt but at disadvantage
3. New events: `dispel`, `channel`, `arcane_surge`
4. Success grants party-wide bonuses for next encounter (buff stacking)
5. Failure deals psychic/force damage (INT-save to resist)

### Encounter Mix Per Dungeon Theme

Weighted distribution replaces uniform random:

| Theme | Combat | Trap | Puzzle | Treasure | Social | Arcane |
|-------|--------|------|--------|----------|--------|--------|
| undead | 40% | 15% | 10% | 15% | 5% | 15% |
| fire | 45% | 20% | 5% | 15% | 5% | 10% |
| shadow | 30% | 15% | 10% | 10% | 10% | 25% |
| arcane | 20% | 10% | 15% | 10% | 10% | 35% |
| demonic | 40% | 10% | 5% | 10% | 15% | 20% |
| nature | 25% | 20% | 15% | 20% | 10% | 10% |
| mechanical | 25% | 30% | 20% | 15% | 5% | 5% |
| aquatic | 30% | 20% | 10% | 20% | 5% | 15% |
| draconic | 40% | 10% | 10% | 20% | 10% | 10% |
| ice | 35% | 20% | 10% | 15% | 5% | 15% |

Dungeon theme matters for lineup decisions -- if it's arcane-heavy, you want casters active. AI managers and humans both use this for lineup strategy.

## Section 4: Scoring Rebalance

### New Event Kinds

Adding to the existing set:

| Event | Generated by | Notes |
|-------|-------------|-------|
| `buff` | Bless, Inspiration, Guidance, Aura | Support characters applying buffs |
| `buff_proc` | System (when buffed ally succeeds) | Credits the buffer for downstream success |
| `persuade` | Social encounters | CHA-based success |
| `deceive` | Social encounters | CHA/INT-based success |
| `intimidate` | Social encounters | STR/CHA-based success |
| `dispel` | Arcane encounters | Caster success |
| `channel` | Arcane encounters | Sustained arcane contribution |
| `arcane_surge` | Arcane encounters | Big caster moment |
| `block` | Tanks actively blocking | Tank-specific damage prevention |
| `taunt` | Tanks drawing aggro | Redirects damage from squishier allies |
| `multiattack` | Fighter/Monk at level 6+ | Multiple hits in one action |
| `sneak_attack` | Rogue | Bonus damage from stealth |
| `smite` | Paladin | Burst damage on hit |
| `rage` | Barbarian | Damage resistance + bonus |
| `revivify` | Life Domain Cleric | Bringing back a dead character |

### Revised Base Points

| Event kind | Points | Change from current |
|---|---|---|
| `hit` | 0.1 per dmg | unchanged |
| `kill` | +2 (boss +5) | boss kill up from +3 |
| `crit` | +1.5 | up from +1 |
| `heal` | 0.1 per hp | down from 0.15 (Healer nerf) |
| `damage_taken` | 0.1 per dmg | up from 0.05 (Tank buff) |
| `save_pass` | +1 | unchanged |
| `save_fail` | -0.5 | unchanged |
| `disarm_trap` | +2 | unchanged |
| `find_treasure` | +3 | unchanged |
| `ko` | -3 | unchanged |
| `death` | -5 | unchanged |
| `buff` | +1 | new |
| `buff_proc` | +1.5 | new (buffer gets credit) |
| `block` | +2 | new |
| `taunt` | +1.5 | new |
| `persuade` | +1.5 | new |
| `deceive` | +1.5 | new |
| `intimidate` | +1.5 | new |
| `dispel` | +2 | new |
| `channel` | +1 | new |
| `arcane_surge` | +3 | new |
| `multiattack` | +0.5 per extra hit | new |
| `sneak_attack` | 0.15 per dmg | new |
| `smite` | 0.15 per dmg | new |
| `rage` | +1 (flat, once per encounter) | new |
| `revivify` | +5 | new |

### Revised Role Multipliers

Tiered multipliers replace the flat 0.5x:

| Role | Core events (0.75x bonus) | Secondary events (0.3x bonus) |
|------|--------------------------|-------------------------------|
| **Tank** | block, taunt, damage_taken | save_pass, intimidate |
| **Healer** | heal, buff, buff_proc, revivify | save_pass, channel |
| **DPS** | hit, kill, crit, sneak_attack, smite, arcane_surge | multiattack, rage |
| **Utility** | disarm_trap, find_treasure, persuade, deceive | buff_proc, dispel |

### Specialty Scoring Bonus

On top of role multipliers, events aligning with a character's specialty get +0.25x. Examples:
- Champion Fighter critting: DPS core (0.75x) + Champion specialty (0.25x) = 2x total
- War Domain Cleric buffing: Healer core (0.75x) + War Domain specialty (0.25x) = 2x on buff events
- Life Domain Cleric healing: Healer core (0.75x) + Life Domain specialty (0.25x) = 2x on heals

Two characters of the same role but different specialties score differently on the same events.

### The Tank/Healer Balance Fix

Problem: a great Tank reduces incoming damage → less healing needed → Healer scores less.

Fix:
1. Tanks generate `block` and `taunt` events (2.0 and 1.5 base) -- new scoring paths
2. `damage_taken` doubled (0.05 → 0.1) -- Tanks score on absorbed damage
3. Heal points reduced (0.15 → 0.1) -- brings Healers toward parity
4. Buff events give Healers a new scoring vector -- War Domain scores through Bless procs even when nobody needs healing
5. Aura of Protection lets Devotion Paladins score passively on party saves

Net effect: Tanks and Healers both have multiple scoring paths. Tank-heavy lineups don't starve the Healer (buff/revivify paths remain). Healer-heavy lineups don't starve Tanks (absorbed damage scoring is self-contained).

## Section 5: Scouting System (TODO)

- Pre-draft exhibition runs (configurable count: 3-5 default, up to 20)
- Generates visible per-character stats for draft evaluation
- Enables auction draft valuations
- Deterministic (seeded from league ID)

## Section 6: Season & League Settings (TODO)

- Default: 10 regular weeks + 2-3 playoff weeks
- Configurable season length
- XP curve adapts to season length
- Scouting depth as league setting
- Draft format as league setting (snake default, auction future)
