/**
 * Level Engine — PURE display helpers for XP / level / rank / title.
 *
 * The authoritative progression logic (XP awards, decay, penalties, streaks, status) runs in
 * Postgres (supabase/migrations/…_game_engine.sql). This file only mirrors the *pure* rules the UI
 * needs for progress bars, previews and labels, and it is unit-tested against golden values that
 * the SQL test-suite asserts too — so the two can't silently drift.
 *
 * Level and rank derive from STANDING = XP balance + XP already spent on rewards, so buying a
 * reward never de-levels you. Always pass `standing_xp` (not `total_points`) to the level helpers.
 */
import { CATEGORY_STAT_LOOKUP } from "./categoryConfig";

/* ═══════════════════════════════════════════════
   LEVELS
═══════════════════════════════════════════════ */

export const XP_PER_LEVEL = 500;

/** XP needed to reach a given level: level × 500 */
export const xpForLevel = (level: number) => level * XP_PER_LEVEL;

/** Derive level from standing XP (negative standing counts as 0). */
export const calcLevel = (standingXp: number): number =>
  Math.max(1, Math.floor(Math.max(standingXp, 0) / XP_PER_LEVEL) + 1);

/** Progress % within the current level (0–100). */
export const calcXpProgress = (standingXp: number): number =>
  Math.min(((Math.max(standingXp, 0) % XP_PER_LEVEL) / XP_PER_LEVEL) * 100, 100);

/* ═══════════════════════════════════════════════
   RANKS
═══════════════════════════════════════════════ */

const RANK_THRESHOLDS: { rank: string; minLevel: number }[] = [
  { rank: "SS", minLevel: 101 },
  { rank: "S", minLevel: 40 },
  { rank: "A", minLevel: 25 },
  { rank: "B", minLevel: 16 },
  { rank: "C", minLevel: 10 },
  { rank: "D", minLevel: 5 },
  { rank: "E", minLevel: 1 },
];

export const RANKS = ["E", "D", "C", "B", "A", "S", "SS"] as const;

export const calcRank = (level: number): string => {
  for (const t of RANK_THRESHOLDS) if (level >= t.minLevel) return t.rank;
  return "E";
};

/** For display: what the next rank is and the level it unlocks at. */
export const nextRankInfo = (currentRank: string) => {
  const idx = (RANKS as readonly string[]).indexOf(currentRank);
  if (idx < 0 || idx >= RANKS.length - 1) return null;
  const nextRank = RANKS[idx + 1];
  const threshold = RANK_THRESHOLDS.find((t) => t.rank === nextRank);
  return threshold ? { rank: nextRank, minLevel: threshold.minLevel } : null;
};

/* ═══════════════════════════════════════════════
   TITLES (per class)
═══════════════════════════════════════════════ */

export const CLASS_TITLES: Record<string, string[]> = {
  Assassin:    ["Street Shadow", "Ghost Agent", "Void Walker", "Silent Reaper", "Shadow Monarch"],
  Warrior:     ["Street Brawler", "Combat Vet", "Vanguard", "Iron Conqueror", "War Lord"],
  Mage:        ["Code Weaver", "Apprentice", "Archmage", "Reality Glitcher", "Techno-Sage"],
  Tamer:       ["Handler", "Jockey", "Beast Lord", "Spectral Binder", "Primeval King"],
  Healer:      ["Field Medic", "Nano-Saint", "Guardian Angel", "World Tree Sage", "Life Bringer"],
  Tank:        ["Shield", "Fortress", "Indomitable", "Aegis Prime", "Eternal Bastion"],
  Ranger:      ["Scout", "Pathfinder", "Grid Sniper", "Windstrider", "Dimensional Tracker"],
  Archer:      ["Scout", "Pathfinder", "Grid Sniper", "Windstrider", "Dimensional Tracker"],
  Necromancer: ["Glint Reaper", "Soul Collector", "Lich King", "Ender of Worlds", "Shadow Monarch"],
  Craftsman:   ["Apprentice", "Artisan", "Master Smith", "Soul Forger", "Divine Architect"],
  Scout:       ["Pathfinder", "Navigator", "Grid Walker", "Void Scout", "Celestial Eye"],
};

export const calcTitle = (playerClass: string, standingXp: number): string => {
  const titles = CLASS_TITLES[playerClass] ?? ["Rookie", "Hunter", "Elite", "Master", "Legend"];
  if (standingXp < 1000) return titles[0];
  if (standingXp < 3000) return titles[1];
  if (standingXp < 8000) return titles[2];
  if (standingXp < 20000) return titles[3];
  return titles[4];
};

/* ═══════════════════════════════════════════════
   XP MATHS (preview only — the server is authoritative)
═══════════════════════════════════════════════ */

/** What each gate tier is worth in base XP. The server derives a gate's XP from its tier. */
export const TIER_POINTS = { Low: 5, Mid: 15, High: 25, Super: 35, Legendary: 50 } as const;
export type Tier = keyof typeof TIER_POINTS;

export const RANK_LETTER_BY_TIER: Record<Tier, string> = { Low: "E", Mid: "C", High: "B", Super: "A", Legendary: "S" };

export const CATEGORY_WEIGHTS: Record<string, number> = {
  Learning: 0.8, Academics: 0.8, Fitness: 1.2, Work: 1.0, Finance: 1.0,
  Mindfulness: 1.1, Social: 1.1, General: 0.7, Errands: 0.7, Creative: 1.0,
};

/** Base XP → effective XP: logarithmic dampening above 50, then the category weight. */
export function calculateEffectiveXp(baseXp: number, category: string): number {
  const weight = CATEGORY_WEIGHTS[category] ?? 1.0;
  const dampened = baseXp > 50 ? 50 + Math.log10(baseXp - 49) * 10 : baseXp;
  return Math.round(dampened * weight);
}

/** category → domain stat column (single registry lives in categoryConfig.ts). */
export const CATEGORY_STAT_MAP: Record<string, string> = CATEGORY_STAT_LOOKUP;

/** Rank this week's top completions by XP (feeds the Playmaker card). */
export function evaluateWeeklySelection<T extends { points?: number | null; is_completed?: boolean }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 11);
}
