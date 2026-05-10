/**
 * Level Engine — centralized XP / Level / Rank / Title calculations
 *
 * Call `syncProgression(supabase, userId)` after any XP change
 * to auto-update level, rank, and title in the database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODE_CONFIGS, type ModeType } from "./modeConfig";
import { CATEGORY_STAT_LOOKUP } from "./categoryConfig";

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */

/** XP needed to reach a given level: level * 500 */
export const xpForLevel = (level: number) => level * 500;

/** 
 * XP Normalization Logic
 * 
 * Category Weights:
 * - Learning/Academics: 0.8 (High volume, needs normalization)
 * - Fitness: 1.2 (High physical effort)
 * - Work/Finance: 1.0 (Standard)
 * - Mindfulness/Social: 1.1 (Mental well-being)
 * - General/Errands: 0.7 (Low complexity)
 */
export const CATEGORY_WEIGHTS: Record<string, number> = {
  Learning: 0.8,
  Academics: 0.8,
  Fitness: 1.2,
  Work: 1.0,
  Finance: 1.0,
  Mindfulness: 1.1,
  Social: 1.1,
  General: 0.7,
  Errands: 0.7,
  Creative: 1.0,
};

/**
 * Calculates effective XP based on category and current XP volume (Diminishing Returns).
 * This ensures that "Heavy Learning Tasks" don't create an unbridgeable gap.
 */
export function calculateEffectiveXp(baseXp: number, category: string, _totalPoints?: number): number {
  const weight = CATEGORY_WEIGHTS[category] ?? 1.0;
  
  // Super Hard Mode: Logarithmic dampening starts much earlier (at 50 XP)
  // This ensures that even "S-Rank" tasks don't provide massive power-level jumps.
  let effective = baseXp;
  if (baseXp > 50) {
    effective = 50 + Math.log10(baseXp - 49) * 10; 
  }
  
  // Apply category weight
  effective = effective * weight;
  
  return Math.round(effective);
}

/** Derive level from total XP */
export const calcLevel = (totalXp: number): number =>
  Math.max(1, Math.floor(totalXp / 500) + 1);

/** Progress % within current level (0-100) */
export const calcXpProgress = (totalXp: number): number =>
  Math.min(((totalXp % 500) / 500) * 100, 100);

/* ── Rank thresholds ────────────────────────── */
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
  Assassin:        ["Street Shadow",  "Ghost Agent",   "Void Walker",      "Silent Reaper",    "Shadow Monarch"],
  Warrior:         ["Street Brawler", "Combat Vet",    "Vanguard",         "Iron Conqueror",   "War Lord"],
  Mage:            ["Code Weaver",    "Apprentice",    "Archmage",         "Reality Glitcher", "Techno-Sage"],
  Tamer:           ["Handler",        "Jockey",        "Beast Lord",       "Spectral Binder",  "Primeval King"],
  Healer:          ["Field Medic",    "Nano-Saint",    "Guardian Angel",   "World Tree Sage",  "Life Bringer"],
  Tank:            ["Shield",         "Fortress",      "Indomitable",      "Aegis Prime",      "Eternal Bastion"],
  Ranger:          ["Scout",          "Pathfinder",    "Grid Sniper",      "Windstrider",      "Dimensional Tracker"],
  Necromancer:     ["Glint Reaper",   "Soul Collector","Lich King",        "Ender of Worlds",  "Shadow Monarch"],
  Craftsman:       ["Apprentice",     "Artisan",       "Master Smith",     "Soul Forger",      "Divine Architect"],
  Scout:           ["Pathfinder",     "Navigator",     "Grid Walker",      "Void Scout",       "Celestial Eye"],
};

