const ROLE_COLORS: Record<string, string> = {
  Tank: "#4a6fa5",
  Healer: "#2e8b57",
  DPS: "#b8860b",
  Utility: "#7b68ee",
};

interface HighlightCardProps {
  highlight: {
    kind: string;
    actorIds: string[];
    description: string;
    importance: "high" | "medium" | "low";
  };
  teamName?: string;
  characterNames?: Record<string, string>;
  characterRoles?: Record<string, string>;
}

function colorizeNames(
  description: string,
  characterNames: Record<string, string>,
  characterRoles: Record<string, string>,
): (string | JSX.Element)[] {
  const names = Object.entries(characterNames)
    .map(([id, name]) => ({ id, name, role: characterRoles[id] }))
    .filter((e) => description.includes(e.name))
    .sort((a, b) => b.name.length - a.name.length);

  if (names.length === 0) return [description];

  const parts: (string | JSX.Element)[] = [];
  let remaining = description;
  let keyIdx = 0;

  while (remaining.length > 0) {
    let earliest = -1;
    let matched: (typeof names)[0] | null = null;

    for (const entry of names) {
      const idx = remaining.indexOf(entry.name);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        matched = entry;
      }
    }

    if (matched === null || earliest === -1) {
      parts.push(remaining);
      break;
    }

    if (earliest > 0) {
      parts.push(remaining.slice(0, earliest));
    }
    parts.push(
      <strong key={keyIdx++} style={{ color: ROLE_COLORS[matched.role] ?? "var(--ink)" }}>
        {matched.name}
      </strong>
    );
    remaining = remaining.slice(earliest + matched.name.length);
  }

  return parts;
}

export function HighlightCard({ highlight, teamName, characterNames = {}, characterRoles = {} }: HighlightCardProps) {
  const borderColor = highlight.importance === "high"
    ? "var(--accent)"
    : highlight.importance === "medium"
    ? "var(--gold)"
    : "var(--parchment-dark)";

  const description = colorizeNames(highlight.description, characterNames, characterRoles);

  return (
    <div
      className="card"
      style={{
        borderLeft: `4px solid ${borderColor}`,
        padding: highlight.importance === "high" ? "1.25rem" : "0.75rem",
        fontSize: "1rem",
      }}
    >
      <p>{description}</p>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--ink-light)", textTransform: "uppercase" }}>
          {highlight.kind.replace("_", " ")}
        </span>
        {teamName && (
          <span style={{ fontSize: "0.75rem", color: "var(--ink-light)" }}>
            — {teamName}
          </span>
        )}
      </div>
    </div>
  );
}
