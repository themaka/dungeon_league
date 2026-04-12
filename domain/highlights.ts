import type { Character, Dungeon, Highlight, SimEvent } from "./types";
import { DEFAULT_HIGHLIGHT_TEMPLATES } from "./content/highlight-templates";

const MAX_HIGHLIGHTS = 10;

function findCharName(chars: Character[], id: string): string {
  return chars.find((c) => c.id === id)?.name ?? id;
}

function findEncounterName(dungeon: Dungeon, encounterId: string): string {
  return dungeon.encounters.find((e) => e.id === encounterId)?.name ?? encounterId;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

interface HighlightCandidate {
  highlight: Highlight;
  priority: number;
}

export function generateHighlights(
  events: SimEvent[],
  roster: Character[],
  dungeon: Dungeon,
): Highlight[] {
  const templates = DEFAULT_HIGHLIGHT_TEMPLATES;
  const candidates: HighlightCandidate[] = [];

  for (const event of events) {
    const actorName = findCharName(roster, event.actorId);
    const targetName = event.targetId
      ? findEncounterName(dungeon, event.targetId) || findCharName(roster, event.targetId)
      : "";
    const vars = {
      actor: actorName,
      target: targetName,
      amount: String(event.amount ?? 0),
    };

    switch (event.kind) {
      case "crit": {
        const tmpl = templates.crit[0] ?? "{actor} scored a critical hit!";
        candidates.push({
          highlight: {
            kind: "crit",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "medium",
          },
          priority: 5 + (event.amount ?? 0),
        });
        break;
      }
      case "kill": {
        const isBoss = !!event.meta?.boss;
        if (isBoss) {
          const tmpl = templates.milestone.boss_killer?.[0] ?? "{actor} slew the boss!";
          candidates.push({
            highlight: {
              kind: "boss_kill",
              actorIds: [event.actorId],
              description: fillTemplate(tmpl, vars),
              importance: "high",
            },
            priority: 100,
          });
        } else {
          const tmpl = templates.kill[0] ?? "{actor} slew {target}!";
          candidates.push({
            highlight: {
              kind: "kill",
              actorIds: [event.actorId],
              description: fillTemplate(tmpl, vars),
              importance: "medium",
            },
            priority: 10,
          });
        }
        break;
      }
      case "death": {
        const tmpl = templates.death[0] ?? "{actor} has fallen!";
        candidates.push({
          highlight: {
            kind: "death",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "high",
          },
          priority: 50,
        });
        break;
      }
      case "ko": {
        const tmpl = templates.ko[0] ?? "{actor} was knocked out!";
        candidates.push({
          highlight: {
            kind: "ko",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "medium",
          },
          priority: 20,
        });
        break;
      }
      case "heal": {
        if ((event.amount ?? 0) >= 8) {
          const tmpl = templates.heal[0] ?? "{actor} healed {target}!";
          candidates.push({
            highlight: {
              kind: "heal",
              actorIds: [event.actorId],
              description: fillTemplate(tmpl, vars),
              importance: "low",
            },
            priority: 3 + (event.amount ?? 0),
          });
        }
        break;
      }
      case "disarm_trap": {
        const tmpl = templates.disarm_trap[0] ?? "{actor} disarmed the trap!";
        candidates.push({
          highlight: {
            kind: "disarm_trap",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "medium",
          },
          priority: 15,
        });
        break;
      }
      case "find_treasure": {
        const tmpl = templates.find_treasure[0] ?? "{actor} found treasure!";
        candidates.push({
          highlight: {
            kind: "find_treasure",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "medium",
          },
          priority: 12,
        });
        break;
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.slice(0, MAX_HIGHLIGHTS).map((c) => c.highlight);
}
