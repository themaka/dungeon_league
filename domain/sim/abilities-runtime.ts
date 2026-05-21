import type { Character, CharacterClass, Stats } from "domain/types";
import { hasAbility } from "domain/abilities";

export const ATTACK_STAT_BY_CLASS: Record<CharacterClass, keyof Stats> = {
  Fighter: "str", Barbarian: "str", Paladin: "str",
  Ranger: "dex", Rogue: "dex", Monk: "dex",
  Wizard: "int",
  Sorcerer: "cha", Warlock: "cha", Bard: "cha",
  Cleric: "wis", Druid: "wis",
};

export function attackStatFor(char: Character): keyof Stats {
  return ATTACK_STAT_BY_CLASS[char.class];
}

export function critRangeFor(char: Character): number {
  if (char.class === "Fighter" && char.specialty === "Champion") {
    if (hasAbility("Fighter", "Champion", char.level, "Superior Critical")) return 18;
    if (hasAbility("Fighter", "Champion", char.level, "Improved Critical")) return 19;
  }
  return 20;
}

export function multiattackCount(char: Character): number {
  if ((char.class === "Fighter" || char.class === "Monk") && char.level >= 6) return 1;
  return 0;
}

export function hasSneakAttack(char: Character): boolean {
  return char.class === "Rogue" && hasAbility("Rogue", char.specialty, char.level, "Sneak Attack");
}

export function hasSmite(char: Character): boolean {
  return char.class === "Paladin" && hasAbility("Paladin", char.specialty, char.level, "Divine Smite");
}

export function hasRage(char: Character): boolean {
  return char.class === "Barbarian" && hasAbility("Barbarian", char.specialty, char.level, "Rage");
}

// Used by sim-engine in Task 12 to gate the post-encounter revivify check.
export function hasRevivify(char: Character): boolean {
  return (
    char.class === "Cleric" &&
    char.specialty === "Life Domain" &&
    hasAbility("Cleric", "Life Domain", char.level, "Revivify")
  );
}

export function chargesForLevel(level: number): number {
  if (level < 3)  return 0;
  if (level < 7)  return 1;
  if (level < 13) return 2;
  if (level < 18) return 3;
  return 4;
}

export function hasBless(char: Character): boolean {
  return char.class === "Cleric" && char.specialty === "War Domain"
    && hasAbility("Cleric", "War Domain", char.level, "Bless");
}

export function hasInspiration(char: Character): boolean {
  return char.class === "Bard" && char.specialty === "Lore"
    && hasAbility("Bard", "Lore", char.level, "Bardic Inspiration");
}

export function hasAura(char: Character): boolean {
  return char.class === "Paladin" && char.specialty === "Devotion"
    && hasAbility("Paladin", "Devotion", char.level, "Aura of Protection");
}

export function hasGuidance(char: Character): boolean {
  return char.class === "Druid" && char.specialty === "Shepherd"
    && hasAbility("Druid", "Shepherd", char.level, "Guidance");
}
