import { ProceduralSource } from "../domain/content/procedural-source";
import { runDungeon } from "../domain/sim/sim-engine";
import { score } from "../domain/scoring";
import { createRng, seedFromIds } from "../domain/rng";
import { applyPreset } from "../domain/presets";
import { ALL_THEMES } from "../domain/themes";
import {
  ROLE_XP_EVENTS,
  XP_THRESHOLDS,
} from "../domain/leveling";
import { isCoreEventForSpecialty } from "../domain/specialties";
import type { Character, EventKind, Lineup, Role, SimEvent } from "../domain/types";

const NUM_SEASONS = 5;
const WEEKS_PER_SEASON = 10;
const TEAMS = 6;
const ROSTER = 6;

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

const SPECIALTY_XP_BONUS = 1.5;

function xpCurrent(character: Character, events: SimEvent[]): number {
  let total = 0;
  const roleSet = ROLE_XP_EVENTS[character.role];
  for (const event of events) {
    if (event.actorId !== character.id) continue;
    if (!roleSet.has(event.kind)) continue;
    let amount = xpAmountForEvent(event);
    if (isCoreEventForSpecialty(character.specialty, event.kind)) {
      amount = Math.round(amount * SPECIALTY_XP_BONUS);
    }
    total += amount;
  }
  return total;
}

function xpBroadened(character: Character, events: SimEvent[]): number {
  let total = 0;
  const roleSet = ROLE_XP_EVENTS[character.role];
  for (const event of events) {
    if (event.actorId !== character.id) continue;
    const isRoleEvent = roleSet.has(event.kind);
    const isSpecialtyCore = isCoreEventForSpecialty(character.specialty, event.kind);
    if (!isRoleEvent && !isSpecialtyCore) continue;
    let amount = xpAmountForEvent(event);
    if (isSpecialtyCore) {
      amount = Math.round(amount * SPECIALTY_XP_BONUS);
    }
    total += amount;
  }
  return total;
}

// Middle path: include specialty-core events for XP eligibility, but the 1.5×
// specialty bonus only applies when the event is ALSO in the role's XP set.
// Off-role specialty events count, but at base value — no compounding.
function xpBroadenedNoBonus(character: Character, events: SimEvent[]): number {
  let total = 0;
  const roleSet = ROLE_XP_EVENTS[character.role];
  for (const event of events) {
    if (event.actorId !== character.id) continue;
    const isRoleEvent = roleSet.has(event.kind);
    const isSpecialtyCore = isCoreEventForSpecialty(character.specialty, event.kind);
    if (!isRoleEvent && !isSpecialtyCore) continue;
    let amount = xpAmountForEvent(event);
    if (isRoleEvent && isSpecialtyCore) {
      amount = Math.round(amount * SPECIALTY_XP_BONUS);
    }
    total += amount;
  }
  return total;
}

// Same as Brd-NoBon, but Utility characters also get a 1.5× bonus on every
// event in the Utility role set (compensates for how rarely those events fire).
function xpBroadenedNoBonusUtilLift(character: Character, events: SimEvent[]): number {
  let total = 0;
  const roleSet = ROLE_XP_EVENTS[character.role];
  const isUtility = character.role === "Utility";
  for (const event of events) {
    if (event.actorId !== character.id) continue;
    const isRoleEvent = roleSet.has(event.kind);
    const isSpecialtyCore = isCoreEventForSpecialty(character.specialty, event.kind);
    if (!isRoleEvent && !isSpecialtyCore) continue;
    let amount = xpAmountForEvent(event);
    if (isRoleEvent && isSpecialtyCore) {
      amount = Math.round(amount * SPECIALTY_XP_BONUS);
    } else if (isUtility && isRoleEvent) {
      amount = Math.round(amount * SPECIALTY_XP_BONUS);
    }
    total += amount;
  }
  return total;
}

// Milestone XP — every active character earns the same flat amount per matchup
// played. Calibrated below from the current system's per-character per-matchup
// average so totals are comparable.
function xpMilestone(_character: Character, _events: SimEvent[], milestoneXp: number): number {
  return milestoneXp;
}

interface CharResult {
  id: string;
  role: Role;
  className: string;
  specialty: string;
  matchupsPlayed: number;
  totalPoints: number;
  xpCurrent: number;
  xpBroadened: number;
  xpBroadenedNoBonus: number;
  xpBroadenedNoBonusUtil: number;
  xpMilestone: number;
}

