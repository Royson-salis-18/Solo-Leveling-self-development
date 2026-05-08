/**
 * Level Engine — centralized XP / Level / Rank / Title calculations
 *
 * Call `syncProgression(supabase, userId)` after any XP change
 * to auto-update level, rank, and title in the database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODE_CONFIGS, type ModeType } from "./modeConfig";

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
 * STAT MAPPING: 
 * Fitness     -> Strength
 * Errands     -> Agility
 * Mindfulness -> Sense
 * Learning    -> Intelligence
 * Wellness    -> Vitality
 */
export const CATEGORY_STAT_MAP: Record<string, string> = {
  Fitness:     "stat_strength",
  Errands:     "stat_agility",
  General:     "stat_agility",
  Mindfulness: "stat_sense",
  Social:      "stat_sense",
  Learning:    "stat_intelligence",
  Academics:   "stat_intelligence",
  Work:        "stat_intelligence",
  Wellness:    "stat_vitality",
  Health:      "stat_vitality",
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
  status: string;
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
    .select("total_points, level, player_rank, player_title, player_class, streak_count, last_active_date, last_heartbeat, stat_strength, stat_agility, stat_sense, stat_intelligence, stat_vitality, dark_mana, current_mode, ego_score")
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

  // Streak & Stagnation Logic
  const today = new Date().toISOString().split("T")[0];
  let newStreak = prof.streak_count ?? 0;
  const lastActive = prof.last_active_date;
  let decayPenalty = 0;

  if (lastActive !== today) {
    const lastActiveDate = new Date(lastActive || Date.now());
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastActiveDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      const decayDays = Math.max(0, diffDays - config.gracePeriod);
      
      if (decayDays > 0) {
        if (config.compoundingDecay) {
          // Nightmare: Each day multiplies prior balance by 0.97
          let tempXp = totalXp;
          for(let i=0; i<decayDays; i++) {
            tempXp *= (1 - config.decayRate);
          }
          decayPenalty = Math.floor(totalXp - tempXp);
        } else {
          decayPenalty = Math.floor(totalXp * config.decayRate * decayDays);
        }
      }
      newStreak = 1; 
    }
  }

  const adjustedTotalXp = Math.max(-5000, totalXp - decayPenalty);

  // Mode-aware XP calculation
  const newLevel = calcLevel(adjustedTotalXp < 0 ? 0 : adjustedTotalXp);
  let newRank = calcRank(newLevel);
  
  // Rank-down logic (Hard/Nightmare only)
  if (config.rankDownEnabled && RANKS.indexOf(newRank as any) < RANKS.indexOf(prevRank as any)) {
    // Rank has naturally dropped due to XP decay/penalties
  } else if (!config.rankDownEnabled) {
    // Prevent rank drop in Easy/Normal
    if (RANKS.indexOf(newRank as any) < RANKS.indexOf(prevRank as any)) {
      newRank = prevRank;
    }
  }

  const newTitle = calcTitle(cls, adjustedTotalXp < 0 ? 0 : adjustedTotalXp);

  // OVERDUE PENALTY SCAN
  // Find tasks where deadline < today and not completed/failed
  const { data: overdueTasks } = await supabase
    .from("tasks")
    .select("id, points, deadline, title")
    .eq("user_id", userId)
    .eq("is_completed", false)
    .eq("is_failed", false)
    .lt("deadline", today);

  let totalOverduePenalty = 0;
  if (overdueTasks && overdueTasks.length > 0) {
    
    for (const t of overdueTasks) {
      const deadlineDate = new Date(t.deadline);
      const todayDate = new Date(today);
      const daysLate = Math.floor((todayDate.getTime() - deadlineDate.getTime()) / (1000 * 3600 * 24));
      
      if (daysLate > 0) {
        // Mode-aware Overdue Penalty: use exponential formula from TODO (e6)
        // overduePenalty = 0.2 × XP × (1 + daysLate)^0.5
        const xpPoints = t.points || 10;
        const expPenalty = Math.floor(0.2 * xpPoints * Math.pow(1 + daysLate, 0.5));
        
        // Cap at 80% to avoid instant wipe
        const cappedPenalty = Math.min(expPenalty, Math.floor(xpPoints * 0.8));
        totalOverduePenalty += cappedPenalty;
      }
    }
  }

  const finalXp = Math.max(-5000, adjustedTotalXp - totalOverduePenalty);

  // Weekly Activity Threshold (300-500 XP per week required for Hard Mode)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: weeklyPoints } = await supabase
    .from("user_points")
    .select("daily_points")
    .eq("user_id", userId)
    .gte("date", sevenDaysAgo);

  const totalWeeklyXp = (weeklyPoints || []).reduce((sum: number, p: any) => sum + (p.daily_points || 0), 0);

  // Status Logic: Priority Chain (DECEASED > PENALTY > STAGNANT > ACTIVE)
  let newStatus = 'ACTIVE';
  if (finalXp < 0) {
    newStatus = 'PENALTY';
  } else if (totalWeeklyXp < 300) {
    newStatus = 'STAGNANT';
  } else if (finalXp < 100) {
    newStatus = 'NEWBIE';
  }

  const leveledUp    = newLevel > prevLevel;
  const rankedUp     = RANKS.indexOf(newRank as any) > RANKS.indexOf(prevRank as any);
  const titleChanged = newTitle !== prevTitle;

  // --- SELF-REAPER CHECK (1 Week Inactivity) ---
  let finalStatus = newStatus;
  const heartbeat = prof.last_heartbeat ? new Date(prof.last_heartbeat) : null;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  if (heartbeat && heartbeat < oneWeekAgo) {
    finalStatus = 'DECEASED';
  }

  // Only write if something actually changed (or just always update heartbeat)
  await supabase
    .from("user_profiles")
    .update({
      total_points: finalXp,
      level: newLevel,
      player_rank: newRank,
      player_title: newTitle,
      streak_count: newStreak,
      last_active_date: today,
      last_heartbeat: new Date().toISOString(),
      status: finalStatus,
      dark_mana: prof.dark_mana ?? 0
    })
    .eq("user_id", userId);

  return {
    totalXp: finalXp,
    level: newLevel,
    rank: newRank,
    title: newTitle,
    leveledUp,
    rankedUp,
    titleChanged,
    prevLevel,
    prevRank,
    prevTitle,
    status: finalStatus
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
  if (result.rankedUp) {
    msgs.push(`🔥 RANK UP! ${result.prevRank}-Rank → ${result.rank}-Rank`);
  }
  if (result.titleChanged) {
    msgs.push(`✨ New Title: "${result.title}"`);
  }
  
  if (result.status === 'PENALTY') {
    msgs.push(`⚠️ SYSTEM WARNING: MANA DEBT DETECTED! You have entered PENALTY MODE. Re-stabilize your mana (XP) immediately to unlock full potential.`);
  }

  if (result.totalXp < result.totalXp + 1) { // checking if there was a decay (conceptually)
    // Actually we need to pass the decay amount to result to show it properly.
    // For now, I'll just keep it simple.
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
