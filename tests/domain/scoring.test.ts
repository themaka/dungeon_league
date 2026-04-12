import { describe, it, expect } from "vitest";
import { score } from "domain/scoring";
import type { SimEvent, Character } from "domain/types";

function makeChar(id: string, role: "Tank" | "Healer" | "DPS" | "Utility"): Character {
  return {
    id,
    name: `Test ${id}`,
    race: "Human",
    class: "Fighter",
    role,
    stats: { str: 14, dex: 12, con: 13, int: 10, wis: 10, cha: 10 },
    level: 1,
    description: "test",
  };
}

describe("scoring", () => {
  it("scores hit events at 0.1 per damage", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "hit", encounterId: "e1", actorId: "a", amount: 10 },
    ];
    const result = score(events, chars);
    expect(result.perCharacter.get("a")!.basePoints).toBe(1);
  });

  it("applies DPS role multiplier to hit events", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "hit", encounterId: "e1", actorId: "a", amount: 10 },
    ];
    const result = score(events, chars);
    expect(result.perCharacter.get("a")!.roleMultiplierPoints).toBeCloseTo(0.5);
  });

  it("applies Tank role multiplier to damage_taken", () => {
    const chars = [makeChar("t", "Tank")];
    const events: SimEvent[] = [
      { kind: "damage_taken", encounterId: "e1", actorId: "t", amount: 20 },
    ];
    const result = score(events, chars);
    expect(result.perCharacter.get("t")!.basePoints).toBe(1);
    expect(result.perCharacter.get("t")!.roleMultiplierPoints).toBeCloseTo(0.5);
  });

  it("scores kill at +2, boss kill at +3", () => {
    const chars = [makeChar("a", "DPS")];
    const normalKill: SimEvent[] = [
      { kind: "kill", encounterId: "e1", actorId: "a", meta: { boss: false } },
    ];
    const bossKill: SimEvent[] = [
      { kind: "kill", encounterId: "e1", actorId: "a", meta: { boss: true } },
    ];
    expect(score(normalKill, chars).perCharacter.get("a")!.basePoints).toBe(2);
    expect(score(bossKill, chars).perCharacter.get("a")!.basePoints).toBe(3);
  });

  it("scores ko at -3 and death at -5", () => {
    const chars = [makeChar("a", "DPS")];
    const ko: SimEvent[] = [{ kind: "ko", encounterId: "e1", actorId: "a" }];
    const death: SimEvent[] = [{ kind: "death", encounterId: "e1", actorId: "a" }];
    expect(score(ko, chars).perCharacter.get("a")!.basePoints).toBe(-3);
    expect(score(death, chars).perCharacter.get("a")!.basePoints).toBe(-5);
  });

  it("awards mvp_of_run milestone to highest scorer", () => {
    const chars = [makeChar("a", "DPS"), makeChar("b", "DPS")];
    const events: SimEvent[] = [
      { kind: "hit", encounterId: "e1", actorId: "a", amount: 100 },
      { kind: "hit", encounterId: "e1", actorId: "b", amount: 10 },
    ];
    const result = score(events, chars);
    expect(result.milestones).toContainEqual({ kind: "mvp_of_run", actorId: "a" });
    // mvp_of_run (+5) + flawless_run (+3, no KOs in this test) = 8
    expect(result.perCharacter.get("a")!.milestonePoints).toBe(8);
  });

  it("awards flawless_run milestone when no KOs", () => {
    const chars = [makeChar("a", "DPS"), makeChar("b", "Tank")];
    const events: SimEvent[] = [
      { kind: "hit", encounterId: "e1", actorId: "a", amount: 10 },
    ];
    const result = score(events, chars);
    expect(result.milestones).toContainEqual({ kind: "flawless_run" });
    expect(result.perCharacter.get("a")!.milestonePoints).toBeGreaterThanOrEqual(3);
  });

  it("awards total_party_wipe when all die", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [
      { kind: "death", encounterId: "e1", actorId: "a" },
    ];
    const result = score(events, chars);
    expect(result.milestones).toContainEqual({ kind: "total_party_wipe" });
  });

  it("teamTotal is sum of all character totals", () => {
    const chars = [makeChar("a", "DPS"), makeChar("b", "Healer")];
    const events: SimEvent[] = [
      { kind: "hit", encounterId: "e1", actorId: "a", amount: 10 },
      { kind: "heal", encounterId: "e1", actorId: "b", amount: 10 },
    ];
    const result = score(events, chars);
    const charTotal = Array.from(result.perCharacter.values()).reduce(
      (sum, c) => sum + c.totalPoints,
      0,
    );
    expect(result.teamTotal).toBeCloseTo(charTotal);
  });
});
