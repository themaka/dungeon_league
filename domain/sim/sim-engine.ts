import type { Character, Dungeon, Lineup, SimEvent } from "domain/types";
import type { Rng } from "domain/rng";
import {
  resolveCombat, resolveTrap, resolvePuzzle, resolveTreasure,
  resolveSocial, resolveArcane,
  type EncounterCtx,
} from "./encounters";
import { newBuffState } from "./buffs";

export function runDungeon(
  lineup: Lineup,
  characterMap: Map<string, Character>,
  dungeon: Dungeon,
  rng: Rng,
): SimEvent[] {
  const activeChars = lineup.active.map((id) => characterMap.get(id)!);
  const hp = new Map<string, number>();
  for (const char of activeChars) {
    hp.set(char.id, 10 + char.stats.con);
  }

  const allEvents: SimEvent[] = [];

  for (const encounter of dungeon.encounters) {
    const alive = activeChars.filter((c) => (hp.get(c.id) ?? 0) > 0);
    if (alive.length === 0) break;

    const ctx: EncounterCtx = { rng, hp, buffs: newBuffState() };

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
  }

  return allEvents;
}
