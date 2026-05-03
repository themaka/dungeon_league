import type {
  Character, EncounterType, LeagueSettings, Lineup, ScoutingReport, SimEvent,
} from "./types";
import type { ContentSource } from "./content/content-source";
import { runDungeon } from "./sim/sim-engine";
import { score } from "./scoring";
import { createRng, seedFromIds } from "./rng";
import { isCoreEventForSpecialty } from "./specialties";
import { ALL_THEMES } from "./themes";

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  const variance = xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

export function runScouting(
  characters: Character[],
  contentSource: ContentSource,
  leagueId: string,
  runs: number,
  settings: LeagueSettings,
): Record<string, ScoutingReport> {
  const charMap = new Map(characters.map((c) => [c.id, c]));
  const perCharRunPoints = new Map<string, number[]>();
  const perCharEventPoints = new Map<string, Record<string, number>>();
  const perCharProcCount = new Map<string, { proc: number; total: number }>();
  const perCharByEncounterType = new Map<string, Record<EncounterType, number[]>>();

  for (const c of characters) {
    perCharRunPoints.set(c.id, []);
    perCharEventPoints.set(c.id, {});
    perCharProcCount.set(c.id, { proc: 0, total: 0 });
    perCharByEncounterType.set(c.id, {
      combat: [], trap: [], puzzle: [], treasure: [], social: [], arcane: [],
    });
  }

  for (let runIdx = 0; runIdx < runs; runIdx++) {
    const baseRng = createRng(seedFromIds(leagueId, "scout", String(runIdx)));
    const shuffled = baseRng.shuffle([...characters]);
    const partySize = 4;
    const totalParties = Math.floor(shuffled.length / partySize);

    for (let p = 0; p < totalParties; p++) {
      const party = shuffled.slice(p * partySize, (p + 1) * partySize);
      if (party.length < partySize) continue;

      const lineup: Lineup = {
        active: [party[0].id, party[1].id, party[2].id, party[3].id],
        bench: ["bench-a", "bench-b"],
      };
      const theme = baseRng.pick(ALL_THEMES);
      const dungeon = contentSource.generateDungeon(0, p, baseRng.fork(`d${p}`), theme, settings.encounterCount);
      const events = runDungeon(lineup, charMap, dungeon, baseRng.fork(`s${p}`));
      const result = score(events, party);

      for (const c of party) {
        const cs = result.perCharacter.get(c.id);
        if (!cs) continue;
        perCharRunPoints.get(c.id)!.push(cs.totalPoints);

        const eventBreakdown = perCharEventPoints.get(c.id)!;
        for (const e of events) {
          if (e.actorId !== c.id) continue;
          eventBreakdown[e.kind] = (eventBreakdown[e.kind] ?? 0) + 1;
        }

        const procStat = perCharProcCount.get(c.id)!;
        for (const e of events) {
          if (e.actorId !== c.id) continue;
          procStat.total += 1;
          if (isCoreEventForSpecialty(c.specialty, e.kind)) procStat.proc += 1;
        }

        const byEnc = perCharByEncounterType.get(c.id)!;
        const eventsByEnc = new Map<string, SimEvent[]>();
        for (const e of events) {
          if (e.actorId !== c.id) continue;
          const enc = dungeon.encounters.find((x) => x.id === e.encounterId);
          if (!enc) continue;
          if (!eventsByEnc.has(enc.type)) eventsByEnc.set(enc.type, []);
          eventsByEnc.get(enc.type)!.push(e);
        }
        for (const [encType, evs] of eventsByEnc) {
          const subtotal = score(evs, [c]).perCharacter.get(c.id)!.totalPoints;
          byEnc[encType as EncounterType].push(subtotal);
        }
      }
    }
  }

  const reports: Record<string, ScoutingReport> = {};
  for (const c of characters) {
    const points = perCharRunPoints.get(c.id) ?? [];
    const procs = perCharProcCount.get(c.id) ?? { proc: 0, total: 0 };
    const byEnc = perCharByEncounterType.get(c.id)!;
    const avgByType: Record<string, number> = {};
    for (const [k, v] of Object.entries(byEnc)) avgByType[k] = mean(v);

    let bestType: EncounterType = "combat";
    let bestVal = -Infinity;
    let worstType: EncounterType = "combat";
    let worstVal = Infinity;
    for (const [k, v] of Object.entries(avgByType)) {
      if (v > bestVal) { bestVal = v; bestType = k as EncounterType; }
      if (v < worstVal) { worstVal = v; worstType = k as EncounterType; }
    }

    const avg = mean(points);
    const sd = stddev(points);
    const consistency = avg > 0 ? Math.max(0, Math.min(1, 1 - sd / Math.max(avg, 1))) : 0;

    reports[c.id] = {
      characterId: c.id,
      runs,
      avgPoints: Number(avg.toFixed(2)),
      pointsByEventType: avgByType,
      bestEncounterType: bestType,
      worstEncounterType: worstType,
      specialtyProcRate: procs.total > 0 ? procs.proc / procs.total : 0,
      consistencyScore: Number(consistency.toFixed(3)),
      projectedValue: 0,
    };
    reports[c.id].projectedValue = projectedValue(reports[c.id]);
  }

  return reports;
}

export function projectedValue(report: ScoutingReport): number {
  const ptsTerm = Math.max(report.avgPoints, 0);
  const procTerm = report.specialtyProcRate * 5;
  const consistencyTerm = report.consistencyScore * 3;
  return Number((ptsTerm + procTerm + consistencyTerm).toFixed(2));
}