/* ── Punishment Quest Pool ──────────────────── */
export const PUNISHMENT_QUESTS = [
  { title: "Penalty Zone: Physical Trial", desc: "Perform 100 Pushups, 100 Sit-ups, 100 Squats, and a 10km Run. (Solo Leveling Classic)", points: 50 },
  { title: "Shadow Restraint", desc: "No entertainment/social media for 4 hours. Focus only on productivity.", points: 30 },
  { title: "Mana Cleanse", desc: "Drink only water for 24 hours. No processed sugars.", points: 40 },
  { title: "Monarch's Discipline", desc: "Wake up at 5:00 AM and start your first task immediately.", points: 25 },
];

export function getRandomPunishment() {
  return PUNISHMENT_QUESTS[Math.floor(Math.random() * PUNISHMENT_QUESTS.length)];
}

/** 
 * All category → stat mappings come from categoryConfig.ts (canonical registry).
 * Import CATEGORY_STAT_LOOKUP from there instead of duplicating here.
 */
export const CATEGORY_STAT_MAP: Record<string, string> = CATEGORY_STAT_LOOKUP;


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
  status: string;
};

/**
 * Recalculate and write level, rank, and title based on current total_points.
 * Returns what changed so the caller can show celebrations.
 *
 * ALL thresholds and penalties are driven by the user's active ModeConfig.
 * Nothing here is hardcoded — the difficulty selection is the single source of truth.
 */
