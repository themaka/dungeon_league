import { describe, it, expect } from "vitest";
import { generateHighlights } from "domain/highlights";
import type { SimEvent, Character, Dungeon, Highlight } from "domain/types";

function makeChar(id: string, role: "Tank" | "Healer" | "DPS" | "Utility"): Character {
  return {
    id, name: `Hero ${id}`, race: "Human", class: "Fighter", role,
    stats: { str: 14, dex: 12, con: 13, int: 10, wis: 10, cha: 10 },
    level: 1, description: "test",
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
