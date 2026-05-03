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

## Section 3: Encounter System (TODO)

- Richer resolution: classes interact differently with same encounter types
- New encounter types: social, arcane
- Buff events (Bless, Inspiration) as scorable actions
- Theme-matching bonuses (Draconic Sorcerer in draconic dungeon)

## Section 4: Scoring Rebalance (TODO)

- Buff/Bless events scorable
- Tank scoring doesn't penalize healers
- Specialty-aligned events score higher
- New event types for new encounter types

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
