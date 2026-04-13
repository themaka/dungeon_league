import { Link, useFetcher } from "react-router";
import { getLeague, advanceWeek } from "services/league-service.server";
import { StandingsTable } from "~/components/standings-table";
import type { Route } from "./+types/leagues.$id";

export async function loader({ params }: Route.LoaderArgs) {
  const league = await getLeague(params.id);
  return { league };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "advance") {
    await advanceWeek(params.id);
  }

  return null;
}

export default function LeagueHome({ loaderData }: Route.ComponentProps) {
  const { league } = loaderData;
  const fetcher = useFetcher();

  const currentWeekMatchups = league.matchups.filter((m) => m.week === league.currentWeek);
  const pastWeeks = [...new Set(league.matchups.filter((m) => m.winnerId).map((m) => m.week))].sort(
    (a, b) => b - a,
  );

  const canAdvance = league.phase === "regular" || league.phase === "playoffs";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{league.name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ color: "var(--ink-light)" }}>
            {league.phase === "complete" ? "Season Complete" : `Week ${league.currentWeek} — ${league.phase}`}
          </span>
          <a href={`/leagues/${league.id}/export`} className="btn" style={{ fontSize: "0.85rem", padding: "0.3rem 0.8rem" }}>
            Download Backup
          </a>
        </div>
      </div>

      {league.phase === "draft" && (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <p>Draft in progress.</p>
          <Link to={`/leagues/${league.id}/draft`} className="btn" style={{ marginTop: "1rem" }}>
            Go to Draft Room
          </Link>
        </div>
      )}

      {canAdvance && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2>Week {league.currentWeek} Matchups</h2>
          {currentWeekMatchups.length > 0 ? (
            <div>
              {currentWeekMatchups.map((m) => {
                const home = league.teams.find((t) => t.id === m.homeTeamId);
                const away = league.teams.find((t) => t.id === m.awayTeamId);
                return (
                  <div key={m.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{home?.name ?? "?"}</span>
                    <span style={{ color: "var(--ink-light)" }}>vs</span>
                    <span>{away?.name ?? "?"}</span>
                    {m.winnerId && (
                      <Link to={`/leagues/${league.id}/matchups/${m.id}`} className="btn" style={{ fontSize: "0.85rem", padding: "0.3rem 0.8rem" }}>
                        View
                      </Link>
                    )}
                  </div>
                );
              })}

              {!currentWeekMatchups.some((m) => m.winnerId) && (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="advance" />
                  <button type="submit" className="btn btn-gold" style={{ marginTop: "1rem", width: "100%" }}>
                    Advance Week {league.currentWeek}
                  </button>
                </fetcher.Form>
              )}
            </div>
          ) : (
            <p style={{ color: "var(--ink-light)" }}>No matchups scheduled for this week.</p>
          )}
        </div>
      )}

      <h2>Standings</h2>
      <StandingsTable teams={league.teams as any} leagueId={league.id} />

      {pastWeeks.length > 0 && (
        <div>
          <h2>Past Weeks</h2>
          {pastWeeks.map((week) => {
            const weekMatchups = league.matchups.filter((m) => m.week === week && m.winnerId);
            return (
              <div key={week} style={{ marginBottom: "1rem" }}>
                <h3>Week {week}</h3>
                {weekMatchups.map((m) => {
                  const home = league.teams.find((t) => t.id === m.homeTeamId);
                  const away = league.teams.find((t) => t.id === m.awayTeamId);
                  const winner = league.teams.find((t) => t.id === m.winnerId);
                  return (
                    <Link key={m.id} to={`/leagues/${league.id}/matchups/${m.id}`} style={{ textDecoration: "none" }}>
                      <div className="card" style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{home?.name} vs {away?.name}</span>
                        <span style={{ color: "var(--gold)", fontWeight: "bold" }}>Winner: {winner?.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
