export const FIRST_NAMES = [
  "Thorin", "Lyra", "Gorim", "Seraphina", "Kaelen", "Brynn", "Drogath",
  "Elara", "Fenwick", "Isolde", "Jareth", "Kira", "Lorek", "Mira",
  "Nyx", "Orin", "Petra", "Quillan", "Rowan", "Sable", "Talon",
  "Uma", "Varek", "Wren", "Xander", "Yara", "Zephyr", "Aldric",
  "Bess", "Cedric", "Dahlia", "Eamon", "Freya", "Gareth", "Hilda",
  "Ignis", "Jorin", "Kael", "Luna", "Magnus", "Nessa", "Osric",
  "Pria", "Renn", "Sigrid", "Tova", "Ulric", "Vex", "Wynne",
  "Ash", "Bramble", "Cinder", "Dusk", "Ember", "Flint", "Gale",
  "Haven", "Ivy", "Jade",
];

export const LAST_NAMES = [
  "Ironveil", "Shadowmere", "Stonehelm", "Brightforge", "Ashwood",
  "Dawnstrider", "Nightwhisper", "Thornwall", "Frostpeak", "Goldleaf",
  "Darkwater", "Firebrand", "Silverthorn", "Stormcaller", "Wildheart",
  "Bonecrusher", "Starweaver", "Grimshaw", "Oakenheart", "Ravensong",
  "Blackthorn", "Copperfield", "Duskwalker", "Emberstrike", "Foxglove",
  "Greymane", "Hollowbone", "Ironwood", "Jadefall", "Kettleburn",
  "Longstrider", "Moonfire", "Nethersong", "Obsidian", "Pinewhisper",
  "Quicksilver", "Redthorn", "Sunforge", "Tidecaller", "Underhill",
  "Voidwalker", "Windrider", "Yarrow", "Zenith", "Ambervale",
  "Blightbane", "Crowfeather", "Deepforge", "Elderwood", "Flameguard",
];

export const DUNGEON_PREFIXES = [
  "The Sunken", "The Burning", "The Frozen", "The Shadow", "The Lost",
  "The Cursed", "The Ruined", "The Ancient", "The Forgotten", "The Twisted",
  "The Haunted", "The Flooded", "The Shattered", "The Crimson", "The Silent",
];

export const DUNGEON_NOUNS = [
  "Crypt", "Cavern", "Temple", "Mines", "Catacombs",
  "Fortress", "Labyrinth", "Sanctum", "Vault", "Depths",
  "Dungeon", "Lair", "Tomb", "Pit", "Warren",
];

export const DUNGEON_THEMES = [
  "undead", "fire", "ice", "shadow", "nature",
  "arcane", "demonic", "draconic", "mechanical", "aquatic",
];

export const ENCOUNTER_NAMES: Record<string, string[]> = {
  combat: [
    "Goblin Ambush", "Skeleton Patrol", "Orc Warband", "Spider Nest",
    "Wraith Encounter", "Bandit Highwaymen", "Troll Bridge", "Cultist Ritual",
    "Dire Wolf Pack", "Mimic Chest",
  ],
  trap: [
    "Poison Dart Hall", "Collapsing Floor", "Flame Jet Corridor",
    "Pendulum Blades", "Acid Pool", "Spike Pit", "Boulder Chase",
    "Rune Ward", "Gas Chamber", "Tripwire Net",
  ],
  puzzle: [
    "Runic Lock", "Pressure Plate Sequence", "Riddle of the Sphinx",
    "Mirror Maze", "Rotating Room", "Symbol Matching", "Weight Puzzle",
    "Elemental Alignment", "Constellation Dial", "Memory Tiles",
  ],
  treasure: [
    "Hidden Vault", "Dragon Hoard", "Sunken Chest", "Enchanted Armory",
    "Gem Cache", "Relic Chamber", "Golden Idol", "Crystal Garden",
    "Coin Fountain", "Trophy Hall",
  ],
};

export const BOSS_NAMES = [
  "The Lich King", "Magma Wyrm", "Shadow Reaver", "Frost Giant Jarl",
  "Beholder Tyrant", "Demon Prince", "Ancient Dragon", "Vampire Lord",
  "Mind Flayer Elder", "Golem Colossus",
];

export const DESCRIPTION_TEMPLATES = [
  "A {adjective} {race} {class} known for {trait}.",
  "Once a {background}, this {race} now walks the path of the {class}.",
  "A {adjective} {race} who {quirk}.",
  "{name} is a {race} {class}, {adjective} and {adjective2}.",
];

export const ADJECTIVES = [
  "battle-scarred", "sharp-eyed", "grim-faced", "silver-tongued", "iron-willed",
  "quick-footed", "broad-shouldered", "keen-minded", "fierce", "stoic",
  "cunning", "relentless", "quiet", "boisterous", "weathered",
];

export const ADJECTIVES_2 = [
  "feared by many", "respected by peers", "driven by vengeance",
  "seeking redemption", "hungry for glory", "haunted by the past",
  "loyal to a fault", "unpredictable in battle", "wise beyond their years",
];

export const TRAITS = [
  "their unbreakable resolve", "devastating critical strikes",
  "an uncanny ability to find traps", "healing even the gravest wounds",
  "never leaving a comrade behind", "always striking first",
  "their mastery of the arcane", "an instinct for treasure",
];

export const QUIRKS = [
  "never backs down from a challenge",
  "speaks to their weapon as if it were alive",
  "collects trophies from every dungeon",
  "always has a plan — and a backup plan",
  "fights with reckless abandon",
  "hums an eerie tune before each battle",
];

export const BACKGROUNDS = [
  "soldier", "scholar", "merchant", "hermit", "noble",
  "outcast", "gladiator", "priest", "thief", "sailor",
];
