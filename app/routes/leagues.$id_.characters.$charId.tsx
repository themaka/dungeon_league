import { useLoaderData } from "react-router";
import { prisma } from "~/lib/db.server";
import type { Route } from "./+types/leagues.$id_.characters.$charId";

export async function loader({ params }: Route.LoaderArgs) {
  const character = await prisma.character.findUniqueOrThrow({
    where: { id: params.charId },
    include: { team: true },
  });

  const matchups = await prisma.matchup.findMany({
    where: { leagueId: params.id, winnerId: { not: null } },
    orderBy: { week: "asc" },
  });

  const weeklyStats: { week: number; points: number; events: any[] }[] = [];
  for (const matchup of matchups) {
    for (const runData of [matchup.homeRunData, matchup.awayRunData]) {
      if (!runData) continue;
      const run = runData as any;
      const charScore = run.score?.perCharacter?.[character.externalId];
      if (charScore) {
        const charEvents = (run.events ?? []).filter(
          (e: any) => e.actorId === character.externalId,
        );
        weeklyStats.push({
          week: matchup.week,
          points: charScore.totalPoints,
          events: charEvents,
        });
      }
    }
  }

  return { character, weeklyStats };
}

export default function CharacterDetail({ loaderData }: Route.ComponentProps) {
  const { character, weeklyStats } = loaderData;
  const stats = character.stats as any;
  const roleClass = `badge badge-${character.role.toLowerCase()}`;

  const seasonTotal = weeklyStats.reduce((sum, w) => sum + w.points, 0);

  return (
    <div>
      <h1>{character.name}</h1>
      <div style={{ marginBottom: "1rem" }}>
        <span className={roleClass}>{character.role}</span>
        <span style={{ marginLeft: "0.5rem", color: "var(--ink-light)" }}>
          {character.race} {character.class} &middot; Level {character.level}
        </span>
      </div>

      <div className="card">
        <p style={{ fontStyle: "italic" }}>{character.description}</p>
      </div>

      <h2>Stats</h2>
      <div className="card" style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        {Object.entries(stats).map(([key, val]) => (
          <div key={key} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--ink-light)" }}>{key}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{val as number}</div>
          </div>
        ))}
      </div>

      {character.team && (
        <p style={{ marginTop: "1rem", color: "var(--ink-light)" }}>
          Drafted by: <strong>{character.team.name}</strong>
        </p>
      )}

      <h2>Season Performance</h2>
      <p style={{ marginBottom: "0.75rem" }}>
        Season total: <strong>{seasonTotal.toFixed(1)} pts</strong> across {weeklyStats.length} weeks
      </p>

      {weeklyStats.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Points</th>
              <th>Key Events</th>
            </tr>
          </thead>
          <tbody>
            {weeklyStats.map((w) => (
              <tr key={w.week}>
                <td>Week {w.week}</td>
                <td style={{ fontWeight: "bold" }}>{w.points.toFixed(1)}</td>
                <td style={{ fontSize: "0.85rem", color: "var(--ink-light)" }}>
                  {w.events.slice(0, 5).map((e: any) => e.kind).join(", ")}
                  {w.events.length > 5 ? ` +${w.events.length - 5} more` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: "var(--ink-light)" }}>No games played yet.</p>
      )}
    </div>
  );
}
