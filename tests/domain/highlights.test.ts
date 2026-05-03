import { describe, it, expect } from "vitest";
import { generateHighlights } from "domain/highlights";
import type { SimEvent, Character, Dungeon, Highlight } from "domain/types";

function makeChar(id: string, role: "Tank" | "Healer" | "DPS" | "Utility"): Character {
  return {
    id, name: `Hero ${id}`, race: "Human", class: "Fighter", role,
    specialty: "Champion",
    stats: { str: 14, dex: 12, con: 13, int: 10, wis: 10, cha: 10 },
    level: 1, xp: 0, abilityTiers: [], description: "test",
  };
}

const dungeon: Dungeon = {
  id: "d1", name: "Test Dungeon", theme: "undead",
  encounters: [
    { id: "e1", type: "combat", name: "Skeletons", difficulty: 5, targetStats: ["str"], isBoss: false },
    { id: "e2", type: "combat", name: "Lich", difficulty: 9, targetStats: ["int"], isBoss: true },
  ],
};

describe("highlight generator", () => {
  it("generates highlights for crit events", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "crit", encounterId: "e1", actorId: "a", amount: 15 },
    ];
    const highlights = generateHighlights(events, chars, dungeon);
    expect(highlights.some((h) => h.kind === "crit")).toBe(true);
  });

  it("generates highlights for kills", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "kill", encounterId: "e1", actorId: "a", meta: { boss: false } },
    ];
    const highlights = generateHighlights(events, chars, dungeon);
    expect(highlights.some((h) => h.kind === "kill")).toBe(true);
  });

  it("generates high-importance highlight for boss kills", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "kill", encounterId: "e2", actorId: "a", meta: { boss: true } },
    ];
    const highlights = generateHighlights(events, chars, dungeon);
    const bossHighlight = highlights.find((h) => h.kind === "boss_kill");
    expect(bossHighlight).toBeDefined();
    expect(bossHighlight!.importance).toBe("high");
  });

  it("generates highlight for death events", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "death", encounterId: "e1", actorId: "a" },
    ];
    const highlights = generateHighlights(events, chars, dungeon);
    expect(highlights.some((h) => h.kind === "death")).toBe(true);
  });

  it("highlights have descriptions", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "crit", encounterId: "e1", actorId: "a", amount: 20 },
      { kind: "kill", encounterId: "e1", actorId: "a", meta: { boss: false } },
    ];
    const highlights = generateHighlights(events, chars, dungeon);
    for (const h of highlights) {
      expect(h.description).toBeTruthy();
    }
  });

  it("limits highlights to ~10 per run", () => {
    const chars = [makeChar("a", "DPS"), makeChar("b", "Tank")];
    const events: SimEvent[] = [];
    for (let i = 0; i < 50; i++) {
      events.push({ kind: "crit", encounterId: "e1", actorId: "a", amount: 10 + i });
    }
    const highlights = generateHighlights(events, chars, dungeon);
    expect(highlights.length).toBeLessThanOrEqual(10);
  });
});

describe("highlights — new events", () => {
  it("generates a revivify highlight", () => {
    const cleric: Character = {
      id: "cl", name: "Cleric", race: "Human", class: "Cleric", role: "Healer",
      specialty: "Life Domain",
      stats: { str: 8, dex: 10, con: 12, int: 10, wis: 18, cha: 12 },
      level: 6, xp: 0, abilityTiers: [1, 2], description: "",
    };
    const target: Character = {
      ...cleric, id: "t", class: "Fighter", role: "DPS", specialty: "Champion",
    };
    const dungeon: Dungeon = {
      id: "d", name: "Tomb", theme: "undead",
      encounters: [{
        id: "e1", type: "combat", name: "Lich", difficulty: 7,
        targetStats: ["wis"], isBoss: true,
      }],
    };
    const events: SimEvent[] = [
      { kind: "death", encounterId: "e1", actorId: "t" },
      { kind: "revivify", encounterId: "e1", actorId: "cl", targetId: "t" },
    ];
    const highlights = generateHighlights(events, [cleric, target], dungeon);
    expect(highlights.some((h) => h.kind === "revivify")).toBe(true);
  });

  it("generates an arcane_surge highlight", () => {
    const wiz: Character = {
      id: "w", name: "Wiz", race: "Elf", class: "Wizard", role: "DPS",
      specialty: "Evoker",
      stats: { str: 8, dex: 10, con: 10, int: 18, wis: 12, cha: 10 },
      level: 6, xp: 0, abilityTiers: [1, 2], description: "",
    };
    const dungeon: Dungeon = {
      id: "d", name: "Tower", theme: "arcane",
      encounters: [{
        id: "e1", type: "arcane", name: "Sigil", difficulty: 5,
        targetStats: ["int"], isBoss: false,
      }],
    };
    const events: SimEvent[] = [
      { kind: "arcane_surge", encounterId: "e1", actorId: "w" },
    ];
    const highlights = generateHighlights(events, [wiz], dungeon);
    expect(highlights.some((h) => h.kind === "arcane_surge")).toBe(true);
  });
});
