import type { Character, Encounter, SimEvent, Stats } from "domain/types";
import type { Rng } from "domain/rng";
import {
  attackStatFor, critRangeFor, multiattackCount,
  hasSneakAttack, hasSmite, hasRage,
  hasAura, hasGuidance,
} from "./abilities-runtime";
import type { BuffPools } from "./buffs";

function statMod(value: number): number {
  return Math.floor((value - 10) / 2);
}

interface EncounterCtx {
  rng: Rng;
  hp: Map<string, number>;
  buffs: BuffPools;
  // Sandbox toggle: heal every wounded ally with per-target probability instead
  // of healing exactly one. Default behavior (single heal per encounter) is
  // preserved when undefined or false.
  healerMultiHeal?: boolean;
  healerMultiHealChance?: number;
}

type RollKind = "save" | "trap_save" | "skill";

interface RollResult {
  success: boolean;
  procs: SimEvent[];
}

// Roll a d20 + statMod, applying any active buffs. Emits buff_proc events
// crediting the buff source for any aura/guidance bonus or charge consumed.
function rollCheck(
  char: Character,
  targetStats: (keyof Stats)[],
  difficulty: number,
  rollKind: RollKind,
  encounterId: string,
  party: Character[],
  ctx: EncounterCtx,
): RollResult {
  const procs: SimEvent[] = [];
  const relevantStat = Math.max(...targetStats.map((s) => char.stats[s]));
  const baseRoll = ctx.rng.nextInt(1, 20);
  let bonus = statMod(relevantStat);

  const isSave = rollKind === "save" || rollKind === "trap_save";

  // Aura of Protection: any alive Devotion Paladin grants +CHA mod to party saves
  if (isSave) {
    const aura = party.find((c) =>
      c.id !== char.id && hasAura(c) && (ctx.hp.get(c.id) ?? 0) > 0,
    );
    if (aura) {
      const auraBonus = Math.max(0, statMod(aura.stats.cha));
      if (auraBonus > 0) {
        bonus += auraBonus;
        procs.push({
          kind: "buff_proc",
          encounterId,
          actorId: aura.id,
          targetId: char.id,
          meta: { buffKind: "aura" },
        });
      }
    }
  }

  // Guidance: alive Shepherd Druid grants +1d4 to trap saves
  if (rollKind === "trap_save") {
    const guidance = party.find((c) =>
      c.id !== char.id && hasGuidance(c) && (ctx.hp.get(c.id) ?? 0) > 0,
    );
    if (guidance) {
      bonus += ctx.rng.nextInt(1, 4);
      procs.push({
        kind: "buff_proc",
        encounterId,
        actorId: guidance.id,
        targetId: char.id,
        meta: { buffKind: "guidance" },
      });
    }
  }

  // Bless: consume one charge from any War Domain Cleric on saves
  if (isSave) {
    for (const [sourceId, charges] of ctx.buffs.bless) {
      if (sourceId === char.id) continue;
      if (charges <= 0) continue;
      ctx.buffs.bless.set(sourceId, charges - 1);
      bonus += ctx.rng.nextInt(1, 4);
      procs.push({
        kind: "buff_proc",
        encounterId,
        actorId: sourceId,
        targetId: char.id,
        meta: { buffKind: "bless" },
      });
      break;
    }
  }

  // Inspiration: consume one charge from any Lore Bard on skill checks
  if (rollKind === "skill") {
    for (const [sourceId, charges] of ctx.buffs.inspiration) {
      if (sourceId === char.id) continue;
      if (charges <= 0) continue;
      ctx.buffs.inspiration.set(sourceId, charges - 1);
      bonus += ctx.rng.nextInt(1, 6);
      procs.push({
        kind: "buff_proc",
        encounterId,
        actorId: sourceId,
        targetId: char.id,
        meta: { buffKind: "inspiration" },
      });
      break;
    }
  }

  const success = baseRoll + bonus >= difficulty + 10;
  return { success, procs };
}

