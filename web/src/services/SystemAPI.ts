/**
 * SystemAPI — thin, typed client for the server-side game engine.
 *
 * This file used to be ~1000 lines of game logic (XP maths, decay, penalties, shadow rolls…) running
 * in the browser as chains of read-modify-write calls. All of that now lives in Postgres
 * (supabase/migrations/…_game_engine.sql) where it is atomic, idempotent and tamper-proof. The
 * client only asks; the server decides. Nothing here computes XP.
 */
import { supabase } from "../lib/supabase";
import { rpc } from "../lib/rpc";
import { OracleService } from "./OracleService";
import type {
  BossLootResult, ChestResult, CompleteResult, DashboardData, Engagement, Trophy, DuelRow, Entitlements, FailResult, GatePayload, PendingInvites, ProfileSnapshot,
} from "../lib/gameTypes";

export type { DashboardData, GatePayload } from "../lib/gameTypes";

function db() {
  if (!supabase) throw new Error("Supabase client not initialized");
  return supabase;
}

/** Fields the server derives or owns; never send them. */
function cleanGatePayload(p: GatePayload): Record<string, unknown> {
  const { user_id: _u, assigned_to: _a, points: _p, ...rest } = p;
  return rest;
}

export const SystemAPI = {
  /* ─── Engagement ─── one round trip for bounties, streak, boss, trophies, referral */
  getEngagement: () => rpc<Engagement>("get_engagement"),
  claimBountyChest: () => rpc<ChestResult>("claim_bounty_chest"),
  claimBossReward: (week?: string) => rpc<BossLootResult>("claim_boss_reward", week ? { p_week: week } : {}),
  getAchievements: () => rpc<Trophy[]>("get_achievements"),

  /* ─── Dashboard ─── one round trip (was ~25 sequential ones) */
  fetchDashboardData: (_userId?: string) => rpc<DashboardData>("get_dashboard"),

  /* ─── Gates ─── */
  fetchGates: async (userId: string) => {
    const s = db();
    // Idempotent server-side manifestation of penalty/weekly-trial/ego gates. Best effort.
    await rpc("sync_system_gates").catch(() => undefined);

    // Open gates in full; completed ones only the recent 200 (history used to be loaded forever),
    // plus the finished children of open bosses so the boss-shield progress stays accurate.
    const [open, done] = await Promise.all([
      s.from("tasks").select("*").eq("user_id", userId).eq("is_completed", false).order("created_at", { ascending: false }),
      s.from("tasks").select("*").eq("user_id", userId).eq("is_completed", true)
        .order("completed_at", { ascending: false, nullsFirst: false }).limit(200),
    ]);
    if (open.error) throw open.error;
    if (done.error) throw done.error;

    const rows = new Map<string, any>();
    [...(open.data ?? []), ...(done.data ?? [])].forEach((t) => rows.set(t.id, t));

    const parentIds = (open.data ?? []).map((t) => t.id);
    if (parentIds.length) {
      const { data: kids } = await s.from("tasks").select("*").eq("user_id", userId).eq("is_completed", true).in("parent_id", parentIds);
      (kids ?? []).forEach((t) => rows.set(t.id, t));
    }
    return [...rows.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  saveGate: (payload: GatePayload, editingId: string | null) =>
    rpc<{ ok: boolean; id: string; postponed?: boolean; penalty?: number; profile?: ProfileSnapshot }>("save_gate", {
      p_payload: cleanGatePayload(payload),
      p_id: editingId,
    }),

  deleteGate: (id: string) => rpc<void>("delete_gate", { p_id: id }),

  startRaid: async (id: string) => (await rpc<{ started_at: string }>("raid_action", { p_id: id, p_action: "start" })).started_at,
  pauseRaid: async (id: string) => (await rpc<{ paused_at: string }>("raid_action", { p_id: id, p_action: "pause" })).paused_at,
  resumeRaid: (id: string) => rpc<{ started_at: string }>("raid_action", { p_id: id, p_action: "resume" }),
  resetRaid: (id: string) => rpc("raid_action", { p_id: id, p_action: "reset" }),

  reactivateGate: (id: string) => rpc<void>("reactivate_gate", { p_id: id }),
  completeGate: (taskId: string) => rpc<CompleteResult>("complete_gate", { p_task_id: taskId }),
  failGate: (taskId: string) => rpc<FailResult>("fail_gate", { p_task_id: taskId }),
  beginArise: () => rpc<{ ok: boolean; spawned: boolean; id?: string }>("begin_arise"),

  /* ─── Economy ─── */
  claimReward: (args: { rewardId?: string; systemKey?: string; triggerGateId?: string | null }) =>
    rpc<{ ok: boolean; name: string; cost: number; expires_at: string; profile: ProfileSnapshot }>("claim_reward", {
      p_reward_id: args.rewardId ?? null,
      p_system_key: args.systemKey ?? null,
      p_trigger_gate: args.triggerGateId ?? null,
    }),

  redeemDarkMana: (amount: number, punishmentId?: string | null) =>
    rpc<{ ok: boolean; dark_mana_cleared: number; xp_cost: number; profile: ProfileSnapshot }>("redeem_dark_mana", {
      p_amount: amount,
      p_punishment_id: punishmentId ?? null,
    }),

  selectMode: (mode: string) =>
    rpc<{ ok: boolean; changed: boolean; season_end_date?: string | null; profile: ProfileSnapshot }>("select_mode", { p_mode: mode }),

  setTimezone: (tz: string) => rpc<void>("set_timezone", { p_tz: tz }),
  claimDailyGift: () => rpc<{ ok: boolean; name: string; rarity: string }>("claim_daily_gift"),

  /* ─── Social ─── */
  findHunter: async (code: string) => {
    const rows = await rpc<Array<{ user_id: string; name: string; level: number; player_rank: string; player_class: string }>>(
      "find_hunter", { p_code: code.trim() });
    return rows?.[0] ?? null;
  },
  myInvites: () => rpc<PendingInvites>("my_invites"),
  createClan: (name: string, desc = "") => rpc<{ ok: boolean; id: string }>("create_clan", { p_name: name, p_desc: desc }),
  inviteToClan: (target: string) => rpc("invite_to_clan", { p_target: target }),
  respondClanInvite: (id: string, accept: boolean) => rpc<{ joined: boolean }>("respond_clan_invite", { p_invite: id, p_accept: accept }),
  leaveClan: () => rpc("leave_clan"),
  createGuild: (a: { name: string; desc?: string; minRank?: string; logo?: string; aura?: string }) =>
    rpc<{ ok: boolean; id: string }>("create_guild", {
      p_name: a.name, p_desc: a.desc ?? "", p_min_rank: a.minRank ?? "E", p_logo: a.logo ?? "⚜️", p_aura: a.aura ?? "shadow",
    }),
  inviteToGuild: (target: string) => rpc("invite_to_guild", { p_target: target }),
  respondGuildInvite: (id: string, accept: boolean) => rpc<{ joined: boolean }>("respond_guild_invite", { p_invite: id, p_accept: accept }),
  leaveGuild: () => rpc("leave_guild"),
  assignQuest: (a: { target: string; title: string; category?: string; tier?: string; priority?: string; deadline?: string | null; description?: string }) =>
    rpc("assign_quest", {
      p_target: a.target, p_title: a.title, p_category: a.category ?? "General", p_tier: a.tier ?? "Low",
      p_priority: a.priority ?? "Normal", p_deadline: a.deadline || null, p_description: a.description ?? "",
    }),
  createChallenge: (opponent: string, target: number, days: number) =>
    rpc<{ ok: boolean; id: string }>("create_challenge", { p_opponent: opponent, p_target: target, p_days: days }),
  listChallenges: () => rpc<DuelRow[]>("list_challenges"),

  /* ─── Account / billing ─── */
  entitlements: () => rpc<Entitlements>("get_entitlements"),
  exportMyData: () => rpc<Record<string, unknown>>("export_my_data"),

  /* ─── Oracle (AI) ─── */
  consultArchitect: (query: string, _userId: string, mode: "short" | "long" = "short"): Promise<string> =>
    OracleService.consult(query, mode),
};
