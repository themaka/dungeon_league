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
    "{actor} scored a devastating critical hit for {amount} damage during the {encounter}!",
    "Critical strike! {actor} unleashed {amount} damage in the {encounter}!",
  ],
  heal: [
    "{actor} healed {target} for {amount} HP during the {encounter}.",
    "{actor} mended {target}'s wounds, restoring {amount} HP.",
  ],
  ko: [
    "{actor} was knocked unconscious by the {encounter}!",
    "{actor} collapsed during the {encounter}!",
  ],
  death: [
    "{actor} has fallen to the {encounter}! They will not continue this dungeon.",
    "{actor} met their end in the {encounter}.",
  ],
  disarm_trap: [
    "{actor} deftly disarmed the {encounter}!",
    "{actor} spotted the {encounter} and neutralized it.",
  ],
  find_treasure: [
    "{actor} discovered hidden treasure in the {encounter}!",
    "{actor} unearthed a valuable cache!",
  ],
  save_pass: [
    "{actor} resisted the {encounter} with ease.",
  ],
  save_fail: [
    "{actor} failed to resist the {encounter}.",
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
