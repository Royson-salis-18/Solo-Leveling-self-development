-- Solo Leveling App Schema (v2 - Cyberpunk Auth Edition)
-- Run in Supabase SQL Editor
-- This schema integrates with Supabase Auth for secure authentication

-- =========================
-- DROP OLD SCHEMA (BACKUP FIRST!)
-- =========================
-- Uncomment below to perform a full reset
-- drop table if exists active_penalties cascade;
-- drop table if exists reward_grants cascade;
-- drop table if exists contracts cascade;
-- drop table if exists penalties cascade;
-- drop table if exists rewards cascade;
-- drop table if exists activity_log cascade;
-- drop table if exists user_points cascade;
-- drop table if exists tasks cascade;
-- drop table if exists user_profiles cascade;

-- =========================
-- PROFILES (Extends auth.users)
-- =========================
create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  avatar_url text,
  bio text default '',
  level integer not null default 1 check (level >= 1),
  total_points integer not null default 0 check (total_points >= 0),
  preferred_categories text default '["Work", "Health", "Learning", "Personal"]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);

create index if not exists idx_user_profiles_email on user_profiles(email);
create index if not exists idx_user_profiles_total_points_desc on user_profiles(total_points desc);

-- =========================
-- QUESTS/TASKS (Points Reduced for Hard Mode)
-- =========================
create table if not exists quests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  category text not null default 'General',
  points integer not null default 10 check (points >= 0 and points <= 175),
  deadline timestamptz,
  is_completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint completed_at_required_when_done check ((is_completed = false) or (completed_at is not null))
);

create index if not exists idx_quests_user_completed_deadline on quests(user_id, is_completed, deadline);
create index if not exists idx_quests_user_created_at on quests(user_id, created_at desc);

-- =========================
-- DAILY POINTS HISTORY
-- =========================
create table if not exists daily_points (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  daily_points integer default 0,
  created_at timestamptz default now(),
  unique(user_id, date)
);

create index if not exists idx_daily_points_user_date on daily_points(user_id, date desc);

-- =========================
-- ACTIVITY LOG
-- =========================
create table if not exists activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  points_earned integer default 0,
  details jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_activity_log_user_ts on activity_log(user_id, created_at desc);

-- =========================
-- REWARDS
-- =========================
create table if not exists rewards (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  xp_cost integer not null check (xp_cost >= 0),
  type text not null default 'instant' check (type in ('instant', 'medium', 'major')),
  description text,
  is_available boolean default true,
  created_at timestamptz default now()
);

-- Reward Redemptions (purchase history)
create table if not exists reward_redemptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references rewards(id) on delete cascade,
  redeemed_at timestamptz default now()
);

create index if not exists idx_reward_redemptions_user_ts on reward_redemptions(user_id, redeemed_at desc);

-- =========================
-- LEADERBOARD (Materialized View)
-- =========================
create table if not exists leaderboard_cache (
  rank integer,
  user_id uuid,
  email text,
  name text,
  level integer,
  total_points integer,
  updated_at timestamptz default now()
);

create index if not exists idx_leaderboard_cache_rank on leaderboard_cache(rank);

-- =========================
-- PENALTIES & CONTRACTS (Optional - Advanced Features)
-- =========================
create table if not exists penalties (
  id uuid default gen_random_uuid() primary key,
  trigger_type text not null check (trigger_type in ('miss_task', 'streak_break')),
  penalty_type text not null check (penalty_type in ('xp_loss', 'lock_rewards')),
  threshold integer default 1,
  value integer default 10,
  created_at timestamptz default now()
);

create table if not exists active_penalties (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  penalty_id uuid not null references penalties(id) on delete cascade,
  applied_at timestamptz default now(),
  expires_at timestamptz
);

create index if not exists idx_active_penalties_user_expires on active_penalties(user_id, expires_at);

-- =========================
-- DAILY CONTRACTS (Challenge System)
-- =========================
create table if not exists daily_contracts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  required_quests integer default 3,
  bonus_multiplier decimal default 1.5,
  status text default 'active' check (status in ('active', 'completed', 'failed')),
  created_at timestamptz default now(),
  unique(user_id, date)
);

create index if not exists idx_daily_contracts_user_date on daily_contracts(user_id, date);

-- =========================
-- SEED DATA (Hard Mode Rewards - Lower Costs)
-- =========================
insert into rewards (name, xp_cost, type, description) values
  ('Coffee Break ☕', 50, 'instant', 'Take a break and enjoy your favorite coffee'),
  ('Gaming Session 🎮', 100, 'medium', '2 hours of guilt-free gaming'),
  ('Movie Night 🎬', 150, 'medium', 'Watch your favorite movie'),
  ('Anime Marathon 📺', 75, 'instant', 'Binge-watch your favorite anime'),
  ('Weekend Getaway 🏖️', 250, 'major', 'Plan a weekend trip'),
  ('Rest Day 😴', 60, 'instant', 'No tasks required for a day')
on conflict (name) do nothing;

insert into penalties (trigger_type, penalty_type, threshold, value) values
  ('miss_task', 'xp_loss', 3, 25),
  ('miss_task', 'lock_rewards', 5, 24),
  ('streak_break', 'xp_loss', 1, 5)
on conflict do nothing;

-- =========================
-- FUNCTIONS & TRIGGERS
-- =========================

-- Update user last_active timestamp
create or replace function update_user_last_active()
returns trigger as $$
begin
  update user_profiles set last_active = now() where user_id = new.user_id;
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_last_active
after insert on activity_log
for each row execute function update_user_last_active();

-- Auto-calculate leaderboard
create or replace function refresh_leaderboard()
returns void as $$
begin
  delete from leaderboard_cache;
  insert into leaderboard_cache (rank, user_id, email, name, level, total_points, updated_at)
  select 
    row_number() over (order by total_points desc),
    user_id,
    email,
    name,
    level,
    total_points,
    now()
  from user_profiles
  order by total_points desc
  limit 100;
end;
$$ language plpgsql;

-- =========================
-- RLS POLICIES (Recommended for Production)
-- =========================
-- Uncomment to enable RLS:
-- alter table user_profiles enable row level security;
-- alter table quests enable row level security;
-- alter table daily_points enable row level security;
-- alter table activity_log enable row level security;
-- alter table reward_redemptions enable row level security;
-- 
-- create policy "Users can view own profile" on user_profiles
--   for select using (auth.uid() = user_id);
-- 
-- create policy "Users can update own profile" on user_profiles
--   for update using (auth.uid() = user_id);
-- 
-- create policy "Users can view own quests" on quests
--   for select using (auth.uid() = user_id);
-- 
-- create policy "Users can manage own quests" on quests
--   for all using (auth.uid() = user_id);
-- 
-- create policy "Users can view own points" on daily_points
--   for select using (auth.uid() = user_id);
-- 
-- create policy "Users can view own activity" on activity_log
--   for select using (auth.uid() = user_id);

-- =========================
-- NOTES
-- =========================
-- 1. All point values reduced by ~65% for hard mode
-- 2. Rewards are cheaper to encourage engagement
-- 3. Uses Supabase Auth (auth.users table) for secure authentication
-- 4. UUID primary keys for better scalability
-- 5. RLS disabled by default - enable in production with policies above
-- 6. Leaderboard caching with refresh_leaderboard() function

