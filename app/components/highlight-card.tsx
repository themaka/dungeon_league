interface HighlightCardProps {
  highlight: {
    kind: string;
    actorIds: string[];
    description: string;
    importance: "high" | "medium" | "low";
  };
  teamName?: string;
}

export function HighlightCard({ highlight, teamName }: HighlightCardProps) {
  const borderColor = highlight.importance === "high"
    ? "var(--accent)"
    : highlight.importance === "medium"
    ? "var(--gold)"
    : "var(--parchment-dark)";

  return (
    <div
      className="card"
      style={{
        borderLeft: `4px solid ${borderColor}`,
        padding: highlight.importance === "high" ? "1.25rem" : "0.75rem",
        fontSize: highlight.importance === "low" ? "0.9rem" : "1rem",
      }}
    >
      <p>{highlight.description}</p>
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
