const ROLE_COLORS: Record<string, string> = {
  Tank: "#4a6fa5",
  Healer: "#2e8b57",
  DPS: "#b8860b",
  Utility: "#7b68ee",
};

const EVENT_LABELS: Record<string, { icon: string; label: string }> = {
  hit: { icon: "⚔", label: "Hit" },
  kill: { icon: "💀", label: "Kill" },
  crit: { icon: "🎯", label: "Crit" },
  heal: { icon: "✨", label: "Heal" },
  damage_taken: { icon: "🩸", label: "Damage taken" },
  save_pass: { icon: "🛡", label: "Save" },
  save_fail: { icon: "✗", label: "Failed save" },
  disarm_trap: { icon: "🔧", label: "Disarmed trap" },
  find_treasure: { icon: "💰", label: "Treasure" },
  ko: { icon: "💤", label: "KO" },
  death: { icon: "☠", label: "Death" },
  buff: { icon: "🌟", label: "Buff" },
  buff_proc: { icon: "🌟", label: "Buff proc" },
  block: { icon: "🛡", label: "Block" },
  taunt: { icon: "📢", label: "Taunt" },
  persuade: { icon: "💬", label: "Persuade" },
  deceive: { icon: "🎭", label: "Deceive" },
  intimidate: { icon: "😠", label: "Intimidate" },
  dispel: { icon: "🌀", label: "Dispel" },
  channel: { icon: "🔮", label: "Channel" },
  arcane_surge: { icon: "⚡", label: "Arcane surge" },
  multiattack: { icon: "⚔⚔", label: "Multiattack" },
  sneak_attack: { icon: "🗡", label: "Sneak attack" },
  smite: { icon: "✨⚔", label: "Smite" },
  rage: { icon: "🔥", label: "Rage" },
  revivify: { icon: "💖", label: "Revivify" },
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
const DRAMATIC_KINDS = new Set(["ko", "death", "revivify"]);

export function PlayByPlay({ events, characterNames, characterRoles = {}, encounterNames = {} }: PlayByPlayProps) {
  const getName = (id: string) => characterNames[id] ?? encounterNames[id] ?? id;
  const getRoleColor = (id: string) => ROLE_COLORS[characterRoles[id]] ?? "var(--ink)";
  const isCharacter = (id: string) => id in characterNames;
  const labelFor = (kind: string) => EVENT_LABELS[kind]?.label ?? kind;
  const iconFor = (kind: string) => EVENT_LABELS[kind]?.icon ?? "•";

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
            const isDramatic = DRAMATIC_KINDS.has(event.kind);
            const showEncounterContext = CONTEXT_KINDS.has(event.kind) && !event.targetId;
            const bgColor =
              event.kind === "death" ? "rgba(139, 26, 26, 0.08)" :
              event.kind === "ko" ? "rgba(180, 130, 0, 0.08)" :
              event.kind === "revivify" ? "rgba(46, 139, 87, 0.10)" :
              undefined;
            return (
              <div
                key={i}
                style={{
                  padding: "0.25rem 0 0.25rem 0.75rem",
                  borderBottom: "1px solid var(--parchment-dark)",
                  fontSize: "0.85rem",
                  background: bgColor,
                }}
              >
                <span style={{
                  color: isDramatic ? "var(--accent)" : "var(--ink-light)",
                  marginRight: "0.5rem",
                  fontWeight: isDramatic ? "bold" : undefined,
                }} title={event.kind}>
                  {iconFor(event.kind)} {labelFor(event.kind)}
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
                {event.kind === "revivify" && <span style={{ color: "#2e8b57", fontWeight: "bold" }}> ✚</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
