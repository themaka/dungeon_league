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
  buff: ["{actor} blessed {target}!", "{actor} inspired {target}!"],
  buff_proc: ["{actor}'s buff guided {target} to victory!"],
  block: ["{actor} blocked the blow!"],
  taunt: ["{actor} taunted the foe!"],
  persuade: ["{actor} persuaded the {encounter}."],
  deceive: ["{actor} outsmarted the {encounter}."],
  intimidate: ["{actor} intimidated the {encounter}."],
  dispel: ["{actor} dispelled the magic of {encounter}."],
  channel: ["{actor} channeled arcane power."],
  arcane_surge: ["{actor} unleashed an arcane surge!"],
  multiattack: ["{actor} struck multiple times!"],
  sneak_attack: ["{actor} landed a sneak attack for {amount}!"],
  smite: ["{actor} smote {target} for {amount}!"],
  rage: ["{actor} entered a rage!"],
  revivify: ["{actor} revived {target}!"],
  milestone: {
    mvp_of_run: ["{actor} was the Most Valuable Player of the run!"],
    clutch_survivor: ["{actor} survived by the skin of their teeth!"],
    first_blood: ["{actor} drew first blood!"],
    boss_killer: ["{actor} slew the dungeon boss!"],
    flawless_run: ["The party completed the dungeon without a single casualty!"],
    total_party_wipe: ["Total party wipe! The dungeon claimed every soul."],
    revivify_save: ["{actor}'s timely revival saved the day!"],
  },
};
