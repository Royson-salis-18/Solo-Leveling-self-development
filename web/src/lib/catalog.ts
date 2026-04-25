import React from 'react';
import { Swords, Gem, Hammer, Zap } from "lucide-react";

export const TABS = ["Army", "Arsenal", "Vault"] as const;
export type Tab = typeof TABS[number];

export const RARITY_COLORS: Record<string, string> = {
  'COMMON': '#334155',
  'RARE': '#3b82f6',
  'EPIC': '#a8a8ff',
  'LEGENDARY': '#b45309',
  'MYTHIC': '#991b1b',
  'E-RANK': '#475569',
  'D-RANK': '#334155',
  'C-RANK': '#3b82f6',
  'B-RANK': '#c4b5fd',
  'A-RANK': '#991b1b',
  'S-RANK': '#b45309'
};

export const CATEGORY_ICONS: Record<string, any> = {
  'Weapon': Swords,
  'Artifact': Gem,
  'Tool': Hammer,
  'Consumable': Zap,
};

export type Shadow = { 
  id?: string; name: string; rarity: string; bonus_value?: number; collected?: boolean; 
  effectType?: 'shadow'|'flame'|'smoke'|'lightning'; 
  col?: number[][]; 
  glow?: string; 
  icon?: React.ReactNode | string; 
  sub?: string; 
};

export type InventoryItem = { 
  id?: string; name: string; description: string; 
  item_type: string; item_category: string; 
  rarity: string; quantity?: number; image_url?: string;
  collected?: boolean;
};

export const SHADOW_CATALOG: (Shadow & { effectType?: 'shadow'|'flame'|'smoke'|'lightning'; col?: number[][]; glow?: string; icon?: string; sub?: string })[] = [
  { name: "Shadow Infantry", rarity: "Common", effectType: "shadow", icon: "◆", sub: "Basic Extraction" },
  { name: "Shadow Mage", rarity: "Common", effectType: "flame", col: [[200, 50, 255], [150, 0, 200], [255, 100, 255]], glow: "180, 50, 255", icon: "◉", sub: "Magic Division" },
  { name: "Iron", rarity: "Rare", effectType: "smoke", col: [[110, 110, 115], [80, 80, 85], [130, 130, 135]], glow: "90,90,95", icon: "◫", sub: "Heavy Tank" },
  { name: "Tank", rarity: "Rare", effectType: "smoke", col: [[110, 110, 115], [80, 80, 85], [130, 130, 135]], glow: "90,90,95", icon: "◫", sub: "Ice Bear" },
  { name: "Igris", rarity: "Epic", effectType: "shadow", col: [[210, 0, 65], [180, 0, 45], [240, 20, 85]], glow: "200,0,60", icon: "◆", sub: "Blood Knight" },
  { name: "Tusk", rarity: "Epic", effectType: "flame", col: [[255, 50, 10], [220, 20, 0], [255, 100, 30]], glow: "240,40,0", icon: "◉", sub: "High Orc Shaman" },
  { name: "Beru", rarity: "Epic", effectType: "smoke", col: [[0, 180, 55], [0, 150, 35], [20, 210, 70]], glow: "0,170,45", icon: "◬", sub: "Ant King" },
  { name: "Baruka", rarity: "Epic", effectType: "smoke", col: [[160, 200, 255], [100, 150, 255], [200, 230, 255]], glow: "150,180,255", icon: "❄", sub: "Frost Elf King" },
  { name: "Kargalgan", rarity: "Epic", effectType: "flame", col: [[255, 0, 100], [200, 0, 80], [255, 50, 150]], glow: "250,0,100", icon: "◉", sub: "Disaster Orc Mage" },
  { name: "Bellion", rarity: "Legendary", effectType: "shadow", col: [[80, 20, 220], [60, 0, 180], [100, 40, 240]], glow: "70,10,200", icon: "◆", sub: "Grand Marshal" },
  { name: "Kamish", rarity: "Legendary", effectType: "flame", col: [[255, 160, 0], [230, 120, 0], [255, 200, 40]], glow: "240,140,0", icon: "⬡", sub: "Dragon's Wrath" },
  { name: "Kira", rarity: "Rare", effectType: "shadow", icon: "◆", sub: "Shadow Assassin" },
  { name: "Sid", rarity: "Rare", effectType: "shadow", icon: "◆", sub: "Shadow Assassin" },
  { name: "Min Byung-gu", rarity: "Epic", effectType: "lightning", col: [[255, 200, 50], [255, 150, 0], [255, 250, 100]], glow: "255,200,0", icon: "⬟", sub: "Holy Healer" },
  { name: "Gray", rarity: "Legendary", effectType: "smoke", icon: "◫", sub: "Beast Monarch" },
  { name: "Greed", rarity: "Epic", effectType: "shadow", col: [[50, 50, 50], [20, 20, 20], [80, 80, 80]], glow: "40,40,40", icon: "◆", sub: "General Rank" },
  { name: "Kaisel", rarity: "Epic", effectType: "lightning", col: [[180, 100, 255], [120, 40, 200], [220, 180, 255]], glow: "150,80,220", icon: "翼", sub: "Sky Drake" },
  { name: "Jima", rarity: "Rare", effectType: "smoke", col: [[0, 100, 200], [0, 60, 150], [40, 150, 255]], glow: "0,80,180", icon: "⚓", sub: "Naga Leader" },
  { name: "Orc Warrior", rarity: "Common", effectType: "flame", col: [[180, 40, 40], [120, 20, 20], [220, 60, 60]], glow: "150,30,30", icon: "◉", sub: "Tusk's Infantry" },
  { name: "High Orc Warrior", rarity: "Common", effectType: "flame", col: [[180, 40, 40], [120, 20, 20], [220, 60, 60]], glow: "150,30,30", icon: "◉", sub: "Elite Infantry" },
  { name: "Shadow Archer", rarity: "Common", effectType: "shadow", icon: "➹", sub: "Ranged Support" },
  { name: "Frost Elf Archer", rarity: "Rare", effectType: "smoke", col: [[180, 230, 255], [130, 180, 255], [220, 250, 255]], glow: "160,200,255", icon: "❄", sub: "Baruka's Guard" },
  { name: "Ashborn", rarity: "Mythic", effectType: "shadow", col: [[30, 10, 50], [10, 0, 30], [50, 20, 80]], glow: "40,10,60", icon: "👑", sub: "The Original Shadow Monarch" },
  { name: "Antares", rarity: "Mythic", effectType: "flame", col: [[255, 30, 0], [200, 10, 0], [255, 80, 20]], glow: "220,20,0", icon: "🔥", sub: "Monarch of Destruction" },
  { name: "Rulers of Light", rarity: "Mythic", effectType: "lightning", col: [[255, 255, 180], [255, 240, 100], [255, 255, 220]], glow: "255,255,150", icon: "✨", sub: "The Absolute Beings" },
  { name: "Igris (Reawakened)", rarity: "Legendary", effectType: "shadow", col: [[255, 0, 0], [150, 0, 0], [200, 0, 0]], glow: "200,0,0", icon: "⚔", sub: "Commander of the Shadows" },
  { name: "Beru (Post-Island)", rarity: "Legendary", effectType: "smoke", col: [[255, 255, 255], [200, 200, 200], [255, 255, 255]], glow: "255,255,255", icon: "👑", sub: "Grand Marshal of the Hive" },
];

