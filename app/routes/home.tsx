import { Link } from "react-router";
import { prisma } from "~/lib/db.server";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dungeon League" },
    { name: "description", content: "Fantasy sports with D&D characters raiding dungeons." },
  ];
}

export async function loader() {
  const leagues = await prisma.league.findMany({
    orderBy: { createdAt: "desc" },
    include: { teams: { where: { managerType: "human" } } },
  });

  return { leagues };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { leagues } = loaderData;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1>Your Leagues</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link to="/leagues/new" className="btn">New League</Link>
          <Link to="/leagues/import" className="btn" style={{ opacity: 0.8 }}>Import</Link>
        </div>
      </div>

      {leagues.length === 0 ? (
        <div className="empty-state">
          <h2>No leagues yet</h2>
          <p>Create your first league to start drafting a team of adventurers.</p>
        </div>
      ) : (
        <div>
          {leagues.map((league) => (
            <Link key={league.id} to={`/leagues/${league.id}`} style={{ textDecoration: "none" }}>
              <div className="card">
                <h3>{league.name}</h3>
                <p style={{ color: "var(--ink-light)", fontSize: "0.9rem" }}>
                  Phase: {league.phase} &middot; Week {league.currentWeek}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
