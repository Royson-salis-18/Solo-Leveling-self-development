import { supabase } from "../lib/supabase";
import { calculateNextDeadline, findNextValidDeadline } from "../lib/taskUtils";
import { syncProgression, showProgressionToast, applyXpBoost, calculateEffectiveXp, getRandomPunishment, CATEGORY_STAT_MAP } from "../lib/levelEngine";
import { OracleService } from "./OracleService";

/* ═══════════════════════════════════════════════
   TYPES — Universal Mission Schema (UMS)
═══════════════════════════════════════════════ */

export type DashboardData = {
  activeCount: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  totalXp: number;
  level: number;
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
  parent_id?: string | null;
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
      s.from("user_profiles").select("total_points,level,player_rank,player_title,guild_id, guilds(name, id), guild_title, status, last_heartbeat").eq("user_id", userId).maybeSingle(),
      s.from("user_points").select("date,daily_points").eq("user_id", userId).order("date", { ascending: true }).limit(7),
      s.from("user_points").select("date,daily_points").eq("user_id", userId).order("date", { ascending: true }).limit(30),
      s.from("tasks").select("category,points").eq("user_id", userId),
      s.from("tasks").select("id, title, is_completed, is_pending, is_failed, is_active, started_at, priority, xp_tier, category").eq("user_id", userId).eq("is_completed", false).eq("is_pending", false).order("created_at", { ascending: false }).limit(10),
      s.from("tasks").select("id, title, points, completed_at").eq("user_id", userId).eq("is_completed", true).order("completed_at", { ascending: false }).limit(5),
      s.from("clan_members").select("clan_id, clans(name, id), role").eq("user_id", userId),
      s.from("shadows").select("*").eq("user_id", userId),
    ]);

    const uData = uRes.data;
    const catMap: Record<string, number> = {};
    (tRes.data || []).forEach((t: any) => {
      catMap[t.category] = (catMap[t.category] || 0) + (t.points || 0);
    });

    return {
      activeCount: ac || 0,
      completedCount: cc || 0,
      failedCount: fc || 0,
      pendingCount: pc || 0,
      totalXp: uData?.total_points || 0,
      level: uData?.level || 1,
      player_rank: uData?.player_rank || "E",
      player_title: uData?.player_title || "Newcomer",
      weeklyHistory: pRes.data || [],
      monthlyHistory: mRes.data || [],
      categoryDistribution: Object.entries(catMap).map(([category, points]) => ({ category, points })),
      activeTasks: activeTasksRes.data || [],
      completedTasks: completedTasksRes.data || [],
      clanMembers: clanMembRes.data || [],
      shadows: shadowsRes.data || [],
      guild: (uData as any)?.guilds,
      guild_title: uData?.guild_title,
      status: uData?.status,
      last_heartbeat: uData?.last_heartbeat,
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
      const { error } = await s.from("tasks").insert({ ...payload, is_active: false, is_completed: false });
      if (error) throw error;
    }
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
    const normalizedPts = calculateEffectiveXp(task.points, task.category, currentTotalXp);
    const pts = await applyXpBoost(s, userId, normalizedPts);

    const { data: prof } = await s.from("user_profiles")
      .select("total_points, stat_strength, stat_agility, stat_intelligence, stat_vitality, stat_sense")
      .eq("user_id", userId).single();

    const statColumn = CATEGORY_STAT_MAP[task.category];
    const updatePayload: any = { total_points: (prof?.total_points ?? 0) + pts };
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
    await db().from("user_profiles").update({ last_heartbeat: new Date().toISOString() }).eq("user_id", userId);
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
      await s.from("tasks").update({ is_completed: false, is_failed: false, is_pending: false, completed_at: null, deadline: nextDeadline }).eq("id", task.id);
    }

    // Overdue active → pending
    const overdue = allTasks.filter(t => !t.is_completed && !t.is_failed && !t.is_pending && t.deadline && t.deadline < today);
    if (overdue.length > 0) {
      await s.from("tasks").update({ is_pending: true, is_completed: false, is_active: false }).in("id", overdue.map(t => t.id));
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
