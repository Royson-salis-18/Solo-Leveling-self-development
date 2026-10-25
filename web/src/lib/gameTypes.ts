/**
 * Shapes returned by the server-side game engine (supabase/migrations/…_game_engine.sql).
 * The engine is the single source of truth; these are only the typed view of its JSON.
 */

export type PlayerStatus = "ACTIVE" | "STAGNANT" | "PENALTY" | "DECEASED";

/** Small slice of the profile returned after every action, so the UI updates instantly. */
export type ProfileSnapshot = {
  total_points: number;
  spent_xp: number;
  standing_xp: number;
  level: number;
  player_rank: string;
  player_title: string;
  status: PlayerStatus;
  streak_count: number;
  dark_mana: number;
  ego_score: number;
  current_mode: string;
};

export type Progression = {
  leveled_up?: boolean;
  ranked_up?: boolean;
  prev_level?: number;
  level?: number;
  prev_rank?: string;
  rank?: string;
  title?: string;
  status?: PlayerStatus;
  prev_status?: PlayerStatus;
};

export type XpBreakdown = {
  base: number | null;
  effective: number | null;
  earned: number;
  applied: number;
  absorbed_by_dark_mana: number;
  capped: boolean;
  arise_bonus: number;
  burst: number;
  paid: boolean;
  multipliers: { mode: number; flow: number; ego: number; boost: number; resonance: number };
};

export type CompleteResult = {
  ok: boolean;
  already: boolean;
  completed_at?: string;
  xp?: XpBreakdown;
  flow_active?: boolean;
  shadow?: { name: string; rarity: string; bonus: number } | null;
  progression?: Progression;
  profile: ProfileSnapshot;
};

export type FailResult = {
  ok: boolean;
  already: boolean;
  penalty: number;
  redemption_spawned?: boolean;
  progression?: Progression;
  profile: ProfileSnapshot;
};

export type DashboardData = {
  activeCount: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  totalXp: number;
  total_points: number;
  spent_xp: number;
  standing_xp: number;
  level: number;
  streak_count: number;
  weeklyHistory: Array<{ date: string; daily_points: number }>;
  monthlyHistory: Array<{ date: string; daily_points: number }>;
  categoryDistribution: Array<{ category: string; points: number }>;
  player_rank: string;
  player_title: string;
  activeTasks: any[];
  completedTasks: any[];
  clanMembers: any[];
  shadows: any[];
  guild?: { name: string; id: string } | null;
  guild_title?: string;
  status: PlayerStatus;
  last_heartbeat?: string;
  dark_mana: number;
  current_mode: string;
  ego_score: number;
  season_end_date?: string | null;
  playmaker_rating: number;
  timezone: string;
  needs_mode_selection: boolean;
  weekly_xp: number;
  /** null = this mode never goes STAGNANT (Easy). */
  weekly_target: number | null;
  flow: { count: number; active: boolean };
  domain_physical: number;
  domain_mind: number;
  domain_soul: number;
  domain_execution: number;
  domain_builder: number;
  profile_missing?: boolean;
};

export type GatePayload = {
  title: string;
  category: string;
  description?: string;
  deadline?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  priority: string;
  xp_tier: string;
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_days?: string | number[];
  recurrence_day_of_month?: number;
  recurrence_custom_label?: string;
  parent_id?: string | null;
  is_gauntlet?: boolean;
  is_weekly_trial?: boolean;
  // Accepted for call-site compatibility but IGNORED by the server (it derives XP from the tier
  // and always owns the gate as the caller).
  user_id?: string;
  assigned_to?: string;
  points?: number;
};

export type Entitlements = {
  plan: { id: string; name: string };
  limits: { max_active_gates?: number; ai_messages_per_day?: number; can_create_groups?: number };
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  usage: { ai_messages_today: number; active_gates: number };
};

export type DuelRow = {
  id: string;
  creator_id: string;
  opponent_id: string;
  creator_name: string;
  opponent_name: string;
  target_points: number;
  expires_at: string;
  status: "active" | "completed" | "expired";
  winner_id: string | null;
  creator_pts: number;
  opponent_pts: number;
};

export type PendingInvites = {
  clan: Array<{ id: string; name: string; inviter: string | null; created_at: string }>;
  guild: Array<{ id: string; name: string; inviter: string | null; created_at: string }>;
};
