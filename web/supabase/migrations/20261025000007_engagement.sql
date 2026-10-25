-- ============================================================================
-- 07 · ENGAGEMENT ENGINE
--
-- Retention mechanics, all server-authoritative (the client only asks; nothing here can be
-- forged from the browser):
--
--   Streak Freezes   Loss-aversion softener. Earned every 7-day streak, auto-spent on a missed
--                    day, capped by plan. A bridged day counts as active (no decay, no reset).
--   Daily Bounties   3 objectives/day (easy → hard, deterministic per user+day, progress is
--                    DERIVED from the xp ledger). 2/3 unlocks the Bounty Chest, 3/3 improves
--                    its odds. Goal-gradient + variable reward, with a pity timer so bad luck
--                    can't run forever.
--   Achievements     Collectible trophies with visible progress (Zeigarnik / completionist).
--   World Boss       Weekly shared HP bar. Every conquest deals damage; difficulty adapts to
--                    last week's result. Collective goal + real, weekly deadline.
--   Comeback Surge   Returning after 3+ idle days gifts 3 XP boosts (once a week) so coming
--                    back feels like a win, not a debt.
--   Referrals        ?ref=CODE at sign-up; both sides rewarded on the recruit's FIRST conquest.
--   Streak nudges    One honest in-app reminder per day, only while the streak is still savable.
--
-- Deliberately NOT here: fake scarcity, guilt copy, streak "repair" purchases, or anything that
-- pays out for logging in without playing.
-- ============================================================================

-- ── schema ───────────────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists streak_freezes    integer not null default 0 check (streak_freezes >= 0),
  add column if not exists best_streak       integer not null default 0,
  add column if not exists chest_pity        integer not null default 0,
  add column if not exists last_freeze_grant date,
  add column if not exists last_comeback_date date,
  add column if not exists referred_by       uuid references auth.users(id) on delete set null,
  add column if not exists referral_paid     boolean not null default false;

update public.user_profiles set best_streak = greatest(best_streak, coalesce(streak_count, 0));

alter table public.xp_events drop constraint if exists xp_events_kind_check;
alter table public.xp_events add constraint xp_events_kind_check check (kind in
  ('complete','burst','arise','fail','decay','postpone','redeem','reward_claim','admin',
   'bounty','achievement','boss','referral'));

create table if not exists public.bounty_catalog (
  key         text primary key,
  kind        text not null check (kind in ('gates','xp','mid','high','early','variety')),
  target      integer not null check (target > 0),
  difficulty  integer not null check (difficulty between 1 and 3),
  title       text not null,
  description text not null
);
insert into public.bounty_catalog (key, kind, target, difficulty, title, description) values
  ('gates_2',   'gates',   2,  1, 'Warm-Up',          'Conquer 2 gates today.'),
  ('xp_20',     'xp',      20, 1, 'First Blood',      'Earn 20 XP from conquests today.'),
  ('early_1',   'early',   1,  1, 'Early Riser',      'Conquer a gate before noon (your local time).'),
  ('gates_3',   'gates',   3,  2, 'Triple Threat',    'Conquer 3 gates today.'),
  ('mid_2',     'mid',     2,  2, 'Rank Pressure',    'Conquer 2 gates of C-rank or higher.'),
  ('xp_40',     'xp',      40, 2, 'Power Surge',      'Earn 40 XP from conquests today.'),
  ('variety_2', 'variety', 2,  2, 'Well-Rounded',     'Conquer gates in 2 different categories.'),
  ('high_1',    'high',    1,  3, 'Gatebreaker',      'Conquer a gate of B-rank or higher.'),
  ('gates_5',   'gates',   5,  3, 'Rampage',          'Conquer 5 gates today.'),
  ('xp_80',     'xp',      80, 3, 'Overdrive',        'Earn 80 XP from conquests today.'),
  ('variety_3', 'variety', 3,  3, 'Renaissance Hunter','Conquer gates in 3 different categories.'),
  ('mid_3',     'mid',     3,  3, 'Elite Run',        'Conquer 3 gates of C-rank or higher.')
on conflict (key) do update set kind = excluded.kind, target = excluded.target, difficulty = excluded.difficulty,
  title = excluded.title, description = excluded.description;

