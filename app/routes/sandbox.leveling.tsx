import { Fragment, useState } from "react";
import { Form } from "react-router";
import { ProceduralSource } from "domain/content/procedural-source";
import { runDungeon } from "domain/sim/sim-engine";
import { pointsForEvent, score, type ScoreOptions } from "domain/scoring";
import { createRng, seedFromIds } from "domain/rng";
import { applyPreset } from "domain/presets";
import { ALL_THEMES } from "domain/themes";
import { ROLE_XP_EVENTS, XP_THRESHOLDS } from "domain/leveling";
import { isCoreEventForSpecialty } from "domain/specialties";
import type { Character, EventKind, Lineup, Role, SimEvent } from "domain/types";
import type { Route } from "./+types/sandbox.leveling";

type XpMode = "current" | "broadened" | "nobonus" | "nobonus_util" | "milestone";

interface SimParams {
  charSeed: string;
  numTeams: number;
  numSeasons: number;
  weeksPerSeason: number;
  xpMode: XpMode;
  specialtyBonus: number;
  utilityBonus: number;
  milestoneXpPerMatchup: number;
  scaleFactor: number;
  includeBench: boolean;
  healerMultiHeal: boolean;
  healerMultiHealChance: number;
  healerHitSecondary: boolean;
}

const DEFAULTS: SimParams = {
  charSeed: "alpha",
  numTeams: 4,
  numSeasons: 10,
  weeksPerSeason: 10,
  xpMode: "nobonus_util",
  specialtyBonus: 1.5,
  utilityBonus: 1.5,
  milestoneXpPerMatchup: 8,
  scaleFactor: 1.0,
  includeBench: false,
  healerMultiHeal: false,
  healerMultiHealChance: 0.6,
  healerHitSecondary: false,
};

