import { CharacterCard } from "./character-card";

interface LineupEditorProps {
  roster: any[];
  active: string[];
  bench: string[];
  onSwap: (activeId: string, benchId: string) => void;
  readOnly?: boolean;
}

export function LineupEditor({ roster, active, bench, onSwap, readOnly }: LineupEditorProps) {
  const activeChars = active.map((id) => roster.find((c) => c.externalId === id)).filter(Boolean);
  const benchChars = bench.map((id) => roster.find((c) => c.externalId === id)).filter(Boolean);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
      <div>
        <h3>Active (4)</h3>
        {activeChars.map((char: any) => (
          <div key={char.id} style={{ position: "relative" }}>
            <CharacterCard character={char} compact />
            {!readOnly && benchChars.length > 0 && (
              <div style={{ marginTop: "-0.5rem", marginBottom: "0.5rem" }}>
                {benchChars.map((bc: any) => (
                  <button
                    key={bc.id}
                    onClick={() => onSwap(char.externalId, bc.externalId)}
                    className="btn"
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", marginRight: "0.25rem" }}
                  >
                    Swap with {bc.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div>
        <h3>Bench (2)</h3>
        {benchChars.map((char: any) => (
          <CharacterCard key={char.id} character={char} compact />
        ))}
      </div>
    </div>
  );
}
