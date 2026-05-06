import { unlockedAbilities } from "domain/abilities";

interface CharacterCardProps {
  character: {
    id: string;
    name: string;
    race: string;
    class: string;
    role: string;
    specialty?: string;
    stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
    level: number;
    xp?: number;
    abilityTiers?: number[];
    description: string;
    scouting?: {
      avgPoints?: number;
      specialtyProcRate?: number;
      consistencyScore?: number;
      projectedValue?: number;
    };
  };
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  expandable?: boolean;
  seasonStats?: { total: number; games: number; lastGame: number | null };
}

export function CharacterCard({ character, onClick, selected, compact, expandable, seasonStats }: CharacterCardProps) {
  const roleClass = `badge badge-${character.role.toLowerCase()}`;
  const abilities = character.specialty
    ? unlockedAbilities(
        character.class as any,
        character.specialty as any,
        character.level,
      )
    : [];

  const details = (
    <>
      <div style={{ fontSize: "0.8rem", marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <span>STR {character.stats.str}</span>
        <span>DEX {character.stats.dex}</span>
        <span>CON {character.stats.con}</span>
        <span>INT {character.stats.int}</span>
        <span>WIS {character.stats.wis}</span>
        <span>CHA {character.stats.cha}</span>
      </div>

      {abilities.length > 0 && (
        <div style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
          <strong>Abilities:</strong>{" "}
          {abilities.map((a) => a.name).join(", ")}
        </div>
      )}

      {character.scouting && (
        <div style={{ fontSize: "0.8rem", marginTop: "0.5rem", padding: "0.4rem", background: "var(--parchment-dark, #f4ecd8)", borderRadius: 4 }}>
          <strong>Scouting:</strong>{" "}
          avg {character.scouting.avgPoints?.toFixed(1) ?? "?"} pts
          {character.scouting.specialtyProcRate !== undefined
            ? ` · proc ${(character.scouting.specialtyProcRate * 100).toFixed(0)}%`
            : null}
          {character.scouting.projectedValue !== undefined
            ? ` · value ${character.scouting.projectedValue}`
            : null}
        </div>
      )}

      <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", fontStyle: "italic" }}>
        {character.description}
      </p>
    </>
  );

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        border: selected ? "2px solid var(--accent)" : undefined,
        padding: compact ? "0.5rem" : "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{character.name}</strong>
        <span className={roleClass}>{character.role}</span>
      </div>
      <div style={{ fontSize: "0.85rem", color: "var(--ink-light)", marginTop: "0.25rem" }}>
        {character.race} {character.class}
        {character.specialty ? ` · ${character.specialty}` : null}
        {` · L${character.level}`}
      </div>

      {seasonStats && seasonStats.games > 0 && (
        <div style={{ fontSize: "0.8rem", marginTop: "0.3rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <span><strong>Season:</strong> {seasonStats.total.toFixed(1)} pts</span>
          <span style={{ color: "var(--ink-light)" }}>
            · {(seasonStats.total / seasonStats.games).toFixed(1)}/game
            {seasonStats.lastGame !== null ? ` · last ${seasonStats.lastGame.toFixed(1)}` : ""}
          </span>
        </div>
      )}

      {!compact && details}

      {compact && expandable && (
        <details style={{ marginTop: "0.4rem" }} onClick={(e) => e.stopPropagation()}>
          <summary style={{ fontSize: "0.8rem", color: "var(--ink-light)", cursor: "pointer" }}>
            Details
          </summary>
          {details}
        </details>
      )}
    </div>
  );
}