export function resolveCombat(
  chars: Character[],
  encounter: Encounter,
  ctx: EncounterCtx,
): SimEvent[] {
  const { rng, hp } = ctx;
  const events: SimEvent[] = [];

  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;

    const attackStat = attackStatFor(char);
    const critOn = critRangeFor(char);
    const extraAttacks = multiattackCount(char);
    const totalAttacks = 1 + extraAttacks;
    const hitDamages: number[] = [];

    for (let attackIdx = 0; attackIdx < totalAttacks; attackIdx++) {
      const d20 = rng.nextInt(1, 20);
      const isCrit = d20 >= critOn;
      let damage = rng.nextInt(3, 12) + statMod(char.stats[attackStat]);
      if (isCrit) damage = Math.floor(damage * 1.5);
      damage = Math.max(damage, 1);

      hitDamages.push(damage);
      events.push({
        kind: "hit", encounterId: encounter.id, actorId: char.id,
        targetId: encounter.id, amount: damage, crit: isCrit,
      });
      if (isCrit) {
        events.push({ kind: "crit", encounterId: encounter.id, actorId: char.id, amount: damage });
      }
    }

    if (extraAttacks > 0) {
      events.push({
        kind: "multiattack", encounterId: encounter.id, actorId: char.id, amount: extraAttacks,
      });
    }

    if (hasSneakAttack(char) && hitDamages.length > 0) {
      const bonus = rng.nextInt(2, 6 * Math.max(1, Math.floor(char.level / 4)));
      events.push({
        kind: "sneak_attack", encounterId: encounter.id, actorId: char.id, amount: bonus,
      });
    }

    if (hasSmite(char) && hitDamages.length > 0 && rng.next() < 0.4) {
      const bonus = rng.nextInt(4, 12);
      events.push({
        kind: "smite", encounterId: encounter.id, actorId: char.id, amount: bonus,
      });
    }

    const raging = hasRage(char);
    if (raging) {
      events.push({ kind: "rage", encounterId: encounter.id, actorId: char.id });
    }

    let damageTaken = Math.max(rng.nextInt(1, encounter.difficulty * 2) - statMod(char.stats.con), 0);
    if (raging) damageTaken = Math.floor(damageTaken / 2);

    if (damageTaken > 0) {
      events.push({
        kind: "damage_taken", encounterId: encounter.id, actorId: char.id, amount: damageTaken,
      });
      const currentHp = hp.get(char.id) ?? 0;
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
      .filter((e) => e.kind === "hit" || e.kind === "sneak_attack" || e.kind === "smite")
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);

    if (totalDamage >= encounter.difficulty * 8) {
      const killer = rng.pick(aliveChars);
      events.push({
        kind: "kill", encounterId: encounter.id, actorId: killer.id,
        targetId: encounter.id, meta: { boss: encounter.isBoss },
      });
    }
  }

  for (const char of chars) {
    if (char.role !== "Tank" || (hp.get(char.id) ?? 0) <= 0) continue;
    if (rng.next() < 0.5) {
      events.push({ kind: "block", encounterId: encounter.id, actorId: char.id });
    }
    if (rng.next() < 0.3) {
      events.push({ kind: "taunt", encounterId: encounter.id, actorId: char.id });
    }
  }

  const healer = chars.find((c) => c.role === "Healer" && (hp.get(c.id) ?? 0) > 0);
  if (healer) {
    const woundedChars = chars.filter((c) => {
      const currentHp = hp.get(c.id) ?? 0;
      const maxHp = 10 + c.stats.con;
      return currentHp > 0 && currentHp < maxHp;
    });
    if (ctx.healerMultiHeal) {
      const chance = ctx.healerMultiHealChance ?? 0.6;
      for (const target of woundedChars) {
        if (rng.next() >= chance) continue;
        const healAmount = Math.max(rng.nextInt(2, 8) + statMod(healer.stats.wis), 1);
        events.push({
          kind: "heal", encounterId: encounter.id, actorId: healer.id,
          targetId: target.id, amount: healAmount,
        });
        hp.set(target.id, (hp.get(target.id) ?? 0) + healAmount);
      }
    } else if (woundedChars.length > 0) {
      const target = rng.pick(woundedChars);
      const healAmount = Math.max(rng.nextInt(2, 8) + statMod(healer.stats.wis), 1);
      events.push({
        kind: "heal", encounterId: encounter.id, actorId: healer.id,
        targetId: target.id, amount: healAmount,
      });
      hp.set(target.id, (hp.get(target.id) ?? 0) + healAmount);
    }
  }

  return events;
}