export const ITEM_CATALOG: InventoryItem[] = [
  { name: "Starter Blade", description: "A basic hunter's blade.", item_type: "WEAPON", item_category: "Weapon", rarity: "E-Rank" },
  { name: "Slayer's Saber", description: "A sharp saber preferred by low-rank agility hunters.", item_type: "WEAPON", item_category: "Weapon", rarity: "D-Rank" },
  { name: "Kasaka's Venom Fang", description: "A dagger made from the tooth of a Great Kasaka. Deals poison damage.", item_type: "WEAPON", item_category: "Weapon", rarity: "C-Rank" },
  { name: "Knight Killer", description: "A heavy dagger designed to pierce thick armor.", item_type: "WEAPON", item_category: "Weapon", rarity: "B-Rank" },
  { name: "Baruka's Dagger", description: "The dagger of the Ice Elf King Baruka. Imbued with cold.", item_type: "WEAPON", item_category: "Weapon", rarity: "A-Rank" },
  { name: "Demon King's Longsword", description: "A sword imbued with lightning from the Demon King.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Demon King's Dagger", description: "A high-speed dagger set belonging to the Monarch of White Flames.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Kamish's Wrath", description: "The ultimate daggers made from the dragon's tooth.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Volcan's Horn", description: "A fiery axe dropped by the Lord of the Demon Realm.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Orb of Avarice", description: "A magic orb that doubles the power of fire magic.", item_type: "WEAPON", item_category: "Weapon", rarity: "A-Rank" },
  { name: "Su-ho's Twin Swords", description: "Dual blades passed down through the Shadow Monarch's bloodline.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Dragon's Breath", description: "A bow that fires arrows made of pure mana.", item_type: "WEAPON", item_category: "Weapon", rarity: "A-Rank" },
  { name: "Moonshadow", description: "A dark katana that thrives in the absence of light.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Wind of the Steppe", description: "A cape that increases movement speed significantly.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Rare" },
  { name: "Red Knight's Helmet", description: "Part of the Red Knight's set. Increases physical defense.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Epic" },
  { name: "High Magician's Ring", description: "A ring that boosts mana capacity by 50%.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Epic" },
  { name: "Rulers' Authority", description: "A mysterious artifact that allows the user to manipulate gravity.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Gauntlet of the Monarch", description: "Resonates with divine power. Increases punch strength.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Epic" },
  { name: "Fragment of the Sea", description: "A crystal holding the power of the Sea of Afterlife.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Divine Bloodline", description: "A passive artifact that boosts all stats and XP gain.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Ring of the Monarch of Frost", description: "An ancient ring that grants immunity to freezing.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "S-Rank" },
  { name: "Boots of the Wind", description: "Enchanted boots that allow for brief bursts of flight.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Rare" },
  { name: "Belt of the Titan", description: "Increases carry capacity and health recovery speed.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Epic" },
  { name: "Shield of the First Monarch", description: "Indestructible shield forged in the beginning of time.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Earrings of the Sea", description: "Allows the user to breathe underwater and move freely.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "A-Rank" },
  { name: "Shadow Monarch's Cloak", description: "A cloak that hides the user's presence from lower-rank enemies.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Instance Dungeon Key", description: "A key that opens a portal to a special training dungeon.", item_type: "TOOL", item_category: "Tool", rarity: "Rare" },
  { name: "Revive Token", description: "A one-time use token that prevents XP loss upon failure.", item_type: "TOOL", item_category: "Tool", rarity: "Legendary" },
  { name: "Chalice of Rebirth", description: "A divine vessel containing the power to reset time.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Ruler's Heart", description: "Pulse of the Primordial Light. Drastically boosts mana regen.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Mana Crystal (High)", description: "A shimmering crystal packed with immense magical energy.", item_type: "TOOL", item_category: "Tool", rarity: "Epic" },
  { name: "Sovereign's Scepter", description: "Authority over the dead. Increases shadow extraction success.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Dragon King's Spear", description: "Forged in the heart of a dying star by Antares.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Black Heart", description: "The core of the Shadow Monarch. Infinite mana potential.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Mythic" },
  { name: "Ruler's Authority (Fragment)", description: "Allows the user to manipulate objects through telekinesis.", item_type: "TOOL", item_category: "Tool", rarity: "Legendary" },
  { name: "Phoenix Down", description: "A mystical feather that can revive a fallen shadow.", item_type: "TOOL", item_category: "Tool", rarity: "Epic" },
  { name: "Shadow Extract", description: "A rare elixir that increases the success rate of Shadow Extraction.", item_type: "TOOL", item_category: "Tool", rarity: "Rare" },
  { name: "TASK_SKIP", description: "A specialized token that allows you to skip a task and still receive XP.", item_type: "TASK_SKIP", item_category: "Tool", rarity: "Epic" },
  { name: "Greatsword of the Abyss", description: "A massive blade that consumes the light around it.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Shield of the Eternal", description: "A shield that can withstand the breath of a dragon.", item_type: "WEAPON", item_category: "Weapon", rarity: "A-Rank" },
  { name: "Staff of the Archmage", description: "Increases mana regeneration by 200%.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Grimoire of Souls", description: "Allows the user to store and summon captured spirits.", item_type: "WEAPON", item_category: "Weapon", rarity: "A-Rank" },
  { name: "Twin Shadows", description: "A pair of daggers that leave a trail of darkness.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Poison Needle", description: "A hidden weapon that deals massive damage over time.", item_type: "WEAPON", item_category: "Weapon", rarity: "B-Rank" },
  { name: "Dragon-Bone Bow", description: "A bow carved from the bones of a dragon.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Star-Fall Bow", description: "Arrows fired from this bow fall like meteorites.", item_type: "WEAPON", item_category: "Weapon", rarity: "A-Rank" },
  { name: "Staff of Life", description: "Can revive a fallen ally once per dungeon.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Holy Orb", description: "Emits a light that burns undead and heals allies.", item_type: "WEAPON", item_category: "Weapon", rarity: "B-Rank" },
];

export const PLAYER_CLASSES = [
  "Warrior", "Mage", "Assassin", "Tank", "Healer", "Archer", "Shadow Monarch"
] as const;

export const PLAYER_JOBS: Record<string, string[]> = {
  "Warrior": ["Berserker", "Paladin", "Warlord"],
  "Mage": ["Necromancer", "Archmage", "Enchanter"],
  "Assassin": ["Shadow Blade", "Phantom", "Stalker"],
  "Tank": ["Guardian", "Immortal", "Colossus"],
  "Healer": ["Saint", "High Priest", "Druid"],
  "Archer": ["Sniper", "Wind Walker", "Ranger"],
  "Shadow Monarch": ["Monarch of Shadows", "King of the Dead", "Arise"]
};

export const MONARCHS = [
  "None",
  "Shadow Monarch (Ashborn)",
  "Monarch of Destruction (Antares)",
  "Monarch of Frost",
  "Monarch of Beastly Fangs",
  "Monarch of Plagues (Querehsha)",
  "Monarch of Iron Body",
  "Monarch of Transfiguration (Yogumunt)",
  "Monarch of White Flames (Baran)",
  "Monarch of Beginning (Legia)"
] as const;

export type Skill = {
  name: string;
  description: string;
  type: 'PASSIVE' | 'ACTIVE';
  rank: string;
  required_class?: string;
  required_monarch?: string;
  icon?: string;
};

export const SKILL_CATALOG: Skill[] = [
  { name: "Shadow Extraction", description: "Extract shadows from fallen enemies to join your army.", type: "ACTIVE", rank: "S", required_class: "Shadow Monarch", required_monarch: "Shadow Monarch (Ashborn)" },
  { name: "Ruler's Authority", description: "Control objects through telekinesis.", type: "ACTIVE", rank: "S", required_class: "Shadow Monarch" },
  { name: "Dragon's Fear", description: "Release a roar that paralyzes enemies with lower mana.", type: "ACTIVE", rank: "S", required_monarch: "Monarch of Destruction (Antares)" },
  { name: "Bloodlust", description: "Drastically increases attack power at the cost of defense.", type: "PASSIVE", rank: "B", required_class: "Warrior" },
  { name: "Stealth", description: "Completely hide your presence and mana.", type: "ACTIVE", rank: "A", required_class: "Assassin" },
  { name: "Mana Siphon", description: "Absorb mana from enemies you damage.", type: "PASSIVE", rank: "B", required_class: "Mage" },
  { name: "Iron Defense", description: "Briefly become immune to all physical damage.", type: "ACTIVE", rank: "A", required_class: "Tank" },
  { name: "Holy Grace", description: "Heal all nearby allies and remove debuffs.", type: "ACTIVE", rank: "B", required_class: "Healer" },
  { name: "Wind Walker", description: "Increases movement speed and agility by 50%.", type: "PASSIVE", rank: "A", required_class: "Archer" },
  { name: "Domain of the Monarch", description: "Strengthens all shadows within the domain.", type: "ACTIVE", rank: "S", required_class: "Shadow Monarch" },
  { name: "Hellfire", description: "Summon flames that incinerate everything in their path.", type: "ACTIVE", rank: "S", required_monarch: "Monarch of White Flames (Baran)" },
  { name: "Frost Aura", description: "Slows down and eventually freezes nearby enemies.", type: "PASSIVE", rank: "A", required_monarch: "Monarch of Frost" },
  { name: "Querehsha's Kiss", description: "Inflict a lethal venom that spreads between enemies.", type: "ACTIVE", rank: "S", required_monarch: "Monarch of Plagues (Querehsha)" },
  { name: "Iron Will", description: "Negate any movement-restricting effects.", type: "PASSIVE", rank: "A", required_monarch: "Monarch of Iron Body" },
  { name: "Beastly Rampage", description: "Transform partially into a beast, doubling strength.", type: "ACTIVE", rank: "S", required_monarch: "Monarch of Beastly Fangs" },
  { name: "Shadow Exchange", description: "Swap places with any of your shadows instantly.", type: "ACTIVE", rank: "S", required_class: "Shadow Monarch" },
  { name: "Full Strike", description: "A powerful overhead swing that shatters armor.", type: "ACTIVE", rank: "C", required_class: "Warrior" },
  { name: "Meteor Shower", description: "Call down a barrage of magical fireballs.", type: "ACTIVE", rank: "S", required_class: "Mage" },
  { name: "Dagger Rush", description: "Perform a series of lightning-fast stabs.", type: "ACTIVE", rank: "B", required_class: "Assassin" },
  { name: "Rain of Arrows", description: "Fire hundreds of arrows that cover a wide area.", type: "ACTIVE", rank: "A", required_class: "Archer" },
];
