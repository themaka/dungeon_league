import type { CharacterClass, Specialty } from "./types";

export interface Ability {
  name: string;
  tier: number;
  className: CharacterClass;
  specialty?: Specialty;
  description: string;
}

const TIER_BY_LEVEL: Record<number, number> = {
  3: 1, 4: 1, 5: 1,
  6: 2, 7: 2, 8: 2,
  9: 3, 10: 3, 11: 3,
  12: 4,
  13: 5, 14: 5,
  15: 6, 16: 6, 17: 6,
  18: 7, 19: 7,
  20: 8,
};

export function unlockTierForLevel(level: number): number {
  if (level < 3) return 0;
  return TIER_BY_LEVEL[Math.min(level, 20)] ?? 0;
}

const ABILITIES: Ability[] = [
  { name: "Second Wind", tier: 1, className: "Fighter", description: "Self-heal once per encounter" },
  { name: "Improved Critical", tier: 1, className: "Fighter", specialty: "Champion", description: "Crit on 19-20" },
  { name: "Action Surge", tier: 2, className: "Fighter", description: "Extra attack 1/encounter" },
  { name: "Multiattack", tier: 2, className: "Fighter", description: "Two attacks per turn" },
  { name: "Indomitable", tier: 3, className: "Fighter", description: "Reroll a failed save" },
  { name: "Superior Critical", tier: 4, className: "Fighter", specialty: "Champion", description: "Crit on 18-20" },
  { name: "Survivor", tier: 5, className: "Fighter", description: "Regenerate at low HP" },

  { name: "Magic Missile", tier: 1, className: "Wizard", description: "Auto-hit ranged spell" },
  { name: "Counterspell", tier: 2, className: "Wizard", specialty: "War Mage", description: "Negate enemy arcane" },
  { name: "Fireball", tier: 2, className: "Wizard", specialty: "Evoker", description: "AoE damage" },
  { name: "Wall of Force", tier: 3, className: "Wizard", description: "Block damage to allies" },
  { name: "Disintegrate", tier: 4, className: "Wizard", description: "High single-target damage" },
  { name: "Meteor Swarm", tier: 5, className: "Wizard", description: "Massive AoE finisher" },

  { name: "Sneak Attack", tier: 1, className: "Rogue", description: "Bonus damage from stealth" },
  { name: "Cunning Action", tier: 2, className: "Rogue", description: "Bonus dash/disengage" },
  { name: "Uncanny Dodge", tier: 3, className: "Rogue", description: "Halve incoming damage" },
  { name: "Death Strike", tier: 4, className: "Rogue", specialty: "Assassin", description: "Double damage on surprise" },
  { name: "Stroke of Luck", tier: 5, className: "Rogue", description: "Auto-succeed once" },

  { name: "Cure Wounds", tier: 1, className: "Cleric", description: "Single-target heal" },
  { name: "Bless", tier: 1, className: "Cleric", specialty: "War Domain", description: "Buff ally rolls" },
  { name: "Revivify", tier: 2, className: "Cleric", specialty: "Life Domain", description: "Bring back dead ally (charge)" },
  { name: "Spirit Guardians", tier: 2, className: "Cleric", description: "Damage aura" },
  { name: "Mass Healing Word", tier: 3, className: "Cleric", description: "Heal multiple allies" },
  { name: "Heal", tier: 4, className: "Cleric", specialty: "Life Domain", description: "Big single-target heal" },
  { name: "True Resurrection", tier: 5, className: "Cleric", description: "Capstone revive" },

  { name: "Hunter's Mark", tier: 1, className: "Ranger", description: "Bonus damage on target" },
  { name: "Volley", tier: 2, className: "Ranger", specialty: "Hunter", description: "Hit multiple foes" },
  { name: "Dread Ambusher", tier: 1, className: "Ranger", specialty: "Gloom Stalker", description: "First-round burst" },
  { name: "Stand Against the Tide", tier: 3, className: "Ranger", description: "Redirect attacks" },
  { name: "Foe Slayer", tier: 4, className: "Ranger", description: "Bonus to last hit on boss" },
  { name: "Whirlwind Attack", tier: 5, className: "Ranger", description: "Capstone AoE" },

  { name: "Divine Smite", tier: 1, className: "Paladin", description: "Burst damage on hit" },
  { name: "Aura of Protection", tier: 2, className: "Paladin", specialty: "Devotion", description: "Party save bonus" },
  { name: "Sacred Weapon", tier: 2, className: "Paladin", description: "Magical weapon strike" },
  { name: "Vow of Enmity", tier: 3, className: "Paladin", specialty: "Vengeance", description: "Advantage vs single target" },
  { name: "Aura of Courage", tier: 4, className: "Paladin", description: "Party fear immunity" },
  { name: "Holy Nimbus", tier: 5, className: "Paladin", specialty: "Devotion", description: "Capstone aura" },

  { name: "Reckless Attack", tier: 1, className: "Barbarian", specialty: "Berserker", description: "Trade defense for damage" },
  { name: "Rage", tier: 1, className: "Barbarian", description: "Damage resistance + bonus" },
  { name: "Bear Totem", tier: 2, className: "Barbarian", specialty: "Totem Warrior", description: "Wide damage resistance" },
  { name: "Mindless Rage", tier: 3, className: "Barbarian", description: "Immunity to fear/charm" },
  { name: "Brutal Critical", tier: 4, className: "Barbarian", description: "Bonus crit dice" },
  { name: "Primal Champion", tier: 5, className: "Barbarian", description: "Capstone stat boost" },

  { name: "Vicious Mockery", tier: 1, className: "Bard", description: "Low damage + debuff" },
  { name: "Bardic Inspiration", tier: 1, className: "Bard", specialty: "Lore", description: "Buff ally rolls" },
  { name: "Cutting Words", tier: 2, className: "Bard", specialty: "Lore", description: "Reduce enemy roll" },
  { name: "Countercharm", tier: 3, className: "Bard", description: "Party charm protection" },
  { name: "Magical Secrets", tier: 4, className: "Bard", description: "Steal a spell" },
  { name: "Superior Inspiration", tier: 5, className: "Bard", description: "Recharge inspiration on init" },

  { name: "Healing Word", tier: 1, className: "Druid", description: "Ranged heal" },
  { name: "Goodberry", tier: 1, className: "Druid", specialty: "Shepherd", description: "Persistent heal token" },
  { name: "Wildfire Spirit", tier: 2, className: "Druid", specialty: "Wildfire", description: "Pet that heals or burns" },
  { name: "Wild Shape", tier: 2, className: "Druid", description: "Beast form combat" },
  { name: "Conjure Animals", tier: 3, className: "Druid", description: "Summon allies" },
  { name: "Heal", tier: 4, className: "Druid", description: "Big single-target heal" },
  { name: "Beast Spells", tier: 5, className: "Druid", description: "Cast in wild shape" },

  { name: "Eldritch Blast", tier: 1, className: "Warlock", description: "Consistent ranged damage" },
  { name: "Hex", tier: 1, className: "Warlock", specialty: "Hexblade", description: "Curse target for bonus dmg" },
  { name: "Hellish Rebuke", tier: 2, className: "Warlock", specialty: "Fiend", description: "Reactive damage" },
  { name: "Devil's Sight", tier: 3, className: "Warlock", description: "Ignore darkness penalties" },
  { name: "Mystic Arcanum", tier: 4, className: "Warlock", description: "Big spell" },
  { name: "Eldritch Master", tier: 5, className: "Warlock", description: "Recharge slot" },

  { name: "Flurry of Blows", tier: 1, className: "Monk", specialty: "Open Hand", description: "Multi-hit strike" },
  { name: "Stunning Strike", tier: 2, className: "Monk", description: "Stun target" },
  { name: "Shadow Step", tier: 2, className: "Monk", specialty: "Shadow", description: "Teleport in dark" },
  { name: "Diamond Soul", tier: 3, className: "Monk", description: "Reroll saves" },
  { name: "Empty Body", tier: 4, className: "Monk", description: "Resistance + invisibility" },
  { name: "Perfect Self", tier: 5, className: "Monk", description: "Recharge ki on init" },

  { name: "Burning Hands", tier: 1, className: "Sorcerer", description: "AoE cone damage" },
  { name: "Draconic Resilience", tier: 1, className: "Sorcerer", specialty: "Draconic", description: "Bonus HP + element ward" },
  { name: "Tides of Chaos", tier: 1, className: "Sorcerer", specialty: "Wild Magic", description: "Random bonus/penalty" },
  { name: "Metamagic", tier: 2, className: "Sorcerer", description: "Bend spell rules" },
  { name: "Heightened Spell", tier: 3, className: "Sorcerer", description: "Disadvantage on save" },
  { name: "Empowered Spell", tier: 4, className: "Sorcerer", description: "Reroll damage dice" },
  { name: "Sorcerous Restoration", tier: 5, className: "Sorcerer", description: "Recharge points" },
];

export function abilitiesForCharacter(
  className: CharacterClass,
  specialty: Specialty,
  level: number,
): Ability[] {
  const tier = unlockTierForLevel(level);
  return ABILITIES.filter(
    (a) =>
      a.className === className &&
      a.tier <= tier &&
      (a.specialty === undefined || a.specialty === specialty),
  );
}

export function unlockedAbilities(
  className: CharacterClass,
  specialty: Specialty,
  level: number,
): Ability[] {
  return abilitiesForCharacter(className, specialty, level);
}

export function hasAbility(
  className: CharacterClass,
  specialty: Specialty,
  level: number,
  abilityName: string,
): boolean {
  return abilitiesForCharacter(className, specialty, level).some((a) => a.name === abilityName);
}

export function allAbilitiesForClass(className: CharacterClass): Ability[] {
  return ABILITIES.filter((a) => a.className === className);
}