create table if not exists public.bounty_chests (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  rarity     text not null,
  xp         integer not null,
  item       text,
  perfect    boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.achievement_catalog (
  key         text primary key,
  name        text not null,
  description text not null,
  icon        text not null default 'trophy',
  rarity      text not null default 'Common',
  metric      text not null check (metric in ('conquests','streak','level','shadows','high','chests','referrals','xp','boss')),
  threshold   integer not null check (threshold > 0),
  xp_reward   integer not null default 0,
  sort_order  integer not null default 0
);
insert into public.achievement_catalog (key, name, description, icon, rarity, metric, threshold, xp_reward, sort_order) values
  ('conq_1',    'First Gate',          'Conquer your first gate.',                 'swords',  'Common',    'conquests', 1,    10, 10),
  ('conq_10',   'Getting Serious',     'Conquer 10 gates.',                        'swords',  'Common',    'conquests', 10,   20, 11),
  ('conq_50',   'Gate Crasher',        'Conquer 50 gates.',                        'swords',  'Rare',      'conquests', 50,   50, 12),
  ('conq_100',  'Centurion',           'Conquer 100 gates.',                       'swords',  'Epic',      'conquests', 100,  100, 13),
  ('conq_500',  'Legion of One',       'Conquer 500 gates.',                       'swords',  'Legendary', 'conquests', 500,  300, 14),
  ('streak_3',  'On a Roll',           'Reach a 3-day streak.',                    'flame',   'Common',    'streak',    3,    10, 20),
  ('streak_7',  'Full Week',           'Reach a 7-day streak.',                    'flame',   'Rare',      'streak',    7,    30, 21),
  ('streak_14', 'Unbreakable',         'Reach a 14-day streak.',                   'flame',   'Rare',      'streak',    14,   60, 22),
  ('streak_30', 'Monthly Monarch',     'Reach a 30-day streak.',                   'flame',   'Epic',      'streak',    30,   150, 23),
  ('streak_100','Century Flame',       'Reach a 100-day streak.',                  'flame',   'Legendary', 'streak',    100,  500, 24),
  ('lvl_5',     'Awakened',            'Reach level 5.',                           'zap',     'Common',    'level',     5,    15, 30),
  ('lvl_10',    'Rising Hunter',       'Reach level 10.',                          'zap',     'Rare',      'level',     10,   40, 31),
  ('lvl_25',    'Veteran',             'Reach level 25.',                          'zap',     'Epic',      'level',     25,   120, 32),
  ('lvl_50',    'Apex',                'Reach level 50.',                          'zap',     'Legendary', 'level',     50,   400, 33),
  ('shadow_1',  'First Extraction',    'Extract your first shadow.',               'ghost',   'Common',    'shadows',   1,    15, 40),
  ('shadow_5',  'Shadow Squad',        'Command 5 shadows.',                       'ghost',   'Rare',      'shadows',   5,    60, 41),
  ('shadow_15', 'Shadow Army',         'Command 15 shadows.',                      'ghost',   'Epic',      'shadows',   15,   200, 42),
  ('high_1',    'Rank Breaker',        'Conquer a B-rank or higher gate.',         'skull',   'Common',    'high',      1,    20, 50),
  ('high_10',   'Boss Hunter',         'Conquer 10 B-rank or higher gates.',       'skull',   'Rare',      'high',      10,   80, 51),
  ('high_50',   'Calamity',            'Conquer 50 B-rank or higher gates.',       'skull',   'Epic',      'high',      50,   250, 52),
  ('chest_1',   'Treasure Seeker',     'Open your first Bounty Chest.',            'gift',    'Common',    'chests',    1,    10, 60),
  ('chest_7',   'Bounty Regular',      'Open 7 Bounty Chests.',                    'gift',    'Rare',      'chests',    7,    50, 61),
  ('chest_30',  'Bounty Master',       'Open 30 Bounty Chests.',                   'gift',    'Epic',      'chests',    30,   200, 62),
  ('xp_1000',   'Four Digits',         'Earn 1,000 XP in total.',                  'star',    'Rare',      'xp',        1000, 50, 70),
  ('xp_10000',  'Five Digits',         'Earn 10,000 XP in total.',                 'star',    'Legendary', 'xp',        10000,400, 71),
  ('recruit_1', 'Recruiter',           'A hunter you recruited conquered a gate.', 'users',   'Rare',      'referrals', 1,    40, 80),
  ('recruit_5', 'Guild Founder Energy','Recruit 5 active hunters.',                'users',   'Epic',      'referrals', 5,    150, 81),
  ('boss_1',    'Raid Contributor',    'Help defeat a World Boss.',                'crown',   'Epic',      'boss',      1,    75, 90)
on conflict (key) do update set name = excluded.name, description = excluded.description, icon = excluded.icon,
  rarity = excluded.rarity, metric = excluded.metric, threshold = excluded.threshold,
  xp_reward = excluded.xp_reward, sort_order = excluded.sort_order;

create table if not exists public.user_achievements (
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null references public.achievement_catalog(key) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.world_bosses (
  week_start date primary key,
  name       text not null,
  hp         integer not null check (hp > 0),
  reward_xp  integer not null default 80
);
create table if not exists public.boss_damage (
  week_start date not null references public.world_bosses(week_start) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  damage     integer not null default 0,
  primary key (week_start, user_id)
);
create index if not exists boss_damage_rank_idx on public.boss_damage (week_start, damage desc);
create table if not exists public.boss_rewards (
  week_start date not null references public.world_bosses(week_start) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  xp         integer not null,
  claimed_at timestamptz not null default now(),
  primary key (week_start, user_id)
);

create table if not exists public.nudge_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  kind    text not null,
  primary key (user_id, day, kind)
);

-- RLS: players can read their own rows; every write goes through the RPCs below.
alter table public.bounty_catalog      enable row level security;
alter table public.bounty_chests       enable row level security;
alter table public.achievement_catalog enable row level security;
alter table public.user_achievements   enable row level security;
alter table public.world_bosses        enable row level security;
alter table public.boss_damage         enable row level security;
alter table public.boss_rewards        enable row level security;
alter table public.nudge_log           enable row level security;

drop policy if exists ref_bounty_catalog on public.bounty_catalog;
create policy ref_bounty_catalog on public.bounty_catalog for select to authenticated using (true);
drop policy if exists ref_achievement_catalog on public.achievement_catalog;
create policy ref_achievement_catalog on public.achievement_catalog for select to authenticated using (true);
drop policy if exists chests_own on public.bounty_chests;
create policy chests_own on public.bounty_chests for select to authenticated using (user_id = auth.uid());
drop policy if exists ach_own on public.user_achievements;
create policy ach_own on public.user_achievements for select to authenticated using (user_id = auth.uid());
drop policy if exists boss_read on public.world_bosses;
create policy boss_read on public.world_bosses for select to authenticated using (true);
drop policy if exists boss_rewards_own on public.boss_rewards;
create policy boss_rewards_own on public.boss_rewards for select to authenticated using (user_id = auth.uid());

revoke all on public.bounty_catalog, public.bounty_chests, public.achievement_catalog, public.user_achievements,
              public.world_bosses, public.boss_damage, public.boss_rewards, public.nudge_log from anon, authenticated;
grant select on public.bounty_catalog, public.bounty_chests, public.achievement_catalog,
                public.user_achievements, public.world_bosses, public.boss_rewards to authenticated;

-- Plans: how many freezes a player may hold (plan-driven, tunable without a deploy).
update public.plans set limits = '{"streak_freeze_cap": 2}'::jsonb || limits where id = 'free';
update public.plans set limits = '{"streak_freeze_cap": 5}'::jsonb || limits where id = 'pro';

-- ── helpers ──────────────────────────────────────────────────────────────────
create or replace function private.freeze_cap(p_uid uuid) returns integer
language sql stable as $$ select coalesce(private.plan_limit(p_uid, 'streak_freeze_cap'), 2) $$;

-- Add to a stackable consumable (XP_BOOST …) or create it. Callers already hold the profile lock.
create or replace function private.grant_item(p_uid uuid, p_name text, p_desc text, p_type text,
                                              p_rarity text, p_qty integer) returns void
language plpgsql as $$
begin
  update public.inventory set quantity = coalesce(quantity, 0) + p_qty
   where id = (select id from public.inventory
                where user_id = p_uid and item_type = p_type and name = p_name
                  and coalesce((metadata ->> 'is_rental')::boolean, false) = false
                limit 1);
  if not found then
    insert into public.inventory (user_id, name, description, item_type, item_category, rarity, quantity)
    values (p_uid, p_name, p_desc, p_type, 'Consumable', p_rarity, p_qty);
  end if;
end $$;

-- Bonus XP that is not a conquest (chests, trophies, boss loot, referrals). It is "free" XP so it
-- bypasses Dark Mana, never counts toward the weekly threshold, and is always in the ledger.
create or replace function private.grant_xp(p_uid uuid, p_kind text, p_xp integer, p_meta jsonb) returns void
language plpgsql as $$
begin
  if p_xp <= 0 then return; end if;
  update public.user_profiles set total_points = coalesce(total_points, 0) + p_xp where user_id = p_uid;
  perform private.record_xp(p_uid, p_kind, p_xp, p_xp, false, null, p_meta);
end $$;

-- ── bounties ─────────────────────────────────────────────────────────────────
create or replace function private.bounty_progress(p_uid uuid, p_tz text, p_day date, p_kind text) returns integer
language sql stable as $$
  select coalesce(case p_kind
    when 'gates'   then count(*)
    when 'xp'      then sum(raw)
    when 'mid'     then count(*) filter (where meta ->> 'tier' in ('Mid','High','Super','Legendary'))
    when 'high'    then count(*) filter (where meta ->> 'tier' in ('High','Super','Legendary'))
    when 'early'   then count(*) filter (where extract(hour from created_at at time zone p_tz) < 12)
    when 'variety' then count(distinct meta ->> 'category')
  end, 0)::integer
  from public.xp_events
  where user_id = p_uid and kind = 'complete'
    and created_at >= (p_day::timestamp at time zone p_tz)
    and created_at <  ((p_day + 1)::timestamp at time zone p_tz)
$$;

-- Today's three bounties: one per difficulty, picked by a stable hash of (user, day).
create or replace function private.bounties_today(p_uid uuid) returns jsonb
language plpgsql stable as $$
declare p public.user_profiles; v_day date;
begin
  select * into p from public.user_profiles where user_id = p_uid;
  v_day := private.today_for(p_uid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'key', k.key, 'title', k.title, 'description', k.description, 'difficulty', k.difficulty,
             'target', k.target, 'progress', least(k.target, k.prog),
             'done', k.prog >= k.target) order by k.difficulty)
      from (select pick.*, private.bounty_progress(p_uid, p.timezone, v_day, pick.kind) as prog
              from (select distinct on (difficulty) *
                      from public.bounty_catalog
                     order by difficulty, md5(p_uid::text || v_day::text || key)) pick) k
  ), '[]'::jsonb);
