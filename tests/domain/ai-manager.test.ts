import { describe, it, expect } from "vitest";
import { AIManager } from "domain/ai-manager";
import { createRng } from "domain/rng";
import type { Character, AIPersonality, Dungeon } from "domain/types";

function makePool(): Character[] {
  const roles = ["Tank", "Healer", "DPS", "Utility"] as const;
  return Array.from({ length: 20 }, (_, i) => ({
    id: `char-${i}`,
    name: `Hero ${i}`,
    race: "Human" as const,
    class: "Fighter" as const,
    role: roles[i % 4],
    stats: { str: 10 + i, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    level: 1,
    description: `test ${i}`,
  }));
}

describe("AIManager", () => {
  const personality: AIPersonality = {
    name: "TankLover",
    priorityRoles: ["Tank", "Healer"],
    aggression: 0.7,
    seed: 42,
  };

  it("makeDraftPick returns a character from the available pool", () => {
    const ai = new AIManager(personality);
    const pool = makePool();
    const pick = ai.makeDraftPick(pool, [], createRng(42));
    expect(pool).toContain(pick);
  });

  it("prioritizes characters matching priority roles", () => {
    const ai = new AIManager(personality);
    const pool = makePool();
    const pick = ai.makeDraftPick(pool, [], createRng(42));
    expect(["Tank", "Healer"]).toContain(pick.role);
  });

  it("fills gaps in roster before doubling up on roles", () => {
    const ai = new AIManager(personality);
    const pool = makePool();
    const existingRoster = pool.filter((c) => c.role === "Tank").slice(0, 2);
    const pick = ai.makeDraftPick(pool.filter((c) => !existingRoster.includes(c)), existingRoster, createRng(42));
    expect(pick.role).toBe("Healer");
  });

  it("setLineup returns 4 active and 2 bench from a 6-char roster", () => {
    const ai = new AIManager(personality);
    const roster = makePool().slice(0, 6);
    const dungeon: Dungeon = {
      id: "d1", name: "Test", theme: "fire",
      encounters: [
        { id: "e1", type: "combat", name: "mob", difficulty: 5, targetStats: ["str"], isBoss: false },
      ],
    };
    const lineup = ai.setLineup(roster, dungeon, createRng(42));
    expect(lineup.active).toHaveLength(4);
    expect(lineup.bench).toHaveLength(2);
    const all = [...lineup.active, ...lineup.bench];
    expect(new Set(all).size).toBe(6);
  });

  it("setLineup is deterministic", () => {
    const ai = new AIManager(personality);
    const roster = makePool().slice(0, 6);
    const dungeon: Dungeon = {
      id: "d1", name: "Test", theme: "fire",
      encounters: [{ id: "e1", type: "combat", name: "mob", difficulty: 5, targetStats: ["str"], isBoss: false }],
    };
    const l1 = ai.setLineup(roster, dungeon, createRng(42));
    const l2 = ai.setLineup(roster, dungeon, createRng(42));
    expect(l1).toEqual(l2);
  });
});