export async function syncProgression(
  supabase: SupabaseClient,
  userId: string
): Promise<ProgressionResult | null> {
  const { data: prof } = await supabase
    .from("user_profiles")
    .select("total_points, level, player_rank, player_title, player_class, streak_count, last_active_date, last_heartbeat, stat_strength, stat_agility, stat_sense, stat_intelligence, stat_vitality, dark_mana, current_mode, ego_score, status")
    .eq("user_id", userId)
    .single();

  if (!prof) return null;

  const currentModeName = (prof.current_mode as ModeType) || "Normal";
  const config = MODE_CONFIGS[currentModeName];

  const totalXp   = prof.total_points ?? 0;
  const prevLevel = prof.level ?? 1;
  const prevRank  = prof.player_rank ?? "E";
  const prevTitle = prof.player_title ?? "Newcomer";
  const cls       = prof.player_class ?? "Warrior";

  // ── STREAK & DECAY (fully mode-driven) ──────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  let newStreak = prof.streak_count ?? 0;
  const lastActive = prof.last_active_date;
  let decayPenalty = 0;

  if (lastActive !== today) {
    const lastActiveDate  = new Date(lastActive || Date.now());
    const todayDate       = new Date(today);
    const diffDays        = Math.floor((todayDate.getTime() - lastActiveDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) {
      // Consecutive day — grow streak
      newStreak += 1;
    } else if (diffDays > 1) {
      // ── Streak Grace (config.streakGraceDays) ─────────────────────────
      // Easy: 2-day grace. Normal: 1-day grace. Hard/Hell: 0 days.
      // Missing ≤ graceDays does NOT break the streak, just pauses it.
      if (diffDays - 1 <= config.streakGraceDays) {
        // Within grace — streak is preserved, shows "Final Warning" in UI
        // (no streak increment — you didn't earn it, but you didn't lose it)
      } else {
        // Beyond grace — streak breaks
        newStreak = 1;
      }

      // ── Inactivity Decay (config.decayRate + gracePeriod + softDecayCapXp) ─
      const decayDays = Math.max(0, diffDays - config.gracePeriod);

      if (decayDays > 0 && config.decayRate > 0) {
        let rawDecay: number;

        if (config.compoundingDecay) {
          // Hell: compound interest in reverse — each day multiplies by (1 - decayRate)
          let tempXp = Math.max(0, totalXp);
          for (let i = 0; i < decayDays; i++) {
            tempXp *= (1 - config.decayRate);
          }
          rawDecay = Math.floor(Math.max(0, totalXp) - tempXp);
        } else {
          // Normal/Hard: linear decay
          rawDecay = Math.floor(Math.max(0, totalXp) * config.decayRate * decayDays);
        }

        // ── Soft Decay Cap (prevents wipeouts) ──────────────────────────
        // Even Hell mode can't remove more than softDecayCapXp per cycle.
        // This is the key psychological protection — a bad week ≠ losing months.
        decayPenalty = config.softDecayCapXp > 0
          ? Math.min(rawDecay, config.softDecayCapXp)
          : rawDecay;
      }
    }
  }

  const adjustedTotalXp = Math.max(-5000, totalXp - decayPenalty);

  // Mode-aware XP calculation
  const newLevel = calcLevel(adjustedTotalXp < 0 ? 0 : adjustedTotalXp);
  let newRank = calcRank(newLevel);

  // Rank-down only in Hard/Hell
  if (!config.rankDownEnabled) {
    if (RANKS.indexOf(newRank as any) < RANKS.indexOf(prevRank as any)) {
      newRank = prevRank; // Protect rank in Easy/Normal
    }
  }

  const newTitle = calcTitle(cls, adjustedTotalXp < 0 ? 0 : adjustedTotalXp);

  const leveledUp    = newLevel > prevLevel;
  const rankedUp     = RANKS.indexOf(newRank as any) > RANKS.indexOf(prevRank as any);
  const titleChanged = newTitle !== prevTitle;

  const finalXp = adjustedTotalXp;

  // ── STATUS LOGIC (all thresholds from mode config) ──────────────────────
  //
  // Priority chain: DECEASED > PENALTY > STAGNANT > ACTIVE
  //
  // DECEASED threshold:     config.deceasedThreshold days (Easy=14, Normal=10, Hard=5, Hell=3)
  // PENALTY trigger:        finalXp < 0
  // STAGNANT threshold:     weekly XP target from config (Easy=no stagnant, Normal=150, Hard=300, Hell=500)

  // Mode-specific weekly XP threshold for STAGNANT
  const STAGNANT_THRESHOLD: Record<ModeType, number | null> = {
    Easy:   null,  // Easy never goes STAGNANT — designed for low-pressure growth
    Normal: 150,   // Light activity expected
    Hard:   300,   // Real effort expected
    Hell:   500,   // Relentless — every week must count
  };
  const weeklyTarget = STAGNANT_THRESHOLD[currentModeName];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let totalWeeklyXp = 0;

  if (weeklyTarget !== null) {
    const { data: weeklyTasks } = await supabase
      .from("tasks")
      .select("points")
      .eq("user_id", userId)
      .eq("is_completed", true)
      .neq("xp_tier", "Low")  // Low tier tasks don't count toward stagnancy check
      .gte("completed_at", sevenDaysAgo);
    totalWeeklyXp = (weeklyTasks || []).reduce((sum: number, t: any) => sum + (t.points || 0), 0);
  }

  let newStatus = "ACTIVE";

  // 1. DECEASED — uses config.deceasedThreshold
  const heartbeat       = prof.last_heartbeat ? new Date(prof.last_heartbeat) : null;
  const deceasedCutoff  = new Date(Date.now() - config.deceasedThreshold * 24 * 60 * 60 * 1000);
  if (heartbeat && heartbeat < deceasedCutoff) {
    newStatus = "DECEASED";
  }
  // 2. PENALTY — XP in debt
  else if (finalXp < 0) {
    newStatus = "PENALTY";
  }
  // 3. STAGNANT — weekly threshold missed (only if mode has one)
  else if (weeklyTarget !== null && totalWeeklyXp < weeklyTarget) {
    newStatus = "STAGNANT";
  }

  // ── WRITE BACK ──────────────────────────────────────────────────────────
  await supabase
    .from("user_profiles")
    .update({
      total_points:  finalXp,
      level:         newLevel,
      player_rank:   newRank,
      player_title:  newTitle,
      streak_count:  newStreak,
      last_active_date: today,
      last_heartbeat: new Date().toISOString(),
      status:        newStatus,
      dark_mana:     prof.dark_mana ?? 0
    })
    .eq("user_id", userId);

  // ── PROGRESSION NOTIFICATIONS ────────────────────────────────────────────
  if (leveledUp) {
    await supabase.from("notifications").insert({
      user_id: userId,
      title:   "⚡ LEVEL UP",
      message: `You reached Level ${newLevel}. The System acknowledges your growth.`,
      type:    "achievement",
      link:    "/profile"
    });
  }
  if (rankedUp) {
    await supabase.from("notifications").insert({
      user_id: userId,
      title:   "🏆 RANK UP",
      message: `You have ascended to ${newRank}-Rank. New gates will open.`,
      type:    "achievement",
      link:    "/profile"
    });
  }
  if (newStatus === "PENALTY" && prof.status !== "PENALTY") {
    await supabase.from("notifications").insert({
      user_id: userId,
      title:   "⚠️ XP DEBT DETECTED",
      message: "Your XP has fallen below zero. Complete tasks to restore your standing. Dark Mana is accumulating.",
      type:    "system",
      link:    "/rewards"
    });
  }
  if (newStatus === "STAGNANT" && prof.status !== "STAGNANT") {
    await supabase.from("notifications").insert({
      user_id: userId,
      title:   "📉 STAGNATION WARNING",
      message: `The System detects insufficient activity this week. ${currentModeName} mode requires ${weeklyTarget} XP/week from meaningful gates.`,
      type:    "system",
      link:    "/dungeon-gate"
    });
  }

  return {
    totalXp: finalXp,
    level:   newLevel,
    rank:    newRank,
    title:   newTitle,
    leveledUp,
    rankedUp,
    titleChanged,
    prevLevel,
    prevRank,
    prevTitle,
    status:  newStatus
  };
}

/**
 * V5 Corruption Multiplier: +10% to next penalty per day of unredeemed debt.
 * Returns the multiplier (e.g. 1.2 for 2 days of debt).
 */
export async function calculateCorruptionMultiplier(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: prof } = await supabase
    .from("user_profiles")
    .select("dark_mana, dark_mana_started_at")
    .eq("user_id", userId)
    .single();

  if (!prof || !prof.dark_mana || prof.dark_mana <= 0 || !prof.dark_mana_started_at) {
    return 1.0;
  }

  const startedAt = new Date(prof.dark_mana_started_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 3600 * 24));
  
  return 1.0 + (diffDays * 0.1);
}