end $$;

create or replace function private.chest_odds(p_done integer) returns table (epic numeric, rare numeric)
language sql immutable as $$
  select case when p_done >= 3 then 0.07 else 0.04 end, case when p_done >= 3 then 0.30 else 0.22 end
$$;

create or replace function public.claim_bounty_chest() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); p public.user_profiles; v_day date; v_b jsonb; v_done integer;
  v_epic numeric; v_rare numeric; v_r double precision; v_rarity text; v_xp integer; v_item text := null;
  v_pity integer; v_cap integer; v_prog jsonb; v_ach jsonb;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  perform private.tick_user(v_uid);                               -- profile lock first
  select * into p from public.user_profiles where user_id = v_uid;
  v_day := private.today_for(v_uid);

  if exists (select 1 from public.bounty_chests where user_id = v_uid and day = v_day) then
    perform private.fail('ALREADY_CLAIMED', 'Today''s chest is already open. New bounties arrive at midnight.');
  end if;
  v_b := private.bounties_today(v_uid);
  select count(*) into v_done from jsonb_array_elements(v_b) e where (e ->> 'done')::boolean;
  if v_done < 2 then
    perform private.fail('BOUNTIES_INCOMPLETE', 'Complete at least 2 of today''s 3 bounties to open the chest.');
  end if;

  select o.epic, o.rare into v_epic, v_rare from private.chest_odds(v_done) o;
  v_r := private.rng();
  v_rarity := case when v_r < v_epic then 'Epic' when v_r < v_rare then 'Rare' else 'Common' end;
  -- Pity timer: five plain chests in a row guarantee the next one is at least Rare.
  v_pity := coalesce(p.chest_pity, 0);
  if v_rarity = 'Common' and v_pity >= 5 then v_rarity := 'Rare'; end if;

  v_xp := case v_rarity when 'Epic' then 90 when 'Rare' then 40 else 15 end;
  if v_rarity = 'Rare' then
    perform private.grant_item(v_uid, 'Surge Crystal', 'Doubles the XP of your next conquest.', 'XP_BOOST', 'Rare', 1);
    v_item := 'Surge Crystal';
  elsif v_rarity = 'Epic' then
    v_cap := private.freeze_cap(v_uid);
    if coalesce(p.streak_freezes, 0) < v_cap then
      update public.user_profiles set streak_freezes = streak_freezes + 1 where user_id = v_uid;
      v_item := 'Streak Freeze';
    else
      v_xp := v_xp + 30;                                         -- freeze slots full: convert to XP
    end if;
  end if;

  update public.user_profiles set chest_pity = case when v_rarity = 'Common' then v_pity + 1 else 0 end
   where user_id = v_uid;
  insert into public.bounty_chests (user_id, day, rarity, xp, item, perfect)
  values (v_uid, v_day, v_rarity, v_xp, v_item, v_done >= 3);
  perform private.grant_xp(v_uid, 'bounty', v_xp, jsonb_build_object('rarity', v_rarity, 'item', v_item, 'perfect', v_done >= 3));
  perform private.notify(v_uid, '🎁 BOUNTY CHEST', format('%s chest: +%s XP%s.', v_rarity, v_xp,
          case when v_item is not null then ' and a ' || v_item else '' end), 'achievement', '/dashboard');

  v_ach  := private.check_achievements(v_uid);
  v_prog := private.refresh_progression(v_uid);
  return jsonb_build_object('ok', true, 'rarity', v_rarity, 'xp', v_xp, 'item', v_item, 'perfect', v_done >= 3,
                            'achievements', v_ach, 'progression', v_prog, 'profile', private.profile_snapshot(v_uid));
end $$;

-- ── achievements ─────────────────────────────────────────────────────────────
create or replace function private.metrics(p_uid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'conquests', (select count(*) from public.xp_events where user_id = p_uid and kind = 'complete'),
    'high',      (select count(*) from public.xp_events where user_id = p_uid and kind = 'complete'
                    and meta ->> 'tier' in ('High','Super','Legendary')),
    'xp',        (select coalesce(sum(raw), 0) from public.xp_events where user_id = p_uid and kind in ('complete','burst','arise')),
    'streak',    (select greatest(best_streak, coalesce(streak_count, 0)) from public.user_profiles where user_id = p_uid),
    'level',     (select level from public.user_profiles where user_id = p_uid),
    'shadows',   (select count(*) from public.shadows where user_id = p_uid),
    'chests',    (select count(*) from public.bounty_chests where user_id = p_uid),
    'referrals', (select count(*) from public.user_profiles where referred_by = p_uid and referral_paid),
    'boss',      (select count(*) from public.boss_rewards where user_id = p_uid))
$$;

-- Unlock whatever is newly earned. Idempotent (primary key), so safe to call after any action.
create or replace function private.check_achievements(p_uid uuid) returns jsonb
language plpgsql as $$
declare v_m jsonb := private.metrics(p_uid); r record; v_out jsonb := '[]'::jsonb; v_n integer;
begin
  for r in
    select c.* from public.achievement_catalog c
     where (v_m ->> c.metric)::numeric >= c.threshold
       and not exists (select 1 from public.user_achievements u where u.user_id = p_uid and u.key = c.key)
     order by c.sort_order
  loop
    insert into public.user_achievements (user_id, key) values (p_uid, r.key) on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n = 1 then
      perform private.grant_xp(p_uid, 'achievement', r.xp_reward, jsonb_build_object('key', r.key, 'name', r.name));
      perform private.notify(p_uid, '🏆 ACHIEVEMENT UNLOCKED', format('%s — %s%s', r.name, r.description,
              case when r.xp_reward > 0 then format(' (+%s XP)', r.xp_reward) else '' end), 'achievement', '/achievements');
      v_out := v_out || jsonb_build_object('key', r.key, 'name', r.name, 'rarity', r.rarity, 'icon', r.icon, 'xp', r.xp_reward);
    end if;
  end loop;
  return v_out;
