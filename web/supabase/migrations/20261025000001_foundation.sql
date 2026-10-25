-- ============================================================================
-- 01 · FOUNDATION
--
-- Schema additions, reference data, ledger and indexes that the server-side
-- game engine (02) and the security lockdown (03) build on.
--
-- Idempotent and non-destructive: safe to run on an existing database. It only
-- ADDS columns/tables/indexes and backfills new columns; it never drops or
-- rewrites user data.
-- ============================================================================

create schema if not exists private;

-- ── user_profiles ────────────────────────────────────────────────────────────
alter table public.user_profiles add column if not exists timezone         text        not null default 'UTC';
alter table public.user_profiles add column if not exists spent_xp         integer     not null default 0;
alter table public.user_profiles add column if not exists last_tick_date   date;
alter table public.user_profiles add column if not exists mode_selected_at timestamptz;
alter table public.user_profiles add column if not exists ego_score        integer     default 0;
alter table public.user_profiles add column if not exists playmaker_rating double precision default 0;
alter table public.user_profiles add column if not exists reawakened_at    timestamptz;

-- Level/rank derive from "standing" = XP balance + XP already spent on rewards.
-- Spending XP on a reward must not de-level you; decay and penalties still do.
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'standing_xp') then
    alter table public.user_profiles
      add column standing_xp integer generated always as (coalesce(total_points, 0) + spent_xp) stored;
  end if;
end $$;

-- Existing players already chose (or defaulted into) a mode; only NEW sign-ups should be
-- sent to the mode picker.
update public.user_profiles
   set mode_selected_at = coalesce(last_mode_switch, created_at)
 where mode_selected_at is null;

-- ── tasks ────────────────────────────────────────────────────────────────────
-- The UI has always sent start_time/end_time but the repo schema never defined them.
alter table public.tasks add column if not exists start_time      text;
alter table public.tasks add column if not exists end_time        text;
-- A gate pays out XP once and penalises once. These stop the complete→reactivate→complete
-- farming loop and double-fail double-penalties.
alter table public.tasks add column if not exists xp_awarded      integer not null default 0;
alter table public.tasks add column if not exists xp_paid         boolean not null default false;
alter table public.tasks add column if not exists penalty_applied integer not null default 0;
alter table public.tasks add column if not exists penalty_paid    boolean not null default false;
-- Who created the task. For a quest assigned by a clan/guild leader this is the leader;
-- user_id is the hunter who owns (and is paid for) it.
alter table public.tasks add column if not exists created_by      uuid references auth.users(id) on delete set null;

-- Legacy rows: treat anything already resolved as paid so it cannot be re-farmed.
update public.tasks set xp_paid = true      where is_completed and not coalesce(is_failed, false) and not xp_paid;
update public.tasks set penalty_paid = true where coalesce(is_failed, false) and not penalty_paid;

