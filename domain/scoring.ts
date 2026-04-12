import type { Character, CharacterScore, EventKind, Milestone, ScoreResult, SimEvent } from "./types";

const BASE_POINTS: Record<EventKind, number | ((e: SimEvent) => number)> = {
  hit: (e) => (e.amount ?? 0) * 0.1,
  kill: (e) => (e.meta?.boss ? 3 : 2),
  crit: 1,
  heal: (e) => (e.amount ?? 0) * 0.15,
  damage_taken: (e) => (e.amount ?? 0) * 0.05,
  save_pass: 1,
  save_fail: -0.5,
  disarm_trap: 2,
  find_treasure: 3,
  ko: -3,
  death: -5,
};

const ROLE_MULTIPLIED_EVENTS: Record<string, Set<EventKind>> = {
  Tank: new Set(["damage_taken", "save_pass"]),
  Healer: new Set(["heal", "save_pass"]),
  DPS: new Set(["hit", "kill", "crit"]),
  Utility: new Set(["disarm_trap", "find_treasure", "save_pass"]),
};

const ROLE_MULTIPLIER = 0.5;

function basePointsFor(event: SimEvent): number {
  const calc = BASE_POINTS[event.kind];
  if (typeof calc === "function") return calc(event);
  return calc;
}

export function score(events: SimEvent[], roster: Character[]): ScoreResult {
  const charMap = new Map(roster.map((c) => [c.id, c]));
  const scores = new Map<string, CharacterScore>();

  for (const char of roster) {
    scores.set(char.id, {
      characterId: char.id,
      basePoints: 0,
      roleMultiplierPoints: 0,
      milestonePoints: 0,
      totalPoints: 0,
    });
  }

  for (const event of events) {
    const cs = scores.get(event.actorId);
    if (!cs) continue;

    const base = basePointsFor(event);
    cs.basePoints += base;

    const char = charMap.get(event.actorId);
    if (char) {
      const multipliedEvents = ROLE_MULTIPLIED_EVENTS[char.role];
      if (multipliedEvents?.has(event.kind)) {
        cs.roleMultiplierPoints += base * ROLE_MULTIPLIER;
      }
    }
  }

  const milestones: Milestone[] = [];

  const hasKoOrDeath = events.some((e) => e.kind === "ko" || e.kind === "death");
  if (!hasKoOrDeath && events.length > 0) {
    milestones.push({ kind: "flawless_run" });
    for (const cs of scores.values()) {
      cs.milestonePoints += 3;
    }
  }

  const allDead = roster.every((c) => events.some((e) => e.kind === "death" && e.actorId === c.id));
  if (allDead) {
    milestones.push({ kind: "total_party_wipe" });
    for (const cs of scores.values()) {
      cs.milestonePoints += -10;
    }
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

  let mvpId: string | undefined;
  let mvpPoints = -Infinity;
  for (const cs of scores.values()) {
    const preMilestone = cs.basePoints + cs.roleMultiplierPoints;
    if (preMilestone > mvpPoints) {
      mvpPoints = preMilestone;
      mvpId = cs.characterId;
    }
  }
  if (mvpId && mvpPoints > 0) {
    milestones.push({ kind: "mvp_of_run", actorId: mvpId });
    const cs = scores.get(mvpId);
    if (cs) cs.milestonePoints += 5;
  }

  // clutch_survivor: a character was KO'd but not killed — survived clutch.
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
    cs.totalPoints = cs.basePoints + cs.roleMultiplierPoints + cs.milestonePoints;
    teamTotal += cs.totalPoints;
  }

  return { perCharacter: scores, milestones, teamTotal };
}
