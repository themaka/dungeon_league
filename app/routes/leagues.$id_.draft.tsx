import { useLoaderData, useFetcher, redirect } from "react-router";
import { getDraftState, makePick, makeAIPick } from "services/draft-service.server";
import { getCurrentUser } from "~/lib/auth.server";
import { DraftPool } from "~/components/draft-pool";
import { CharacterCard } from "~/components/character-card";
import type { Route } from "./+types/leagues.$id_.draft";

export async function loader({ params }: Route.LoaderArgs) {
  const state = await getDraftState(params.id);
  const user = getCurrentUser();

  if (state.currentPick >= state.totalPicks) {
    return redirect(`/leagues/${params.id}`);
  }

  const currentSlot = state.draftOrder[state.currentPick];
  const humanTeam = state.teams.find(
    (t) => t.managerType === "human"
  );

  return {
    ...state,
    isMyTurn: currentSlot?.teamId === humanTeam?.id,
    currentTeamName: state.teams.find((t) => t.id === currentSlot?.teamId)?.name ?? "Unknown",
    humanTeamId: humanTeam?.id,
    myRoster: humanTeam?.roster ?? [],
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "pick") {
    const charId = formData.get("characterId") as string;
    const teamId = formData.get("teamId") as string;
    await makePick(params.id, teamId, charId);
  } else if (intent === "ai-pick") {
    await makeAIPick(params.id);
  }

  const state = await getDraftState(params.id);
  if (state.currentPick >= state.totalPicks) {
    return redirect(`/leagues/${params.id}`);
  }

  return null;
}

export default function DraftRoom({ loaderData }: Route.ComponentProps) {
  const data = loaderData;
  const fetcher = useFetcher();

  const handlePick = (charId: string) => {
    fetcher.submit(
      { intent: "pick", characterId: charId, teamId: data.humanTeamId! },
      { method: "post" },
    );
  };

  const handleAIPick = () => {
    fetcher.submit({ intent: "ai-pick" }, { method: "post" });
  };

  return (
    <div>
      <h1>Draft Room</h1>
      <div style={{ marginBottom: "1rem" }} className="card">
        <p>
          Pick {data.currentPick + 1} of {data.totalPicks} &mdash;{" "}
          <strong>{data.currentTeamName}</strong>
          {data.isMyTurn ? " (Your pick!)" : "'s turn"}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem" }}>
        <div>
          <h2>Available Characters ({data.available.length})</h2>
          {data.isMyTurn ? (
            <DraftPool
              leagueId={data.leagueId}
              characters={data.available}
              onPick={handlePick}
              isMyTurn={true}
            />
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p>Waiting for <strong>{data.currentTeamName}</strong> to pick...</p>
              <button onClick={handleAIPick} className="btn" style={{ marginTop: "1rem" }}>
                Continue
              </button>
            </div>
          )}
        </div>

        <div>
          <h2>Your Roster ({data.myRoster.length}/6)</h2>
          {data.myRoster.length === 0 ? (
            <p style={{ color: "var(--ink-light)", fontSize: "0.9rem" }}>No characters drafted yet.</p>
          ) : (
            data.myRoster.map((char: any) => (
              <CharacterCard key={char.id} character={char} compact />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
