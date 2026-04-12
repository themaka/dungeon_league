interface HighlightCardProps {
  highlight: {
    kind: string;
    actorIds: string[];
    description: string;
    importance: "high" | "medium" | "low";
  };
}

export function HighlightCard({ highlight }: HighlightCardProps) {
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
      <span style={{ fontSize: "0.75rem", color: "var(--ink-light)", textTransform: "uppercase" }}>
        {highlight.kind.replace("_", " ")}
      </span>
    </div>
  );
}
