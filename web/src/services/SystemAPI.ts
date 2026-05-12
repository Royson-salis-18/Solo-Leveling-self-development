import { supabase } from "../lib/supabase";
import { calculateNextDeadline, findNextValidDeadline } from "../lib/taskUtils";
import { syncProgression, showProgressionToast, applyXpBoost, calculateEffectiveXp, getRandomPunishment, CATEGORY_STAT_MAP } from "../lib/levelEngine";
import { OracleService } from "./OracleService";
import { MODE_CONFIGS, type ModeType } from "../lib/modeConfig";

/* ═══════════════════════════════════════════════
   TYPES — Universal Mission Schema (UMS)
═══════════════════════════════════════════════ */

export type DashboardData = {
  activeCount: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  totalXp: number;
  total_points: number;
  level: number;
  streak_count?: number;
  weeklyHistory: Array<{ date: string; daily_points: number }>;
  monthlyHistory: Array<{ date: string; daily_points: number }>;
  categoryDistribution: Array<{ category: string; points: number }>;
  player_rank?: string;
  player_title?: string;
  activeTasks: any[];
  completedTasks: any[];
  clanMembers: any[];
  shadows: any[];
  guild?: { name: string; id: string };
  guild_title?: string;
  status?: string;
  last_heartbeat?: string;
  dark_mana: number;
  current_mode?: string;
  ego_score?: number;
  season_end_date?: string;
  playmaker_rating?: number;
  // ── Hunter Stat Proficiency (for Radar) ──
  domain_physical: number;
  domain_mind: number;
  domain_soul: number;
  domain_execution: number;
  domain_builder: number;
};

export type GatePayload = {
  user_id: string;
  title: string;
  category: string;
  description?: string;
  deadline?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  priority: string;
  xp_tier: string;
  points: number;
  is_recurring: boolean;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_days?: string | number[]; 
  recurrence_day_of_month?: number;
  recurrence_custom_label?: string;
  parent_id?: string | null;
  assigned_to?: string;
  is_gauntlet?: boolean;
  is_weekly_trial?: boolean;
};

/* ═══════════════════════════════════════════════
   HELPER — ensures supabase is initialized
═══════════════════════════════════════════════ */
function db() {
  if (!supabase) throw new Error("Supabase client not initialized");
  return supabase;
}

/* ═══════════════════════════════════════════════
   SERVICE LAYER — Phase 1 (Direct Supabase)
   In Phase 2, each method becomes a Gateway call.
═══════════════════════════════════════════════ */