function parseParams(p: URLSearchParams): SimParams {
  const num = (k: string, fallback: number) => {
    const v = p.get(k);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const validModes: XpMode[] = ["current", "broadened", "nobonus", "nobonus_util", "milestone"];
  const modeRaw = (p.get("xpMode") ?? DEFAULTS.xpMode) as XpMode;
  const xpMode = validModes.includes(modeRaw) ? modeRaw : DEFAULTS.xpMode;
  return {
    charSeed: p.get("charSeed") || DEFAULTS.charSeed,
    numTeams: Math.max(2, Math.min(8, Math.round(num("numTeams", DEFAULTS.numTeams)))),
    numSeasons: Math.max(1, Math.min(50, Math.round(num("numSeasons", DEFAULTS.numSeasons)))),
    weeksPerSeason: Math.max(1, Math.min(30, Math.round(num("weeksPerSeason", DEFAULTS.weeksPerSeason)))),
    xpMode,
    specialtyBonus: num("specialtyBonus", DEFAULTS.specialtyBonus),
    utilityBonus: num("utilityBonus", DEFAULTS.utilityBonus),
    milestoneXpPerMatchup: num("milestoneXpPerMatchup", DEFAULTS.milestoneXpPerMatchup),
    scaleFactor: num("scaleFactor", DEFAULTS.scaleFactor),
    includeBench: p.get("includeBench") === "1",
    healerMultiHeal: p.get("healerMultiHeal") === "1",
    healerMultiHealChance: num("healerMultiHealChance", DEFAULTS.healerMultiHealChance),
    healerHitSecondary: p.get("healerHitSecondary") === "1",
  };
}

function xpAmountForEvent(event: SimEvent): number {
  switch (event.kind) {
    case "hit": return Math.max(1, Math.floor((event.amount ?? 0) / 4));
    case "kill": return event.meta?.boss ? 5 : 2;
    case "crit": return 2;
    case "heal": return Math.max(1, Math.floor((event.amount ?? 0) / 4));
    case "damage_taken": return Math.max(1, Math.floor((event.amount ?? 0) / 5));
    case "save_pass": return 1;
    case "disarm_trap": return 2;
    case "find_treasure": return 3;
    case "buff": return 1;
    case "buff_proc": return 1;
    case "block": return 2;
    case "taunt": return 1;
    case "persuade":
    case "deceive":
    case "intimidate": return 2;
    case "dispel": return 2;
    case "channel": return 1;
    case "arcane_surge": return 3;
    case "multiattack": return 1;
    case "sneak_attack": return Math.max(1, Math.floor((event.amount ?? 0) / 4));
    case "smite": return Math.max(1, Math.floor((event.amount ?? 0) / 4));
    case "rage": return 1;
    case "revivify": return 5;
    default: return 0;
  }
}

function xpFromMatchup(char: Character, events: SimEvent[], p: SimParams): number {
  if (p.xpMode === "milestone") return p.milestoneXpPerMatchup;

  const roleSet = ROLE_XP_EVENTS[char.role];
  let total = 0;
  for (const e of events) {
    if (e.actorId !== char.id) continue;
    const isRoleEvent = roleSet.has(e.kind);
    const isSpecCore = isCoreEventForSpecialty(char.specialty, e.kind);

    if (p.xpMode === "current") {
      if (!isRoleEvent) continue;
      let amt = xpAmountForEvent(e);
      if (isSpecCore) amt = Math.round(amt * p.specialtyBonus);
      total += amt;
    } else if (p.xpMode === "broadened") {
      if (!isRoleEvent && !isSpecCore) continue;
      let amt = xpAmountForEvent(e);
      if (isSpecCore) amt = Math.round(amt * p.specialtyBonus);
      total += amt;
    } else if (p.xpMode === "nobonus") {
      if (!isRoleEvent && !isSpecCore) continue;
      let amt = xpAmountForEvent(e);
      if (isRoleEvent && isSpecCore) amt = Math.round(amt * p.specialtyBonus);
      total += amt;
    } else if (p.xpMode === "nobonus_util") {
      if (!isRoleEvent && !isSpecCore) continue;
      let amt = xpAmountForEvent(e);
      if (isRoleEvent && isSpecCore) amt = Math.round(amt * p.specialtyBonus);
      else if (char.role === "Utility" && isRoleEvent) amt = Math.round(amt * p.utilityBonus);
      total += amt;
    }
  }
  return total;
}

function levelFor(xp: number, scaleFactor: number, max = 20): number {
  let lvl = 1;
  for (let i = 2; i <= max; i++) {
    if (xp >= (XP_THRESHOLDS[i] ?? Infinity) * scaleFactor) lvl = i;
    else break;
  }
  return lvl;
}

type EventTally = Partial<Record<EventKind, { count: number; total: number; points: number }>>;

interface CharResult {
  externalId: string;
  name: string;
  className: string;
  specialty: string;
  role: Role;
  teamIdx: number;
  matchupsPlayed: number;
  totalPoints: number;
  totalXp: number;
  level: number;
  events: EventTally;
  bossKills: number;
}

interface SimResult {
  roster: CharResult[];
  perRoleXp: Record<Role, { mean: number; n: number }>;
  pearson: number;
  totalChars: number;
  totalMatchups: number;
}

function pearson(xs: number[], ys: number[]): number {
  if (xs.length === 0) return 0;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const ex = xs[i] - mx;
    const ey = ys[i] - my;
    num += ex * ey;
    dx += ex * ex;
    dy += ey * ey;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function runSim(params: SimParams): SimResult {
  const settings = applyPreset("standard");
  const source = new ProceduralSource();
  const ROSTER_PER_TEAM = 6;
  const totalChars = params.numTeams * ROSTER_PER_TEAM;
  const baseRng = createRng(seedFromIds("sandbox", params.charSeed));
  const characters = source.generateCharacters(totalChars, baseRng, settings);
  const charMap = new Map(characters.map((c) => [c.id, c]));

  const sorted = [...characters].sort((a, b) => {
    const sa = Object.values(a.stats).reduce((s: number, v: number) => s + v, 0);
    const sb = Object.values(b.stats).reduce((s: number, v: number) => s + v, 0);
    return sb - sa;
  });
  const teams: Character[][] = Array.from({ length: params.numTeams }, () => []);
  sorted.forEach((c, i) => teams[i % params.numTeams].push(c));

  const results = new Map<string, CharResult>();
  for (let t = 0; t < teams.length; t++) {
    for (const c of teams[t]) {
      results.set(c.id, {
        externalId: c.id,
        name: c.name,
        className: c.class,
        specialty: c.specialty,
        role: c.role,
        teamIdx: t,
        matchupsPlayed: 0,
        totalPoints: 0,
        totalXp: 0,
        level: 0,
        events: {},
        bossKills: 0,
      });
    }
  }

  const scoreOpts: ScoreOptions = params.healerHitSecondary
    ? { extraSecondaryByRole: { Healer: new Set(["hit"]) } }
    : {};

  let totalMatchups = 0;
  for (let season = 0; season < params.numSeasons; season++) {
    const seasonRng = baseRng.fork(`season-${season}`);
    for (let week = 1; week <= params.weeksPerSeason; week++) {
      const themeRng = seasonRng.fork(`theme-${week}`);
      const theme = themeRng.pick(ALL_THEMES);
      const dungeon = source.generateDungeon(
        week, 0, seasonRng.fork(`d-${week}`), theme, settings.encounterCount,
      );
      for (const team of teams) {
        if (team.length < 6) continue;
        const active = team.slice(0, 4).map((c) => c.id) as [string, string, string, string];
        const lineup: Lineup = { active, bench: [team[4].id, team[5].id] };
        const events = runDungeon(
          lineup, charMap, dungeon, seasonRng.fork(`s-${week}-${team[0].id}`),
          {
            healerMultiHeal: params.healerMultiHeal,
            healerMultiHealChance: params.healerMultiHealChance,
          },
        );
        const sc = score(events, team.slice(0, 4), scoreOpts);
        for (const ch of team.slice(0, 4)) {
          const r = results.get(ch.id)!;
          const cs = sc.perCharacter.get(ch.id);
          r.matchupsPlayed += 1;
          r.totalPoints += cs?.totalPoints ?? 0;
          r.totalXp += xpFromMatchup(ch, events, params);
          for (const e of events) {
            if (e.actorId !== ch.id) continue;
            const slot = r.events[e.kind] ?? { count: 0, total: 0, points: 0 };
            slot.count += 1;
            slot.total += e.amount ?? 0;
            slot.points += pointsForEvent(e, ch, scoreOpts);
            r.events[e.kind] = slot;
            if (e.kind === "kill" && e.meta?.boss) r.bossKills += 1;
          }
        }
        totalMatchups += 1;
      }
    }
  }

  const roster: CharResult[] = [];
  for (const r of results.values()) {
    r.level = levelFor(r.totalXp, params.scaleFactor);
    roster.push(r);
  }

  const roles: Role[] = ["Tank", "Healer", "DPS", "Utility"];
  const perRoleXp = {} as SimResult["perRoleXp"];
  for (const role of roles) {
    const xs = roster.filter((r) => r.role === role && r.matchupsPlayed > 0).map((r) => r.totalXp);
    const mean = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    perRoleXp[role] = { mean, n: xs.length };
  }
  const active = roster.filter((r) => r.matchupsPlayed > 0);
  const r = pearson(active.map((c) => c.totalPoints), active.map((c) => c.totalXp));

  return { roster, perRoleXp, pearson: r, totalChars, totalMatchups };
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const params = parseParams(url.searchParams);
  const result = runSim(params);
  const url2 = new URL(request.url);
  if (url2.searchParams.get("format") === "csv") {
    const lines: string[] = [
      "team,name,class,specialty,role,level,totalXp,totalPoints,avg,games",
    ];
    const csvRoster = params.includeBench
      ? result.roster
      : result.roster.filter((r) => r.matchupsPlayed > 0);
    for (const r of csvRoster) {
      const avg = r.matchupsPlayed > 0 ? (r.totalPoints / r.matchupsPlayed).toFixed(2) : "";
      const fields = [
        `T${r.teamIdx + 1}`,
        JSON.stringify(r.name),
        r.className,
        r.specialty,
        r.role,
        r.level,
        r.totalXp,
        r.totalPoints.toFixed(2),
        avg,
        r.matchupsPlayed,
      ];
      lines.push(fields.join(","));
    }
    const tag = `${params.charSeed}-${params.xpMode}-util${params.utilityBonus}-spec${params.specialtyBonus}`;
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="sandbox-${tag}.csv"`,
      },
    });
  }

  return { params, result };
}

const ROLE_COLORS: Record<Role, string> = {
  Tank: "#4a6fa5",
  Healer: "#2e8b57",
  DPS: "#b8860b",
  Utility: "#7b68ee",
};

type SortKey = "totalXp" | "totalPoints" | "level" | "role" | "team" | "name" | "avg";

const STAT_GROUPS: { label: string; kinds: { kind: EventKind; label: string; unit?: "dmg" | "hp" }[] }[] = [
  {
    label: "Combat",
    kinds: [
      { kind: "hit", label: "Hits", unit: "dmg" },
      { kind: "crit", label: "Crits" },
      { kind: "kill", label: "Kills" },
      { kind: "multiattack", label: "Multiattacks", unit: "dmg" },
      { kind: "sneak_attack", label: "Sneak attacks", unit: "dmg" },
      { kind: "smite", label: "Smites", unit: "dmg" },
      { kind: "rage", label: "Rages" },
      { kind: "arcane_surge", label: "Arcane surges" },
    ],
  },
  {
    label: "Defense",
    kinds: [
      { kind: "damage_taken", label: "Damage taken", unit: "dmg" },
      { kind: "block", label: "Blocks" },
      { kind: "taunt", label: "Taunts" },
      { kind: "save_pass", label: "Saves passed" },
      { kind: "save_fail", label: "Saves failed" },
      { kind: "ko", label: "KOs" },
      { kind: "death", label: "Deaths" },
    ],
  },
  {
    label: "Support",
    kinds: [
      { kind: "heal", label: "Heals", unit: "hp" },
      { kind: "buff", label: "Buffs cast" },
      { kind: "buff_proc", label: "Buff procs" },
      { kind: "revivify", label: "Revivifies" },
      { kind: "channel", label: "Channels" },
      { kind: "dispel", label: "Dispels" },
    ],
  },
  {
    label: "Skill",
    kinds: [
      { kind: "disarm_trap", label: "Traps disarmed" },
      { kind: "find_treasure", label: "Treasures found" },
      { kind: "persuade", label: "Persuades" },
      { kind: "deceive", label: "Deceives" },
      { kind: "intimidate", label: "Intimidates" },
    ],
  },
];

function StatBlock({ char }: { char: CharResult }) {
  const summedEventPoints = Object.values(char.events).reduce(
    (acc, t) => acc + (t?.points ?? 0),
    0,
  );
  const milestonePoints = char.totalPoints - summedEventPoints;

  return (
    <div style={{ padding: "0.75rem", background: "var(--parchment-dark, #f4ecd8)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {STAT_GROUPS.map((g) => {
          const rows = g.kinds
            .map((k) => {
              const tally = char.events[k.kind];
              if (!tally || tally.count === 0) return null;
              return { ...k, count: tally.count, total: tally.total, points: tally.points };
            })
            .filter(Boolean) as { kind: EventKind; label: string; unit?: "dmg" | "hp"; count: number; total: number; points: number }[];
          if (rows.length === 0) return null;
          const groupPoints = rows.reduce((a, r) => a + r.points, 0);
          return (
            <div key={g.label}>
              <div style={{ fontWeight: "bold", fontSize: "0.85rem", marginBottom: "0.25rem", display: "flex", justifyContent: "space-between" }}>
                <span>{g.label}</span>
                <span style={{ color: "var(--ink-light)" }}>{groupPoints.toFixed(1)} pts</span>
              </div>
              {rows.map((r) => (
                <div key={r.kind} style={{ fontSize: "0.85rem", display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.5rem" }}>
                  <span>
                    {r.label}
                    {r.kind === "kill" && char.bossKills > 0 ? ` (${char.bossKills} boss)` : ""}
                  </span>
                  <span style={{ color: "var(--ink-light)", textAlign: "right" }}>
                    {r.count}
                    {r.unit ? ` (${Math.round(r.total)} ${r.unit})` : ""}
                  </span>
                  <span style={{ color: r.points >= 0 ? "var(--ink)" : "var(--accent)", textAlign: "right", minWidth: "3.5em" }}>
                    {r.points >= 0 ? "+" : ""}{r.points.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid var(--ink-light)", fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "var(--ink-light)" }}>
          Event points: {summedEventPoints.toFixed(1)} · Milestones (run bonuses): {milestonePoints.toFixed(1)}
        </span>
        <strong>Total: {char.totalPoints.toFixed(1)}</strong>
      </div>
    </div>
  );
}

export default function Sandbox({ loaderData }: Route.ComponentProps) {
  const { params, result } = loaderData;
  const [sortKey, setSortKey] = useState<SortKey>("totalXp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = params.includeBench
    ? result.roster
    : result.roster.filter((r) => r.matchupsPlayed > 0);

  const sorted = [...filtered].sort((a, b) => {
    const cmp = (() => {
      switch (sortKey) {
        case "totalXp": return a.totalXp - b.totalXp;
        case "totalPoints": return a.totalPoints - b.totalPoints;
        case "level": return a.level - b.level;
        case "role": return a.role.localeCompare(b.role);
        case "team": return a.teamIdx - b.teamIdx;
        case "name": return a.name.localeCompare(b.name);
        case "avg": {
          const aa = a.matchupsPlayed > 0 ? a.totalPoints / a.matchupsPlayed : 0;
          const bb = b.matchupsPlayed > 0 ? b.totalPoints / b.matchupsPlayed : 0;
          return aa - bb;
        }
      }
    })();
    return sortDir === "desc" ? -cmp : cmp;
  });

  const setSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const arrow = (k: SortKey) => sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  return (
    <div>
      <h1>Leveling Sandbox</h1>
      <p style={{ color: "var(--ink-light)", fontSize: "0.9rem" }}>
        Deterministic league simulation. Same charSeed → same characters and matchups across runs;
        change xpMode / multipliers to see how leveling outcomes shift.
      </p>

      <Form method="get" className="card" style={{ marginBottom: "1rem", padding: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
          <label>
            <div style={{ fontSize: "0.8rem" }}>charSeed</div>
            <input name="charSeed" defaultValue={params.charSeed} style={{ width: "100%" }} />
          </label>
          <label>
            <div style={{ fontSize: "0.8rem" }}>Teams (×6 chars each)</div>
            <input name="numTeams" type="number" min={2} max={8} defaultValue={params.numTeams} style={{ width: "100%" }} />
          </label>
          <label>
            <div style={{ fontSize: "0.8rem" }}>Seasons</div>
            <input name="numSeasons" type="number" min={1} max={50} defaultValue={params.numSeasons} style={{ width: "100%" }} />
          </label>
          <label>
            <div style={{ fontSize: "0.8rem" }}>Weeks/season</div>
            <input name="weeksPerSeason" type="number" min={1} max={30} defaultValue={params.weeksPerSeason} style={{ width: "100%" }} />
          </label>

          <label>
            <div style={{ fontSize: "0.8rem" }}>xpMode</div>
            <select name="xpMode" defaultValue={params.xpMode} style={{ width: "100%" }}>
              <option value="current">current (role only, 1.5× on specialty)</option>
              <option value="broadened">broadened (role OR specialty, 1.5× on specialty)</option>
              <option value="nobonus">no-bonus (specialty 1.5× only when role+specialty match)</option>
              <option value="nobonus_util">no-bonus + utility lift</option>
              <option value="milestone">milestone (flat XP per matchup)</option>
            </select>
          </label>
          <label>
            <div style={{ fontSize: "0.8rem" }}>specialtyBonus (×)</div>
            <input name="specialtyBonus" type="number" step="0.1" defaultValue={params.specialtyBonus} style={{ width: "100%" }} />
          </label>
          <label>
            <div style={{ fontSize: "0.8rem" }}>utilityBonus (× on Util role events)</div>
            <input name="utilityBonus" type="number" step="0.1" defaultValue={params.utilityBonus} style={{ width: "100%" }} />
          </label>
          <label>
            <div style={{ fontSize: "0.8rem" }}>milestoneXp/matchup</div>
            <input name="milestoneXpPerMatchup" type="number" step="1" defaultValue={params.milestoneXpPerMatchup} style={{ width: "100%" }} />
          </label>

          <label>
            <div style={{ fontSize: "0.8rem" }}>scaleFactor (XP threshold)</div>
            <input name="scaleFactor" type="number" step="0.1" defaultValue={params.scaleFactor} style={{ width: "100%" }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input name="includeBench" type="checkbox" value="1" defaultChecked={params.includeBench} />
            <span style={{ fontSize: "0.85rem" }}>Include bench (0-game chars)</span>
          </label>
        </div>

        <div style={{ marginTop: "0.75rem", paddingTop: "0.5rem", borderTop: "1px dashed var(--ink-light)" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.4rem" }}>Healer experiments</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input name="healerMultiHeal" type="checkbox" value="1" defaultChecked={params.healerMultiHeal} />
              <span style={{ fontSize: "0.85rem" }}>Multi-target heal per encounter</span>
            </label>
            <label>
              <div style={{ fontSize: "0.8rem" }}>Per-target heal chance</div>
              <input name="healerMultiHealChance" type="number" step="0.05" min={0} max={1} defaultValue={params.healerMultiHealChance} style={{ width: "100%" }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input name="healerHitSecondary" type="checkbox" value="1" defaultChecked={params.healerHitSecondary} />
              <span style={{ fontSize: "0.85rem" }}>Add `hit` to Healer secondary (0.3×)</span>
            </label>
          </div>
        </div>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="submit" className="btn btn-gold">Run simulation</button>
          <a href="/sandbox/leveling" className="btn">Reset</a>
          <a
            href={`?${new URLSearchParams({
              charSeed: params.charSeed,
              numTeams: String(params.numTeams),
              numSeasons: String(params.numSeasons),
              weeksPerSeason: String(params.weeksPerSeason),
              xpMode: params.xpMode,
              specialtyBonus: String(params.specialtyBonus),
              utilityBonus: String(params.utilityBonus),
              milestoneXpPerMatchup: String(params.milestoneXpPerMatchup),
              scaleFactor: String(params.scaleFactor),
              includeBench: params.includeBench ? "1" : "",
              healerMultiHeal: params.healerMultiHeal ? "1" : "",
              healerMultiHealChance: String(params.healerMultiHealChance),
              healerHitSecondary: params.healerHitSecondary ? "1" : "",
              format: "csv",
            }).toString()}`}
            className="btn"
          >
            Download CSV
          </a>
        </div>
      </Form>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <strong>Summary:</strong>{" "}
        {result.totalChars} chars · {result.totalMatchups} matchups simulated ·
        Pearson(pts↔XP) <strong>{result.pearson.toFixed(3)}</strong>
        <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
          Mean XP per role:{" "}
          {(["Tank", "Healer", "DPS", "Utility"] as Role[]).map((role, i) => (
            <span key={role}>
              <span style={{ color: ROLE_COLORS[role] }}>{role}</span>{" "}
              <strong>{result.perRoleXp[role].mean.toFixed(1)}</strong>
              {i < 3 ? " · " : ""}
            </span>
          ))}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th onClick={() => setSort("team")} style={{ cursor: "pointer" }}>Team{arrow("team")}</th>
            <th onClick={() => setSort("name")} style={{ cursor: "pointer" }}>Name{arrow("name")}</th>
            <th>Class · Specialty</th>
            <th onClick={() => setSort("role")} style={{ cursor: "pointer" }}>Role{arrow("role")}</th>
            <th onClick={() => setSort("level")} style={{ cursor: "pointer", textAlign: "right" }}>L{arrow("level")}</th>
            <th onClick={() => setSort("totalXp")} style={{ cursor: "pointer", textAlign: "right" }}>XP{arrow("totalXp")}</th>
            <th onClick={() => setSort("totalPoints")} style={{ cursor: "pointer", textAlign: "right" }}>Pts{arrow("totalPoints")}</th>
            <th onClick={() => setSort("avg")} style={{ cursor: "pointer", textAlign: "right" }}>Avg{arrow("avg")}</th>
            <th style={{ textAlign: "right" }}>Games</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const isOpen = expandedId === r.externalId;
            return (
              <Fragment key={r.externalId}>
                <tr>
                  <td><span style={{ background: "var(--parchment-dark)", padding: "0.1rem 0.4rem", borderRadius: 4, fontSize: "0.8rem" }}>T{r.teamIdx + 1}</span></td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : r.externalId)}
                      disabled={r.matchupsPlayed === 0}
                      style={{
                        background: "none", border: "none", padding: 0,
                        cursor: r.matchupsPlayed === 0 ? "default" : "pointer",
                        font: "inherit", color: "inherit", textAlign: "left",
                      }}
                    >
                      <span style={{ color: "var(--ink-light)", fontSize: "0.8rem" }}>{isOpen ? "▼ " : r.matchupsPlayed > 0 ? "▶ " : "  "}</span>
                      {r.name}
                    </button>
                  </td>
                  <td style={{ fontSize: "0.85rem", color: "var(--ink-light)" }}>{r.className} · {r.specialty}</td>
                  <td><span className={`badge badge-${r.role.toLowerCase()}`}>{r.role}</span></td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>{r.level}</td>
                  <td style={{ textAlign: "right" }}>{r.totalXp}</td>
                  <td style={{ textAlign: "right" }}>{r.totalPoints.toFixed(1)}</td>
                  <td style={{ textAlign: "right" }}>
                    {r.matchupsPlayed > 0 ? (r.totalPoints / r.matchupsPlayed).toFixed(1) : "—"}
                  </td>
                  <td style={{ textAlign: "right", color: "var(--ink-light)" }}>{r.matchupsPlayed}</td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={9} style={{ padding: 0 }}>
                      <StatBlock char={r} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
