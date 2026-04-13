import { useLoaderData, useFetcher, Link } from "react-router";
import { prisma } from "~/lib/db.server";
import { LineupEditor } from "~/components/lineup-editor";
import { CharacterCard } from "~/components/character-card";
import type { Route } from "./+types/leagues.$id_.teams.$teamId";

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const postDraft = url.searchParams.get("postDraft") === "1";

  const team = await prisma.team.findUniqueOrThrow({
    where: { id: params.teamId },
    include: { roster: true },
  });

  const league = await prisma.league.findUniqueOrThrow({ where: { id: params.id } });

  let latestLineup = await prisma.lineup.findFirst({
    where: { teamId: params.teamId },
    orderBy: { week: "desc" },
  });

  // Auto-create a default lineup if none exists (e.g., right after draft)
  if (!latestLineup && team.roster.length >= 6) {
    const active = team.roster.slice(0, 4).map((c) => c.externalId);
    const bench = team.roster.slice(4, 6).map((c) => c.externalId);
    latestLineup = await prisma.lineup.create({
      data: { teamId: team.id, week: league.currentWeek, active, bench },
    });
  }

  return {
    team,
    league,
    lineup: latestLineup
      ? { active: latestLineup.active as string[], bench: latestLineup.bench as string[] }
      : null,
    isHuman: team.managerType === "human",
    postDraft,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "swap") {
    const activeId = formData.get("activeId") as string;
    const benchId = formData.get("benchId") as string;
    const league = await prisma.league.findUniqueOrThrow({ where: { id: params.id } });

    const lineup = await prisma.lineup.findFirst({
      where: { teamId: params.teamId },
      orderBy: { week: "desc" },
    });

    if (lineup) {
      const active = lineup.active as string[];
      const bench = lineup.bench as string[];
      const newActive = active.map((id) => (id === activeId ? benchId : id));
      const newBench = bench.map((id) => (id === benchId ? activeId : id));

      await prisma.lineup.upsert({
        where: { teamId_week: { teamId: params.teamId!, week: league.currentWeek } },
        update: { active: newActive, bench: newBench },
        create: { teamId: params.teamId!, week: league.currentWeek, active: newActive, bench: newBench },
      });
    }
  }

  return null;
}

export default function TeamPage({ loaderData }: Route.ComponentProps) {
  const { team, league, lineup, isHuman, postDraft } = loaderData;
  const fetcher = useFetcher();

  const handleSwap = (activeId: string, benchId: string) => {
    fetcher.submit(
      { intent: "swap", activeId, benchId },
      { method: "post" },
    );
  };

  return (
    <div>
      {postDraft && (
        <div className="card" style={{ background: "rgba(184, 134, 11, 0.1)", borderLeft: "4px solid var(--gold)", marginBottom: "1.5rem", padding: "1rem" }}>
          <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Draft complete! Set your lineup.</p>
          <p style={{ fontSize: "0.9rem", color: "var(--ink-light)", marginBottom: "0.75rem" }}>
            Choose which 4 characters to send into the dungeon. Swap your active and bench below, then head to the league page to start the season.
          </p>
          <Link to={`/leagues/${league.id}`} className="btn btn-gold">
            Go to League Home
          </Link>
        </div>
      )}
      <h1>{team.name} {isHuman ? "(Your Team)" : ""}</h1>
      <p style={{ color: "var(--ink-light)", marginBottom: "1.5rem" }}>
        {team.wins}W - {team.losses}L &middot; PF: {team.pointsFor.toFixed(1)} &middot; PA: {team.pointsAgainst.toFixed(1)}
      </p>

      {lineup ? (
        <LineupEditor
          roster={team.roster}
          active={lineup.active}
          bench={lineup.bench}
          onSwap={handleSwap}
          readOnly={!isHuman}
        />
      ) : (
        <div>
          <h2>Roster</h2>
          {team.roster.map((char: any) => (
            <CharacterCard key={char.id} character={char} />
          ))}
        </div>
      )}
    </div>
  );
}
