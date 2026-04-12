import { Form, redirect } from "react-router";
import { importLeague } from "services/export-import.server";
import type { Route } from "./+types/leagues.import";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");

  const text = await file.text();
  const data = JSON.parse(text);
  const league = await importLeague(data);

  return redirect(`/leagues/${league.id}`);
}

export default function ImportLeague() {
  return (
    <div>
      <h1>Import League</h1>
      <Form method="post" encType="multipart/form-data" className="card" style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="file" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
            League JSON File
          </label>
          <input id="file" name="file" type="file" accept=".json" required />
        </div>
        <button type="submit" className="btn">Import League</button>
      </Form>
    </div>
  );
}
