import { exportLeague } from "services/export-import.server";
import type { Route } from "./+types/leagues.$id_.export";

export async function loader({ params }: Route.LoaderArgs) {
  const data = await exportLeague(params.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="league-${params.id}.json"`,
    },
  });
}
