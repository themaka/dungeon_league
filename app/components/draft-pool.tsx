import { useState, useEffect } from "react";
import { CharacterCard } from "./character-card";

interface DraftPoolProps {
  leagueId?: string;
  characters: any[];
  onPick: (charId: string) => void;
  isMyTurn: boolean;
}

export function DraftPool({ leagueId, characters, onPick, isMyTurn }: DraftPoolProps) {
  const storageKey = leagueId ? `league:${leagueId}:draft:roleFilter` : null;

  const [roleFilter, setRoleFilter] = useState<string>(() => {
    if (typeof window === "undefined" || !storageKey) return "all";
    return localStorage.getItem(storageKey) ?? "all";
  });

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, roleFilter);
    }
  }, [roleFilter, storageKey]);

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