function levelFor(xp: number, scaleFactor: number, maxLevel = 20): number {
  let lvl = 1;
  for (let i = 2; i <= maxLevel; i++) {
    if (xp >= (XP_THRESHOLDS[i] ?? Infinity) * scaleFactor) lvl = i;
    else break;
  }
  return lvl;
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

function stats(xs: number[]) {
  if (xs.length === 0) return { mean: 0, sd: 0, cv: 0, min: 0, max: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return {
    mean,
    sd,
    cv: mean === 0 ? 0 : sd / mean,
    min: Math.min(...xs),
    max: Math.max(...xs),
  };
}

function main() {
  const settings = applyPreset("standard");
  const source = new ProceduralSource();
  const allResults: CharResult[] = [];

  for (let season = 0; season < NUM_SEASONS; season++) {
    const seed = seedFromIds(`season-${season}`);
    const rng = createRng(seed);
    const characters = source.generateCharacters(48, rng, settings);
    const charMap = new Map(characters.map((c) => [c.id, c]));

    const sorted = [...characters].sort((a, b) => {
      const sa = Object.values(a.stats).reduce((s: number, v: number) => s + v, 0);
      const sb = Object.values(b.stats).reduce((s: number, v: number) => s + v, 0);
      return sb - sa;
    });
    const teams: typeof characters[] = Array.from({ length: TEAMS }, () => []);
    sorted.forEach((c, idx) => teams[idx % TEAMS].push(c));

    const seasonChars = new Map<string, CharResult>();
    for (const team of teams) {
      for (const c of team) {
        seasonChars.set(c.id, {
          id: c.id,
          role: c.role,
          className: c.class,
          specialty: c.specialty,
          matchupsPlayed: 0,
          totalPoints: 0,
          xpCurrent: 0,
          xpBroadened: 0,
          xpBroadenedNoBonus: 0,
          xpBroadenedNoBonusUtil: 0,
          xpMilestone: 0,
        });
      }
    }

    for (let week = 1; week <= WEEKS_PER_SEASON; week++) {
      const themeRng = rng.fork(`theme-${week}`);
      const theme = themeRng.pick(ALL_THEMES);
      const dungeon = source.generateDungeon(
        week, 0, rng.fork(`d-${week}`), theme, settings.encounterCount,
      );

      for (const team of teams) {
        if (team.length < ROSTER) continue;
        const active = team.slice(0, 4).map((c) => c.id) as [string, string, string, string];
        const lineup: Lineup = { active, bench: [team[4].id, team[5].id] };
        const events = runDungeon(lineup, charMap, dungeon, rng.fork(`s-${week}-${team[0].id}`));
        const result = score(events, team.slice(0, 4));

        for (const ch of team.slice(0, 4)) {
          const cs = result.perCharacter.get(ch.id);
          const r = seasonChars.get(ch.id)!;
          r.matchupsPlayed += 1;
          r.totalPoints += cs?.totalPoints ?? 0;
          r.xpCurrent += xpCurrent(ch, events);
          r.xpBroadened += xpBroadened(ch, events);
          r.xpBroadenedNoBonus += xpBroadenedNoBonus(ch, events);
          r.xpBroadenedNoBonusUtil += xpBroadenedNoBonusUtilLift(ch, events);
          // Milestone XP: defer calibration to after we know the current avg.
        }
      }
    }

    for (const r of seasonChars.values()) {
      if (r.matchupsPlayed > 0) allResults.push(r);
    }
  }

  // Calibrate milestone XP so that mean season XP equals the current system's mean.
  const meanCurrentTotal = allResults.reduce((a, r) => a + r.xpCurrent, 0) / allResults.length;
  const meanMatchups = allResults.reduce((a, r) => a + r.matchupsPlayed, 0) / allResults.length;
  const milestonePerMatchup = Math.round(meanCurrentTotal / meanMatchups);
  for (const r of allResults) r.xpMilestone = r.matchupsPlayed * milestonePerMatchup;

  console.log(`\n=== Leveling comparison: ${NUM_SEASONS} seasons × ${WEEKS_PER_SEASON} weeks × ${TEAMS} teams ===`);
  console.log(`Standard preset · Active characters per team: 4 · Active char-seasons: ${allResults.length}`);
  console.log(`Milestone calibration: ${milestonePerMatchup} XP per matchup (matches current mean total)\n`);

  const modes = [
    { name: "Current", get: (r: CharResult) => r.xpCurrent },
    { name: "Broadened", get: (r: CharResult) => r.xpBroadened },
    { name: "Brd-NoBon", get: (r: CharResult) => r.xpBroadenedNoBonus },
    { name: "NoBon+Util", get: (r: CharResult) => r.xpBroadenedNoBonusUtil },
    { name: "Milestone", get: (r: CharResult) => r.xpMilestone },
  ];

  console.log("--- Overall XP distribution per character-season ---");
  console.log("Mode        mean    sd    cv    min    max");
  for (const m of modes) {
    const xs = allResults.map(m.get);
    const s = stats(xs);
    console.log(
      `${m.name.padEnd(10)} ${s.mean.toFixed(1).padStart(6)} ${s.sd.toFixed(1).padStart(5)} ${s.cv.toFixed(2).padStart(5)} ${s.min.toFixed(0).padStart(5)} ${s.max.toFixed(0).padStart(6)}`
    );
  }

  console.log("\n--- Pearson correlation: season points ↔ season XP ---");
  const pts = allResults.map((r) => r.totalPoints);
  for (const m of modes) {
    const xs = allResults.map(m.get);
    console.log(`${m.name.padEnd(10)} r=${pearson(pts, xs).toFixed(3)}`);
  }

  console.log("\n--- Per-role mean XP ---");
  const roles: Role[] = ["Tank", "Healer", "DPS", "Utility"];
  console.log(`Role     ${modes.map((m) => m.name.padStart(10)).join("")}`);
  for (const role of roles) {
    const cells = modes.map((m) => {
      const xs = allResults.filter((r) => r.role === role).map(m.get);
      return stats(xs).mean.toFixed(1).padStart(10);
    });
    console.log(`${role.padEnd(8)} ${cells.join("")}`);
  }

  console.log("\n--- Implied end-of-season level (Standard preset, scaleFactor=1.0) ---");
  const scaleFactor = 10 / WEEKS_PER_SEASON;
  console.log(`Mode        mean   sd   min  max`);
  for (const m of modes) {
    const lvls = allResults.map((r) => levelFor(m.get(r), scaleFactor));
    const s = stats(lvls);
    console.log(
      `${m.name.padEnd(10)} ${s.mean.toFixed(2).padStart(5)} ${s.sd.toFixed(2).padStart(4)} ${s.min.toFixed(0).padStart(4)} ${s.max.toFixed(0).padStart(4)}`,
    );
  }

  console.log("\n--- Off-role specialty cases (top scorers under current system) ---");
  // Identify characters whose specialty core events are mostly outside their role's XP set
  // — that's where we expect Broadened to most differ from Current.
  const offRoleChars = allResults.filter((r) => {
    const roleSet = ROLE_XP_EVENTS[r.role];
    // Simulate: count how much current vs broadened diverged.
    return r.xpBroadened > r.xpCurrent * 1.15; // 15%+ XP gain under broadened
  });
  const sample = [...offRoleChars]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 8);
  console.log("class · specialty · role : pts | curXP/brdNoBon/brd | curLvl/brdNoBonLvl/brdLvl");
  for (const r of sample) {
    const curLvl = levelFor(r.xpCurrent, scaleFactor);
    const brdNoBonLvl = levelFor(r.xpBroadenedNoBonus, scaleFactor);
    const brdLvl = levelFor(r.xpBroadened, scaleFactor);
    console.log(
      `${r.className.padEnd(11)} ${r.specialty.padEnd(15)} ${r.role.padEnd(8)} : ${r.totalPoints.toFixed(0).padStart(4)} | ${r.xpCurrent.toString().padStart(4)}/${r.xpBroadenedNoBonus.toString().padStart(4)}/${r.xpBroadened.toString().padStart(4)} | L${curLvl}/L${brdNoBonLvl}/L${brdLvl}`,
    );
  }

  console.log("\n--- Utility characters (impact of NoBon+Util) ---");
  const utilityChars = allResults
    .filter((r) => r.role === "Utility")
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 8);
  console.log("class · specialty : pts | cur/noBon/noBon+Util | curL/noBonL/noBonUtilL");
  for (const r of utilityChars) {
    const cL = levelFor(r.xpCurrent, scaleFactor);
    const nL = levelFor(r.xpBroadenedNoBonus, scaleFactor);
    const uL = levelFor(r.xpBroadenedNoBonusUtil, scaleFactor);
    console.log(
      `${r.className.padEnd(11)} ${r.specialty.padEnd(15)} : ${r.totalPoints.toFixed(0).padStart(4)} | ${r.xpCurrent.toString().padStart(3)}/${r.xpBroadenedNoBonus.toString().padStart(3)}/${r.xpBroadenedNoBonusUtil.toString().padStart(3)} | L${cL}/L${nL}/L${uL}`,
    );
  }
}

main();
