import type { Character, EventKind, LeagueSettings, Role, SimEvent } from "./types";
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
    const isRoleEvent = roleSet.has(event.kind);
    const isSpecialtyCore = isCoreEventForSpecialty(character.specialty, event.kind);
    if (!isRoleEvent && !isSpecialtyCore) continue;
    const base = xpAmountForEvent(event);
    const mult = xpMultiplierFor(character, isRoleEvent, isSpecialtyCore);
    // Round per-event then aggregate so each event credits an integer; final
    // multiplier rounded once at the end. Order matters for calibration.
    total += Math.round(base * mult);
  }
  return Math.round(total * XP_AWARD_MULTIPLIER);
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

/**
 * Levels at which the character receives a +1 stat bump from regular leveling.
 * MUST match procedural-source.ts statBumpsForLevel — starting stats for
 * characters generated above level 3 are derived using these same sets.
 */
export const STAT_BUMP_LEVELS = new Set([2, 5, 8, 11, 14, 17]);

/**
 * Levels at which the character's specialty mechanic improves AND receives a
 * +1 primary stat bump. Disjoint from STAT_BUMP_LEVELS.
 */
export const SCALING_LEVELS = new Set([4, 7, 10, 16, 19]);

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

    const stat = primaryStatForSpecialty(next.specialty);

    if (STAT_BUMP_LEVELS.has(next.level)) {
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
  if (settings.seasonWeeks <= 0) return 1.0;
  return (baselineRange * settings.seasonWeeks) / (presetRange * baselineWeeks);
}
