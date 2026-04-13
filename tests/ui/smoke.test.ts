import { describe, it, expect } from "vitest";

describe("UI smoke tests", () => {
  it("home page exports component and loader", async () => {
    const mod = await import("~/routes/home");
    expect(mod.default).toBeDefined();
    expect(mod.loader).toBeDefined();
  });

  it("leagues.new exports component and action", async () => {
    const mod = await import("~/routes/leagues.new");
    expect(mod.default).toBeDefined();
    expect(mod.action).toBeDefined();
  });

  it("leagues.import exports component and action", async () => {
    const mod = await import("~/routes/leagues.import");
    expect(mod.default).toBeDefined();
    expect(mod.action).toBeDefined();
  });

  it("leagues.$id exports component, loader, and action", async () => {
    const mod = await import("~/routes/leagues.$id");
    expect(mod.default).toBeDefined();
    expect(mod.loader).toBeDefined();
    expect(mod.action).toBeDefined();
  });

  it("leagues.$id_.export exports a loader (loader-only route, no component)", async () => {
    const mod = await import("~/routes/leagues.$id_.export");
    expect(mod.loader).toBeDefined();
  });

  it("leagues.$id_.draft exports component, loader, and action", async () => {
    const mod = await import("~/routes/leagues.$id_.draft");
    expect(mod.default).toBeDefined();
    expect(mod.loader).toBeDefined();
    expect(mod.action).toBeDefined();
  });

  it("leagues.$id_.teams.$teamId exports component and loader and action", async () => {
    const mod = await import("~/routes/leagues.$id_.teams.$teamId");
    expect(mod.default).toBeDefined();
    expect(mod.loader).toBeDefined();
    expect(mod.action).toBeDefined();
  });

  it("leagues.$id_.characters.$charId exports component and loader", async () => {
    const mod = await import("~/routes/leagues.$id_.characters.$charId");
    expect(mod.default).toBeDefined();
    expect(mod.loader).toBeDefined();
  });

  it("leagues.$id_.matchups.$matchupId exports component and loader", async () => {
    const mod = await import("~/routes/leagues.$id_.matchups.$matchupId");
    expect(mod.default).toBeDefined();
    expect(mod.loader).toBeDefined();
  });
});