end $$;

create or replace function public.get_achievements() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_m jsonb;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  v_m := private.metrics(v_uid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'key', c.key, 'name', c.name, 'description', c.description, 'icon', c.icon, 'rarity', c.rarity,
             'threshold', c.threshold, 'xp_reward', c.xp_reward,
             'progress', least(c.threshold, (v_m ->> c.metric)::numeric),
             'unlocked_at', u.unlocked_at) order by c.sort_order)
      from public.achievement_catalog c
      left join public.user_achievements u on u.user_id = v_uid and u.key = c.key), '[]'::jsonb);
end $$;

-- ── world boss ───────────────────────────────────────────────────────────────
create or replace function private.boss_week(p_at timestamptz default now()) returns date
language sql stable as $$ select date_trunc('week', p_at at time zone 'UTC')::date $$;

-- The week's boss, created on first touch. HP adapts: beat last week's boss → ~15% tougher;
-- missed it → ~10% easier (never below 2,000), so the goal always feels reachable-but-real.
create or replace function private.boss_for(p_week date) returns public.world_bosses
language plpgsql as $$
declare b public.world_bosses; prev public.world_bosses; v_dmg bigint; v_hp integer;
  v_names text[] := array['The Procrastination Hydra','Sloth Titan Gorvak','The Doomscroll Wraith','Lord of Excuses',
                          'Entropy Dragon','The Snooze Colossus','Distraction Demon','Mother of Mañana'];
begin
  select * into b from public.world_bosses where week_start = p_week;
  if found then return b; end if;
  select * into prev from public.world_bosses where week_start < p_week order by week_start desc limit 1;
  if found then
    select coalesce(sum(damage), 0) into v_dmg from public.boss_damage where week_start = prev.week_start;
    v_hp := greatest(2000, round((prev.hp * case when v_dmg >= prev.hp then 1.15 else 0.9 end) / 100.0)::integer * 100);
  else
    v_hp := 2500;
  end if;
  insert into public.world_bosses (week_start, name, hp, reward_xp)
  values (p_week, v_names[1 + (extract(week from p_week)::integer % array_length(v_names, 1))], v_hp, 80)
  on conflict (week_start) do nothing;
  select * into b from public.world_bosses where week_start = p_week;
  return b;
end $$;

create or replace function private.boss_hit(p_uid uuid, p_damage integer) returns void
language plpgsql as $$
declare b public.world_bosses;
begin
  if p_damage <= 0 then return; end if;
  b := private.boss_for(private.boss_week());
  insert into public.boss_damage as d (week_start, user_id, damage) values (b.week_start, p_uid, p_damage)
  on conflict (week_start, user_id) do update set damage = d.damage + excluded.damage;
end $$;

create or replace function private.boss_view(p_uid uuid) returns jsonb
language plpgsql stable as $$
declare
  v_week date := private.boss_week(); b public.world_bosses; v_total bigint; v_mine integer; v_players integer;
  v_claim jsonb; v_top jsonb;
begin
  select * into b from public.world_bosses where week_start = v_week;
  if not found then
    -- not created yet this week (nobody has landed a hit): describe it without writing
    return jsonb_build_object('week', v_week, 'name', 'The Week''s Boss', 'hp', null, 'damage', 0, 'my_damage', 0,
                              'players', 0, 'defeated', false, 'ends_at', (v_week + 7)::timestamp at time zone 'UTC',
                              'top', '[]'::jsonb, 'claimable', '[]'::jsonb, 'pending', true);
  end if;
  select coalesce(sum(damage), 0), count(*) into v_total, v_players from public.boss_damage where week_start = v_week;
  select coalesce(damage, 0) into v_mine from public.boss_damage where week_start = v_week and user_id = p_uid;
  v_mine := coalesce(v_mine, 0);
  select coalesce(jsonb_agg(jsonb_build_object('name', n.name, 'damage', n.damage, 'me', n.user_id = p_uid) order by n.damage desc), '[]'::jsonb)
    into v_top
    from (select d.user_id, p.name, d.damage from public.boss_damage d join public.user_profiles p on p.user_id = d.user_id
           where d.week_start = v_week order by d.damage desc limit 5) n;
  select coalesce(jsonb_agg(jsonb_build_object('week', w.week_start, 'name', w.name, 'reward_xp', w.reward_xp)), '[]'::jsonb)
    into v_claim
    from public.world_bosses w
    join public.boss_damage d on d.week_start = w.week_start and d.user_id = p_uid and d.damage >= 20
   where w.week_start >= v_week - 7
     and (select coalesce(sum(damage), 0) from public.boss_damage x where x.week_start = w.week_start) >= w.hp
     and not exists (select 1 from public.boss_rewards r where r.week_start = w.week_start and r.user_id = p_uid);
  return jsonb_build_object('week', v_week, 'name', b.name, 'hp', b.hp, 'damage', v_total, 'my_damage', v_mine,
                            'players', v_players, 'defeated', v_total >= b.hp, 'reward_xp', b.reward_xp,
                            'ends_at', (v_week + 7)::timestamp at time zone 'UTC', 'top', v_top, 'claimable', v_claim,
                            'min_damage', 20);
end $$;

