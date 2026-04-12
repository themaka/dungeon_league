import type { HighlightTemplateBundle } from "./content-source";

export const DEFAULT_HIGHLIGHT_TEMPLATES: HighlightTemplateBundle = {
  hit: [
    "{actor} landed a solid blow for {amount} damage!",
    "{actor} struck true, dealing {amount} damage.",
  ],
  kill: [
    "{actor} slew the {target}!",
    "{actor} delivered the killing blow to {target}.",
  ],
  crit: [
    "{actor} scored a devastating critical hit for {amount} damage!",
    "Critical strike! {actor} unleashed {amount} damage!",
  ],
  heal: [
    "{actor} healed {target} for {amount} HP.",
    "{actor} mended {target}'s wounds, restoring {amount} HP.",
  ],
  ko: [
    "{actor} was knocked unconscious!",
    "{actor} collapsed, overwhelmed by the onslaught.",
  ],
  death: [
    "{actor} has fallen! They will not continue this dungeon.",
    "{actor} met their end in the darkness.",
  ],
  disarm_trap: [
    "{actor} deftly disarmed the trap!",
    "{actor} spotted the danger and neutralized it.",
  ],
  find_treasure: [
    "{actor} discovered hidden treasure!",
    "{actor} unearthed a valuable cache!",
  ],
  save_pass: [
    "{actor} resisted the danger with ease.",
  ],
  save_fail: [
    "{actor} failed to avoid the hazard.",
  ],
  milestone: {
    mvp_of_run: ["{actor} was the Most Valuable Player of the run!"],
    clutch_survivor: ["{actor} survived by the skin of their teeth!"],
    first_blood: ["{actor} drew first blood!"],
    boss_killer: ["{actor} slew the dungeon boss!"],
    flawless_run: ["The party completed the dungeon without a single casualty!"],
    total_party_wipe: ["Total party wipe! The dungeon claimed every soul."],
  },
};