-- Bounds on gate data. Legacy rows are repaired first: Postgres re-checks a row's constraints on
-- ANY update to it, so a single out-of-range legacy row would otherwise make every XP action on
-- it fail. (A NOT VALID constraint does not avoid that.)
update public.tasks set points = least(greatest(points, 0), 1000) where points < 0 or points > 1000;
update public.tasks set xp_tier = 'Low' where xp_tier is not null and xp_tier not in ('Low','Mid','High','Super','Legendary');
update public.tasks set title = left(title, 200) where char_length(title) > 200;
update public.tasks set title = 'Untitled gate' where char_length(btrim(title)) < 1;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_points_range') then
    alter table public.tasks add constraint tasks_points_range check (points between 0 and 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_xp_tier_valid') then
    alter table public.tasks add constraint tasks_xp_tier_valid
      check (xp_tier in ('Low','Mid','High','Super','Legendary'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_title_len') then
    alter table public.tasks add constraint tasks_title_len check (char_length(title) between 1 and 200);
  end if;
end $$;

-- ── rewards / punishments / events: sane bounds so the UI can't store nonsense ──
update public.rewards     set xp_cost    = least(greatest(xp_cost, 0), 100000)  where xp_cost < 0 or xp_cost > 100000;
update public.punishments set xp_penalty = least(greatest(xp_penalty, 0), 10000) where xp_penalty < 0 or xp_penalty > 10000;
update public.clan_events  set xp_reward = least(greatest(xp_reward, 0), 1000)  where xp_reward < 0 or xp_reward > 1000;
update public.guild_events set xp_reward = least(greatest(xp_reward, 0), 1000)  where xp_reward < 0 or xp_reward > 1000;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rewards_cost_range') then
    alter table public.rewards add constraint rewards_cost_range check (xp_cost between 0 and 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'punishments_penalty_range') then
    alter table public.punishments add constraint punishments_penalty_range check (xp_penalty between 0 and 10000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clan_events_reward_range') then
    alter table public.clan_events add constraint clan_events_reward_range check (xp_reward between 0 and 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'guild_events_reward_range') then
    alter table public.guild_events add constraint guild_events_reward_range check (xp_reward between 0 and 1000);
  end if;
end $$;

-- ── challenges: resolution states ────────────────────────────────────────────
-- Duels were never resolved (no code ever set winner_id / completed / expired).
alter table public.challenges drop constraint if exists challenges_status_check;
alter table public.challenges add constraint challenges_status_check
  check (status in ('active','completed','expired'));

-- ── clans / guilds: pending invites instead of forced joins ─────────────────
create table if not exists public.guild_invites (
  id          uuid primary key default gen_random_uuid(),
  guild_id    uuid not null references public.guilds(id) on delete cascade,
  inviter_id  uuid not null references auth.users(id) on delete cascade,
  invitee_id  uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at  timestamptz not null default now()
);
alter table public.guild_invites enable row level security;

-- ============================================================================
-- XP LEDGER — append-only record of every XP movement.
--   delta      : signed change actually applied to total_points
--   raw        : gross XP earned/lost before dark-mana absorption and caps
--   counts_weekly : whether this earn counts toward the weekly activity threshold
--                   (E-rank work does not, per V5 rules)
-- Powers: weekly threshold, duels, ARISE restore, history charts, audit.
-- ============================================================================
create table if not exists public.xp_events (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  kind           text not null check (kind in
                   ('complete','burst','arise','fail','decay','postpone','redeem','reward_claim','admin')),
  delta          integer not null,
  raw            integer not null default 0,
  counts_weekly  boolean not null default false,
  ref_id         uuid,
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
alter table public.xp_events enable row level security;

create table if not exists public.reward_claims (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  reward_id       uuid references public.rewards(id) on delete set null,
  system_key      text,
  name            text not null,
  tier            text not null,
  xp_cost         integer not null,
  trigger_gate_id uuid references public.tasks(id) on delete set null,
  claimed_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);
alter table public.reward_claims enable row level security;

-- ============================================================================
-- REFERENCE DATA (single source of truth for the engine)
-- ============================================================================

-- Difficulty modes. Mirrors web/src/lib/modeConfig.ts — a unit test fails if they drift.
create table if not exists public.game_modes (
  name                  text primary key,
  xp_multiplier         numeric not null,
  decay_rate            numeric not null,   -- fraction of XP lost per decay day
  soft_decay_cap_xp     integer not null,   -- max XP lost to decay per day (0 = uncapped)
  grace_period          integer not null,   -- idle days before decay starts
  streak_grace_days     integer not null,   -- idle days a streak survives
  dm_on_fail            integer not null,
  fail_xp_penalty_rate  numeric not null,   -- fraction of the GATE's XP lost on failure
  dm_cap                integer not null,
  deceased_threshold    integer not null,   -- idle days before DECEASED
  stagnant_threshold    integer,            -- weekly XP floor (null = mode never stagnates)
  postpone_enabled      boolean not null,
  rank_down_enabled     boolean not null,
  compounding_decay     boolean not null,
  resonance_burst_chance numeric not null,
  season_days           integer,            -- lock-in length (Hell = 30)
  switch_cooldown_days  integer not null default 7
);

insert into public.game_modes
  (name, xp_multiplier, decay_rate, soft_decay_cap_xp, grace_period, streak_grace_days, dm_on_fail,
   fail_xp_penalty_rate, dm_cap, deceased_threshold, stagnant_threshold, postpone_enabled,
   rank_down_enabled, compounding_decay, resonance_burst_chance, season_days)
values
  ('Easy',   0.8, 0,    0,   14, 2,  3, 0.10,  50, 14, null, true,  false, false, 0.15, null),
  ('Normal', 1.0, 0.01, 30,  5,  1,  7, 0.20,  80, 10, 150,  true,  false, false, 0.25, null),
  ('Hard',   1.5, 0.02, 60,  2,  0, 15, 0.35, 100,  5, 300,  false, true,  false, 0.35, null),
  ('Hell',   2.5, 0.03, 100, 1,  0, 25, 0.50, 100,  3, 500,  false, true,  true,  0.40, 30)
on conflict (name) do update set
  xp_multiplier = excluded.xp_multiplier, decay_rate = excluded.decay_rate,
  soft_decay_cap_xp = excluded.soft_decay_cap_xp, grace_period = excluded.grace_period,
  streak_grace_days = excluded.streak_grace_days, dm_on_fail = excluded.dm_on_fail,
  fail_xp_penalty_rate = excluded.fail_xp_penalty_rate, dm_cap = excluded.dm_cap,
  deceased_threshold = excluded.deceased_threshold, stagnant_threshold = excluded.stagnant_threshold,
  postpone_enabled = excluded.postpone_enabled, rank_down_enabled = excluded.rank_down_enabled,
  compounding_decay = excluded.compounding_decay, resonance_burst_chance = excluded.resonance_burst_chance,
  season_days = excluded.season_days;

-- Reward tier unlock rules (previously buried in a client-side object).
create table if not exists public.reward_tiers (
  tier           text primary key,
  min_streak     integer not null,
  min_rank_idx   integer not null,   -- index into E,D,C,B,A,S,SS
  dm_block       boolean not null,   -- locked while Dark Mana > 0
  needs_trigger  boolean not null    -- requires a recently conquered "trigger gate"
);
insert into public.reward_tiers (tier, min_streak, min_rank_idx, dm_block, needs_trigger) values
  ('1',  3, 0, false, false),
  ('2',  7, 2, false, true),
  ('3', 14, 3, true,  true),
  ('4', 21, 4, true,  true),
  ('5', 60, 5, true,  false)
on conflict (tier) do update set
  min_streak = excluded.min_streak, min_rank_idx = excluded.min_rank_idx,
  dm_block = excluded.dm_block, needs_trigger = excluded.needs_trigger;

-- Built-in rewards. These used to be fake client-side objects ("sys-r1") that could never
-- be persisted as claimed, so claiming one deducted XP without recording anything.
create table if not exists public.system_rewards (
  key         text primary key,
  name        text not null,
  xp_cost     integer not null check (xp_cost >= 0),
  tier        text not null references public.reward_tiers(tier),
  description text not null default ''
);
insert into public.system_rewards (key, name, xp_cost, tier, description) values
  ('sys-r1', 'Mana Elixir',          50,  '1', 'Small snack or indulgence to stabilize mana.'),
  ('sys-r2', 'Shadow Rest',         150,  '2', 'A 1-hour gaming or leisure session. Requires a Trigger Gate.'),
  ('sys-r3', 'Monarch''s Feast',    400,  '3', 'A premium meal or outing. Requires B-Rank standing.'),
  ('sys-r4', 'The Vault Key',       800,  '4', 'Major splurge purchase. Requires A-Rank and 0 Dark Mana.'),
  ('sys-r5', 'Sovereign''s Rebirth', 3000, '5', 'Legendary life milestone. Requires S-Rank and 60-day streak.')
on conflict (key) do update set
  name = excluded.name, xp_cost = excluded.xp_cost, tier = excluded.tier, description = excluded.description;

-- Category → domain stat + XP weight (mirrors categoryConfig.ts / levelEngine.ts CATEGORY_WEIGHTS).
create table if not exists public.category_stats (
  name   text primary key,
  stat   text not null check (stat in ('domain_physical','domain_mind','domain_soul','domain_execution','domain_builder')),
  weight numeric not null default 1.0
);
insert into public.category_stats (name, stat, weight) values
  ('Fitness','domain_physical',1.2), ('Health','domain_physical',1.0), ('Wellness','domain_physical',1.0),
  ('Personal Development','domain_physical',1.0),
  ('Work','domain_mind',1.0), ('Learning','domain_mind',0.8), ('Academics','domain_mind',0.8),
  ('Finance','domain_mind',1.0),
  ('Side Projects','domain_builder',1.0), ('Creative','domain_builder',1.0),
  ('Mindfulness','domain_soul',1.1), ('Spirituality','domain_soul',1.0), ('Social','domain_soul',1.1),
  ('Family','domain_soul',1.0),
  ('Errands','domain_execution',0.7), ('General','domain_execution',0.7)
on conflict (name) do update set stat = excluded.stat, weight = excluded.weight;

-- Shadows the System can extract (mirrors SHADOW_CATALOG in web/src/lib/catalog.ts).
create table if not exists public.shadow_catalog (
  name   text primary key,
  rarity text not null check (rarity in ('Common','Rare','Epic','Legendary','Mythic')),
  bonus  numeric not null
);
-- Resonance bonus by rarity: +2% / +3% / +5% / +8% / +10% XP per shadow.
insert into public.shadow_catalog (name, rarity, bonus) values
  ('Shadow Infantry','Common',0.02), ('Shadow Mage','Common',0.02), ('Orc Warrior','Common',0.02),
  ('High Orc Warrior','Common',0.02), ('Shadow Archer','Common',0.02),
  ('Iron','Rare',0.03), ('Tank','Rare',0.03), ('Kira','Rare',0.03), ('Sid','Rare',0.03),
  ('Jima','Rare',0.03), ('Frost Elf Archer','Rare',0.03),
  ('Igris','Epic',0.05), ('Tusk','Epic',0.05), ('Beru','Epic',0.05), ('Baruka','Epic',0.05),
  ('Kargalgan','Epic',0.05), ('Min Byung-gu','Epic',0.05), ('Greed','Epic',0.05), ('Kaisel','Epic',0.05),
  ('Bellion','Legendary',0.08), ('Kamish','Legendary',0.08), ('Gray','Legendary',0.08),
  ('Igris (Reawakened)','Legendary',0.08), ('Beru (Post-Island)','Legendary',0.08),
  ('Ashborn','Mythic',0.10), ('Antares','Mythic',0.10), ('Rulers of Light','Mythic',0.10)
on conflict (name) do update set rarity = excluded.rarity, bonus = excluded.bonus;

-- ============================================================================
-- INDEXES — only primary keys existed before, so every per-user query was a seq scan.
-- ============================================================================
create index if not exists tasks_user_state_idx     on public.tasks (user_id, is_completed, is_failed, is_pending);
create index if not exists tasks_user_deadline_idx  on public.tasks (user_id, deadline) where is_completed = false;
create index if not exists tasks_user_completed_idx on public.tasks (user_id, completed_at desc) where is_completed = true;
create index if not exists tasks_assigned_idx       on public.tasks (assigned_to) where assigned_to is not null;
create index if not exists tasks_parent_idx         on public.tasks (parent_id) where parent_id is not null;
create index if not exists xp_events_user_time_idx  on public.xp_events (user_id, created_at desc);
create index if not exists xp_events_user_kind_idx  on public.xp_events (user_id, kind, created_at desc);
create index if not exists user_points_user_date_idx on public.user_points (user_id, date desc);
create index if not exists notifications_user_idx   on public.notifications (user_id, is_read, created_at desc);
create index if not exists shadows_user_idx         on public.shadows (user_id);
create index if not exists inventory_user_idx       on public.inventory (user_id, item_type);
create index if not exists rewards_user_idx         on public.rewards (user_id);
create index if not exists reward_claims_user_idx   on public.reward_claims (user_id, claimed_at desc);
create index if not exists clan_members_user_idx    on public.clan_members (user_id);
create index if not exists clan_members_clan_idx    on public.clan_members (clan_id);
create index if not exists guild_members_user_idx   on public.guild_members (user_id);
create index if not exists friendship_receiver_idx  on public.friendship (receiver_id);
create index if not exists friendship_requester_idx on public.friendship (requester_id);
create index if not exists dm_receiver_idx          on public.direct_messages (receiver_id, created_at desc);
create index if not exists dm_sender_idx            on public.direct_messages (sender_id, created_at desc);
create index if not exists challenges_creator_idx   on public.challenges (creator_id, status);
create index if not exists challenges_opponent_idx  on public.challenges (opponent_id, status);
create index if not exists global_chat_time_idx     on public.global_chat (created_at desc);
create index if not exists user_profiles_points_idx on public.user_profiles (total_points desc);
create index if not exists user_profiles_guild_idx  on public.user_profiles (guild_id) where guild_id is not null;
create index if not exists clan_invites_invitee_idx on public.clan_invites (invitee_id, status);
create index if not exists guild_invites_invitee_idx on public.guild_invites (invitee_id, status);

-- Notifications drive a realtime subscription in the app; make sure the table is published.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
