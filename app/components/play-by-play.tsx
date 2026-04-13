const ROLE_COLORS: Record<string, string> = {
  Tank: "#4a6fa5",
  Healer: "#2e8b57",
  DPS: "#b8860b",
  Utility: "#7b68ee",
};

interface PlayByPlayProps {
  events: {
    kind: string;
    actorId: string;
    targetId?: string;
    amount?: number;
    encounterId: string;
  }[];
  characterNames: Record<string, string>;
  characterRoles?: Record<string, string>;
  encounterNames?: Record<string, string>;
}

export function PlayByPlay({ events, characterNames, characterRoles = {}, encounterNames = {} }: PlayByPlayProps) {
  const getName = (id: string) => characterNames[id] ?? encounterNames[id] ?? id;
  const getRoleColor = (id: string) => ROLE_COLORS[characterRoles[id]] ?? "var(--ink)";

  const dramaticKinds = new Set(["ko", "death"]);
  const isCharacter = (id: string) => id in characterNames;

  return (
    <div style={{ maxHeight: 400, overflowY: "auto" }}>
      {events.map((event, i) => {
        const isDramatic = dramaticKinds.has(event.kind);
        return (
          <div
            key={i}
            style={{
              padding: "0.3rem 0",
              borderBottom: "1px solid var(--parchment-dark)",
              fontSize: "0.85rem",
              background: event.kind === "death" ? "rgba(139, 26, 26, 0.08)" : event.kind === "ko" ? "rgba(180, 130, 0, 0.08)" : undefined,
            }}
          >
            <span style={{
              color: isDramatic ? "var(--accent)" : "var(--ink-light)",
              marginRight: "0.5rem",
              fontWeight: isDramatic ? "bold" : undefined,
            }}>
              [{event.kind}]
            </span>
            <strong style={{ color: getRoleColor(event.actorId) }}>
              {getName(event.actorId)}
            </strong>
            {event.targetId && (
              <span>
                {" → "}
                <span style={{ color: isCharacter(event.targetId) ? getRoleColor(event.targetId) : "var(--ink)" }}>
                  {getName(event.targetId)}
                </span>
              </span>
            )}
            {event.amount != null && <span> ({event.amount})</span>}
            {event.kind === "death" && <span style={{ color: "var(--accent)", fontWeight: "bold" }}> ☠</span>}
            {event.kind === "ko" && <span style={{ color: "var(--gold)", fontWeight: "bold" }}> ⚠</span>}
          </div>
        );
      })}
    </div>
  );
}
