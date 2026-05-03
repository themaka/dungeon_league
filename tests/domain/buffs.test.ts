import { describe, it, expect } from "vitest";
import { newBuffState, addBuff, consumeBuff, buffersOf } from "domain/sim/buffs";

describe("buffs", () => {
  it("addBuff records source and target with charges", () => {
    const state = newBuffState();
    addBuff(state, { kind: "bless", sourceId: "cleric1", targetId: "ally1", charges: 3, bonus: 4 });
    expect(state.byTarget.get("ally1")?.length).toBe(1);
  });

  it("consumeBuff returns the active buff and decrements charges", () => {
    const state = newBuffState();
    addBuff(state, { kind: "bless", sourceId: "c", targetId: "a", charges: 2, bonus: 4 });
    const consumed = consumeBuff(state, "a", "bless");
    expect(consumed?.sourceId).toBe("c");
    expect(state.byTarget.get("a")?.[0].charges).toBe(1);
  });

  it("consumeBuff removes a buff at zero charges", () => {
    const state = newBuffState();
    addBuff(state, { kind: "inspiration", sourceId: "b", targetId: "a", charges: 1, bonus: 6 });
    consumeBuff(state, "a", "inspiration");
    expect(state.byTarget.get("a")?.length ?? 0).toBe(0);
  });

  it("buffersOf returns sources currently buffing a target", () => {
    const state = newBuffState();
    addBuff(state, { kind: "bless", sourceId: "c1", targetId: "a", charges: 2, bonus: 4 });
    addBuff(state, { kind: "aura", sourceId: "p1", targetId: "a", charges: 99, bonus: 2 });
    expect(buffersOf(state, "a").sort()).toEqual(["c1", "p1"]);
  });
});
