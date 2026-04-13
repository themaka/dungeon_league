import { useLoaderData } from "react-router";
import { prisma } from "~/lib/db.server";
import { HighlightCard } from "~/components/highlight-card";
import { PlayByPlay } from "~/components/play-by-play";
import type { Route } from "./+types/leagues.$id_.matchups.$matchupId";

export async function loader({ params }: Route.LoaderArgs) {
  const matchup = await prisma.matchup.findUniqueOrThrow({
    where: { id: params.matchupId },
    include: { homeTeam: true, awayTeam: true },
  });

  const characters = await prisma.character.findMany({
    where: { leagueId: params.id },
  });

  const charNames: Record<string, string> = {};
  const charRoles: Record<string, string> = {};
  const charTeams: Record<string, string> = {};
  for (const c of characters) {
    charNames[c.externalId] = c.name;
    charRoles[c.externalId] = c.role;
    if (c.teamId === matchup.homeTeamId) {
      charTeams[c.externalId] = matchup.homeTeam.name;
    } else if (c.teamId === matchup.awayTeamId) {
      charTeams[c.externalId] = matchup.awayTeam.name;
    }
  }

  const dungeonData = matchup.dungeonData as any;
  const encounterNames: Record<string, string> = {};
  if (dungeonData?.encounters) {
    for (const enc of dungeonData.encounters) {
      encounterNames[enc.id] = enc.name;
    }
  }

  return { matchup, charNames, charRoles, charTeams, encounterNames };
}

export default function MatchupPage({ loaderData }: Route.ComponentProps) {
  const { matchup, charNames, charRoles, charTeams, encounterNames } = loaderData;
  const dungeon = matchup.dungeonData as any;
  const homeRun = matchup.homeRunData as any;
  const awayRun = matchup.awayRunData as any;

  if (!homeRun || !awayRun) {
    return <div className="card">This matchup hasn't been played yet.</div>;
  }

  const allHighlights = [
    ...(homeRun.highlights ?? []).map((h: any) => ({ ...h, _teamName: matchup.homeTeam.name })),
    ...(awayRun.highlights ?? []).map((h: any) => ({ ...h, _teamName: matchup.awayTeam.name })),
  ].sort((a: any, b: any) => {
    const imp = { high: 3, medium: 2, low: 1 };
    return (imp[b.importance as keyof typeof imp] ?? 0) - (imp[a.importance as keyof typeof imp] ?? 0);
  });

  return (
    <div>
      <h1>{dungeon?.name ?? "Dungeon"}</h1>
      <p style={{ color: "var(--ink-light)", marginBottom: "1.5rem" }}>
        Theme: {dungeon?.theme} &middot; {dungeon?.encounters?.length ?? 0} encounters
      </p>

      <div className="card" style={{ textAlign: "center", padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          <div>
            <h2>{matchup.homeTeam.name}</h2>
            <div style={{ fontSize: "2rem", fontWeight: "bold", color: matchup.winnerId === matchup.homeTeamId ? "var(--gold)" : "var(--ink-light)" }}>
              {homeRun.score?.teamTotal?.toFixed(1)}
            </div>
          </div>
          <span style={{ fontSize: "1.5rem", color: "var(--ink-light)" }}>vs</span>
          <div>
            <h2>{matchup.awayTeam.name}</h2>
            <div style={{ fontSize: "2rem", fontWeight: "bold", color: matchup.winnerId === matchup.awayTeamId ? "var(--gold)" : "var(--ink-light)" }}>
              {awayRun.score?.teamTotal?.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      <h2>Highlights</h2>
      {allHighlights.map((h: any, i: number) => (
        <HighlightCard key={i} highlight={h} teamName={h._teamName} />
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1.5rem" }}>
        <div>
          <h2>{matchup.homeTeam.name} — Play by Play</h2>
          <PlayByPlay events={homeRun.events ?? []} characterNames={charNames} characterRoles={charRoles} encounterNames={encounterNames} />
        </div>
        <div>
          <h2>{matchup.awayTeam.name} — Play by Play</h2>
          <PlayByPlay events={awayRun.events ?? []} characterNames={charNames} characterRoles={charRoles} encounterNames={encounterNames} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1.5rem" }}>
        <div>
          <h2>{matchup.homeTeam.name} — Character Stats</h2>
          <table>
            <thead>
              <tr><th>Character</th><th>Role</th><th>Base</th><th>Role Pts</th><th>Milestone</th><th>Total</th></tr>
            </thead>
            <tbody>
              {Object.entries(homeRun.score?.perCharacter ?? {}).map(([id, cs]: any) => (
                <tr key={id}>
                  <td style={{ color: {"Tank":"#4a6fa5","Healer":"#2e8b57","DPS":"#b8860b","Utility":"#7b68ee"}[charRoles[cs.characterId]] ?? "var(--ink)" }}>{charNames[cs.characterId] ?? cs.characterId}</td>
                  <td><span className={`badge badge-${(charRoles[cs.characterId] ?? "dps").toLowerCase()}`}>{charRoles[cs.characterId] ?? "?"}</span></td>
                  <td>{cs.basePoints?.toFixed(1)}</td>
                  <td>{cs.roleMultiplierPoints?.toFixed(1)}</td>
                  <td>{cs.milestonePoints?.toFixed(1)}</td>
                  <td style={{ fontWeight: "bold" }}>{cs.totalPoints?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>{matchup.awayTeam.name} — Character Stats</h2>
          <table>
            <thead>
              <tr><th>Character</th><th>Role</th><th>Base</th><th>Role Pts</th><th>Milestone</th><th>Total</th></tr>
            </thead>
            <tbody>
              {Object.entries(awayRun.score?.perCharacter ?? {}).map(([id, cs]: any) => (
                <tr key={id}>
                  <td style={{ color: {"Tank":"#4a6fa5","Healer":"#2e8b57","DPS":"#b8860b","Utility":"#7b68ee"}[charRoles[cs.characterId]] ?? "var(--ink)" }}>{charNames[cs.characterId] ?? cs.characterId}</td>
                  <td><span className={`badge badge-${(charRoles[cs.characterId] ?? "dps").toLowerCase()}`}>{charRoles[cs.characterId] ?? "?"}</span></td>
                  <td>{cs.basePoints?.toFixed(1)}</td>
                  <td>{cs.roleMultiplierPoints?.toFixed(1)}</td>
                  <td>{cs.milestonePoints?.toFixed(1)}</td>
                  <td style={{ fontWeight: "bold" }}>{cs.totalPoints?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
