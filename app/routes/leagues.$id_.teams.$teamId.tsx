import { useLoaderData, useFetcher } from "react-router";
import { prisma } from "~/lib/db.server";
import { LineupEditor } from "~/components/lineup-editor";
import { CharacterCard } from "~/components/character-card";
import type { Route } from "./+types/leagues.$id_.teams.$teamId";

export async function loader({ params }: Route.LoaderArgs) {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: params.teamId },
    include: { roster: true },
  });

  const league = await prisma.league.findUniqueOrThrow({ where: { id: params.id } });

  const latestLineup = await prisma.lineup.findFirst({
    where: { teamId: params.teamId },
    orderBy: { week: "desc" },
  });

  return {
    team,
    league,
    lineup: latestLineup
      ? { active: latestLineup.active as string[], bench: latestLineup.bench as string[] }
      : null,
    isHuman: team.managerType === "human",
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
  const { team, league, lineup, isHuman } = loaderData;
  const fetcher = useFetcher();

  const handleSwap = (activeId: string, benchId: string) => {
    fetcher.submit(
      { intent: "swap", activeId, benchId },
      { method: "post" },
    );
  };

  return (
    <div>
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
