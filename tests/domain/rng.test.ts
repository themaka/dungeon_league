import { describe, it, expect } from "vitest";
import { createRng } from "domain/rng";

describe("seeded RNG", () => {
  it("produces deterministic output for the same seed", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).toEqual(seq2);
  });

  it("produces different output for different seeds", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(99);
    const val1 = rng1.next();
    const val2 = rng2.next();
    expect(val1).not.toBe(val2);
  });

  it("next() returns values in [0, 1)", () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("nextInt(min, max) returns integers in [min, max]", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(1, 6);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it("pick() returns an element from the array", () => {
    const rng = createRng(55);
    const items = ["a", "b", "c", "d"];
    for (let i = 0; i < 100; i++) {
      const picked = rng.pick(items);
      expect(items).toContain(picked);
    }
  });

  it("shuffle() produces a deterministic permutation", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(rng1.shuffle(arr1)).toEqual(rng2.shuffle(arr2));
  });

  it("rollStat() produces values in [3, 18]", () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const val = rng.rollStat();
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThanOrEqual(18);
    }
  });

  it("fork() creates a child RNG that is deterministic but independent", () => {
    const parent1 = createRng(42);
    const parent2 = createRng(42);
    const child1 = parent1.fork("matchup-1");
    const child2 = parent2.fork("matchup-1");
    expect(child1.next()).toBe(child2.next());
    expect(parent1.next()).toBe(parent2.next());
  });
});
