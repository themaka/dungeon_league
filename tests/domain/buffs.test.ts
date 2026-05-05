import { describe, it, expect } from "vitest";
import { newBuffPools } from "domain/sim/buffs";

describe("buff pools", () => {
  it("newBuffPools produces empty maps for all three buff kinds", () => {
    const pools = newBuffPools();
    expect(pools.bless.size).toBe(0);
    expect(pools.inspiration.size).toBe(0);
    expect(pools.revivify.size).toBe(0);
  });

  it("pools support per-source charge tracking", () => {
    const pools = newBuffPools();
    pools.bless.set("cleric-1", 3);
    expect(pools.bless.get("cleric-1")).toBe(3);
    pools.bless.set("cleric-1", 2);
    expect(pools.bless.get("cleric-1")).toBe(2);
  });
});