create or replace function public.claim_boss_reward(p_week date default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_cur date := private.boss_week(); v_week date; b public.world_bosses;
  v_total bigint; v_mine integer; v_ach jsonb; v_prog jsonb;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  perform private.tick_user(v_uid);
  v_week := coalesce(p_week, v_cur);
  if v_week not in (v_cur, v_cur - 7) then perform private.fail('BOSS_EXPIRED', 'That boss has already left.'); end if;
  select * into b from public.world_bosses where week_start = v_week;
  if not found then perform private.fail('BOSS_NOT_FOUND', 'No boss for that week.'); end if;
  select coalesce(sum(damage), 0) into v_total from public.boss_damage where week_start = v_week;
  if v_total < b.hp then perform private.fail('BOSS_ALIVE', 'The boss is still standing. Keep conquering gates.'); end if;
  select coalesce(damage, 0) into v_mine from public.boss_damage where week_start = v_week and user_id = v_uid;
  if coalesce(v_mine, 0) < 20 then
    perform private.fail('NO_CONTRIBUTION', 'Deal at least 20 damage (XP) to the boss to share in the loot.');
  end if;
  insert into public.boss_rewards (week_start, user_id, xp) values (v_week, v_uid, b.reward_xp)
  on conflict do nothing;
  if not found then perform private.fail('ALREADY_CLAIMED', 'You already claimed this boss''s loot.'); end if;

  perform private.grant_xp(v_uid, 'boss', b.reward_xp, jsonb_build_object('boss', b.name, 'week', v_week));
  perform private.grant_item(v_uid, 'Surge Crystal', 'Doubles the XP of your next conquest.', 'XP_BOOST', 'Rare', 1);
  perform private.notify(v_uid, '👑 BOSS DEFEATED', format('%s fell. Loot: +%s XP and a Surge Crystal.', b.name, b.reward_xp), 'achievement', '/dashboard');
  v_ach  := private.check_achievements(v_uid);
  v_prog := private.refresh_progression(v_uid);
  return jsonb_build_object('ok', true, 'xp', b.reward_xp, 'item', 'Surge Crystal', 'achievements', v_ach,
                            'progression', v_prog, 'profile', private.profile_snapshot(v_uid));
end $$;

-- ── after every first-time conquest ──────────────────────────────────────────
create or replace function private.after_conquest(p_uid uuid, p_task uuid, p_first boolean, p_xp integer,
                                                  p_tier text, p_streak integer) returns jsonb
language plpgsql as $$
declare
  p public.user_profiles; v_today date; v_cap integer; v_freeze boolean := false; v_ref public.user_profiles;
  v_paid integer;
begin
  select * into p from public.user_profiles where user_id = p_uid;
  v_today := private.today_for(p_uid);

  if p_streak > coalesce(p.best_streak, 0) then
    update public.user_profiles set best_streak = p_streak where user_id = p_uid;
  end if;

  -- Every 7th streak day banks a Streak Freeze (once per day, up to the plan's cap).
  if p_streak > 0 and p_streak % 7 = 0 and p.last_freeze_grant is distinct from v_today then
    v_cap := private.freeze_cap(p_uid);
    update public.user_profiles set last_freeze_grant = v_today where user_id = p_uid;
    if coalesce(p.streak_freezes, 0) < v_cap then
      update public.user_profiles set streak_freezes = streak_freezes + 1 where user_id = p_uid;
      v_freeze := true;
      perform private.notify(p_uid, '🧊 STREAK FREEZE EARNED',
        format('%s days straight. A Freeze will protect your streak if you miss a day.', p_streak), 'achievement', '/dashboard');
    end if;
  end if;

  if p_first and p_xp > 0 then perform private.boss_hit(p_uid, p_xp); end if;

  -- Referral payout: on the recruit's FIRST conquest (so throwaway sign-ups earn nothing).
  if p_first and p.referred_by is not null and not p.referral_paid then
    update public.user_profiles set referral_paid = true where user_id = p_uid;
    select count(*) into v_paid from public.user_profiles where referred_by = p.referred_by and referral_paid;
    if v_paid <= 20 then                                             -- anti-farming cap per recruiter
      select * into v_ref from public.user_profiles where user_id = p.referred_by for update;
      if found then
        perform private.grant_item(v_ref.user_id, 'Surge Crystal', 'Doubles the XP of your next conquest.', 'XP_BOOST', 'Rare', 2);
        perform private.notify(v_ref.user_id, '🤝 RECRUIT ACTIVE',
          format('%s just conquered their first gate. You earned 2 Surge Crystals.', p.name), 'achievement', '/achievements');
        perform private.check_achievements(v_ref.user_id);
      end if;
      perform private.grant_item(p_uid, 'Surge Crystal', 'Doubles the XP of your next conquest.', 'XP_BOOST', 'Rare', 1);
      perform private.notify(p_uid, '🎁 WELCOME BONUS', 'A friend brought you in: 1 Surge Crystal added to your inventory.', 'achievement', '/rewards');
    end if;
  end if;

  return jsonb_build_object('freeze_earned', v_freeze, 'achievements', private.check_achievements(p_uid));
end $$;

-- ── one round-trip for the whole engagement panel ────────────────────────────
create or replace function public.get_engagement() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); p public.user_profiles; v_day date; v_b jsonb; v_done integer; v_chest public.bounty_chests;
  v_total integer; v_unlocked integer; v_next jsonb; v_m jsonb; v_left integer;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;
  if not found then return jsonb_build_object('profile_missing', true); end if;
  v_day := private.today_for(v_uid);

  v_b := private.bounties_today(v_uid);
  select count(*) into v_done from jsonb_array_elements(v_b) e where (e ->> 'done')::boolean;
  select * into v_chest from public.bounty_chests where user_id = v_uid and day = v_day;

  v_m := private.metrics(v_uid);
  select count(*) into v_total from public.achievement_catalog;
  select count(*) into v_unlocked from public.user_achievements where user_id = v_uid;
  -- the locked trophy you are closest to: nearness is the motivator
  select jsonb_build_object('key', c.key, 'name', c.name, 'description', c.description, 'icon', c.icon, 'rarity', c.rarity,
                            'progress', (v_m ->> c.metric)::numeric, 'threshold', c.threshold, 'xp_reward', c.xp_reward)
    into v_next
    from public.achievement_catalog c
   where not exists (select 1 from public.user_achievements u where u.user_id = v_uid and u.key = c.key)
   order by ((v_m ->> c.metric)::numeric / c.threshold) desc, c.sort_order limit 1;

  v_left := greatest(0, extract(epoch from (((v_day + 1)::timestamp at time zone p.timezone) - now()))::integer);

  return jsonb_build_object(
    'day', v_day, 'seconds_left', v_left,
    'bounties', v_b, 'bounties_done', v_done,
    'chest', case when v_chest.user_id is null then jsonb_build_object('claimed', false, 'unlockable', v_done >= 2, 'pity', coalesce(p.chest_pity, 0))
                  else jsonb_build_object('claimed', true, 'rarity', v_chest.rarity, 'xp', v_chest.xp, 'item', v_chest.item) end,
    'streak', jsonb_build_object(
        'count', coalesce(p.streak_count, 0), 'best', greatest(coalesce(p.best_streak, 0), coalesce(p.streak_count, 0)),
        'freezes', coalesce(p.streak_freezes, 0), 'freeze_cap', private.freeze_cap(v_uid),
        'done_today', p.last_active_date = v_day,
        'at_risk', coalesce(p.streak_count, 0) > 0 and p.last_active_date is distinct from v_day,
        'next_freeze_in', case when coalesce(p.streak_count, 0) = 0 then 7 else 7 - (p.streak_count % 7) end),
    'boss', private.boss_view(v_uid),
    'achievements', jsonb_build_object('unlocked', v_unlocked, 'total', v_total, 'next', v_next),
    'referral', jsonb_build_object('code', p.hunter_code,
        'recruited', (select count(*) from public.user_profiles where referred_by = v_uid),
        'active', (select count(*) from public.user_profiles where referred_by = v_uid and referral_paid)));
end $$;

-- ── honest return nudges (schedule hourly: see SETUP.md) ─────────────────────
-- A reminder goes out ONLY while the streak can still be saved (they conquered yesterday, not
-- yet today), at most once a day, between 18:00 and 21:59 local time.
create or replace function private.send_return_nudges() returns integer
language plpgsql as $$
declare r record; v_n integer := 0; v_ins integer;
begin
  for r in
    select p.user_id, p.streak_count, p.streak_freezes, (now() at time zone p.timezone)::date as today
      from public.user_profiles p
     where p.streak_count >= 2
       and p.last_active_date = (now() at time zone p.timezone)::date - 1
       and extract(hour from now() at time zone p.timezone) between 18 and 21
  loop
    insert into public.nudge_log (user_id, day, kind) values (r.user_id, r.today, 'streak') on conflict do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 1 then
      perform private.notify(r.user_id, format('🔥 %s-day streak ends at midnight', r.streak_count),
        'One gate keeps it alive.' || case when r.streak_freezes > 0
          then format(' (You also have %s Streak Freeze%s as backup.)', r.streak_freezes, case when r.streak_freezes = 1 then '' else 's' end)
          else '' end, 'system', '/dungeon-gate');
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- ── patched engine functions (streak freezes + comeback in tick_user; hook in complete_gate) ──
create or replace function private.tick_user(p_uid uuid) returns void
language plpgsql as $$
declare
  p public.user_profiles; cfg public.game_modes; r record;
  v_today date; v_last date; v_cursor date; d date;
  v_idle integer; v_xp integer; v_streak integer; v_base integer; v_loss integer;
  v_total_loss integer := 0; v_decay_days integer := 0;
  v_freezes integer; v_frozen integer := 0; v_orig_last date;
begin
  -- Always take the profile lock first (global lock order), even when there is nothing to do.
  select * into p from public.user_profiles where user_id = p_uid for update;
  if not found then return; end if;

  v_today := private.today_for(p_uid);
  if p.last_tick_date = v_today then return; end if;

  cfg      := private.cfg(p.current_mode);
  v_last   := coalesce(p.last_active_date, (p.created_at at time zone p.timezone)::date);
  v_cursor := greatest(coalesce(p.last_tick_date, v_last), v_today - 91);
  v_xp     := coalesce(p.total_points, 0);
  v_streak := coalesce(p.streak_count, 0);
  v_freezes := coalesce(p.streak_freezes, 0);
  v_orig_last := v_last;

  -- Linear modes decay from the XP held when decay began; compounding modes from current XP.
  v_base := v_xp + coalesce((
    select -sum(delta) from public.xp_events
     where user_id = p_uid and kind = 'decay'
       and created_at >= ((v_last + 1)::timestamp at time zone p.timezone)), 0);

  d := v_cursor + 1;
  while d <= v_today - 1 loop
    if d > v_last then
      v_idle := d - v_last;                        -- consecutive idle days, counting d
      if v_idle > cfg.streak_grace_days and v_streak > 0 then
        if v_freezes > 0 then
          -- A Streak Freeze bridges the day: it counts as active (no reset, no decay).
          v_freezes := v_freezes - 1; v_frozen := v_frozen + 1;
          v_last := d; v_idle := 0;
        else
          v_streak := 0;
        end if;
      elsif v_idle > cfg.streak_grace_days then
        v_streak := 0;
      end if;

      if cfg.decay_rate > 0 and v_idle > cfg.grace_period then
        v_loss := floor(greatest(case when cfg.compounding_decay then v_xp else v_base end, 0) * cfg.decay_rate)::integer;
        if cfg.soft_decay_cap_xp > 0 then v_loss := least(v_loss, cfg.soft_decay_cap_xp); end if;
        v_loss := least(v_loss, greatest(v_xp + 5000, 0));
        if v_loss > 0 then
          v_xp := v_xp - v_loss;
          v_total_loss := v_total_loss + v_loss;
          v_decay_days := v_decay_days + 1;
        end if;
      end if;
    end if;
    d := d + 1;
  end loop;

  if v_total_loss > 0 then
    update public.user_profiles set total_points = v_xp where user_id = p_uid;
    perform private.record_xp(p_uid, 'decay', -v_total_loss, v_total_loss, false, null,
                              jsonb_build_object('days', v_decay_days));
    perform private.notify(p_uid, '📉 XP DECAY',
      format('Inactivity cost you %s XP over %s day(s). Conquer a gate to stop the bleeding.', v_total_loss, v_decay_days),
      'system', '/dungeon-gate');
  end if;

  update public.user_profiles
     set streak_count = v_streak, last_tick_date = v_today, streak_freezes = v_freezes,
         last_active_date = case when v_frozen > 0 then v_last else last_active_date end
   where user_id = p_uid;

  if v_frozen > 0 then
    perform private.notify(p_uid, '🧊 STREAK FREEZE USED',
      format('%s missed day(s) covered. Your %s-day streak is safe (%s Freeze%s left).',
             v_frozen, v_streak, v_freezes, case when v_freezes = 1 then '' else 's' end), 'system', '/dungeon-gate');
  end if;

  -- Comeback Surge: coming back after 3+ idle days is rewarded, not punished (once a week).
  if p.last_active_date is not null and v_today - v_orig_last >= 3
     and (p.last_comeback_date is null or p.last_comeback_date <= v_today - 7) then
    perform private.grant_item(p_uid, 'Surge Crystal', 'Doubles the XP of your next conquest.', 'XP_BOOST', 'Rare', 3);
    update public.user_profiles set last_comeback_date = v_today where user_id = p_uid;
    perform private.notify(p_uid, '🌅 WELCOME BACK, HUNTER',
      'The System saved you 3 Surge Crystals — each doubles the XP of a conquest. Start with one gate.', 'achievement', '/dungeon-gate');
  end if;

  -- Recurring gates that were resolved in an earlier cycle: roll to the next valid date.
  for r in
    select id, deadline, recurrence_type, recurrence_interval, recurrence_days, recurrence_day_of_month
      from public.tasks
     where user_id = p_uid and is_recurring and (is_completed or is_failed) and deadline < v_today
  loop
    update public.tasks
       set is_completed = false, is_failed = false, is_pending = false, is_active = false,
           completed_at = null, started_at = null, xp_paid = false, xp_awarded = 0,
           penalty_paid = false, penalty_applied = 0,
           deadline = private.find_next_valid(r.recurrence_type, r.recurrence_interval, r.recurrence_days,
                                              r.recurrence_day_of_month, r.deadline, v_today)
     where id = r.id;
  end loop;

  -- Overdue gates wait in "pending" until the player decides (do it / postpone / abandon).
  update public.tasks set is_pending = true, is_active = false
   where user_id = p_uid and not is_completed and not is_failed and not is_pending
     and deadline is not null and deadline < v_today;

  -- System rental weapons expire after 5 days (20% durability per day).
  delete from public.inventory
   where user_id = p_uid and item_category = 'Weapon'
     and coalesce((metadata ->> 'is_rental')::boolean, false)
     and acquired_at < now() - interval '5 days';

  perform private.resolve_challenges(p_uid);
  perform private.refresh_progression(p_uid);
end $$;

create or replace function public.complete_gate(p_task_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  t public.tasks; p public.user_profiles; cfg public.game_modes;
  v_now timestamptz := now(); v_today date;
  v_tier text; v_b_plus boolean; v_first boolean;
  v_base integer; v_eff numeric;
  v_flow_n integer; v_flow numeric := 1; v_ego numeric := 1; v_boost numeric := 1; v_res numeric := 0;
  v_boost_id uuid;
  v_xp integer := 0; v_capped boolean := false; v_e_today integer; v_room integer;
  v_dm integer; v_absorbed integer := 0; v_applied integer := 0;
  v_lost integer; v_arise integer := 0; v_burst integer := 0;
  v_streak integer; v_missed integer; v_stat text;
  v_chance numeric; v_shadow record; v_shadow_json jsonb := null;
  v_prog jsonb; v_next date; v_eng jsonb := '{}'::jsonb;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;

  perform private.tick_user(v_uid);                       -- locks the profile row first
  select * into p from public.user_profiles where user_id = v_uid;
  if not found then perform private.fail('PROFILE_MISSING', 'Profile not found.'); end if;

  select * into t from public.tasks where id = p_task_id for update;
  if not found or not (t.user_id = v_uid or t.assigned_to = v_uid) then
    perform private.fail('GATE_NOT_FOUND', 'That gate does not exist.');
  end if;

  if t.is_completed then
    return jsonb_build_object('ok', true, 'already', true, 'profile', private.profile_snapshot(v_uid));
  end if;

  if exists (select 1 from public.tasks c where c.parent_id = t.id and not c.is_completed) then
    perform private.fail('BOSS_SHIELD', 'Internal dungeons are still active. Clear every sub-objective first.');
  end if;
  if t.is_weekly_trial and (select count(*) from public.tasks c where c.parent_id = t.id) < 3 then
    perform private.fail('TRIAL_INCOMPLETE', 'Weekly Trials need at least 3 manifested objectives before conquest.');
  end if;

  cfg     := private.cfg(p.current_mode);
  v_today := private.today_for(v_uid);
  v_tier  := coalesce(t.xp_tier, 'Low');
  v_b_plus := v_tier in ('High', 'Super', 'Legendary');
  v_first := not t.xp_paid;

  if v_first then
    v_base := coalesce(nullif(t.points, 0), private.tier_points(v_tier));
    v_eff  := private.effective_xp(v_base, t.category);

    -- Flow ("Zone"): 5+ non-E conquests in the last 90 minutes → ×2.5. Server-derived, so it
    -- can't be forged via localStorage, and trivial E-rank spam can't trigger it.
    select count(*) into v_flow_n from public.xp_events
     where user_id = v_uid and kind = 'complete' and counts_weekly and created_at > v_now - interval '90 minutes';
    if v_flow_n >= 5 then v_flow := 2.5; end if;

    if coalesce(p.ego_score, 0) > 50 then v_ego := 1.1; end if;

    select id into v_boost_id from public.inventory
     where user_id = v_uid and item_type = 'XP_BOOST' and quantity > 0
     order by acquired_at limit 1 for update;
    if found then
      v_boost := 2;
      update public.inventory set quantity = quantity - 1 where id = v_boost_id;
    end if;

    -- Shadow resonance: top-5 shadows' bonuses, capped at +25%.
    select coalesce(sum(bonus_value), 0) into v_res
      from (select bonus_value from public.shadows where user_id = v_uid
             order by bonus_value desc nulls last limit 5) s;
    v_res := least(v_res, 0.25);

    v_xp := round(v_eff * cfg.xp_multiplier * v_flow * v_ego * v_boost * (1 + v_res))::integer;

    -- E-rank work is capped at 15 XP per local day (the old cap counted the task itself, so it
    -- really kicked in at 10).
    if v_tier = 'Low' then
      select coalesce(sum(raw), 0) into v_e_today from public.xp_events
       where user_id = v_uid and kind = 'complete' and not counts_weekly
         and (created_at at time zone p.timezone)::date = v_today;
      v_room := greatest(0, 15 - v_e_today);
      if v_xp > v_room then v_xp := v_room; v_capped := true; end if;
    end if;

    -- ARISE: a B-rank+ conquest while DECEASED restores half the XP lost to decay since the
    -- last ARISE, and ends the DECEASED state.
    if p.status = 'DECEASED' and v_b_plus then
      select coalesce(-sum(delta), 0) into v_lost from public.xp_events
       where user_id = v_uid and kind = 'decay'
         and created_at > coalesce((select max(created_at) from public.xp_events where user_id = v_uid and kind = 'arise'),
                                   '-infinity'::timestamptz);
      v_arise := floor(v_lost * 0.5)::integer;
    end if;

    -- "Dopamine hole": earned XP first pays down Dark Mana debt.
    v_dm := coalesce(p.dark_mana, 0);
    v_absorbed := least(v_dm, v_xp);
    v_applied  := v_xp - v_absorbed;
    v_dm := v_dm - v_absorbed;
  else
    v_dm := coalesce(p.dark_mana, 0);
  end if;

  -- Streak: counts days with a CONQUERED gate. (Failing a gate or spending XP used to count
  -- as "activity" and extend it.)
  v_streak := coalesce(p.streak_count, 0);
  if p.last_active_date is distinct from v_today then
    if p.last_active_date is null then
      v_streak := 1;
    else
      v_missed := v_today - p.last_active_date - 1;           -- idle days in between
      if v_missed <= cfg.streak_grace_days then v_streak := v_streak + 1; else v_streak := 1; end if;
    end if;
  end if;

  v_stat := (select stat from public.category_stats where name = t.category);

  update public.user_profiles set
      total_points = coalesce(total_points, 0) + v_applied + v_arise,
      dark_mana = v_dm,
      dark_mana_started_at = case when v_dm = 0 then null else dark_mana_started_at end,
      streak_count = v_streak,
      last_active_date = v_today,
      last_heartbeat = v_now,
      ego_score = coalesce(ego_score, 0) + case when v_first and (t.priority = 'URGENT' or v_b_plus) then 1 else 0 end,
      status = case when p.status = 'DECEASED' and v_b_plus then 'ACTIVE' else status end,
      reawakened_at = case when p.status = 'DECEASED' and v_b_plus then v_now else reawakened_at end,
      domain_physical  = case when v_first and v_stat = 'domain_physical'  then least(100, coalesce(domain_physical, 0) + 1)  else domain_physical  end,
      domain_mind      = case when v_first and v_stat = 'domain_mind'      then least(100, coalesce(domain_mind, 0) + 1)      else domain_mind      end,
      domain_soul      = case when v_first and v_stat = 'domain_soul'      then least(100, coalesce(domain_soul, 0) + 1)      else domain_soul      end,
      domain_execution = case when v_first and v_stat = 'domain_execution' then least(100, coalesce(domain_execution, 0) + 1) else domain_execution end,
      domain_builder   = case when v_first and v_stat = 'domain_builder'   then least(100, coalesce(domain_builder, 0) + 1)   else domain_builder   end
   where user_id = v_uid;

  if v_first then
    perform private.record_xp(v_uid, 'complete', v_applied, v_xp, v_tier <> 'Low', t.id, jsonb_build_object(
      'title', t.title, 'tier', v_tier, 'category', t.category, 'base', v_base, 'effective', round(v_eff, 2),
      'absorbed_by_dark_mana', v_absorbed, 'capped', v_capped,
      'mult', jsonb_build_object('mode', cfg.xp_multiplier, 'flow', v_flow, 'ego', v_ego, 'boost', v_boost, 'resonance', 1 + v_res)));
    if v_arise > 0 then
      perform private.record_xp(v_uid, 'arise', v_arise, v_arise, true, t.id, jsonb_build_object('restored_from_decay', v_lost));
      perform private.notify(v_uid, '🌅 ARISE', format('You conquered a high-rank gate after death. The System restores %s XP of decayed power.', v_arise), 'achievement', '/profile');
    end if;
  end if;

  update public.tasks set
      is_completed = true, is_failed = false, is_active = false, is_pending = false, is_paused = false,
      completed_at = v_now,
      xp_paid = true, xp_awarded = case when v_first then v_xp else xp_awarded end
   where id = t.id;

  -- Resonance burst (variable reward): 3+ non-E conquests in a 90-minute window, mode-dependent odds.
  if v_first and v_xp > 0 and v_tier <> 'Low' and (v_flow_n + 1) >= 3 and private.rng() <= cfg.resonance_burst_chance then
    v_burst := round(v_xp * least(2.0, 1.0 + ((v_flow_n + 1) - 3) * 0.15) * 0.5)::integer;
    if v_burst > 0 then
      update public.user_profiles set total_points = coalesce(total_points, 0) + v_burst where user_id = v_uid;
      perform private.record_xp(v_uid, 'burst', v_burst, v_burst, true, t.id, jsonb_build_object('momentum', v_flow_n + 1));
      perform private.notify(v_uid, '⚡ RESONANCE BURST', format('%s-gate momentum! Bonus +%s XP awarded by the System.', v_flow_n + 1, v_burst), 'achievement', '/dungeon-gate');
    end if;
  end if;

  -- Shadow extraction (disabled while in XP debt). Never hands out a duplicate.
  if v_first and p.status is distinct from 'PENALTY' then
    v_chance := case v_tier when 'Legendary' then 1.0 when 'Super' then 0.4 when 'High' then 0.15
                            when 'Mid' then 0.05 else 0.02 end;
    if private.rng() <= v_chance then
      select name, rarity, bonus into v_shadow from public.shadow_catalog sc
       where sc.rarity = any (case v_tier when 'Legendary' then array['Legendary','Mythic']
                                          when 'Super' then array['Epic'] when 'High' then array['Rare']
                                          else array['Common'] end)
         and not exists (select 1 from public.shadows s where s.user_id = v_uid and s.name = sc.name)
       order by random() limit 1;
      if found then
        insert into public.shadows (user_id, name, rarity, bonus_type, bonus_value)
        values (v_uid, v_shadow.name, v_shadow.rarity, 'xp_boost', v_shadow.bonus);
        v_shadow_json := jsonb_build_object('name', v_shadow.name, 'rarity', v_shadow.rarity, 'bonus', v_shadow.bonus);
        perform private.notify(v_uid, '👤 SHADOW EXTRACTED', format('[%s] %s has joined your army.', v_shadow.rarity, v_shadow.name), 'achievement', '/collection');
      end if;
    end if;
  end if;

  -- Recurring: keep a history row, then roll the original to its next cycle.
  if t.is_recurring then
    if v_first then
      insert into public.tasks (user_id, title, category, points, xp_tier, is_completed, completed_at,
                                is_recurring, is_system_generated, xp_paid, xp_awarded, created_by)
      values (v_uid, t.title || ' (Cycle Conquered)', t.category, t.points, t.xp_tier, true, v_now,
              false, true, true, v_xp, v_uid);
    end if;
    v_next := private.next_deadline(t.recurrence_type, t.recurrence_interval, t.recurrence_days,
                                    t.recurrence_day_of_month, v_today);
    update public.tasks set
        is_completed = false, is_failed = false, is_pending = false, is_active = false,
        completed_at = null, started_at = null, is_paused = false, paused_at = null,
        xp_paid = false, xp_awarded = 0, penalty_paid = false, penalty_applied = 0, deadline = v_next
     where id = t.id;
    update public.tasks set
        is_completed = false, is_failed = false, is_pending = false, is_active = false,
        completed_at = null, xp_paid = false, xp_awarded = 0
     where parent_id = t.id;
  end if;

  v_eng := private.after_conquest(v_uid, t.id, v_first, case when v_first then v_xp else 0 end, v_tier, v_streak);
  v_prog := private.refresh_progression(v_uid);

  return jsonb_build_object(
    'ok', true, 'already', false, 'engagement', v_eng, 'completed_at', v_now,
    'xp', jsonb_build_object(
      'base', v_base, 'effective', round(v_eff, 2), 'earned', v_xp, 'applied', v_applied,
      'absorbed_by_dark_mana', v_absorbed, 'capped', v_capped, 'arise_bonus', v_arise, 'burst', v_burst,
      'paid', v_first,
      'multipliers', jsonb_build_object('mode', cfg.xp_multiplier, 'flow', v_flow, 'ego', v_ego, 'boost', v_boost, 'resonance', 1 + v_res)),
    'flow_active', v_flow > 1,
    'shadow', v_shadow_json,
    'progression', v_prog,
    'profile', private.profile_snapshot(v_uid));
end $$;

create or replace function private.profile_snapshot(p_uid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
           'total_points', coalesce(total_points, 0), 'spent_xp', spent_xp, 'standing_xp', standing_xp,
           'level', level, 'player_rank', player_rank, 'player_title', player_title,
           'status', status, 'streak_count', coalesce(streak_count, 0), 'dark_mana', coalesce(dark_mana, 0),
           'ego_score', coalesce(ego_score, 0), 'current_mode', current_mode,
           'streak_freezes', coalesce(streak_freezes, 0), 'best_streak', coalesce(best_streak, 0))
    from public.user_profiles where user_id = p_uid
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_class text := coalesce(new.raw_user_meta_data ->> 'player_class', 'Warrior'); v_ref uuid;
        v_code text := upper(left(btrim(coalesce(new.raw_user_meta_data ->> 'ref', '')), 16));
begin
  if v_class not in ('Warrior','Mage','Assassin','Tank','Healer','Archer','Ranger','Necromancer','Tamer','Craftsman','Scout') then
    v_class := 'Warrior';
  end if;
  if v_code ~ '^[A-Z0-9]{8}$' then
    select user_id into v_ref from public.user_profiles where hunter_code = v_code and user_id <> new.id;
  end if;
  insert into public.user_profiles (user_id, email, hunter_code, name, player_class, player_rank, player_title, referred_by)
  values (new.id, new.email, upper(substr(new.id::text, 1, 8)),
          left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'Hunter'), 40),
          v_class, 'E', 'Newcomer', v_ref)
  on conflict (user_id) do nothing;
  return new;
end $$;

-- ── function privileges: player RPCs open, internals closed ──────────────────
revoke all on function public.claim_bounty_chest(), public.get_achievements(), public.claim_boss_reward(date),
                       public.get_engagement(), public.handle_new_user() from public, anon, authenticated;
grant execute on function public.claim_bounty_chest(), public.get_achievements(), public.claim_boss_reward(date),
                          public.get_engagement() to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_friend(uuid, uuid), private.is_clan_officer(uuid, uuid), private.is_clan_member(uuid, uuid),
  private.is_guild_officer(uuid, uuid), private.is_guild_member(uuid, uuid)
  to authenticated;