export function resolveTrap(chars: Character[], encounter: Encounter, ctx: EncounterCtx): SimEvent[] {
  const { rng, hp } = ctx;
  const events: SimEvent[] = [];

  const utilityChar = chars.find((c) => c.role === "Utility" && (hp.get(c.id) ?? 0) > 0);
  if (utilityChar) {
    const result = rollCheck(utilityChar, encounter.targetStats, encounter.difficulty, "skill", encounter.id, chars, ctx);
    events.push(...result.procs);
    if (result.success) {
      events.push({ kind: "disarm_trap", encounterId: encounter.id, actorId: utilityChar.id });
      return events;
    }
  }

  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;
    const result = rollCheck(char, encounter.targetStats, encounter.difficulty, "trap_save", encounter.id, chars, ctx);
    events.push(...result.procs);
    if (result.success) {
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

export function resolvePuzzle(chars: Character[], encounter: Encounter, ctx: EncounterCtx): SimEvent[] {
  const { hp } = ctx;
  const events: SimEvent[] = [];
  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;
    const result = rollCheck(char, encounter.targetStats, encounter.difficulty, "save", encounter.id, chars, ctx);
    events.push(...result.procs);
    if (result.success) {
      events.push({ kind: "save_pass", encounterId: encounter.id, actorId: char.id });
    } else {
      events.push({ kind: "save_fail", encounterId: encounter.id, actorId: char.id });
    }
  }
  return events;
}

export function resolveTreasure(chars: Character[], encounter: Encounter, ctx: EncounterCtx): SimEvent[] {
  const { rng, hp } = ctx;
  const events: SimEvent[] = [];
  const aliveChars = chars.filter((c) => (hp.get(c.id) ?? 0) > 0);
  if (aliveChars.length === 0) return events;
  const finder = rng.pick(aliveChars);
  events.push({ kind: "find_treasure", encounterId: encounter.id, actorId: finder.id });
  return events;
}

export function resolveSocial(chars: Character[], encounter: Encounter, ctx: EncounterCtx): SimEvent[] {
  const { hp } = ctx;
  const events: SimEvent[] = [];
  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;
    const result = rollCheck(char, encounter.targetStats, encounter.difficulty, "skill", encounter.id, chars, ctx);
    events.push(...result.procs);
    let kind: "persuade" | "deceive" | "intimidate";
    if (char.stats.cha >= char.stats.str && char.stats.cha >= char.stats.int) kind = "persuade";
    else if (char.stats.int >= char.stats.str) kind = "deceive";
    else kind = "intimidate";
    if (result.success) {
      events.push({ kind, encounterId: encounter.id, actorId: char.id });
    } else {
      events.push({ kind: "save_fail", encounterId: encounter.id, actorId: char.id });
    }
  }
  return events;
}

export function resolveArcane(chars: Character[], encounter: Encounter, ctx: EncounterCtx): SimEvent[] {
  const { rng, hp } = ctx;
  const events: SimEvent[] = [];
  const casterClasses = new Set(["Wizard", "Sorcerer", "Warlock", "Druid", "Cleric", "Bard"]);

  for (const char of chars) {
    if ((hp.get(char.id) ?? 0) <= 0) continue;
    const isCaster = casterClasses.has(char.class);
    const checkDifficulty = isCaster ? encounter.difficulty - 2 : encounter.difficulty + 2;
    const result = rollCheck(char, encounter.targetStats, checkDifficulty, "save", encounter.id, chars, ctx);
    events.push(...result.procs);

    if (result.success) {
      if (isCaster) {
        const roll = rng.next();
        if (roll < 0.3) {
          events.push({ kind: "arcane_surge", encounterId: encounter.id, actorId: char.id });
        } else if (roll < 0.6) {
          events.push({ kind: "dispel", encounterId: encounter.id, actorId: char.id });
        } else {
          events.push({ kind: "channel", encounterId: encounter.id, actorId: char.id });
        }
      } else {
        events.push({ kind: "save_pass", encounterId: encounter.id, actorId: char.id });
      }
    } else {
      events.push({ kind: "save_fail", encounterId: encounter.id, actorId: char.id });
      const dmg = rng.nextInt(2, 6);
      events.push({ kind: "damage_taken", encounterId: encounter.id, actorId: char.id, amount: dmg });
      const currentHp = hp.get(char.id)!;
      hp.set(char.id, Math.max(0, currentHp - dmg));
      if (currentHp - dmg <= 0) {
        events.push({ kind: "ko", encounterId: encounter.id, actorId: char.id });
        hp.set(char.id, 1);
      }
    }
  }
  return events;
}

export type { EncounterCtx };
