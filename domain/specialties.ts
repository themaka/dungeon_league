import type { CharacterClass, EventKind, Specialty, Stats } from "./types";

export interface SpecialtyDef {
  name: Specialty;
  className: CharacterClass;
  primaryStat: keyof Stats;
  coreEvents: EventKind[];
  description: string;
}

export const SPECIALTIES: SpecialtyDef[] = [
  { name: "Battle Master", className: "Fighter", primaryStat: "str",
    coreEvents: ["hit", "multiattack"], description: "Tactical strikes, bonus on positioning/multiattack" },
  { name: "Champion", className: "Fighter", primaryStat: "str",
    coreEvents: ["crit", "hit"], description: "Crit-focused, expanded crit range" },
  { name: "Evoker", className: "Wizard", primaryStat: "int",
    coreEvents: ["hit", "arcane_surge"], description: "AoE spell damage, targets INT" },
  { name: "War Mage", className: "Wizard", primaryStat: "int",
    coreEvents: ["hit", "dispel"], description: "Single-target burst, counterspell on arcane" },
  { name: "Assassin", className: "Rogue", primaryStat: "dex",
    coreEvents: ["sneak_attack", "kill"], description: "Sneak Attack burst from stealth" },
  { name: "Thief", className: "Rogue", primaryStat: "dex",
    coreEvents: ["disarm_trap", "find_treasure"], description: "Treasure/trap specialist" },
  { name: "Life Domain", className: "Cleric", primaryStat: "wis",
    coreEvents: ["heal", "revivify"], description: "Big heals, Revivify access" },
  { name: "War Domain", className: "Cleric", primaryStat: "wis",
    coreEvents: ["buff", "buff_proc"], description: "Bless buff + moderate healing" },
  { name: "Hunter", className: "Ranger", primaryStat: "dex",
    coreEvents: ["hit", "kill"], description: "Sustained damage, multi-target" },
  { name: "Gloom Stalker", className: "Ranger", primaryStat: "dex",
    coreEvents: ["sneak_attack", "hit"], description: "First-round burst, ambush bonus" },
  { name: "Devotion", className: "Paladin", primaryStat: "str",
    coreEvents: ["buff", "buff_proc", "save_pass"], description: "Aura of Protection, party save bonus" },
  { name: "Vengeance", className: "Paladin", primaryStat: "str",
    coreEvents: ["smite", "hit"], description: "Smite burst damage while tanking" },
  { name: "Berserker", className: "Barbarian", primaryStat: "str",
    coreEvents: ["rage", "hit"], description: "Reckless Attack, damage + self-risk" },
  { name: "Totem Warrior", className: "Barbarian", primaryStat: "con",
    coreEvents: ["damage_taken", "block"], description: "Damage resistance, party HP buffer" },
  { name: "Lore", className: "Bard", primaryStat: "cha",
    coreEvents: ["buff", "persuade", "deceive"], description: "Social specialist, Inspiration buff" },
  { name: "Swords", className: "Bard", primaryStat: "cha",
    coreEvents: ["hit", "crit"], description: "Combat utility, off-DPS with finesse" },
  { name: "Shepherd", className: "Druid", primaryStat: "wis",
    coreEvents: ["heal", "buff", "buff_proc"], description: "Group healing, nature bonus" },
  { name: "Wildfire", className: "Druid", primaryStat: "wis",
    coreEvents: ["heal", "hit"], description: "Damage + heal hybrid, fire-themed" },
  { name: "Fiend", className: "Warlock", primaryStat: "cha",
    coreEvents: ["hit", "channel"], description: "Sustained Eldritch Blast" },
  { name: "Hexblade", className: "Warlock", primaryStat: "cha",
    coreEvents: ["hit", "smite"], description: "Melee burst, curse debuff" },
  { name: "Open Hand", className: "Monk", primaryStat: "dex",
    coreEvents: ["multiattack", "hit"], description: "Sustained flurry, stun chance" },
  { name: "Shadow", className: "Monk", primaryStat: "dex",
    coreEvents: ["sneak_attack", "hit"], description: "Stealth burst, dark dungeon bonus" },
  { name: "Draconic", className: "Sorcerer", primaryStat: "cha",
    coreEvents: ["hit", "arcane_surge"], description: "Elemental burst, theme-matched bonus" },
  { name: "Wild Magic", className: "Sorcerer", primaryStat: "cha",
    coreEvents: ["hit", "arcane_surge"], description: "High variance, random bonuses" },
];

export const CLASS_SPECIALTY_MAP: Record<CharacterClass, [Specialty, Specialty]> = {
  Fighter: ["Battle Master", "Champion"],
  Wizard: ["Evoker", "War Mage"],
  Rogue: ["Assassin", "Thief"],
  Cleric: ["Life Domain", "War Domain"],
  Ranger: ["Hunter", "Gloom Stalker"],
  Paladin: ["Devotion", "Vengeance"],
  Barbarian: ["Berserker", "Totem Warrior"],
  Bard: ["Lore", "Swords"],
  Druid: ["Shepherd", "Wildfire"],
  Warlock: ["Fiend", "Hexblade"],
  Monk: ["Open Hand", "Shadow"],
  Sorcerer: ["Draconic", "Wild Magic"],
};

const SPECIALTY_INDEX = new Map(SPECIALTIES.map((s) => [s.name, s]));

export function specialtyDef(name: Specialty): SpecialtyDef {
  const def = SPECIALTY_INDEX.get(name);
  if (!def) throw new Error(`Unknown specialty: ${name}`);
  return def;
}

export function specialtyForClass(className: CharacterClass, roll: 0 | 1): Specialty {
  return CLASS_SPECIALTY_MAP[className][roll];
}

export function primaryStatForSpecialty(name: Specialty): keyof Stats {
  return specialtyDef(name).primaryStat;
}

export function isCoreEventForSpecialty(name: Specialty, kind: EventKind): boolean {
  return specialtyDef(name).coreEvents.includes(kind);
}
