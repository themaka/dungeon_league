import { Form, redirect } from "react-router";
import { createLeague } from "services/league-service.server";
import { getCurrentUser } from "~/lib/auth.server";
import type { Route } from "./+types/leagues.new";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const teamName = formData.get("teamName") as string;
  if (!name?.trim()) throw new Error("League name required");

  const user = getCurrentUser();
  const league = await createLeague(name.trim(), user.id, teamName);
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
        <button type="submit" className="btn">Create &amp; Start Draft</button>
      </Form>
    </div>
  );
}