export const SystemAPI = {

  /* ─── DASHBOARD ─────────────────────────────── */

  fetchDashboardData: async (userId: string): Promise<DashboardData> => {
    const s = db();
    const today = new Date().toISOString().split("T")[0];

    const [
      { count: ac },
      { count: cc },
      { count: fc },
      { count: pc },
      uRes, pRes, mRes, tRes,
      activeTasksRes, completedTasksRes, clanMembRes, shadowsRes,
    ] = await Promise.all([
      s.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_completed", false).eq("is_pending", false).eq("is_failed", false),
      s.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_completed", true).eq("is_failed", false).gte("completed_at", today + "T00:00:00"),
      s.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_failed", true).gte("completed_at", today + "T00:00:00"),
      s.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_pending", true).eq("is_completed", false),
      // Keep profile fetch schema-tolerant; relation/optional fields are loaded separately.
      s.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
      s.from("user_points").select("date,daily_points").eq("user_id", userId).order("date", { ascending: true }).limit(7),
      s.from("user_points").select("date,daily_points").eq("user_id", userId).order("date", { ascending: true }).limit(30),
      s.from("tasks").select("category,points").eq("user_id", userId),
      s.from("tasks").select("id, title, is_completed, is_pending, is_failed, is_active, started_at, priority, xp_tier, category").eq("user_id", userId).eq("is_completed", false).eq("is_pending", false).order("created_at", { ascending: false }).limit(10),
      s.from("tasks").select("id, title, points, completed_at").eq("user_id", userId).eq("is_completed", true).order("completed_at", { ascending: false }).limit(5),
      s.from("clan_members").select("clan_id, clans(name, id), role").eq("user_id", userId),
      s.from("shadows").select("*").eq("user_id", userId),
    ]);

    let uData: any = uRes.data;
    if (!uData || uRes.error) {
      // Fallback: avoid zeroed dashboard when relational profile select fails.
      const { data: basicProfile } = await s
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      uData = basicProfile || null;
    }

    let guildData: { name: string; id: string } | undefined = (uData as any)?.guilds;
    if (!guildData && uData?.guild_id) {
      const { data: guild } = await s
        .from("guilds")
        .select("name,id")
        .eq("id", uData.guild_id)
        .maybeSingle();
      guildData = guild || undefined;
    }

    const weeklyHistory = pRes.data || [];
    const monthlyHistory = mRes.data || [];
    const catMap: Record<string, number> = {};
    (tRes.data || []).forEach((t: any) => {
      catMap[t.category] = (catMap[t.category] || 0) + (t.points || 0);
    });

    return {
      activeCount: ac || 0,
      completedCount: cc || 0,
      failedCount: fc || 0,
      pendingCount: pc || 0,
      totalXp: uData?.total_points ?? 0,
      total_points: uData?.total_points ?? 0,
      level: uData?.level || 1,
      streak_count: uData?.streak_count || 0,
      player_rank: uData?.player_rank || "E",
      player_title: uData?.player_title || "Newcomer",
      weeklyHistory,
      monthlyHistory,
      categoryDistribution: Object.entries(catMap).map(([category, points]) => ({ category, points })),
      activeTasks: activeTasksRes.data || [],
      completedTasks: completedTasksRes.data || [],
      clanMembers: clanMembRes.data || [],
      shadows: shadowsRes.data || [],
      guild: guildData,
      guild_title: uData?.guild_title,
      status: uData?.status,
      last_heartbeat: uData?.last_heartbeat,
      dark_mana: uData?.dark_mana || 0,
      current_mode: uData?.current_mode || "Normal",
      ego_score: uData?.ego_score || 0,
      season_end_date: uData?.season_end_date,
      playmaker_rating: uData?.playmaker_rating || 0,
      // ── Hunter Stat Proficiency (real skill from DB) ──
      domain_physical:   uData?.domain_physical   || 10,
      domain_mind:       uData?.domain_mind       || 10,
      domain_soul:       uData?.domain_soul       || 10,
      domain_execution:  uData?.domain_execution  || 10,
      domain_builder:    uData?.domain_builder    || 10,
    };
  },

  /* ─── GATE: Fetch All ──────────────────────── */

  fetchGates: async (userId: string) => {
    const s = db();
    
    // V5: Trigger system manifestation clauses before fetching
    await SystemAPI.triggerSystemGates(userId);
    
    const { data, error } = await s.from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  triggerSystemGates: async (userId: string) => {
    const s = db();
    const { data: prof } = await s.from("user_profiles").select("*").eq("user_id", userId).single();
    if (!prof) return;

    // ── ROBUST DEDUP: check for any ACTIVE (non-completed, non-failed) instance ──
    // Old bug: `.gte("created_at", today)` only checked if it was created TODAY.
    // If you didn't complete it yesterday, it would spawn again today.
    const hasActiveGate = async (title: string) => {
      const { data } = await s.from("tasks")
        .select("id")
        .eq("user_id", userId)
        .eq("title", title)
        .eq("is_completed", false)
        .eq("is_failed", false);
      return (data || []).length > 0;
    };

    // 1. Clause: Penalty Zone (Dark Mana + Penalty Status)
    // Only spawn ONE at a time. If one is active, the System is already watching.
    if (prof.dark_mana > 0 && prof.status === 'PENALTY') {
      const title = "🚨 PENALTY: Penalty Zone: Physical Trial";
      if (!await hasActiveGate(title)) {
        await s.from("tasks").insert({
          user_id: userId,
          title,
          category: "Punishment",
          points: 25,
          xp_tier: "High",
          priority: "URGENT",
          is_system_generated: true,
          description: "SYSTEM: Clear your Dark Mana debt through physical discipline. 100 Pushups, 100 Situps, 100 Squats, 10km Run.",
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      }
    }

    // 2. Clause: Survival Test (7-Day Streak Milestone)
    // Only spawn if NO trial (active OR completed) exists from the last 7 days.
    if (prof.streak_count > 0 && prof.streak_count % 7 === 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentTrials } = await s.from("tasks")
        .select("id")
        .eq("user_id", userId)
        .eq("is_weekly_trial", true)
        .gte("created_at", sevenDaysAgo);
        
      if ((recentTrials || []).length === 0) {
        const title = `🛡️ Weekly Trial: [SYSTEM_SURVIVAL_TEST] - Day ${prof.streak_count}`;
        await s.from("tasks").insert({
          user_id: userId,
          title,
          category: "General",
          points: 50,
          xp_tier: "Legendary",
          priority: "High",
          is_system_generated: true,
          is_weekly_trial: true,
          is_gauntlet: true,
          description: "SYSTEM: You have survived for a week. Prove your worth in this survival gauntlet.",
        });
      }
    }

    // 3. Clause: Ego Stabilization (S-Rank + Stagnant Status)
    if (prof.player_rank === 'S' && prof.status === 'STAGNANT') {
      const title = "🌀 Monarch's Trial: [EGO_STABILIZATION]";
      if (!await hasActiveGate(title)) {
        await s.from("tasks").insert({
          user_id: userId,
          title,
          category: "Mindfulness",
          points: 40,
          xp_tier: "Super",
          priority: "High",
          is_system_generated: true,
        description: "SYSTEM: Your S-Rank ego is destabilizing. Realign your focus through deep work or meditation."
        });
      }
    }
  },

  /* ─── FLOW SYSTEM: Cleanup Duplicate Gates ──── */
  // Call this ONCE to clean up the existing mess.
  // Keeps the OLDEST active instance of each system gate title, deletes the rest.

  cleanupDuplicateSystemGates: async (userId: string) => {
    const s = db();
    
    // Get all active (non-completed, non-failed) system-generated gates
    const { data: systemGates } = await s.from("tasks")
      .select("id, title, created_at")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .eq("is_failed", false)
      .eq("is_system_generated", true)
      .order("created_at", { ascending: true }); // oldest first

    if (!systemGates || systemGates.length === 0) return { removed: 0 };

    // Group by title → keep first (oldest), delete the rest
    const seen = new Map<string, string>(); // title → id to keep
    const toDelete: string[] = [];

    for (const gate of systemGates) {
      if (seen.has(gate.title)) {
        toDelete.push(gate.id); // duplicate — mark for deletion
      } else {
        seen.set(gate.title, gate.id); // first seen — keep it
      }
    }

    // Also remove weekly trials that are duplicates (match by is_weekly_trial)
    const { data: weeklyGates } = await s.from("tasks")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .eq("is_failed", false)
      .eq("is_weekly_trial", true)
      .order("created_at", { ascending: true });

    if (weeklyGates && weeklyGates.length > 1) {
      // Keep oldest weekly trial, delete the rest
      weeklyGates.slice(1).forEach(g => {
        if (!toDelete.includes(g.id)) toDelete.push(g.id);
      });
    }

    if (toDelete.length > 0) {
      await s.from("tasks").delete().in("id", toDelete);
    }

    return { removed: toDelete.length };
  },

  /* ─── FLOW SYSTEM: Category Nudge (Psychology) ─ */
  // Sends a soft notification if any stat hasn't been trained in 7+ days.
  // NEVER creates forced gates. Uses the Habit Loop: Cue → Routine → Reward.

  checkCategoryNudges: async (userId: string) => {
    const s = db();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const STAT_CATEGORIES: Array<{ stat: string; categories: string[]; emoji: string }> = [
      { stat: "Strength",     categories: ["Fitness"],             emoji: "💪" },
      { stat: "Intelligence", categories: ["Learning", "Work", "Academics"], emoji: "🧠" },
      { stat: "Vitality",     categories: ["Wellness", "Health"],  emoji: "❤️" },
      { stat: "Agility",      categories: ["Errands", "General"],  emoji: "⚡" },
      { stat: "Sense",        categories: ["Mindfulness", "Social"], emoji: "🌊" },
    ];

    const nudgesSent: string[] = [];

    for (const { stat, categories, emoji } of STAT_CATEGORIES) {
      // Check if any task in these categories was completed in the last 7 days
      const { data: recentTasks } = await s.from("tasks")
        .select("id")
        .eq("user_id", userId)
        .eq("is_completed", true)
        .in("category", categories)
        .gte("completed_at", sevenDaysAgo)
        .limit(1);

      if (!recentTasks || recentTasks.length === 0) {
        // Check if we already sent this nudge recently (avoid spamming)
        const { data: recentNudge } = await s.from("notifications")
          .select("id")
          .eq("user_id", userId)
          .ilike("title", `%${stat}%`)
          .gte("created_at", sevenDaysAgo)
          .limit(1);

        if (!recentNudge || recentNudge.length === 0) {
          await s.from("notifications").insert({
            user_id: userId,
            title: `${emoji} ${stat.toUpperCase()} FADING`,
            message: `Your ${stat} stat hasn't been trained in 7+ days. The System recommends a ${categories[0]} task today. Even 20 minutes will maintain your growth.`,
            type: "system",
            is_read: false,
          });
          nudgesSent.push(stat);
        }
      }
    }

    return { nudgesSent };
  },

  /* ─── FLOW SYSTEM: Resonance Burst (Variable Reward) ─ */
  // After completing tasks, rolls for a bonus XP burst.
  // Variable reward schedule (Skinner) creates the same engagement loop as games.
  // Call this from completeGate after the base XP is awarded.

  awardResonanceBurst: async (userId: string, consecutiveCompletions: number, baseXp: number) => {
    const s = db();
    const { data: prof } = await s.from("user_profiles")
      .select("current_mode, total_points")
      .eq("user_id", userId).single();

    const mode = (prof?.current_mode as ModeType) || "Normal";
    const config = MODE_CONFIGS[mode];

    // Only roll if user has 3+ consecutive completions (momentum required)
    if (consecutiveCompletions < 3) return null;

    const roll = Math.random();
    if (roll > config.resonanceBurstChance) return null;

    // Burst scales with consecutive completions (more momentum → bigger burst)
    const burstMultiplier = Math.min(2.0, 1.0 + (consecutiveCompletions - 3) * 0.15);
    const burstXp = Math.round(baseXp * burstMultiplier * 0.5);

    if (burstXp <= 0) return null;

    // Award the burst
    await s.from("user_profiles").update({
      total_points: (prof?.total_points ?? 0) + burstXp
    }).eq("user_id", userId);

    // Notify the user (this IS a toast-worthy event)
    await s.from("notifications").insert({
      user_id: userId,
      title: "⚡ RESONANCE BURST",
      message: `${consecutiveCompletions}-gate momentum! Bonus +${burstXp} XP has been awarded by the System.`,
      type: "achievement",
      is_read: false,
    });

    return { burstXp, consecutiveCompletions };
  },

  /* ─── GATE: Recurring Sweep ────────────────── */

  sweepRecurringGates: async (_userId: string, tasks: any[]) => {
    const s = db();
    const today = new Date().toISOString().split("T")[0];
    const expired = tasks.filter(t => (t.is_completed || t.is_failed) && t.is_recurring && t.deadline && t.deadline < today);
    if (expired.length === 0) return false; // no changes

    for (const task of expired) {
      const nextDeadline = findNextValidDeadline(task);
      await s.from("tasks").update({
        is_completed: false, is_failed: false, is_pending: false, completed_at: null, deadline: nextDeadline,
      }).eq("id", task.id);
    }
    return true; // re-fetch needed
  },

  /* ─── GATE: Create / Update ────────────────── */

  saveGate: async (payload: GatePayload, editingId: string | null) => {
    const s = db();
    
    // V5: Smart Daily Capacity (Max 20 active tasks PER DAY)
    if (!editingId && payload.deadline) {
      const targetDeadline = payload.deadline;
      const deadlineDate = new Date(targetDeadline);
      const isWeekend = deadlineDate.getDay() === 0 || deadlineDate.getDay() === 6; // 0=Sun, 6=Sat

      const { count } = await s.from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", payload.user_id)
        .eq("is_completed", false)
        .eq("is_failed", false)
        .eq("deadline", targetDeadline);

      const dailyLimit = isWeekend ? 30 : 20; // Weekends have higher capacity for "Shadow Raids"

      if ((count || 0) >= dailyLimit) {
        throw new Error(`⚠️ TEMPORAL OVERLOAD: You already have ${count} active gates for ${targetDeadline}. ${!isWeekend ? "The System recommends shifting some tasks to the weekend ('Weekend tasks will wait') to prevent mana burnout." : "Even a Monarch must rest; this day is at maximum capacity."}`);
      }
    }

    // V5: Deadline Validation & Auto E-Rank
    const now = new Date();
    let finalPayload = { ...payload };
    
    if (!payload.deadline && !editingId) {
      // For NEW gates, no deadline = Auto E-Rank. 
      // For EDITS, we respect the user's choice as they might be upgrading or adding a deadline.
      finalPayload.xp_tier = "Low";
      finalPayload.points = 5;
    } else if (!editingId && payload.deadline) {
      // Deadline validation ONLY for new gates to prevent locking existing ones
      // Deadline must be >= current + (rank * 30 mins)
      const rankMinutes: Record<string, number> = { "Low": 30, "Mid": 60, "High": 120, "Super": 240, "Legendary": 480 };
      const minBuffer = rankMinutes[payload.xp_tier] || 30;
      const minDeadline = new Date(now.getTime() + minBuffer * 60000);
      
      const providedDeadline = new Date(payload.deadline + (payload.start_time ? `T${payload.start_time}` : "T23:59:59"));
      if (providedDeadline < minDeadline) {
        throw new Error(`⚠️ TEMPORAL ANOMALY: For a ${payload.xp_tier}-Rank gate, the System requires a preparation window of at least ${minBuffer} minutes.`);
      }
    }

    if (editingId) {
      // For updates, we often want to exclude the user_id from the payload to avoid RLS issues,
      // and we only validate the deadline if it has actually changed.
      const { user_id, ...updatePayload } = finalPayload;
      const { error } = await s.from("tasks").update(updatePayload).eq("id", editingId);
      if (error) throw error;
    } else {
      const { data: newGate, error } = await s.from("tasks").insert({ ...finalPayload, is_active: false, is_completed: false }).select("id").single();
      if (error) throw error;

      // If Gauntlet, generate 5 stages
      if (payload.is_gauntlet && newGate) {
        const stages = [
          "Stage 1: Perimeter Breach",
          "Stage 2: Dungeon Entry",
          "Stage 3: Mob Clearing",
          "Stage 4: Mini-Boss Encounter",
          "Stage 5: Boss Chamber Access"
        ];
        const subtasks = stages.map(title => ({
          user_id: payload.user_id,
          assigned_to: payload.assigned_to,
          parent_id: newGate.id,
          title,
          category: payload.category,
          points: 5,
          xp_tier: "Low",
          priority: "Normal"
        }));
        await s.from("tasks").insert(subtasks);
      }
    }
  },

  increaseDarkMana: async (userId: string, amount: number) => {
    const s = db();
    const { data, error: fError } = await s.from("user_profiles").select("dark_mana, dark_mana_started_at").eq("user_id", userId).single();
    if (fError) throw fError;
    const current = data?.dark_mana || 0;
    
    const update: any = { dark_mana: current + amount };
    if (current === 0) {
      update.dark_mana_started_at = new Date().toISOString();
    }
    
    const { error: uError } = await s.from("user_profiles").update(update).eq("user_id", userId);
    if (uError) throw uError;
  },

  redeemDarkMana: async (userId: string, amountRedeemed: number) => {
    const s = db();
    const { data: prof } = await s.from("user_profiles").select("total_points, dark_mana").eq("user_id", userId).single();
    if (!prof) return;

    // V5: Redemption dual-cost: 1.5x XP (10 DM = 15 XP)
    const xpCost = Math.floor(amountRedeemed * 1.5);
    const newDM = Math.max(0, prof.dark_mana - amountRedeemed);
    const newXP = Math.max(-5000, prof.total_points - xpCost);

    const update: any = { 
      dark_mana: newDM,
      total_points: newXP
    };
    
    if (newDM === 0) {
      update.dark_mana_started_at = null;
    }

    await s.from("user_profiles").update(update).eq("user_id", userId);
    
    // Sync progression
    const progression = await syncProgression(s, userId);
    showProgressionToast(progression);
  },

  /* ─── SPECIAL GATES (g2, g3) ──────────────── */

  manifestWeeklyTrial: async (userId: string) => {
    const s = db();

    // ── ROBUST DEDUP: never spawn if ANY trial (active OR completed) exists from the last 7 days.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existingTrials } = await s.from("tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("is_weekly_trial", true)
      .gte("created_at", sevenDaysAgo);

    if (existingTrials && existingTrials.length > 0) return; // Already exists or completed this week, don't stack

    // 1. Manifest the Core Trial Gate
    const { data: trial, error } = await s.from("tasks").insert({
      user_id: userId,
      assigned_to: userId,
      title: `Weekly Trial: [SYSTEM_SURVIVAL_TEST]`,
      category: "General",
      points: 100,
      xp_tier: "Legendary",
      priority: "URGENT",
      is_weekly_trial: true,
      is_system_generated: true,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      description: "The System demands a proof of growth. You must manifest and conquer at least 3 Nested Objectives to unlock the Boss Chamber. Failure to provide proof of struggle will result in mana corruption."
    }).select("id").single();

    if (error) throw error;

    // 2. Auto-generate 3 Mandatory Phases (Hidden Dungeons)
    if (trial) {
      const phases = [
        { title: "Phase 1: [IDENTIFY_WEAKNESS]", points: 15, desc: "Define the core obstacle you will overcome this week." },
        { title: "Phase 2: [EXECUTION_CHAMBER]", points: 25, desc: "Perform the primary labor required for growth." },
        { title: "Phase 3: [LIMIT_BREAK_PROTOCOL]", points: 50, desc: "Push beyond your comfort zone to finalize the trial." }
      ];

      const subtasks = phases.map(p => ({
        user_id: userId,
        assigned_to: userId,
        parent_id: trial.id,
        title: p.title,
        description: p.desc,
        category: "General",
        points: p.points,
        xp_tier: "High",
        priority: "High",
        is_active: false,
        is_system_generated: true,
      }));

      await s.from("tasks").insert(subtasks);
    }
  },

  manifestMonarchsJudgment: async (userId: string, taskTitle: string) => {
    const s = db();
    const { error } = await s.from("tasks").insert({
      user_id: userId,
      assigned_to: userId,
      title: `Monarch's Judgment: ${taskTitle}`,
      category: "Work",
      points: 150,
      xp_tier: "Super",
      priority: "URGENT",
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      description: "The Oracle has judged your performance. Complete this mandatory mission to redeem your standing."
    });
    if (error) throw error;
  },

  /* ─── GATE: Delete ─────────────────────────── */

  deleteGate: async (id: string) => {
    const { error } = await db().from("tasks").delete().eq("id", id);
    if (error) throw error;
  },

  /* ─── GATE: Start Raid ─────────────────────── */

  startRaid: async (id: string) => {
    const s = db();
    const started_at = new Date().toISOString();
    const { error } = await s.from("tasks").update({ is_active: true, started_at }).eq("id", id);
    if (error) {
      // Fallback: schema might not have started_at
      const { error: fb } = await s.from("tasks").update({ is_active: true }).eq("id", id);
      if (fb) throw fb;
    }
    return started_at;
  },

  /* ─── GATE: Pause / Resume / Reset ─────────── */

  pauseRaid: async (id: string) => {
    const paused_at = new Date().toISOString();
    const { error } = await db().from("tasks").update({ is_paused: true, paused_at }).eq("id", id);
    if (error) throw error;
    return paused_at;
  },

  resumeRaid: async (id: string) => {
    const { error } = await db().from("tasks").update({ is_paused: false, paused_at: null }).eq("id", id);
    if (error) throw error;
  },

  resetRaid: async (id: string) => {
    const { error } = await db().from("tasks").update({
      is_active: false, started_at: null, is_paused: false, paused_at: null,
    }).eq("id", id);
    if (error) throw error;
  },

  /* ─── GATE: Reactivate (un-complete / un-fail) */

  reactivateGate: async (id: string) => {
    const { error } = await db().from("tasks").update({
      is_completed: false, is_failed: false, is_active: false,
      completed_at: null, started_at: null, is_paused: false, paused_at: null,
    }).eq("id", id);
    if (error) throw error;
  },

  /* ─── GATE: Complete (Conquer) ─────────────── */

  completeGate: async (userId: string, task: any, currentTotalXp: number, userStatus: string) => {
    const s = db();
    const completed_at = new Date().toISOString();

    // 1. Mark as completed
    const { error: updateErr } = await s.from("tasks").update({
      is_completed: true, is_failed: false, is_active: false, completed_at,
    }).eq("id", task.id);
    if (updateErr) throw updateErr;

    // V5: E-Rank Daily Cap (15 XP total per day)
    if (task.xp_tier === "Low") {
      const todayDate = new Date().toISOString().split("T")[0];
      const { data: todayERankTasks } = await s.from("tasks")
        .select("points")
        .eq("user_id", userId)
        .eq("xp_tier", "Low")
        .eq("is_completed", true)
        .gte("completed_at", todayDate + "T00:00:00");
      
      const currentTodayE = (todayERankTasks || []).reduce((sum: number, t: any) => sum + (t.points || 0), 0);
      if (currentTodayE >= 15) {
        // Award 0 XP but still complete the task
        await s.from("tasks").update({
          is_completed: true, is_failed: false, is_active: false, completed_at,
        }).eq("id", task.id);
        alert("💡 SYSTEM NOTICE: You have reached the daily 15 XP cap for E-Rank tasks. This gate was conquered, but no further power was gained.");
        return { completed_at, extractedShadow: null, progression: null };
      }
    }

    // 2. Calculate & award XP
    const { data: prof } = await s.from("user_profiles")
      .select("total_points, current_mode, ego_score, status, domain_physical, domain_mind, domain_soul, domain_execution, domain_builder, dark_mana")
      .eq("user_id", userId).single();

    const modeName = (prof?.current_mode as ModeType) || "Normal";
    const config = MODE_CONFIGS[modeName];
    
    // V5: ARISE Ritual (Restore 50% decayed XP if B-Rank+ completed while DECEASED)
    let ariseBonus = 0;
    if (prof?.status === "DECEASED" && (task.xp_tier === "High" || task.xp_tier === "Super" || task.xp_tier === "Legendary")) {
      const { data: logs } = await s.from("user_points").select("daily_points").eq("user_id", userId).lt("daily_points", 0);
      const totalLost = Math.abs((logs || []).reduce((sum, l) => sum + l.daily_points, 0));
      ariseBonus = Math.floor(totalLost * 0.5);
      alert(`🌅 ARISE! You have conquered a high-rank gate after death. The System restores ${ariseBonus} XP of your decayed power.`);
    }

    // Zone Multiplier (bl2): 2.5x
    const lastCompletions = JSON.parse(localStorage.getItem("lastCompletions") || "[]");
    const isZone = lastCompletions.length >= 5 && (Date.now() - lastCompletions[0] < 90 * 60 * 1000);
    const zoneMult = isZone ? 2.5 : 1.0;

    // Ego Burst Multiplier (bl1): 1.1x
    const isEgoBurst = (prof?.ego_score || 0) > 50; 
    const egoMult = isEgoBurst ? 1.1 : 1.0;

    // Devour Multiplier (bl5): Category weight increase
    const devouredCategories = JSON.parse(localStorage.getItem("devouredCategories") || "{}");
    const devourMult = devouredCategories[task.category] ? 1.15 : 1.0;

    // Mode multiplier
    const normalizedPts = calculateEffectiveXp(task.points, task.category, currentTotalXp) * config.xpMultiplier * zoneMult * egoMult * devourMult;
    const pts = (await applyXpBoost(s, userId, normalizedPts)) + ariseBonus;

    const statColumn = CATEGORY_STAT_MAP[task.category];
    const updatePayload: any = { 
      total_points: (prof?.total_points ?? 0) + pts,
      status: prof?.status === "DECEASED" ? "ACTIVE" : prof?.status // Restore status if ARISE
    };
    
    // Update daily log for Weekly Activity Threshold
    const today = new Date().toISOString().split("T")[0];
    const { data: log } = await s.from("user_points").select("daily_points").eq("user_id", userId).eq("date", today).maybeSingle();
    if (log) {
      await s.from("user_points").update({ daily_points: (log.daily_points || 0) + pts }).eq("user_id", userId).eq("date", today);
    } else {
      await s.from("user_points").insert({ user_id: userId, date: today, daily_points: pts });
    }

    // Ego score update (bl1)
    if (task.priority === "URGENT" || task.xp_tier === "High" || task.xp_tier === "Legendary") {
      updatePayload.ego_score = (prof?.ego_score || 0) + 1;
    }

    if (statColumn && prof) {
      updatePayload[statColumn] = ((prof as any)[statColumn] || 0) + 1;
    }
    await s.from("user_profiles").update(updatePayload).eq("user_id", userId);

    // 3. Sync progression
    const progression = await syncProgression(s, userId);
    showProgressionToast(progression);

    // 4. Shadow Extraction (RNG)
    let extractedShadow: any = null;
    if (userStatus !== "PENALTY") {
      const { SHADOW_CATALOG } = await import("../lib/catalog");
      const tier = task.xp_tier || "Low";
      const chances: Record<string, number> = { Legendary: 1.0, Super: 0.4, High: 0.15, Mid: 0.05, Low: 0.02 };
      const roll = Math.random();

      if (roll <= (chances[tier] || 0.02)) {
        const pool = SHADOW_CATALOG.filter((sh: any) => {
          if (tier === "Legendary") return sh.rarity === "Legendary" || sh.rarity === "Mythic";
          if (tier === "Super") return sh.rarity === "Epic";
          if (tier === "High") return sh.rarity === "Rare";
          return sh.rarity === "Common";
        });
        if (pool.length > 0) {
          const shadow = pool[Math.floor(Math.random() * pool.length)];
          const { error: sErr } = await s.from("shadows").insert({
            user_id: userId, name: shadow.name, rarity: shadow.rarity,
            bonus_type: "xp_boost", bonus_value: (shadow as any).bonus || (shadow.rarity === "Legendary" ? 0.1 : 0.05),
          });
          if (!sErr) extractedShadow = shadow;
        }
      }
    }

    // 5. Recurring reset (V5: Preservation Logic — Create a history record)
    if (task.is_recurring) {
      // 5a. Create a static completion record for the history/leaderboard
      await s.from("tasks").insert({
        user_id: userId,
        title: `${task.title} (Cycle Conquered)`,
        category: task.category,
        points: task.points,
        xp_tier: task.xp_tier,
        is_completed: true,
        completed_at,
        is_recurring: false,
        is_system_generated: true, // Mark as system generated history
      });

      // 5b. Reset the original recurring task
      const nextDeadline = calculateNextDeadline(task);
      await s.from("tasks").update({ 
        is_completed: false, 
        is_active: false, 
        completed_at: null, 
        deadline: nextDeadline 
      }).eq("id", task.id);
    }

    return { completed_at, extractedShadow, progression };
  },

  /* ─── GATE: Fail (Abandon) ─────────────────── */

  failGate: async (userId: string, task: any) => {
    const s = db();
    const completed_at = new Date().toISOString();
    
    // 1. Fetch current profile for penalties
    const { data: prof } = await s.from("user_profiles")
      .select("total_points, current_mode, dark_mana, dark_mana_started_at, player_rank")
      .eq("user_id", userId).single();
    
    const mode = (prof?.current_mode as ModeType) || "Normal";
    const config = MODE_CONFIGS[mode];
    const { calculateCorruptionMultiplier } = await import("../lib/levelEngine");
    const corruptionMult = await calculateCorruptionMultiplier(s, userId);

    // ── PSYCHOLOGICALLY HEALTHY PENALTY FORMULA ──────────────────
    // Old: 50% of TOTAL XP for a Legendary failure → catastrophic, causes quit
    // New: config.failXpPenaltyRate × task.points only
    //   • Proportional to the gate, not your entire career
    //   • Corruption multiplier can increase it if Dark Mana debt lingers
    //   • Capped at 200 XP max so a single failure can't wipe weeks of progress
    const baseGateXp = task.points || 10;
    const rawPenalty = Math.floor(baseGateXp * (config.failXpPenaltyRate ?? 0.2) * corruptionMult);
    const finalPenalty = Math.min(rawPenalty, 200); // Hard cap: never more than 200 XP lost per failure

    // 2. Mark as failed
    const { error } = await s.from("tasks").update({
      is_failed: true, is_completed: true, is_active: false, is_pending: false, is_paused: false, completed_at,
    }).eq("id", task.id);
    if (error) throw error;

    // Dark Mana Accumulation (capped at dmCap)
    const currentDM = prof?.dark_mana || 0;
    const newDM = Math.min(config.dmCap, currentDM + config.dmOnFail);
    const dmUpdate: any = { dark_mana: newDM };
    if (currentDM === 0 && newDM > 0) {
      dmUpdate.dark_mana_started_at = new Date().toISOString();
    }

    // 3. Deduct XP (proportional, not catastrophic)
    const newPoints = Math.max(-5000, (prof?.total_points ?? 0) - finalPenalty);
    await s.from("user_profiles").update({ ...dmUpdate, total_points: newPoints }).eq("user_id", userId);

    // 4. Log daily deduction
    const today = new Date().toISOString().split("T")[0];
    const { data: log } = await s.from("user_points").select("daily_points").eq("user_id", userId).eq("date", today).maybeSingle();
    if (log) {
      await s.from("user_points").update({ daily_points: log.daily_points - finalPenalty }).eq("user_id", userId).eq("date", today);
    } else {
      await s.from("user_points").insert({ user_id: userId, date: today, daily_points: -finalPenalty });
    }

    // 5. Sync progression
    const progression = await syncProgression(s, userId);

    // 6. Punishment quest — only if user isn't already overwhelmed (< 10 active gates)
    // Spawning punishment into an already full dashboard is what kills flow state
    const { count: activeGateCount } = await s.from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_completed", false)
      .eq("is_failed", false);

    if ((activeGateCount || 0) < 10) {
      const punishment = getRandomPunishment();
      await s.from("tasks").insert({
        user_id: userId,
        title: `🔥 REDEMPTION: ${punishment.title}`,
        description: `${punishment.desc}\n\nThe System offers you a path back. Complete this to restore your momentum.`,
        points: punishment.points,
        category: "Punishment",
        priority: "High", // Not URGENT — it's a path forward, not a panic alarm
        is_active: false,
        is_system_generated: true,
        deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h window, not 24h
        xp_tier: "High",
      });
    }

    // 7. Recurring reset
    if (task.is_recurring) {
      const nextDeadline = findNextValidDeadline(task);
      await s.from("tasks").update({
        is_completed: false, is_failed: false, is_pending: false, completed_at: null, deadline: nextDeadline,
      }).eq("id", task.id);
    }

    return { penalty: finalPenalty, progression };
  },

  /* ─── REWARDS (V5) ─────────────────────────── */

  claimReward: async (userId: string, reward: any, triggerGateId?: string) => {
    const s = db();
    const { data: prof } = await s.from("user_profiles")
      .select("total_points, streak_count, player_rank, dark_mana")
      .eq("user_id", userId).single();

    if (!prof) throw new Error("Profile not found");

    // V5 Unlock Validation
    const rankOrder = ["E", "D", "C", "B", "A", "S", "SS"];
    const rankIdx = rankOrder.indexOf(prof.player_rank || "E");

    const tierRules: Record<string, any> = {
      "1": { minStreak: 3,  minRankIdx: 0, dmBlock: false, trigger: false },
      "2": { minStreak: 7,  minRankIdx: 2, dmBlock: false, trigger: true },
      "3": { minStreak: 14, minRankIdx: 3, dmBlock: true,  trigger: true },
      "4": { minStreak: 21, minRankIdx: 4, dmBlock: true,  trigger: true },
      "5": { minStreak: 60, minRankIdx: 5, dmBlock: true,  trigger: false },
    };

    const rule = tierRules[reward.tier] || tierRules["1"];
    
    if (prof.streak_count < rule.minStreak) throw new Error(`⚠️ STREAK LOCK: This tier requires a ${rule.minStreak}-day streak.`);
    if (rankIdx < rule.minRankIdx) throw new Error(`⚠️ RANK LOCK: This tier requires ${rankOrder[rule.minRankIdx]}-Rank standing.`);
    if (rule.dmBlock && (prof.dark_mana || 0) > 0) throw new Error("⚠️ MANA CORRUPTION: Clear your Dark Mana debt to unlock high-tier rewards.");
    if (rule.trigger && !triggerGateId) throw new Error("⚠️ TRIGGER REQUIRED: This tier requires a recently conquered gate to activate.");
    if (prof.total_points < reward.xp_cost) throw new Error("⚠️ INSUFFICIENT XP: You do not have enough Experience to manifest this reward.");

    // 1. Mark as claimed with claim window
    const claimed_at = new Date().toISOString();
    const expires_at = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    
    await s.from("rewards").update({ 
      is_claimed: true, 
      claimed_at, 
      expires_at, 
      trigger_gate_id: triggerGateId 
    }).eq("id", reward.id);

    // 2. Deduct XP
    await s.from("user_profiles").update({ 
      total_points: prof.total_points - reward.xp_cost 
    }).eq("user_id", userId);

    // 3. Sync
    const progression = await syncProgression(s, userId);
    showProgressionToast(progression);
    
    return { claimed_at, expires_at, progression };
  },

  /* ─── PROFILE: Fetch Status ────────────────── */

  fetchUserStatus: async (userId: string) => {
    const { data } = await db().from("user_profiles").select("status, total_points").eq("user_id", userId).single();
    return data || { status: "ACTIVE", total_points: 0 };
  },

  /* ─── HEARTBEAT ────────────────────────────── */

  updateHeartbeat: async (userId: string) => {
    const { error } = await db().from("user_profiles").update({ last_heartbeat: new Date().toISOString() }).eq("user_id", userId);
    if (error) throw error;
  },

  /* ─── SYSTEM SWEEP: Overdue → Pending ──────── */

  sweepOverdueTasks: async (userId: string) => {
    const s = db();
    const today = new Date().toISOString().split("T")[0];
    const { data: allTasks } = await s.from("tasks").select("*").eq("user_id", userId);
    if (!allTasks) return;

    // Recurring catch-up
    const expiredRecur = allTasks.filter(t => (t.is_completed || t.is_failed) && t.is_recurring && t.deadline && t.deadline < today);
    for (const task of expiredRecur) {
      const nextDeadline = findNextValidDeadline(task);
      const { error } = await s.from("tasks").update({ is_completed: false, is_failed: false, is_pending: false, completed_at: null, deadline: nextDeadline }).eq("id", task.id);
      if (error) throw error;
    }

    // Overdue active → pending
    const overdue = allTasks.filter(t => !t.is_completed && !t.is_failed && !t.is_pending && t.deadline && t.deadline < today);
    if (overdue.length > 0) {
      const { error } = await s.from("tasks").update({ is_pending: true, is_completed: false, is_active: false }).in("id", overdue.map(t => t.id));
      if (error) throw error;
    }
  },

  /* ─── ORACLE: AI Guidance ──────────────────── */

  consultArchitect: async (query: string, userId: string, mode: 'short' | 'long' = 'short'): Promise<string> => {
    // 1. Gather System Context
    const [taskRes, profileRes] = await Promise.all([
      db().from("tasks").select("id, title, category, priority, xp_tier, is_recurring").eq("user_id", userId).eq("is_completed", false),
      db().from("user_profiles").select("level, player_rank, player_title, total_points").eq("user_id", userId).single()
    ]);

    const systemContext = {
      player_stats: profileRes.data,
      active_gates: taskRes.data || [],
    };

    // 2. Call the Oracle Microservice with the specified mode
    return await OracleService.consult(query, systemContext, mode);
  }
};
