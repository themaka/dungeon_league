import type {
  Character, CharacterScore, EventKind, Milestone, ScoreResult, SimEvent,
} from "./types";
import { isCoreEventForSpecialty } from "./specialties";

const BASE_POINTS: Record<EventKind, number | ((e: SimEvent) => number)> = {
  hit: (e) => (e.amount ?? 0) * 0.12,
  kill: (e) => (e.meta?.boss ? 7 : 2),
  crit: 1.5,
  heal: (e) => (e.amount ?? 0) * 0.1,
  damage_taken: (e) => (e.amount ?? 0) * 0.1,
  save_pass: 1,
  save_fail: -0.5,
  disarm_trap: 2,
  find_treasure: 3,
  ko: -3,
  death: -5,
  buff: 1,
  buff_proc: 1.5,
  block: 2,
  taunt: 1.5,
  persuade: 1.5,
  deceive: 1.5,
  intimidate: 1.5,
  dispel: 2,
  channel: 1,
  arcane_surge: 3,
  multiattack: (e) => (e.amount ?? 0) * 0.5,
  sneak_attack: (e) => (e.amount ?? 0) * 0.15,
  smite: (e) => (e.amount ?? 0) * 0.15,
  rage: 1,
  revivify: 5,
};

// Role multipliers — events that magnify scoring for matching roles.
// Penalty events (save_fail, ko, death) are intentionally excluded:
// they apply equally to all roles and don't warrant role-based amplification.
const ROLE_CORE_EVENTS: Record<string, Set<EventKind>> = {
  Tank: new Set(["block", "taunt", "damage_taken"]),
  Healer: new Set(["heal", "buff", "buff_proc", "revivify"]),
  DPS: new Set(["hit", "kill", "crit", "sneak_attack", "smite", "arcane_surge"]),
  Utility: new Set(["disarm_trap", "find_treasure", "persuade", "deceive"]),
};

const ROLE_SECONDARY_EVENTS: Record<string, Set<EventKind>> = {
  Tank: new Set(["save_pass", "intimidate"]),
  Healer: new Set(["save_pass", "channel"]),
  DPS: new Set(["multiattack", "rage"]),
  Utility: new Set(["buff_proc", "dispel"]),
};

const ROLE_CORE_MULT = 0.75;
const ROLE_SECONDARY_MULT = 0.3;
const SPECIALTY_BONUS_MULT = 0.25;

function basePointsFor(event: SimEvent): number {
  const calc = BASE_POINTS[event.kind];
  if (calc === undefined) return 0;
  if (typeof calc === "function") return calc(event);
  return calc;
}

export function pointsForEvent(event: SimEvent, character: Character): number {
  const base = basePointsFor(event);
  let total = base;
  const core = ROLE_CORE_EVENTS[character.role];
  const secondary = ROLE_SECONDARY_EVENTS[character.role];
  if (core?.has(event.kind)) total += base * ROLE_CORE_MULT;
  else if (secondary?.has(event.kind)) total += base * ROLE_SECONDARY_MULT;
  if (isCoreEventForSpecialty(character.specialty, event.kind)) {
    total += base * SPECIALTY_BONUS_MULT;
  }
  return total;
}

export function score(events: SimEvent[], roster: Character[]): ScoreResult {
  const charMap = new Map(roster.map((c) => [c.id, c]));
  const scores = new Map<string, CharacterScore>();

  for (const char of roster) {
    scores.set(char.id, {
      characterId: char.id,
      basePoints: 0,
      roleMultiplierPoints: 0,
      specialtyBonusPoints: 0,
      milestonePoints: 0,
      totalPoints: 0,
    });
  }

  for (const event of events) {
    const cs = scores.get(event.actorId);
    if (!cs) continue;
    const char = charMap.get(event.actorId);
    if (!char) continue;

    const base = basePointsFor(event);
    cs.basePoints += base;

    const core = ROLE_CORE_EVENTS[char.role];
    const secondary = ROLE_SECONDARY_EVENTS[char.role];
    if (core?.has(event.kind)) {
      cs.roleMultiplierPoints += base * ROLE_CORE_MULT;
    } else if (secondary?.has(event.kind)) {
      cs.roleMultiplierPoints += base * ROLE_SECONDARY_MULT;
    }

    if (isCoreEventForSpecialty(char.specialty, event.kind)) {
      cs.specialtyBonusPoints += base * SPECIALTY_BONUS_MULT;
    }
  }

  const milestones: Milestone[] = [];

  const hasKoOrDeath = events.some((e) => e.kind === "ko" || e.kind === "death");
  if (!hasKoOrDeath && events.length > 0) {
    milestones.push({ kind: "flawless_run" });
    for (const cs of scores.values()) cs.milestonePoints += 3;
  }

  const allDead = roster.every((c) => events.some((e) => e.kind === "death" && e.actorId === c.id));
  if (allDead && roster.length > 0) {
    milestones.push({ kind: "total_party_wipe" });
    for (const cs of scores.values()) cs.milestonePoints += -10;
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

  const deadIds = new Set<string>();
  for (const e of events) {
    if (e.kind === "death") deadIds.add(e.actorId);
    if (e.kind === "revivify" && e.targetId && deadIds.has(e.targetId)) {
      milestones.push({ kind: "revivify_save", actorId: e.actorId });
      const cs = scores.get(e.actorId);
      if (cs) cs.milestonePoints += 3;
      deadIds.delete(e.targetId);
    }
  }

  let mvpId: string | undefined;
  let mvpPoints = -Infinity;
  for (const cs of scores.values()) {
    const pre = cs.basePoints + cs.roleMultiplierPoints + cs.specialtyBonusPoints;
    if (pre > mvpPoints) {
      mvpPoints = pre;
      mvpId = cs.characterId;
    }
  }
  if (mvpId && mvpPoints > 0) {
    milestones.push({ kind: "mvp_of_run", actorId: mvpId });
    const cs = scores.get(mvpId);
    if (cs) cs.milestonePoints += 5;
  }

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
    cs.totalPoints =
      cs.basePoints + cs.roleMultiplierPoints + cs.specialtyBonusPoints + cs.milestonePoints;
    teamTotal += cs.totalPoints;
  }

  return { perCharacter: scores, milestones, teamTotal };
}
