import { exportLeague } from "services/export-import.server";
import type { Route } from "./+types/leagues.$id_.export";

export async function loader({ params }: Route.LoaderArgs) {
  const data = await exportLeague(params.id);
  const slug = data.league.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${slug}.json"`,
    },
  });
}
