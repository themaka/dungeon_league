import type { AIPersonality, Character, Dungeon, Lineup, Stats } from "./types";
import type { Rng } from "./rng";

export class AIManager {
  constructor(private personality: AIPersonality) {}

  makeDraftPick(available: Character[], currentRoster: Character[], rng: Rng): Character {
    const ownedRoles = new Set(currentRoster.map((c) => c.role));
    const neededPriorityRoles = this.personality.priorityRoles.filter((r) => !ownedRoles.has(r));

    if (neededPriorityRoles.length > 0) {
      const candidates = available.filter((c) => neededPriorityRoles.includes(c.role));
      if (candidates.length > 0) {
        return this.pickByStat(candidates, rng);
      }
    }

    const priorityCandidates = available.filter((c) => this.personality.priorityRoles.includes(c.role));
    if (priorityCandidates.length > 0 && rng.next() < this.personality.aggression) {
      return this.pickByStat(priorityCandidates, rng);
    }

    return this.pickByStat(available, rng);
  }

  setLineup(roster: Character[], dungeon: Dungeon, rng: Rng): Lineup {
    const targetStats = new Set<keyof Stats>();
    for (const enc of dungeon.encounters) {
      for (const stat of enc.targetStats) {
        targetStats.add(stat);
      }
    }

    const scored = roster.map((char) => {
      let relevance = 0;
      for (const stat of targetStats) {
        relevance += char.stats[stat];
      }
      if (this.personality.priorityRoles.includes(char.role)) {
        relevance += 10;
      }
      relevance += rng.next() * 5;
      return { char, relevance };
    });

    scored.sort((a, b) => b.relevance - a.relevance);
    const active = scored.slice(0, 4).map((s) => s.char.id) as [string, string, string, string];
    const bench = scored.slice(4, 6).map((s) => s.char.id) as [string, string];

    return { active, bench };
  }

  private pickByStat(candidates: Character[], rng: Rng): Character {
    const sorted = [...candidates].sort((a, b) => {
      const aTotal = Object.values(a.stats).reduce((s, v) => s + v, 0);
      const bTotal = Object.values(b.stats).reduce((s, v) => s + v, 0);
      return bTotal - aTotal;
    });
    const topCount = Math.max(1, Math.ceil(sorted.length * 0.3));
    return rng.pick(sorted.slice(0, topCount));
  }
}

export const AI_PERSONALITIES: AIPersonality[] = [
  { name: "Iron Wall", priorityRoles: ["Tank", "Healer"], aggression: 0.8, seed: 1 },
  { name: "Glass Cannon", priorityRoles: ["DPS", "DPS"], aggression: 0.9, seed: 2 },
  { name: "Balanced General", priorityRoles: ["Tank", "DPS"], aggression: 0.5, seed: 3 },
  { name: "Treasure Hunter", priorityRoles: ["Utility", "DPS"], aggression: 0.6, seed: 4 },
  { name: "Mystic Circle", priorityRoles: ["Healer", "Utility"], aggression: 0.7, seed: 5 },
];
