import type { Character, CharacterClass, Race, Stats, Dungeon, Encounter, EncounterType } from "domain/types";
import { CLASS_ROLE_MAP } from "domain/types";
import type { Rng } from "domain/rng";
import type { ContentSource, HighlightTemplateBundle } from "./content-source";
import { DEFAULT_HIGHLIGHT_TEMPLATES } from "./highlight-templates";
import {
  FIRST_NAMES, LAST_NAMES, ADJECTIVES, ADJECTIVES_2, TRAITS, QUIRKS,
  BACKGROUNDS, DESCRIPTION_TEMPLATES, DUNGEON_PREFIXES, DUNGEON_NOUNS,
  DUNGEON_THEMES, ENCOUNTER_NAMES, BOSS_NAMES,
} from "./name-tables";

const ALL_RACES: Race[] = [
  "Human", "Elf", "Dwarf", "Halfling", "Orc", "Gnome", "Tiefling", "Dragonborn",
];

const ALL_CLASSES: CharacterClass[] = [
  "Fighter", "Wizard", "Rogue", "Cleric", "Ranger", "Paladin",
  "Barbarian", "Bard", "Druid", "Warlock", "Monk", "Sorcerer",
];

function generateDescription(
  rng: Rng,
  name: string,
  race: Race,
  charClass: CharacterClass,
): string {
  const template = rng.pick(DESCRIPTION_TEMPLATES);
  return template
    .replace("{name}", name)
    .replace("{race}", race)
    .replace("{class}", charClass)
    .replace("{adjective2}", rng.pick(ADJECTIVES_2))
    .replace("{adjective}", rng.pick(ADJECTIVES))
    .replace("{trait}", rng.pick(TRAITS))
    .replace("{quirk}", rng.pick(QUIRKS))
    .replace("{background}", rng.pick(BACKGROUNDS));
}

function rollStats(rng: Rng): Stats {
  return {
    str: rng.rollStat(),
    dex: rng.rollStat(),
    con: rng.rollStat(),
    int: rng.rollStat(),
    wis: rng.rollStat(),
    cha: rng.rollStat(),
  };
}

export class ProceduralSource implements ContentSource {
  generateCharacters(count: number, rng: Rng): Character[] {
    const usedNames = new Set<string>();
    const characters: Character[] = [];

    const shuffledFirstNames = rng.shuffle([...FIRST_NAMES]);
    const shuffledLastNames = rng.shuffle([...LAST_NAMES]);

    for (let i = 0; i < count; i++) {
      const firstName = shuffledFirstNames[i % shuffledFirstNames.length];
      const lastName = shuffledLastNames[i % shuffledLastNames.length];
      let fullName = `${firstName} ${lastName}`;

      let attempt = 0;
      while (usedNames.has(fullName) && attempt < 100) {
        fullName = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
        attempt++;
      }
      usedNames.add(fullName);

      const charClass = rng.pick(ALL_CLASSES);
      const race = rng.pick(ALL_RACES);
      const role = CLASS_ROLE_MAP[charClass];
      const stats = rollStats(rng);

      characters.push({
        id: `char-${i}-${firstName.toLowerCase()}`,
        name: fullName,
        race,
        class: charClass,
        role,
        stats,
        level: 1,
        description: generateDescription(rng, fullName, race, charClass),
      });
    }

    return characters;
  }

  generateDungeon(week: number, matchupIndex: number, rng: Rng): Dungeon {
    const name = `${rng.pick(DUNGEON_PREFIXES)} ${rng.pick(DUNGEON_NOUNS)}`;
    const theme = rng.pick(DUNGEON_THEMES);
    const encounterCount = rng.nextInt(5, 8);

    const encounterTypes: EncounterType[] = ["combat", "trap", "puzzle", "treasure"];
    const statKeys: (keyof Stats)[] = ["str", "dex", "con", "int", "wis", "cha"];

    const encounters: Encounter[] = [];

    for (let i = 0; i < encounterCount - 1; i++) {
      const type = rng.pick(encounterTypes);
      encounters.push({
        id: `enc-w${week}-m${matchupIndex}-${i}`,
        type,
        name: rng.pick(ENCOUNTER_NAMES[type]),
        difficulty: rng.nextInt(1, 10),
        targetStats: [rng.pick(statKeys), rng.pick(statKeys)],
        isBoss: false,
      });
    }

    encounters.push({
      id: `enc-w${week}-m${matchupIndex}-boss`,
      type: "combat",
      name: rng.pick(BOSS_NAMES),
      difficulty: rng.nextInt(7, 10),
      targetStats: [rng.pick(statKeys), rng.pick(statKeys)],
      isBoss: true,
    });

    return {
      id: `dungeon-w${week}-m${matchupIndex}`,
      name,
      theme,
      encounters,
    };
  }

  getHighlightTemplates(): HighlightTemplateBundle {
    return DEFAULT_HIGHLIGHT_TEMPLATES;
  }
}
