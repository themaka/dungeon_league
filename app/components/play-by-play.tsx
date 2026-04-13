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

const CONTEXT_KINDS = new Set(["damage_taken", "save_pass", "save_fail", "ko", "death"]);

export function PlayByPlay({ events, characterNames, characterRoles = {}, encounterNames = {} }: PlayByPlayProps) {
  const getName = (id: string) => characterNames[id] ?? encounterNames[id] ?? id;
  const getRoleColor = (id: string) => ROLE_COLORS[characterRoles[id]] ?? "var(--ink)";
  const isCharacter = (id: string) => id in characterNames;
  const dramaticKinds = new Set(["ko", "death"]);

  // Group events by encounter
  const grouped: { encounterId: string; events: typeof events }[] = [];
  let currentGroup: (typeof grouped)[0] | null = null;

  for (const event of events) {
    if (!currentGroup || currentGroup.encounterId !== event.encounterId) {
      currentGroup = { encounterId: event.encounterId, events: [] };
      grouped.push(currentGroup);
    }
    currentGroup.events.push(event);
  }

  return (
    <div style={{ maxHeight: 500, overflowY: "auto" }}>
      {grouped.map((group, gi) => (
        <div key={gi} style={{ marginBottom: "0.75rem" }}>
          <div style={{
            padding: "0.4rem 0.5rem",
            background: "rgba(44, 24, 16, 0.06)",
            borderLeft: "3px solid var(--gold)",
            fontWeight: "bold",
            fontSize: "0.85rem",
            color: "var(--ink-light)",
            marginBottom: "0.25rem",
          }}>
            {encounterNames[group.encounterId] ?? group.encounterId}
          </div>
          {group.events.map((event, i) => {
            const isDramatic = dramaticKinds.has(event.kind);
            const showEncounterContext = CONTEXT_KINDS.has(event.kind) && !event.targetId;
            return (
              <div
                key={i}
                style={{
                  padding: "0.25rem 0 0.25rem 0.75rem",
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
                {showEncounterContext && (
                  <span style={{ color: "var(--ink-light)" }}>
                    {" ← "}{encounterNames[event.encounterId] ?? event.encounterId}
                  </span>
                )}
                {event.amount != null && <span> ({event.amount})</span>}
                {event.kind === "death" && <span style={{ color: "var(--accent)", fontWeight: "bold" }}> ☠</span>}
                {event.kind === "ko" && <span style={{ color: "var(--gold)", fontWeight: "bold" }}> ⚠</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
