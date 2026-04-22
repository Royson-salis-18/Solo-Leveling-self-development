/**
 * Level Engine — centralized XP / Level / Rank / Title calculations
 *
 * Call `syncProgression(supabase, userId)` after any XP change
 * to auto-update level, rank, and title in the database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */

/** XP needed to reach a given level: level * 500 */
export const xpForLevel = (level: number) => level * 500;

/** Derive level from total XP */
export const calcLevel = (totalXp: number): number =>
  Math.max(1, Math.floor(totalXp / 500) + 1);

/** Progress % within current level (0-100) */
export const calcXpProgress = (totalXp: number): number =>
  Math.min(((totalXp % 500) / 500) * 100, 100);

/* ── Rank thresholds ────────────────────────── */
const RANK_THRESHOLDS: { rank: string; minLevel: number }[] = [
  { rank: "S", minLevel: 40 },
  { rank: "A", minLevel: 25 },
  { rank: "B", minLevel: 16 },
  { rank: "C", minLevel: 10 },
  { rank: "D", minLevel: 5 },
  { rank: "E", minLevel: 1 },
];

export const RANKS = ["E", "D", "C", "B", "A", "S"] as const;

export const calcRank = (level: number): string => {
  for (const t of RANK_THRESHOLDS) {
    if (level >= t.minLevel) return t.rank;
  }
  return "E";
};

/** For display: next rank info */
export const nextRankInfo = (currentRank: string) => {
  const idx = RANKS.indexOf(currentRank as any);
  if (idx < 0 || idx >= RANKS.length - 1) return null;
  const nextRank = RANKS[idx + 1];
  const threshold = RANK_THRESHOLDS.find(t => t.rank === nextRank);
  return threshold ? { rank: nextRank, minLevel: threshold.minLevel } : null;
};

/* ── Title config (per class) ───────────────── */
export const CLASS_TITLES: Record<string, string[]> = {
  Assassin:        ["Street Shadow",  "Ghost Agent",   "Void Walker",      "Silent Reaper",    "Void Sovereign"],
  Warrior:         ["Street Brawler", "Combat Vet",    "Vanguard",         "Iron Conqueror",   "War Lord"],
  Mage:            ["Code Weaver",    "Apprentice",    "Archmage",         "Reality Glitcher", "Techno-Sage"],
  Tamer:           ["Handler",        "Jockey",        "Beast Lord",       "Spectral Binder",  "Primeval King"],
  Healer:          ["Field Medic",    "Nano-Saint",    "Guardian Angel",   "World Tree Sage",  "Life Bringer"],
  Tank:            ["Shield",         "Fortress",      "Indomitable",      "Aegis Prime",      "Eternal Bastion"],
  Ranger:          ["Scout",          "Pathfinder",    "Grid Sniper",      "Windstrider",      "Dimensional Tracker"],
  Necromancer:     ["Glint Reaper",   "Soul Collector","Lich King",        "Ender of Worlds",  "Death Monarch"],
  Engineer:        ["Tinkerer",       "Machinist",     "Gear Soul",        "Clockwork God",    "Mech Overlord"],
  "Shadow Monarch":["Chosen One",     "Shadow Lord",   "Dark Sovereign",   "Ruler of Shadows", "Eternal Monarch"],
};

export const calcTitle = (playerClass: string, totalXp: number): string => {
  const titles = CLASS_TITLES[playerClass] ?? ["Rookie", "Hunter", "Elite", "Master", "Legend"];
  if (totalXp < 1000)  return titles[0];
  if (totalXp < 3000)  return titles[1];
  if (totalXp < 8000)  return titles[2];
  if (totalXp < 20000) return titles[3];
  return titles[4];
};

/* ═══════════════════════════════════════════════
   CORE: Sync progression after any XP change
═══════════════════════════════════════════════ */

export type ProgressionResult = {
  totalXp: number;
  level: number;
  rank: string;
  title: string;
  leveledUp: boolean;
  rankedUp: boolean;
  titleChanged: boolean;
  prevLevel: number;
  prevRank: string;
  prevTitle: string;
};

/**
 * Recalculate and write level, rank, and title based on current total_points.
 * Returns what changed so the caller can show celebrations.
 */
export async function syncProgression(
  supabase: SupabaseClient,
  userId: string
): Promise<ProgressionResult | null> {
  const { data: prof } = await supabase
    .from("user_profiles")
    .select("total_points, level, player_rank, player_title, player_class, streak_count, last_active_date")
    .eq("user_id", userId)
    .single();

  if (!prof) return null;

  const totalXp   = prof.total_points ?? 0;
  const prevLevel = prof.level ?? 1;
  const prevRank  = prof.player_rank ?? "E";
  const prevTitle = prof.player_title ?? "Newcomer";
  const cls       = prof.player_class ?? "Warrior";

  const newLevel = calcLevel(totalXp);
  const newRank  = calcRank(newLevel);
  const newTitle = calcTitle(cls, totalXp);

  const leveledUp    = newLevel > prevLevel;
  const rankedUp     = RANKS.indexOf(newRank as any) > RANKS.indexOf(prevRank as any);
  const titleChanged = newTitle !== prevTitle;

  // Streak logic
  const today = new Date().toISOString().split("T")[0];
  let newStreak = prof.streak_count ?? 0;
  const lastActive = prof.last_active_date;

  if (lastActive !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (lastActive === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1; // Reset or start fresh
    }
  }

  // Only write if something actually changed
  if (newLevel !== prevLevel || newRank !== prevRank || newTitle !== prevTitle || lastActive !== today) {
    await supabase
      .from("user_profiles")
      .update({
        level: newLevel,
        player_rank: newRank,
        player_title: newTitle,
        streak_count: newStreak,
        last_active_date: today,
      })
      .eq("user_id", userId);
  }

  return {
    totalXp,
    level: newLevel,
    rank: newRank,
    title: newTitle,
    leveledUp,
    rankedUp,
    titleChanged,
    prevLevel,
    prevRank,
    prevTitle,
  };
}

/* ═══════════════════════════════════════════════
   HELPER: Show celebration toast/alert
═══════════════════════════════════════════════ */

export function showProgressionToast(result: ProgressionResult | null) {
  if (!result) return;

  const msgs: string[] = [];

  if (result.leveledUp) {
    msgs.push(`⚡ LEVEL UP! ${result.prevLevel} → ${result.level}`);
  }
  if (result.rankedUp) {
    msgs.push(`🔥 RANK UP! ${result.prevRank}-Rank → ${result.rank}-Rank`);
  }
  if (result.titleChanged) {
    msgs.push(`✨ New Title: "${result.title}"`);
  }

  if (msgs.length > 0) {
    // Use a non-blocking notification
    const msg = msgs.join("\n");
    // Check if we can use custom notification or fall back to alert
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Solo Leveling", { body: msg });
    }
    // Always show an in-page alert as well
    setTimeout(() => alert(msg), 100);
  }
}

/* ═══════════════════════════════════════════════
   XP BOOST HELPER: Apply 2x multiplier if user
   has XP_BOOST item in inventory
═══════════════════════════════════════════════ */

export async function applyXpBoost(
  supabase: SupabaseClient,
  userId: string,
  baseXp: number
): Promise<number> {
  const { data: boost } = await supabase
    .from("inventory")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("item_type", "XP_BOOST")
    .gt("quantity", 0)
    .maybeSingle();

  if (boost && boost.quantity > 0) {
    // Consume one boost charge
    await supabase
      .from("inventory")
      .update({ quantity: boost.quantity - 1 })
      .eq("id", boost.id);
    return baseXp * 2; // 2x multiplier
  }
  return baseXp;
}
