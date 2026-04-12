import type { Character, Encounter, SimEvent, Stats } from "domain/types";
import type { Rng } from "domain/rng";

function statCheck(char: Character, targetStats: (keyof Stats)[], difficulty: number, rng: Rng): boolean {
  const relevantStat = Math.max(...targetStats.map((s) => char.stats[s]));
  const roll = rng.nextInt(1, 20);
  return roll + Math.floor((relevantStat - 10) / 2) >= difficulty + 10;
}

export function resolveCombat(
  chars: Character[],
  encounter: Encounter,
  rng: Rng,
  hp: Map<string, number>,
): SimEvent[] {
  const events: SimEvent[] = [];

  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;

    const isCrit = rng.nextInt(1, 20) === 20;
    let damage = rng.nextInt(3, 12) + Math.floor((char.stats.str - 10) / 2);
    if (isCrit) damage = Math.floor(damage * 1.5);

    events.push({
      kind: "hit",
      encounterId: encounter.id,
      actorId: char.id,
      targetId: encounter.id,
      amount: Math.max(damage, 1),
      crit: isCrit,
    });

    if (isCrit) {
      events.push({
        kind: "crit",
        encounterId: encounter.id,
        actorId: char.id,
        amount: damage,
      });
    }

    const damageTaken = Math.max(rng.nextInt(1, encounter.difficulty * 2) - Math.floor((char.stats.con - 10) / 2), 0);
    if (damageTaken > 0) {
      events.push({
        kind: "damage_taken",
        encounterId: encounter.id,
        actorId: char.id,
        amount: damageTaken,
      });

      const currentHp = hp.get(char.id)!;
      hp.set(char.id, currentHp - damageTaken);

      if (currentHp - damageTaken <= 0) {
        hp.set(char.id, 0);
        if (rng.next() < 0.3) {
          events.push({ kind: "death", encounterId: encounter.id, actorId: char.id });
        } else {
          events.push({ kind: "ko", encounterId: encounter.id, actorId: char.id });
          hp.set(char.id, 1);
        }
      }
    }
  }

  const aliveChars = chars.filter((c) => (hp.get(c.id) ?? 0) > 0);
  if (aliveChars.length > 0) {
    const totalDamage = events
      .filter((e) => e.kind === "hit")
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);

    if (totalDamage >= encounter.difficulty * 8) {
      const killer = rng.pick(aliveChars);
      events.push({
        kind: "kill",
        encounterId: encounter.id,
        actorId: killer.id,
        targetId: encounter.id,
        meta: { boss: encounter.isBoss },
      });
    }
  }

  if (chars.some((c) => c.role === "Healer" && (hp.get(c.id) ?? 0) > 0)) {
    const healer = chars.find((c) => c.role === "Healer" && (hp.get(c.id) ?? 0) > 0)!;
    const woundedChars = chars.filter((c) => {
      const currentHp = hp.get(c.id) ?? 0;
      const maxHp = 10 + c.stats.con;
      return currentHp > 0 && currentHp < maxHp;
    });
    if (woundedChars.length > 0) {
      const target = rng.pick(woundedChars);
      const healAmount = rng.nextInt(2, 8) + Math.floor((healer.stats.wis - 10) / 2);
      events.push({
        kind: "heal",
        encounterId: encounter.id,
        actorId: healer.id,
        targetId: target.id,
        amount: Math.max(healAmount, 1),
      });
      hp.set(target.id, (hp.get(target.id) ?? 0) + Math.max(healAmount, 1));
    }
  }

  return events;
}

export function resolveTrap(
  chars: Character[],
  encounter: Encounter,
  rng: Rng,
  hp: Map<string, number>,
): SimEvent[] {
  const events: SimEvent[] = [];

  const utilityChar = chars.find((c) => c.role === "Utility" && (hp.get(c.id) ?? 0) > 0);
  if (utilityChar && statCheck(utilityChar, encounter.targetStats, encounter.difficulty, rng)) {
    events.push({
      kind: "disarm_trap",
      encounterId: encounter.id,
      actorId: utilityChar.id,
    });
    return events;
  }

  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;
    if (statCheck(char, encounter.targetStats, encounter.difficulty, rng)) {
      events.push({ kind: "save_pass", encounterId: encounter.id, actorId: char.id });
    } else {
      events.push({ kind: "save_fail", encounterId: encounter.id, actorId: char.id });
      const dmg = rng.nextInt(2, 8);
      events.push({ kind: "damage_taken", encounterId: encounter.id, actorId: char.id, amount: dmg });
      const currentHp = hp.get(char.id)!;
      hp.set(char.id, currentHp - dmg);
      if (currentHp - dmg <= 0) {
        hp.set(char.id, 0);
        events.push({ kind: "ko", encounterId: encounter.id, actorId: char.id });
        hp.set(char.id, 1);
      }
    }
  }

  return events;
}

export function resolvePuzzle(
  chars: Character[],
  encounter: Encounter,
  rng: Rng,
  hp: Map<string, number>,
): SimEvent[] {
  const events: SimEvent[] = [];

  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;
    if (statCheck(char, encounter.targetStats, encounter.difficulty, rng)) {
      events.push({ kind: "save_pass", encounterId: encounter.id, actorId: char.id });
    } else {
      events.push({ kind: "save_fail", encounterId: encounter.id, actorId: char.id });
    }
  }

  return events;
}

export function resolveTreasure(
  chars: Character[],
  encounter: Encounter,
  rng: Rng,
  hp: Map<string, number>,
): SimEvent[] {
  const events: SimEvent[] = [];
  const aliveChars = chars.filter((c) => (hp.get(c.id) ?? 0) > 0);
  if (aliveChars.length === 0) return events;

  const finder = rng.pick(aliveChars);
  events.push({
    kind: "find_treasure",
    encounterId: encounter.id,
    actorId: finder.id,
  });

  return events;
}
