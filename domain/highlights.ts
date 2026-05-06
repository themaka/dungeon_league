import type { Character, Dungeon, Highlight, SimEvent } from "./types";
import { DEFAULT_HIGHLIGHT_TEMPLATES } from "./content/highlight-templates";
import { pointsForEvent } from "./scoring";

const MAX_HIGHLIGHTS = 10;

function findCharName(chars: Character[], id: string): string | undefined {
  return chars.find((c) => c.id === id)?.name;
}

function findEncounterName(dungeon: Dungeon, encounterId: string): string | undefined {
  return dungeon.encounters.find((e) => e.id === encounterId)?.name;
}

function resolveTargetName(id: string, roster: Character[], dungeon: Dungeon): string {
  return findCharName(roster, id) ?? findEncounterName(dungeon, id) ?? id;
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
    const actor = roster.find((c) => c.id === event.actorId);
    const actorName = actor?.name ?? event.actorId;
    const targetName = event.targetId
      ? resolveTargetName(event.targetId, roster, dungeon)
      : "";
    const encounterName = findEncounterName(dungeon, event.encounterId) ?? event.encounterId;
    const vars = {
      actor: actorName,
      target: targetName,
      amount: String(event.amount ?? 0),
      encounter: encounterName,
    };
    const points = actor ? pointsForEvent(event, actor) : 0;

    switch (event.kind) {
      case "crit": {
        const tmpl = templates.crit[0] ?? "{actor} scored a critical hit!";
        candidates.push({
          highlight: {
            kind: "crit",
            actorIds: [event.actorId],
            description: fillTemplate(tmpl, vars),
            importance: "medium",
            points,
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
              points,
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
              points,
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
            points,
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
            points,
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
              points,
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
            points,
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
            points,
          },
          priority: 12,
        });
        break;
      }
      case "revivify": {
        const tmpl = templates.revivify[0] ?? "{actor} revived {target}!";
        candidates.push({
          highlight: { kind: "revivify", actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "high", points },
          priority: 80,
        });
        break;
      }
      case "arcane_surge": {
        const tmpl = templates.arcane_surge[0] ?? "{actor} unleashed an arcane surge!";
        candidates.push({
          highlight: { kind: "arcane_surge", actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "medium", points },
          priority: 25,
        });
        break;
      }
      case "smite": {
        if ((event.amount ?? 0) >= 6) {
          const tmpl = templates.smite[0] ?? "{actor} smote {target}!";
          candidates.push({
            highlight: { kind: "smite", actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "medium", points },
            priority: 15 + (event.amount ?? 0),
          });
        }
        break;
      }
      case "sneak_attack": {
        if ((event.amount ?? 0) >= 6) {
          const tmpl = templates.sneak_attack[0] ?? "{actor} landed a sneak attack!";
          candidates.push({
            highlight: { kind: "sneak_attack", actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "medium", points },
            priority: 12 + (event.amount ?? 0),
          });
        }
        break;
      }
      case "buff": {
        const tmpl = templates.buff[0] ?? "{actor} buffed {target}!";
        candidates.push({
          highlight: { kind: "buff", actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "low", points },
          priority: 5,
        });
        break;
      }
      case "persuade":
      case "deceive":
      case "intimidate": {
        const tmpl = templates[event.kind][0] ?? `{actor} prevailed.`;
        candidates.push({
          highlight: { kind: event.kind, actorIds: [event.actorId], description: fillTemplate(tmpl, vars), importance: "low", points },
          priority: 8,
        });
        break;
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.slice(0, MAX_HIGHLIGHTS).map((c) => c.highlight);
}
