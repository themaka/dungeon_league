interface PlayByPlayProps {
  events: {
    kind: string;
    actorId: string;
    targetId?: string;
    amount?: number;
    encounterId: string;
  }[];
  characterNames: Record<string, string>;
  encounterNames?: Record<string, string>;
}

export function PlayByPlay({ events, characterNames, encounterNames = {} }: PlayByPlayProps) {
  const getName = (id: string) => characterNames[id] ?? encounterNames[id] ?? id;

  return (
    <div style={{ maxHeight: 400, overflowY: "auto" }}>
      {events.map((event, i) => (
        <div
          key={i}
          style={{
            padding: "0.3rem 0",
            borderBottom: "1px solid var(--parchment-dark)",
            fontSize: "0.85rem",
          }}
        >
          <span style={{ color: "var(--ink-light)", marginRight: "0.5rem" }}>
            [{event.kind}]
          </span>
          <strong>{getName(event.actorId)}</strong>
          {event.targetId && <span> &rarr; {getName(event.targetId)}</span>}
          {event.amount != null && <span> ({event.amount})</span>}
        </div>
      ))}
    </div>
  );
}
