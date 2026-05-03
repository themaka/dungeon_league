import { Form, redirect } from "react-router";
import { createLeague } from "services/league-service.server";
import { getCurrentUser } from "~/lib/auth.server";
import type { Route } from "./+types/leagues.new";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const teamName = formData.get("teamName") as string;
  if (!name?.trim()) throw new Error("League name required");

  const presetRaw = (formData.get("preset") as string) ?? "standard";
  const validPresets = ["standard", "quick", "epic", "champions", "veterans"] as const;
  type ValidPreset = typeof validPresets[number];
  const preset: ValidPreset = (validPresets as readonly string[]).includes(presetRaw)
    ? (presetRaw as ValidPreset) : "standard";

  const user = getCurrentUser();
  const league = await createLeague(name.trim(), user.id, teamName, { preset });
  return redirect(`/leagues/${league.id}/draft`);
}

export default function NewLeague() {
  return (
    <div>
      <h1>Create New League</h1>
      <Form method="post" className="card" style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="name" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
            League Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Enter league name..."
            style={{
              width: "100%",
              padding: "0.5rem",
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
              border: "1px solid var(--parchment-dark)",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.5)",
            }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="teamName" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
            Your Team Name
          </label>
          <input
            id="teamName"
            name="teamName"
            type="text"
            placeholder="Your Team"
            style={{
              width: "100%",
              padding: "0.5rem",
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
              border: "1px solid var(--parchment-dark)",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.5)",
            }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="preset" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
            League Style
          </label>
          <select
            id="preset"
            name="preset"
            defaultValue="standard"
            style={{
              width: "100%",
              padding: "0.5rem",
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
              border: "1px solid var(--parchment-dark)",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.5)",
            }}
          >
            <option value="standard">Standard — 10+3 weeks, level 12-13</option>
            <option value="quick">Quick Play — 5+2 weeks, level 8-9</option>
            <option value="epic">Epic Campaign — 20+4 weeks, level 18-20</option>
            <option value="champions">Champions — Level 20 from start, no XP</option>
            <option value="veterans">Veterans — Start at level 5, deep scouting</option>
          </select>
        </div>
        <button type="submit" className="btn">Create &amp; Start Draft</button>
      </Form>
    </div>
  );
}
