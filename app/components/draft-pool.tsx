import { useState } from "react";
import { CharacterCard } from "./character-card";

interface DraftPoolProps {
  characters: any[];
  onPick: (charId: string) => void;
  isMyTurn: boolean;
}

export function DraftPool({ characters, onPick, isMyTurn }: DraftPoolProps) {
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filtered = roleFilter === "all"
    ? characters
    : characters.filter((c) => c.role === roleFilter);

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {["all", "Tank", "Healer", "DPS", "Utility"].map((role) => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={roleFilter === role ? "btn" : "btn"}
            style={{
              padding: "0.3rem 0.8rem",
              fontSize: "0.85rem",
              opacity: roleFilter === role ? 1 : 0.6,
            }}
          >
            {role === "all" ? "All" : role}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {filtered.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            onClick={isMyTurn ? () => onPick(char.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
