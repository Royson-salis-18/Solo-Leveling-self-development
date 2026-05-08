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
  recurrence_days?: string; // JSON string
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
    const totalPointsFromTasks = (tRes.data || []).reduce((sum: number, t: any) => sum + (t.points || 0), 0);
    const catMap: Record<string, number> = {};
    (tRes.data || []).forEach((t: any) => {
      catMap[t.category] = (catMap[t.category] || 0) + (t.points || 0);
    });

    return {
      activeCount: ac || 0,
      completedCount: cc || 0,
      failedCount: fc || 0,
      pendingCount: pc || 0,
      totalXp: uData?.total_points ?? totalPointsFromTasks,
      total_points: uData?.total_points ?? totalPointsFromTasks,
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
    };
  },

  /* ─── GATE: Fetch All ──────────────────────── */

  fetchGates: async (userId: string) => {
    const s = db();
    const { data, error } = await s.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
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
    if (editingId) {
      const { error } = await s.from("tasks").update(payload).eq("id", editingId);
      if (error) throw error;
    } else {
      const { data: newGate, error } = await s.from("tasks").insert({ ...payload, is_active: false, is_completed: false }).select("id").single();
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
    const { data, error: fError } = await s.from("user_profiles").select("dark_mana").eq("user_id", userId).single();
    if (fError) throw fError;
    const current = data?.dark_mana || 0;
    const { error: uError } = await s.from("user_profiles").update({ dark_mana: current + amount }).eq("user_id", userId);
    if (uError) throw uError;
  },

  /* ─── SPECIAL GATES (g2, g3) ──────────────── */

  manifestWeeklyTrial: async (userId: string) => {
    const s = db();
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay())).toISOString().split('T')[0];
    
    // Check if trial already exists for this week
    const { data: existing } = await s.from("tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("is_weekly_trial", true)
      .gte("created_at", weekStart + "T00:00:00");

    if (existing && existing.length > 0) return;

    // 1. Manifest the Core Trial Gate
    const { data: trial, error } = await s.from("tasks").insert({
      user_id: userId,
      assigned_to: userId,
      title: `Weekly Trial: [SYSTEM_SURVIVAL_TEST]`,
      category: "General",
      points: 100, // Reduced from 500 for Hard Mode
      xp_tier: "Legendary",
      priority: "URGENT",
      is_weekly_trial: true,
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
        is_active: false
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

    // 2. Calculate & award XP
    const { data: prof } = await s.from("user_profiles")
      .select("total_points, current_mode, ego_score, stat_strength, stat_agility, stat_intelligence, stat_vitality, stat_sense")
      .eq("user_id", userId).single();

    const modeName = (prof?.current_mode as ModeType) || "Normal";
    const config = MODE_CONFIGS[modeName];
    
    // Zone Multiplier (bl2): 2.5x
    const lastCompletions = JSON.parse(localStorage.getItem("lastCompletions") || "[]");
    const isZone = lastCompletions.length >= 5 && (Date.now() - lastCompletions[0] < 90 * 60 * 1000);
    const zoneMult = isZone ? 2.5 : 1.0;

    // Ego Burst Multiplier (bl1): 1.1x
    const isEgoBurst = (prof?.ego_score || 0) > 50; // Example trigger
    const egoMult = isEgoBurst ? 1.1 : 1.0;

    // Devour Multiplier (bl5): Category weight increase
    const devouredCategories = JSON.parse(localStorage.getItem("devouredCategories") || "{}");
    const devourMult = devouredCategories[task.category] ? 1.15 : 1.0;

    // Mode multiplier
    const normalizedPts = calculateEffectiveXp(task.points, task.category, currentTotalXp) * config.xpMultiplier * zoneMult * egoMult * devourMult;
    const pts = await applyXpBoost(s, userId, normalizedPts);

    const statColumn = CATEGORY_STAT_MAP[task.category];
    const updatePayload: any = { total_points: (prof?.total_points ?? 0) + pts };
    
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

    // 5. Recurring reset
    if (task.is_recurring) {
      const nextDeadline = calculateNextDeadline(task);
      await s.from("tasks").update({ is_completed: false, is_active: false, completed_at: null, deadline: nextDeadline }).eq("id", task.id);
    }

    return { completed_at, extractedShadow, progression };
  },

  /* ─── GATE: Fail (Abandon) ─────────────────── */

  failGate: async (userId: string, task: any) => {
    const s = db();
    const completed_at = new Date().toISOString();
    const penalty = task.points || 10;

    // 1. Mark as failed
    const { error } = await s.from("tasks").update({
      is_failed: true, is_completed: true, is_active: false, is_pending: false, is_paused: false, completed_at,
    }).eq("id", task.id);
    if (error) throw error;

    // Infrastructure: Season stats (i2)
    const profRes = await s.from("user_profiles").select("current_mode, dark_mana").eq("user_id", userId).single();
    const mode = (profRes.data?.current_mode as ModeType) || "Normal";
    const config = MODE_CONFIGS[mode];

    // Shadow Permadeath (e5) - Nightmare only
    if (mode === 'Nightmare' && task.xp_tier === 'High') {
      const roll = Math.random();
      if (roll <= 0.3) {
        const { data: shadowPool } = await s.from("shadows").select("id, name").eq("user_id", userId);
        if (shadowPool && shadowPool.length > 0) {
          const victim = shadowPool[Math.floor(Math.random() * shadowPool.length)];
          await s.from("shadows").delete().eq("id", victim.id);
          await s.from("permanent_record_logs").insert({
            user_id: userId,
            event_type: 'shadow_death',
            metadata: { shadow_name: victim.name, gate_title: task.title }
          });
        }
      }
    }

    // Shadow Corruption (e4) - Hard+
    if ((mode === 'Hard' || mode === 'Nightmare') && (profRes.data?.dark_mana || 0) + config.dmOnFail >= 50) {
      const { data: shadowPool } = await s.from("shadows").select("id").eq("user_id", userId).eq("is_corrupted", false);
      if (shadowPool && shadowPool.length > 0) {
        const victim = shadowPool[Math.floor(Math.random() * shadowPool.length)];
        await s.from("shadows").update({ is_corrupted: true }).eq("id", victim.id);
      }
    }

    // Dark Mana Accumulation (Database)
    await s.from("user_profiles").update({ dark_mana: (profRes.data?.dark_mana || 0) + config.dmOnFail }).eq("user_id", userId);

    // 2. Log punishment
    await s.from("punishments").insert({ user_id: userId, name: `Failed Gate: ${task.title}`, xp_penalty: penalty, triggered: 1 });

    // 3. Deduct XP
    const { data: prof } = await s.from("user_profiles").select("total_points").eq("user_id", userId).single();
    const newPoints = Math.max(0, (prof?.total_points ?? 0) - penalty);
    await s.from("user_profiles").update({ total_points: newPoints }).eq("user_id", userId);

    // 4. Deduct from daily log
    const today = new Date().toISOString().split("T")[0];
    const { data: log } = await s.from("user_points").select("daily_points").eq("user_id", userId).eq("date", today).maybeSingle();
    if (log) {
      await s.from("user_points").update({ daily_points: Math.max(0, log.daily_points - penalty) }).eq("user_id", userId).eq("date", today);
    }

    // 5. Sync progression
    const progression = await syncProgression(s, userId);

    // 6. Generate punishment quest
    const punishment = getRandomPunishment();
    await s.from("tasks").insert({
      user_id: userId, title: `🚨 PENALTY: ${punishment.title}`, description: punishment.desc,
      points: punishment.points, category: "PUNISHMENT", priority: "URGENT",
      is_active: true, deadline: today, xp_tier: "High",
    });

    // 7. Recurring reset
    if (task.is_recurring) {
      const nextDeadline = findNextValidDeadline(task);
      await s.from("tasks").update({
        is_completed: false, is_failed: false, is_pending: false, completed_at: null, deadline: nextDeadline,
      }).eq("id", task.id);
    }

    return { penalty, progression };
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
