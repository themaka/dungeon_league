import type { Character, Dungeon, Lineup, SimEvent } from "domain/types";
import type { Rng } from "domain/rng";
import {
  resolveCombat, resolveTrap, resolvePuzzle, resolveTreasure,
  resolveSocial, resolveArcane,
  type EncounterCtx,
} from "./encounters";
import { newBuffPools } from "./buffs";
import {
  hasRevivify, hasBless, hasInspiration, chargesForLevel,
} from "./abilities-runtime";

export interface RunDungeonOptions {
  // Optional override for revivify charges. If omitted, charges are derived from
  // each Life Domain Cleric's level.
  revivifyCharges?: Record<string, number>;
}

export function runDungeon(
  lineup: Lineup,
  characterMap: Map<string, Character>,
  dungeon: Dungeon,
  rng: Rng,
  options: RunDungeonOptions = {},
): SimEvent[] {
  const activeChars = lineup.active.map((id) => characterMap.get(id)!);
  const hp = new Map<string, number>();
  for (const char of activeChars) {
    hp.set(char.id, 10 + char.stats.con);
  }

  // Compute buff pools at matchup start; charges last the whole run.
  const buffs = newBuffPools();
  for (const char of activeChars) {
    if (hasBless(char))       buffs.bless.set(char.id, chargesForLevel(char.level));
    if (hasInspiration(char)) buffs.inspiration.set(char.id, chargesForLevel(char.level));
    if (hasRevivify(char))    buffs.revivify.set(char.id, chargesForLevel(char.level));
  }

  // Test override: explicit revivifyCharges replaces level-derived values.
  if (options.revivifyCharges) {
    buffs.revivify.clear();
    for (const [id, n] of Object.entries(options.revivifyCharges)) {
      buffs.revivify.set(id, n);
    }
  }

  const allEvents: SimEvent[] = [];

  for (const encounter of dungeon.encounters) {
    const alive = activeChars.filter((c) => (hp.get(c.id) ?? 0) > 0);
    if (alive.length === 0) break;

    const ctx: EncounterCtx = { rng, hp, buffs };

    let events: SimEvent[] = [];
    switch (encounter.type) {
      case "combat":   events = resolveCombat(alive, encounter, ctx); break;
      case "trap":     events = resolveTrap(alive, encounter, ctx); break;
      case "puzzle":   events = resolvePuzzle(alive, encounter, ctx); break;
      case "treasure": events = resolveTreasure(alive, encounter, ctx); break;
      case "social":   events = resolveSocial(alive, encounter, ctx); break;
      case "arcane":   events = resolveArcane(alive, encounter, ctx); break;
    }
    allEvents.push(...events);

    // Post-encounter: attempt revivify if anyone died and a Life Domain Cleric is alive with charges
    const cleric = activeChars.find((c) => hasRevivify(c) && (hp.get(c.id) ?? 0) > 0);
    if (cleric && (buffs.revivify.get(cleric.id) ?? 0) > 0) {
      const dead = events.find((e) => e.kind === "death");
      if (dead) {
        buffs.revivify.set(cleric.id, (buffs.revivify.get(cleric.id) ?? 0) - 1);
        hp.set(dead.actorId, 5);
        allEvents.push({
          kind: "revivify", encounterId: encounter.id,
          actorId: cleric.id, targetId: dead.actorId,
        });
      }
    }
  }

  return allEvents;
}
