import { describe, it, expect } from "vitest";
import { score } from "domain/scoring";
import type { Character, CharacterClass, Role, SimEvent, Specialty } from "domain/types";

function makeChar(
  id: string,
  role: Role,
  cls: CharacterClass = "Fighter",
  specialty: Specialty = "Champion",
): Character {
  return {
    id, name: `Test ${id}`, race: "Human", class: cls, role, specialty,
    stats: { str: 14, dex: 12, con: 13, int: 10, wis: 10, cha: 10 },
    level: 3, xp: 30, abilityTiers: [1], description: "test",
  };
}

describe("scoring", () => {
  it("scores hit events at 0.1 per damage", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [{ kind: "hit", encounterId: "e1", actorId: "a", amount: 10 }];
    expect(score(events, chars).perCharacter.get("a")!.basePoints).toBe(1);
  });

  it("DPS core multiplier is 0.75 for hit", () => {
    const chars = [makeChar("a", "DPS")];
    const events: SimEvent[] = [{ kind: "hit", encounterId: "e1", actorId: "a", amount: 10 }];
    const r = score(events, chars).perCharacter.get("a")!;
    expect(r.roleMultiplierPoints).toBeCloseTo(0.75, 4);
  });

  it("Tank core multiplier is 0.75 for damage_taken at 0.1/dmg", () => {
    const chars = [makeChar("t", "Tank", "Barbarian", "Totem Warrior")];
    const events: SimEvent[] = [{ kind: "damage_taken", encounterId: "e1", actorId: "t", amount: 20 }];
    const r = score(events, chars).perCharacter.get("t")!;
    expect(r.basePoints).toBeCloseTo(2, 4);
    expect(r.roleMultiplierPoints).toBeCloseTo(1.5, 4);
  });

  it("Tank secondary multiplier is 0.3 for save_pass", () => {
    const chars = [makeChar("t", "Tank", "Paladin", "Devotion")];
    const events: SimEvent[] = [{ kind: "save_pass", encounterId: "e1", actorId: "t" }];
    const r = score(events, chars).perCharacter.get("t")!;
    expect(r.basePoints).toBe(1);
    // save_pass IS core for Devotion (specialty), so role still 0.3 (secondary), specialty +0.25
    expect(r.roleMultiplierPoints).toBeCloseTo(0.3, 4);
    expect(r.specialtyBonusPoints).toBeCloseTo(0.25, 4);
  });

  it("Healer heal at 0.1/hp (down from 0.15)", () => {
    const chars = [makeChar("h", "Healer", "Cleric", "Life Domain")];
    const events: SimEvent[] = [{ kind: "heal", encounterId: "e1", actorId: "h", amount: 10 }];
    const r = score(events, chars).perCharacter.get("h")!;
    expect(r.basePoints).toBeCloseTo(1, 4);
  });

  it("specialty bonus +0.25x stacks on aligned events", () => {
    const champ = makeChar("a", "DPS", "Fighter", "Champion");
    const events: SimEvent[] = [{ kind: "crit", encounterId: "e1", actorId: "a" }];
    const r = score(events, [champ]).perCharacter.get("a")!;
    expect(r.basePoints).toBe(1.5);
    expect(r.roleMultiplierPoints).toBeCloseTo(1.5 * 0.75, 4);
    expect(r.specialtyBonusPoints).toBeCloseTo(1.5 * 0.25, 4);
  });

  it("buff event scores +1 base for healer", () => {
    const c = makeChar("h", "Healer", "Cleric", "War Domain");
    const events: SimEvent[] = [{ kind: "buff", encounterId: "e", actorId: "h" }];
    const r = score(events, [c]).perCharacter.get("h")!;
    expect(r.basePoints).toBe(1);
    expect(r.roleMultiplierPoints).toBeCloseTo(0.75, 4);
  });

  it("buff_proc credits the buffer at +1.5", () => {
    const c = makeChar("h", "Healer", "Cleric", "War Domain");
    const events: SimEvent[] = [{ kind: "buff_proc", encounterId: "e", actorId: "h" }];
    expect(score(events, [c]).perCharacter.get("h")!.basePoints).toBe(1.5);
  });

  it("block at +2 with Tank multiplier", () => {
    const c = makeChar("t", "Tank", "Barbarian", "Totem Warrior");
    const events: SimEvent[] = [{ kind: "block", encounterId: "e", actorId: "t" }];
    const r = score(events, [c]).perCharacter.get("t")!;
    expect(r.basePoints).toBe(2);
    expect(r.roleMultiplierPoints).toBeCloseTo(1.5, 4);
  });

  it("revivify scores +5", () => {
    const c = makeChar("h", "Healer", "Cleric", "Life Domain");
    const events: SimEvent[] = [{ kind: "revivify", encounterId: "e", actorId: "h", targetId: "x" }];
    expect(score(events, [c]).perCharacter.get("h")!.basePoints).toBe(5);
  });

  it("multiattack at +0.5 per extra hit", () => {
    const c = makeChar("a", "DPS", "Fighter", "Battle Master");
    const events: SimEvent[] = [
      { kind: "multiattack", encounterId: "e", actorId: "a", amount: 2 },
    ];
    expect(score(events, [c]).perCharacter.get("a")!.basePoints).toBe(1);
  });

  it("sneak_attack at 0.15/dmg with Rogue Assassin specialty", () => {
    const c = makeChar("a", "Utility", "Rogue", "Assassin");
    const events: SimEvent[] = [
      { kind: "sneak_attack", encounterId: "e", actorId: "a", amount: 20 },
    ];
    const r = score(events, [c]).perCharacter.get("a")!;
    expect(r.basePoints).toBeCloseTo(3, 4);
    expect(r.specialtyBonusPoints).toBeCloseTo(0.75, 4);
  });

  it("kills boss at +5 (up from +3)", () => {
    const c = makeChar("a", "DPS");
    const events: SimEvent[] = [
      { kind: "kill", encounterId: "e", actorId: "a", meta: { boss: true } },
    ];
    expect(score(events, [c]).perCharacter.get("a")!.basePoints).toBe(5);
  });

  it("revivify_save milestone awards bonus to reviver", () => {
    const c = makeChar("h", "Healer", "Cleric", "Life Domain");
    const target = makeChar("t", "DPS");
    const events: SimEvent[] = [
      { kind: "death", encounterId: "e", actorId: "t" },
      { kind: "revivify", encounterId: "e2", actorId: "h", targetId: "t" },
    ];
    const r = score(events, [c, target]);
    expect(r.milestones.some((m) => m.kind === "revivify_save" && m.actorId === "h")).toBe(true);
    // base 5 (revivify) + role 0.75x (Healer core) + specialty 0.25x (Life Domain core) = 5 + 3.75 + 1.25
    // milestonePoints from revivify_save should add +3
    expect(r.perCharacter.get("h")!.milestonePoints).toBeGreaterThanOrEqual(3);
  });

  it("revivify without a prior death does NOT award revivify_save milestone", () => {
    const c = makeChar("h", "Healer", "Cleric", "Life Domain");
    const target = makeChar("t", "DPS");
    const events: SimEvent[] = [
      { kind: "revivify", encounterId: "e", actorId: "h", targetId: "t" },
    ];
    const r = score(events, [c, target]);
    expect(r.milestones.some((m) => m.kind === "revivify_save")).toBe(false);
  });

  it("multiattack with amount=0 scores 0 base points", () => {
    const c = makeChar("a", "DPS", "Fighter", "Battle Master");
    const events: SimEvent[] = [
      { kind: "multiattack", encounterId: "e", actorId: "a", amount: 0 },
    ];
    expect(score(events, [c]).perCharacter.get("a")!.basePoints).toBe(0);
  });

  it("flawless_run still awards +3 to all on no ko/death", () => {
    const a = makeChar("a", "DPS"); const b = makeChar("b", "Tank", "Paladin", "Devotion");
    const events: SimEvent[] = [{ kind: "hit", encounterId: "e", actorId: "a", amount: 5 }];
    const r = score(events, [a, b]);
    expect(r.milestones.some((m) => m.kind === "flawless_run")).toBe(true);
    expect(r.perCharacter.get("a")!.milestonePoints).toBeGreaterThanOrEqual(3);
  });
});
