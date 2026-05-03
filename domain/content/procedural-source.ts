import type {
  Character, CharacterClass, EncounterCount, EncounterType, LeagueSettings,
  Race, Stats, Dungeon, Encounter,
} from "domain/types";
import { CLASS_ROLE_MAP } from "domain/types";
import { CLASS_SPECIALTY_MAP, primaryStatForSpecialty } from "domain/specialties";
import { unlockTierForLevel } from "domain/abilities";
import { pickEncounterType } from "domain/themes";
import type { Rng } from "domain/rng";
import type { ContentSource, HighlightTemplateBundle } from "./content-source";
import { DEFAULT_HIGHLIGHT_TEMPLATES } from "./highlight-templates";
import {
  FIRST_NAMES, LAST_NAMES, ADJECTIVES, ADJECTIVES_2, TRAITS, QUIRKS,
  BACKGROUNDS, DESCRIPTION_TEMPLATES, DUNGEON_PREFIXES, DUNGEON_NOUNS,
  ENCOUNTER_NAMES, BOSS_NAMES,
} from "./name-tables";

const ALL_RACES: Race[] = [
  "Human", "Elf", "Dwarf", "Halfling", "Orc", "Gnome", "Tiefling", "Dragonborn",
];

const ALL_CLASSES: CharacterClass[] = [
  "Fighter", "Wizard", "Rogue", "Cleric", "Ranger", "Paladin",
  "Barbarian", "Bard", "Druid", "Warlock", "Monk", "Sorcerer",
];

function generateDescription(rng: Rng, name: string, race: Race, charClass: CharacterClass): string {
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
    str: rng.rollStat(), dex: rng.rollStat(), con: rng.rollStat(),
    int: rng.rollStat(), wis: rng.rollStat(), cha: rng.rollStat(),
  };
}

// Must match the level sets in domain/leveling.ts (STAT_BUMP_LEVELS and
// SCALING_LEVELS). Each set contributes +1 to the primary stat at the listed
// levels; the sets are disjoint so a level grants exactly +1 stat (not +2).
function statBumpsForLevel(level: number): number {
  let bumps = 0;
  const statBumpLevels = new Set([2, 5, 8, 11, 14, 17]);
  const scalingLevels = new Set([4, 7, 10, 16, 19]);
  for (let l = 2; l <= level; l++) {
    if (statBumpLevels.has(l)) bumps += 1;
    if (scalingLevels.has(l)) bumps += 1;
  }
  return bumps;
}

function tiersAtLevel(level: number): number[] {
  const top = unlockTierForLevel(level);
  const out: number[] = [];
  for (let t = 1; t <= top; t++) out.push(t);
  return out;
}

function targetStatsForType(type: EncounterType, rng: Rng): (keyof Stats)[] {
  switch (type) {
    case "combat": return [rng.pick<keyof Stats>(["str", "dex", "int"]), "con"];
    case "trap": return ["dex", rng.pick<keyof Stats>(["int", "wis"])];
    case "puzzle": return [rng.pick<keyof Stats>(["int", "wis", "cha"])];
    case "treasure": return [rng.pick<keyof Stats>(["wis", "dex", "cha"])];
    case "social": return [rng.pick<keyof Stats>(["cha", "wis", "int"])];
    case "arcane": return [rng.pick<keyof Stats>(["int", "wis", "cha"])];
  }
}

function encounterCountRange(count: EncounterCount): [number, number] {
  switch (count) {
    case "3-5": return [3, 5];
    case "5-8": return [5, 8];
    case "7-10": return [7, 10];
  }
}

export class ProceduralSource implements ContentSource {
  generateCharacters(count: number, rng: Rng, settings: LeagueSettings): Character[] {
    const usedNames = new Set<string>();
    const characters: Character[] = [];
    const shuffledFirstNames = rng.shuffle([...FIRST_NAMES]);
    const shuffledLastNames = rng.shuffle([...LAST_NAMES]);

    const startingLevel = settings.startingLevel;

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
      const specialty = CLASS_SPECIALTY_MAP[charClass][rng.next() < 0.5 ? 0 : 1];
      const stats = rollStats(rng);

      const primary = primaryStatForSpecialty(specialty);
      stats[primary] = stats[primary] + statBumpsForLevel(startingLevel);

      const startingXp = startingLevel >= 3 ? 30 : 0;

      characters.push({
        id: `char-${i}-${firstName.toLowerCase()}`,
        name: fullName,
        race,
        class: charClass,
        role,
        specialty,
        stats,
        level: startingLevel,
        xp: startingXp,
        abilityTiers: tiersAtLevel(startingLevel),
        description: generateDescription(rng, fullName, race, charClass),
      });
    }

    return characters;
  }

  generateDungeon(
    week: number,
    matchupIndex: number,
    rng: Rng,
    theme: string,
    encounterCount: EncounterCount,
  ): Dungeon {
    const name = `${rng.pick(DUNGEON_PREFIXES)} ${rng.pick(DUNGEON_NOUNS)}`;
    const [min, max] = encounterCountRange(encounterCount);
    const total = rng.nextInt(min, max);

    const encounters: Encounter[] = [];
    for (let i = 0; i < total - 1; i++) {
      const type = pickEncounterType(theme, rng);
      const names = ENCOUNTER_NAMES[type] ?? ENCOUNTER_NAMES.combat;
      encounters.push({
        id: `enc-w${week}-m${matchupIndex}-${i}`,
        type,
        name: rng.pick(names),
        difficulty: rng.nextInt(1, 10),
        targetStats: targetStatsForType(type, rng),
        isBoss: false,
      });
    }

    encounters.push({
      id: `enc-w${week}-m${matchupIndex}-boss`,
      type: "combat",
      name: rng.pick(BOSS_NAMES),
      difficulty: rng.nextInt(7, 10),
      targetStats: targetStatsForType("combat", rng),
      isBoss: true,
    });

    return { id: `dungeon-w${week}-m${matchupIndex}`, name, theme, encounters };
  }

  getHighlightTemplates(): HighlightTemplateBundle {
    // Cast needed until Task 14 fills in the new event-kind arrays in highlight-templates.ts
    return DEFAULT_HIGHLIGHT_TEMPLATES as unknown as HighlightTemplateBundle;
  }
}