/* ═══════════════════════════════════════════════
   HELPER: Show celebration effects (Rain, etc)
═══════════════════════════════════════════════ */

export function showProgressionToast(result: ProgressionResult | null) {
  if (!result) return;

  if (result.leveledUp) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("solo-leveling:level-up", {
          detail: {
            level: result.level,
            prevLevel: result.prevLevel,
            rank: result.rank,
          },
        })
      );
    }
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

/* ═══════════════════════════════════════════════
   PLAYMAKER RATING (bl6)
   Score = (Comp% * 0.4) + (AvgDiff * 0.3) + (Streak * 0.2) + (Ego * 0.1)
═══════════════════════════════════════════════ */

export function calculatePlaymakerRating(
  completedCount: number,
  totalCount: number,
  avgXp: number,
  streak: number,
  egoScore: number
): number {
  if (totalCount === 0) return 0;
  
  const compRate = (completedCount / totalCount) * 100;
  // Avg XP normalized (assuming 100 is "High" tier)
  const normAvgXp = Math.min(100, (avgXp / 100) * 100);
  // Streak normalized (cap at 30 days)
  const normStreak = Math.min(100, (streak / 30) * 100);
  // Ego Score normalized (cap at 100)
  const normEgo = Math.min(100, (egoScore / 100) * 100);

  const score = (compRate * 0.4) + (normAvgXp * 0.3) + (normStreak * 0.2) + (normEgo * 0.1);
  return Math.round(score * 10) / 10;
}

/* ═══════════════════════════════════════════════
   WEEKLY SELECTION (bl4)
   Rank top 11 tasks by XP value
═══════════════════════════════════════════════ */

export function evaluateWeeklySelection(tasks: any[]): any[] {
  return [...tasks]
    .filter(t => t.is_completed)
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 11);
}
