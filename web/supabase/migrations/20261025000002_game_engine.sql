-- ============================================================================
-- 02 · GAME ENGINE (server-authoritative)
--
-- Every XP-affecting action now runs here, atomically, instead of as a chain of
-- read-modify-write calls from the browser. Properties this gives us:
--   • idempotent   – double-clicks / retries can't double-pay or double-penalise
--   • race-safe    – the profile row is locked first in every mutating RPC
--   • tamper-proof – clients can't write XP/level/streak; they can only ask
--   • one formula  – there used to be four different "complete a task" code paths
--   • timezone-correct – "today" is the player's local day, not UTC
--
-- Lock order (to avoid deadlocks): profile row → task row → everything else.
--
-- Error convention: RAISE EXCEPTION 'CODE: human message'. The client maps the
-- CODE prefix; the message is safe to show to the user.
-- ============================================================================

create schema if not exists private;

-- ── tiny utilities ──────────────────────────────────────────────────────────

create or replace function private.fail(p_code text, p_msg text) returns void
language plpgsql as $$
begin
  raise exception '%: %', p_code, p_msg using errcode = 'P0001';
end $$;

create or replace function private.cfg(p_mode text) returns public.game_modes
language plpgsql stable as $$
declare r public.game_modes;
begin
  select * into r from public.game_modes where name = p_mode;
  if not found then select * into r from public.game_modes where name = 'Normal'; end if;
  return r;
end $$;

create or replace function private.today_for(p_uid uuid) returns date
language sql stable as $$
  select (now() at time zone coalesce(
            (select timezone from public.user_profiles where user_id = p_uid), 'UTC'))::date
$$;

create or replace function private.notify(p_uid uuid, p_title text, p_msg text,
                                          p_type text default 'system', p_link text default null)
returns void language sql as $$
  insert into public.notifications (user_id, title, message, type, link)
  values (p_uid, p_title, p_msg, p_type, p_link)
$$;

-- Randomness seam. Production = random(); the test suite overrides it so shadow drops and
-- resonance bursts are deterministic instead of making XP assertions flaky.
create or replace function private.rng() returns double precision
language sql volatile as $$ select random() $$;

-- Plan limits. Replaced with the real lookup in the SaaS migration; NULL = unlimited.
create or replace function private.plan_limit(p_uid uuid, p_key text) returns integer
language sql stable as $$ select null::integer $$;

-- ── pure rules (kept in sync with web/src/lib/levelEngine.ts by unit tests) ──

create or replace function private.tier_points(p_tier text) returns integer
language sql immutable as $$
  select case p_tier when 'Legendary' then 50 when 'Super' then 35 when 'High' then 25
                     when 'Mid' then 15 else 5 end
$$;

-- Minimum preparation window (minutes) before a new gate's deadline, by tier.
create or replace function private.tier_buffer_minutes(p_tier text) returns integer
language sql immutable as $$
  select case p_tier when 'Legendary' then 480 when 'Super' then 240 when 'High' then 120
                     when 'Mid' then 60 else 30 end
$$;

create or replace function private.rank_index(p_rank text) returns integer
language sql immutable as $$
  select coalesce(array_position(array['E','D','C','B','A','S','SS'], p_rank) - 1, 0)
$$;

create or replace function private.calc_level(p_standing integer) returns integer
language sql immutable as $$ select greatest(1, floor(greatest(coalesce(p_standing, 0), 0) / 500.0)::int + 1) $$;

create or replace function private.calc_rank(p_level integer) returns text
language sql immutable as $$
  select case when p_level >= 101 then 'SS' when p_level >= 40 then 'S' when p_level >= 25 then 'A'
              when p_level >= 16 then 'B' when p_level >= 10 then 'C' when p_level >= 5 then 'D' else 'E' end
$$;

create or replace function private.title_for(p_class text, p_standing integer) returns text
language sql immutable as $$
  select coalesce(
           (jsonb '{
             "Assassin":    ["Street Shadow","Ghost Agent","Void Walker","Silent Reaper","Shadow Monarch"],
             "Warrior":     ["Street Brawler","Combat Vet","Vanguard","Iron Conqueror","War Lord"],
             "Mage":        ["Code Weaver","Apprentice","Archmage","Reality Glitcher","Techno-Sage"],
             "Tamer":       ["Handler","Jockey","Beast Lord","Spectral Binder","Primeval King"],
             "Healer":      ["Field Medic","Nano-Saint","Guardian Angel","World Tree Sage","Life Bringer"],
             "Tank":        ["Shield","Fortress","Indomitable","Aegis Prime","Eternal Bastion"],
             "Ranger":      ["Scout","Pathfinder","Grid Sniper","Windstrider","Dimensional Tracker"],
             "Archer":      ["Scout","Pathfinder","Grid Sniper","Windstrider","Dimensional Tracker"],
             "Necromancer": ["Glint Reaper","Soul Collector","Lich King","Ender of Worlds","Shadow Monarch"],
             "Craftsman":   ["Apprentice","Artisan","Master Smith","Soul Forger","Divine Architect"],
             "Scout":       ["Pathfinder","Navigator","Grid Walker","Void Scout","Celestial Eye"]
           }') -> p_class,
           jsonb '["Rookie","Hunter","Elite","Master","Legend"]'
         ) ->> (case when coalesce(p_standing,0) < 1000 then 0 when p_standing < 3000 then 1
                     when p_standing < 8000 then 2 when p_standing < 20000 then 3 else 4 end)
$$;

-- Base XP → effective XP: logarithmic dampening above 50, then category weight.
create or replace function private.effective_xp(p_base integer, p_category text) returns numeric
language sql stable as $$
  select (case when p_base > 50 then 50 + log((p_base - 49)::double precision)::numeric * 10
               else p_base end)
         * coalesce((select weight from public.category_stats where name = p_category), 1.0)
$$;

-- Next due date for a recurring gate (port of taskUtils.calculateNextDeadline, minus its
-- month-overflow bug: Jan 31 + "monthly on the 31st" no longer jumps to March).
create or replace function private.next_deadline(p_type text, p_interval integer, p_days text,
                                                 p_dom integer, p_from date) returns date
language plpgsql immutable as $$
declare
  v_type text := coalesce(nullif(p_type, 'none'), 'daily');
  v_int  integer := greatest(coalesce(p_interval, 1), 1);
  v_days integer[] := '{}';
  d date := p_from;
  i integer;
  v_first date;
begin
  if v_type in ('daily', 'interval') then
    return d + v_int;
  elsif v_type = 'weekly' then
    begin
      v_days := array(select jsonb_array_elements_text(p_days::jsonb)::integer);
    exception when others then v_days := '{}';
    end;
    if coalesce(array_length(v_days, 1), 0) > 0 then
      for i in 1..7 loop
        d := d + 1;
        if extract(dow from d)::integer = any(v_days) then return d; end if;
      end loop;
      return d + 7;
    end if;
    return d + 7;
  elsif v_type = 'monthly' then
    v_first := (date_trunc('month', d) + interval '1 month')::date;
    return v_first + (least(greatest(coalesce(p_dom, 1), 1),
                            extract(day from (v_first + interval '1 month - 1 day'))::integer) - 1);
  end if;
  return d + 1;
end $$;

-- First valid due date on/after p_today, stepping forward from the stored deadline.
create or replace function private.find_next_valid(p_type text, p_interval integer, p_days text,
                                                   p_dom integer, p_deadline date, p_today date) returns date
language plpgsql immutable as $$
declare n date := coalesce(p_deadline, p_today); guard integer := 0;
begin
  if n >= p_today then return n; end if;
  while n < p_today and guard < 400 loop
    n := private.next_deadline(p_type, p_interval, p_days, p_dom, n);
    guard := guard + 1;
  end loop;
  return n;
end $$;

-- ── ledger ───────────────────────────────────────────────────────────────────

-- Append an XP event and keep the per-day chart table (user_points) in step, atomically.
-- Reward spending is a trade, not performance, so it stays out of the daily chart.
create or replace function private.record_xp(p_uid uuid, p_kind text, p_delta integer, p_raw integer,
                                             p_counts_weekly boolean, p_ref uuid, p_meta jsonb)
returns void language plpgsql as $$
declare v_chart integer;
begin
  insert into public.xp_events (user_id, kind, delta, raw, counts_weekly, ref_id, meta)
  values (p_uid, p_kind, p_delta, p_raw, p_counts_weekly, p_ref, coalesce(p_meta, '{}'::jsonb));

  if p_kind <> 'reward_claim' then
    v_chart := case when p_kind in ('complete', 'burst', 'arise') then p_raw else p_delta end;
    if v_chart <> 0 then
      insert into public.user_points (user_id, date, daily_points)
      values (p_uid, private.today_for(p_uid), v_chart)
      on conflict (user_id, date)
      do update set daily_points = public.user_points.daily_points + excluded.daily_points;
    end if;
  end if;
end $$;

create or replace function private.weekly_xp(p_uid uuid) returns integer
language sql stable as $$
  select coalesce(sum(raw), 0)::integer
    from public.xp_events
   where user_id = p_uid and counts_weekly and kind in ('complete', 'burst', 'arise')
     and created_at > now() - interval '7 days'
$$;

-- ── status & progression ─────────────────────────────────────────────────────

-- Priority: DECEASED > PENALTY > STAGNANT > ACTIVE.
--  • DECEASED is sticky: only the ARISE ritual (a B-rank+ gate) clears it.
--  • Idle time is measured from the last COMPLETED gate, not from opening the app — merely
--    logging in used to count as being "alive".
--  • New accounts get a 7-day honeymoon before they can be STAGNANT.
create or replace function private.compute_status(p_uid uuid) returns text
language plpgsql stable as $$
declare p public.user_profiles; cfg public.game_modes; v_today date; v_last date;
begin
  select * into p from public.user_profiles where user_id = p_uid;
  if not found then return 'ACTIVE'; end if;
  if p.status = 'DECEASED' then return 'DECEASED'; end if;

  cfg := private.cfg(p.current_mode);
  v_today := private.today_for(p_uid);
  v_last := coalesce(p.last_active_date, (p.created_at at time zone p.timezone)::date);

  if (v_today - v_last) > cfg.deceased_threshold then return 'DECEASED'; end if;
  if coalesce(p.total_points, 0) < 0 then return 'PENALTY'; end if;
  if cfg.stagnant_threshold is not null
     and (v_today - (p.created_at at time zone p.timezone)::date) >= 7
     and private.weekly_xp(p_uid) < cfg.stagnant_threshold then
    return 'STAGNANT';
  end if;
  return 'ACTIVE';
end $$;

-- Recompute level / rank / title / status from the current numbers, notify on change.
-- THE single place progression is derived. Level comes from standing (balance + spent), so
-- buying a reward never de-levels you. Rank only drops in modes that allow rank-down.
create or replace function private.refresh_progression(p_uid uuid) returns jsonb
language plpgsql as $$
declare
  p public.user_profiles; cfg public.game_modes;
  v_standing integer; v_level integer; v_rank text; v_title text; v_status text;
  v_leveled boolean; v_ranked boolean;
begin
  select * into p from public.user_profiles where user_id = p_uid for update;
  if not found then return '{}'::jsonb; end if;

  cfg := private.cfg(p.current_mode);
  v_standing := coalesce(p.total_points, 0) + coalesce(p.spent_xp, 0);
  v_level := private.calc_level(v_standing);
  v_rank  := private.calc_rank(v_level);
  if not cfg.rank_down_enabled and private.rank_index(v_rank) < private.rank_index(p.player_rank) then
    v_rank := p.player_rank;
  end if;
  v_title  := private.title_for(p.player_class, v_standing);
  v_status := private.compute_status(p_uid);

  update public.user_profiles
     set level = v_level, player_rank = v_rank, player_title = v_title, status = v_status
   where user_id = p_uid;

  v_leveled := v_level > coalesce(p.level, 1);
  v_ranked  := private.rank_index(v_rank) > private.rank_index(p.player_rank);

  if v_leveled then
    perform private.notify(p_uid, '⚡ LEVEL UP', format('You reached Level %s. The System acknowledges your growth.', v_level), 'achievement', '/profile');
  end if;
  if v_ranked then
    perform private.notify(p_uid, '🏆 RANK UP', format('You have ascended to %s-Rank. New gates will open.', v_rank), 'achievement', '/profile');
  end if;
  if v_status is distinct from p.status then
    if v_status = 'PENALTY' then
      perform private.notify(p_uid, '⚠️ XP DEBT DETECTED', 'Your XP has fallen below zero. Complete gates to restore your standing.', 'system', '/rewards');
    elsif v_status = 'STAGNANT' then
      perform private.notify(p_uid, '📉 STAGNATION WARNING',
        format('Insufficient activity this week. %s mode requires %s XP/week from C-rank+ gates.', p.current_mode, cfg.stagnant_threshold), 'system', '/dungeon-gate');
    elsif v_status = 'DECEASED' then
      perform private.notify(p_uid, '💀 YOU HAVE FALLEN', 'Too long without conquering a gate. Complete a B-rank or higher gate to ARISE.', 'system', '/dungeon-gate');
    end if;
  end if;

  return jsonb_build_object(
    'leveled_up', v_leveled, 'ranked_up', v_ranked,
    'prev_level', coalesce(p.level, 1), 'level', v_level,
    'prev_rank', p.player_rank, 'rank', v_rank,
    'title', v_title, 'status', v_status, 'prev_status', p.status);
end $$;

-- Small, safe slice of the profile returned to the client after every action.
create or replace function private.profile_snapshot(p_uid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
           'total_points', coalesce(total_points, 0), 'spent_xp', spent_xp, 'standing_xp', standing_xp,
           'level', level, 'player_rank', player_rank, 'player_title', player_title,
           'status', status, 'streak_count', coalesce(streak_count, 0), 'dark_mana', coalesce(dark_mana, 0),
           'ego_score', coalesce(ego_score, 0), 'current_mode', current_mode)
    from public.user_profiles where user_id = p_uid
$$;

-- Apply an XP/Dark-Mana penalty (postponement, failure…) and record it.
-- Returns the XP actually lost (the balance floors at -5000).
create or replace function private.apply_penalty(p_uid uuid, p_kind text, p_xp integer, p_dm integer,
                                                 p_ref uuid, p_meta jsonb) returns integer
language plpgsql as $$
declare p public.user_profiles; cfg public.game_modes; v_new integer; v_lost integer; v_dm integer;
begin
  select * into p from public.user_profiles where user_id = p_uid for update;
  cfg := private.cfg(p.current_mode);
  v_new  := greatest(-5000, coalesce(p.total_points, 0) - greatest(p_xp, 0));
  v_lost := coalesce(p.total_points, 0) - v_new;
  v_dm   := least(cfg.dm_cap, coalesce(p.dark_mana, 0) + greatest(p_dm, 0));

  update public.user_profiles
     set total_points = v_new,
         dark_mana = v_dm,
         dark_mana_started_at = case when coalesce(p.dark_mana, 0) = 0 and v_dm > 0 then now() else p.dark_mana_started_at end
   where user_id = p_uid;

  if v_lost > 0 then
    perform private.record_xp(p_uid, p_kind, -v_lost, v_lost, false, p_ref, p_meta);
  end if;
  return v_lost;
end $$;

-- ── challenges (duels) ───────────────────────────────────────────────────────
-- Progress = XP EARNED since the duel started (gross, from the ledger). The old version
-- diffed total_points, so spending XP on a reward lowered your duel score — and nothing
-- ever declared a winner.

create or replace function private.earned_since(p_uid uuid, p_since timestamptz) returns integer
language sql stable as $$
  select coalesce(sum(raw), 0)::integer from public.xp_events
   where user_id = p_uid and kind in ('complete', 'burst', 'arise') and created_at >= p_since
$$;

create or replace function private.reached_at(p_uid uuid, p_since timestamptz, p_until timestamptz, p_target integer)
returns timestamptz language sql stable as $$
  select min(created_at) from (
    select created_at, sum(raw) over (order by created_at, id) as cum
      from public.xp_events
     where user_id = p_uid and kind in ('complete', 'burst', 'arise')
       and created_at >= p_since and created_at <= p_until
  ) s where cum >= p_target
$$;

create or replace function private.resolve_challenges(p_uid uuid) returns void
language plpgsql as $$
declare c record; v_a timestamptz; v_b timestamptz; v_winner uuid; v_done boolean;
begin
  for c in
    select * from public.challenges
     where status = 'active' and (creator_id = p_uid or opponent_id = p_uid)
     for update
  loop
    v_a := private.reached_at(c.creator_id,  c.created_at, c.expires_at, c.target_points);
    v_b := private.reached_at(c.opponent_id, c.created_at, c.expires_at, c.target_points);
    v_done := false;

    if v_a is not null or v_b is not null then
      v_winner := case when v_b is null or (v_a is not null and v_a <= v_b) then c.creator_id else c.opponent_id end;
      update public.challenges set status = 'completed', winner_id = v_winner where id = c.id;
      perform private.notify(v_winner, '🏆 DUEL WON', format('You reached %s XP first and won the duel.', c.target_points), 'duel', '/arena');
      perform private.notify(case when v_winner = c.creator_id then c.opponent_id else c.creator_id end,
                             '⚔️ DUEL LOST', 'Your rival reached the target first.', 'duel', '/arena');
    elsif c.expires_at < now() then
      update public.challenges set status = 'expired' where id = c.id;
      perform private.notify(c.creator_id,  '⌛ DUEL EXPIRED', 'Nobody reached the target in time.', 'duel', '/arena');
      perform private.notify(c.opponent_id, '⌛ DUEL EXPIRED', 'Nobody reached the target in time.', 'duel', '/arena');
    end if;
  end loop;
end $$;

-- ── daily tick ───────────────────────────────────────────────────────────────
-- Idempotent per local day, run lazily when a player opens the app (and by cron for
-- everyone if enabled). Catches up every fully-elapsed day since the last tick, so the
-- outcome is identical whether the player visits daily or after three weeks away.
create or replace function private.tick_user(p_uid uuid) returns void
language plpgsql as $$
declare
  p public.user_profiles; cfg public.game_modes; r record;
  v_today date; v_last date; v_cursor date; d date;
  v_idle integer; v_xp integer; v_streak integer; v_base integer; v_loss integer;
  v_total_loss integer := 0; v_decay_days integer := 0;
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

  -- Linear modes decay from the XP held when decay began; compounding modes from current XP.
  v_base := v_xp + coalesce((
    select -sum(delta) from public.xp_events
     where user_id = p_uid and kind = 'decay'
       and created_at >= ((v_last + 1)::timestamp at time zone p.timezone)), 0);

  d := v_cursor + 1;
  while d <= v_today - 1 loop
    if d > v_last then
      v_idle := d - v_last;                        -- consecutive idle days, counting d
      if v_idle > cfg.streak_grace_days then v_streak := 0; end if;

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
     set streak_count = v_streak, last_tick_date = v_today
   where user_id = p_uid;

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

-- ============================================================================
-- PUBLIC RPCs
-- ============================================================================

create or replace function public.set_timezone(p_tz text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if p_tz is null or not exists (select 1 from pg_timezone_names where name = p_tz) then
    perform private.fail('INVALID_TIMEZONE', 'Unknown timezone.');
  end if;
  update public.user_profiles set timezone = p_tz where user_id = auth.uid() and timezone is distinct from p_tz;
end $$;

-- Complete ("conquer") a gate. Idempotent: completing twice returns {already:true}.
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
  v_prog jsonb; v_next date;
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

  v_prog := private.refresh_progression(v_uid);

  return jsonb_build_object(
    'ok', true, 'already', false, 'completed_at', v_now,
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

-- Abandon a gate. Penalty = fail rate × the GATE's XP (capped at 200), amplified by lingering
-- Dark Mana. Idempotent: a gate can only be penalised once.
create or replace function public.fail_gate(p_task_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  t public.tasks; p public.user_profiles; cfg public.game_modes;
  v_now timestamptz := now(); v_today date;
  v_mult numeric := 1; v_pen integer := 0; v_lost integer := 0; v_spawned boolean := false;
  v_active integer; v_pick jsonb; v_prog jsonb;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;

  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;
  select * into t from public.tasks where id = p_task_id for update;
  if not found or not (t.user_id = v_uid or t.assigned_to = v_uid) then
    perform private.fail('GATE_NOT_FOUND', 'That gate does not exist.');
  end if;
  if t.is_completed then
    return jsonb_build_object('ok', true, 'already', true, 'penalty', 0, 'profile', private.profile_snapshot(v_uid));
  end if;

  cfg := private.cfg(p.current_mode);
  v_today := private.today_for(v_uid);

  if not t.penalty_paid then
    if coalesce(p.dark_mana, 0) > 0 and p.dark_mana_started_at is not null then
      v_mult := 1.0 + floor(extract(epoch from (v_now - p.dark_mana_started_at)) / 86400) * 0.1;
    end if;
    v_pen := least(200, floor(coalesce(nullif(t.points, 0), 10) * cfg.fail_xp_penalty_rate * v_mult)::integer);
    v_lost := private.apply_penalty(v_uid, 'fail', v_pen, cfg.dm_on_fail, t.id,
                jsonb_build_object('title', t.title, 'tier', t.xp_tier, 'corruption_multiplier', v_mult));
  end if;

  update public.tasks set
      is_failed = true, is_completed = true, is_active = false, is_pending = false, is_paused = false,
      completed_at = v_now, penalty_paid = true, penalty_applied = greatest(penalty_applied, v_lost)
   where id = t.id;

  -- Offer a redemption path, but never bury a player: only if they're not swamped and don't
  -- already have an open one.
  select count(*) into v_active from public.tasks
   where user_id = v_uid and not is_completed and not is_failed;
  if v_active < 10 and not exists (select 1 from public.tasks
        where user_id = v_uid and is_system_generated and not is_completed and not is_failed
          and title like '🔥 REDEMPTION:%') then
    v_pick := (jsonb '[
      {"title":"Penalty Zone: Physical Trial","desc":"Perform 100 Pushups, 100 Sit-ups, 100 Squats, and a 10km Run.","points":50},
      {"title":"Shadow Restraint","desc":"No entertainment/social media for 4 hours. Focus only on productivity.","points":30},
      {"title":"Mana Cleanse","desc":"Drink only water for 24 hours. No processed sugars.","points":40},
      {"title":"Monarch''s Discipline","desc":"Wake up at 5:00 AM and start your first task immediately.","points":25}]')
      -> floor(random() * 4)::integer;
    insert into public.tasks (user_id, assigned_to, created_by, title, description, points, category, priority,
                              xp_tier, is_system_generated, deadline)
    values (v_uid, v_uid, v_uid, '🔥 REDEMPTION: ' || (v_pick ->> 'title'),
            (v_pick ->> 'desc') || E'\n\nThe System offers you a path back. Complete this to restore your momentum.',
            (v_pick ->> 'points')::integer, 'Punishment', 'High', 'High', true, v_today + 2);
    v_spawned := true;
  end if;

  if t.is_recurring then
    update public.tasks set
        is_completed = false, is_failed = false, is_pending = false, is_active = false,
        completed_at = null, started_at = null, xp_paid = false, xp_awarded = 0,
        penalty_paid = false, penalty_applied = 0,
        deadline = private.find_next_valid(t.recurrence_type, t.recurrence_interval, t.recurrence_days,
                                           t.recurrence_day_of_month, t.deadline, v_today)
     where id = t.id;
  end if;

  v_prog := private.refresh_progression(v_uid);
  return jsonb_build_object('ok', true, 'already', false, 'penalty', v_lost, 'redemption_spawned', v_spawned,
                            'progression', v_prog, 'profile', private.profile_snapshot(v_uid));
end $$;

-- Create or edit a gate. XP value is derived from the tier on the server — a client can no
-- longer mint a "Low" gate worth a million points.
create or replace function public.save_gate(p_payload jsonb, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  p public.user_profiles; cfg public.game_modes; old public.tasks; new_id uuid;
  v_title text; v_desc text; v_cat text; v_prio text; v_tier text; v_deadline date;
  v_start text; v_end text; v_rtype text; v_rint integer; v_rdays text; v_rdom integer; v_rlabel text;
  v_gauntlet boolean; v_trial boolean; v_parent uuid; v_recurring boolean;
  v_count integer; v_limit integer; v_weekend boolean; v_minimum timestamptz; v_cut timestamptz;
  v_postponed boolean := false; v_penalty integer := 0; v_plan_limit integer;
  v_stage text;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    perform private.fail('INVALID_INPUT', 'Malformed gate.');
  end if;

  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;
  cfg := private.cfg(p.current_mode);

  v_title := btrim(coalesce(p_payload ->> 'title', ''));
  if char_length(v_title) < 1 or char_length(v_title) > 200 then
    perform private.fail('INVALID_TITLE', 'A gate needs a name (1–200 characters).');
  end if;
  v_desc  := left(coalesce(p_payload ->> 'description', ''), 2000);
  v_cat   := left(coalesce(nullif(btrim(p_payload ->> 'category'), ''), 'General'), 60);
  v_prio  := case when (p_payload ->> 'priority') in ('Low','Normal','High','URGENT') then p_payload ->> 'priority' else 'Normal' end;
  v_tier  := case when (p_payload ->> 'xp_tier') in ('Low','Mid','High','Super','Legendary') then p_payload ->> 'xp_tier' else 'Low' end;

  begin
    v_deadline := nullif(p_payload ->> 'deadline', '')::date;
  exception when others then
    perform private.fail('INVALID_DEADLINE', 'That deadline is not a valid date.');
  end;

  v_start := case when (p_payload ->> 'start_time') ~ '^\d{2}:\d{2}(:\d{2})?$' then p_payload ->> 'start_time' end;
  v_end   := case when (p_payload ->> 'end_time')   ~ '^\d{2}:\d{2}(:\d{2})?$' then p_payload ->> 'end_time'   end;

  v_rtype := case when (p_payload ->> 'recurrence_type') in ('none','daily','interval','weekly','monthly','custom')
                  then p_payload ->> 'recurrence_type' else 'none' end;
  v_recurring := v_rtype <> 'none';
  v_rint  := least(greatest(coalesce(nullif(p_payload ->> 'recurrence_interval', '')::integer, 1), 1), 365);
  v_rdom  := least(greatest(coalesce(nullif(p_payload ->> 'recurrence_day_of_month', '')::integer, 1), 1), 31);
  v_rlabel := left(p_payload ->> 'recurrence_custom_label', 60);
  begin
    v_rdays := (select coalesce(jsonb_agg(x::integer order by x::integer), '[]'::jsonb)::text
                  from jsonb_array_elements_text(
                         case when jsonb_typeof(p_payload -> 'recurrence_days') = 'array' then p_payload -> 'recurrence_days'
                              when jsonb_typeof(p_payload -> 'recurrence_days') = 'string' then (p_payload ->> 'recurrence_days')::jsonb
                              else '[]'::jsonb end) x
                 where x ~ '^[0-6]$');
  exception when others then v_rdays := '[]';
  end;

  v_gauntlet := coalesce((p_payload ->> 'is_gauntlet')::boolean, false);
  v_trial    := coalesce((p_payload ->> 'is_weekly_trial')::boolean, false);

  if p_id is null then
    -- ── CREATE ───────────────────────────────────────────────────────────────
    v_parent := nullif(p_payload ->> 'parent_id', '')::uuid;
    if v_parent is not null and not exists (select 1 from public.tasks where id = v_parent and user_id = v_uid) then
      perform private.fail('INVALID_PARENT', 'The parent gate does not exist.');
    end if;

    v_plan_limit := private.plan_limit(v_uid, 'max_active_gates');
    if v_plan_limit is not null then
      select count(*) into v_count from public.tasks where user_id = v_uid and not is_completed and not is_failed;
      if v_count >= v_plan_limit then
        perform private.fail('PLAN_LIMIT', format('Your plan allows %s active gates. Upgrade to manifest more.', v_plan_limit));
      end if;
    end if;

    if v_deadline is null then
      v_tier := 'Low';                                   -- no deadline = auto E-rank
    else
      v_weekend := extract(dow from v_deadline) in (0, 6);
      v_limit := case when v_weekend then 30 else 20 end;
      select count(*) into v_count from public.tasks
       where user_id = v_uid and not is_completed and not is_failed and deadline = v_deadline;
      if v_count >= v_limit then
        perform private.fail('TEMPORAL_OVERLOAD', format('You already have %s active gates for %s. %s', v_count, v_deadline,
          case when v_weekend then 'Even a Monarch must rest; this day is full.'
               else 'Shift some to the weekend to avoid burnout.' end));
      end if;

      v_cut := ((v_deadline + coalesce(v_start::time, time '23:59:59'))::timestamp at time zone p.timezone);
      v_minimum := now() + make_interval(mins => private.tier_buffer_minutes(v_tier));
      if v_cut < v_minimum then
        perform private.fail('TEMPORAL_ANOMALY', format('A %s-rank gate needs at least %s minutes of preparation before its deadline.',
          case v_tier when 'Legendary' then 'S' when 'Super' then 'A' when 'High' then 'B' when 'Mid' then 'C' else 'E' end,
          private.tier_buffer_minutes(v_tier)));
      end if;
    end if;

    insert into public.tasks (user_id, assigned_to, created_by, title, description, category, priority, xp_tier, points,
        deadline, start_time, end_time, is_recurring, recurrence_type, recurrence_interval, recurrence_days,
        recurrence_day_of_month, recurrence_custom_label, is_gauntlet, is_weekly_trial, parent_id, is_active, is_completed)
    values (v_uid, v_uid, v_uid, v_title, v_desc, v_cat, v_prio, v_tier, private.tier_points(v_tier),
        v_deadline, v_start, v_end, v_recurring, v_rtype, v_rint, v_rdays, v_rdom, v_rlabel, v_gauntlet, v_trial,
        v_parent, false, false)
    returning id into new_id;

    if v_gauntlet then
      foreach v_stage in array array['Stage 1: Perimeter Breach','Stage 2: Dungeon Entry','Stage 3: Mob Clearing',
                                     'Stage 4: Mini-Boss Encounter','Stage 5: Boss Chamber Access'] loop
        insert into public.tasks (user_id, assigned_to, created_by, parent_id, title, category, points, xp_tier, priority)
        values (v_uid, v_uid, v_uid, new_id, v_stage, v_cat, 5, 'Low', 'Normal');
      end loop;
    end if;

    return jsonb_build_object('ok', true, 'id', new_id);
  end if;

  -- ── EDIT ─────────────────────────────────────────────────────────────────────
  select * into old from public.tasks where id = p_id for update;
  if not found or old.user_id <> v_uid then
    perform private.fail('GATE_NOT_FOUND', 'That gate does not exist.');
  end if;

  -- Re-validate the preparation window if the tier went up or the deadline moved.
  if not old.is_completed and v_deadline is not null
     and (v_deadline is distinct from old.deadline
          or private.tier_points(v_tier) > private.tier_points(coalesce(old.xp_tier, 'Low'))) then
    v_cut := ((v_deadline + coalesce(v_start::time, time '23:59:59'))::timestamp at time zone p.timezone);
    v_minimum := now() + make_interval(mins => private.tier_buffer_minutes(v_tier));
    if v_cut < v_minimum then
      perform private.fail('TEMPORAL_ANOMALY', format('That tier needs at least %s minutes of preparation before the deadline.',
        private.tier_buffer_minutes(v_tier)));
    end if;
  end if;

  -- Pushing a deadline later is a postponement: costs XP + Dark Mana, and is banned in Hard/Hell.
  if old.deadline is not null and v_deadline is not null and v_deadline > old.deadline then
    if not cfg.postpone_enabled then
      perform private.fail('POSTPONE_DISABLED', format('Postponing is not allowed in %s mode. Conquer it or abandon it.', cfg.name));
    end if;
    v_postponed := true;
    v_penalty := private.apply_penalty(v_uid, 'postpone', 5, 5, p_id,
                   jsonb_build_object('title', old.title, 'from', old.deadline, 'to', v_deadline));
  end if;

  update public.tasks set
      title = v_title, description = v_desc, category = v_cat, priority = v_prio,
      xp_tier = v_tier, points = private.tier_points(v_tier),
      deadline = v_deadline, start_time = v_start, end_time = v_end,
      is_recurring = v_recurring, recurrence_type = v_rtype, recurrence_interval = v_rint,
      recurrence_days = v_rdays, recurrence_day_of_month = v_rdom, recurrence_custom_label = v_rlabel,
      is_pending = case when v_postponed then false else is_pending end
   where id = p_id;

  if v_postponed then perform private.refresh_progression(v_uid); end if;
  return jsonb_build_object('ok', true, 'id', p_id, 'postponed', v_postponed, 'penalty', v_penalty,
                            'profile', private.profile_snapshot(v_uid));
end $$;

create or replace function public.delete_gate(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  delete from public.tasks where id = p_id and user_id = auth.uid();
end $$;

-- Raid timer controls. Resuming shifts started_at forward by the paused time so the clock
-- genuinely excludes the pause.
create or replace function public.raid_action(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); t public.tasks; v_now timestamptz := now();
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  select * into t from public.tasks where id = p_id for update;
  if not found or not (t.user_id = v_uid or t.assigned_to = v_uid) then
    perform private.fail('GATE_NOT_FOUND', 'That gate does not exist.');
  end if;
  if t.is_completed then perform private.fail('GATE_CLOSED', 'This gate is already resolved.'); end if;

  if p_action = 'start' then
    update public.tasks set is_active = true, started_at = v_now, is_paused = false, paused_at = null, is_pending = false where id = p_id;
  elsif p_action = 'pause' then
    if not t.is_active then perform private.fail('NOT_ACTIVE', 'Start the raid first.'); end if;
    update public.tasks set is_paused = true, paused_at = v_now where id = p_id and not coalesce(is_paused, false);
  elsif p_action = 'resume' then
    update public.tasks set
        started_at = case when t.paused_at is not null and t.started_at is not null
                          then t.started_at + (v_now - t.paused_at) else started_at end,
        is_paused = false, paused_at = null
     where id = p_id;
  elsif p_action = 'reset' then
    update public.tasks set is_active = false, started_at = null, is_paused = false, paused_at = null where id = p_id;
  else
    perform private.fail('INVALID_ACTION', 'Unknown raid action.');
  end if;

  select * into t from public.tasks where id = p_id;
  return jsonb_build_object('ok', true, 'is_active', t.is_active, 'is_paused', t.is_paused,
                            'started_at', t.started_at, 'paused_at', t.paused_at);
end $$;

-- Undo a completion/failure. Pays nothing and refunds nothing: a gate only ever pays out once,
-- so complete → reactivate → complete can't farm XP.
create or replace function public.reactivate_gate(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.tasks;
begin
  if auth.uid() is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  select * into t from public.tasks where id = p_id for update;
  if not found or not (t.user_id = auth.uid() or t.assigned_to = auth.uid()) then
    perform private.fail('GATE_NOT_FOUND', 'That gate does not exist.');
  end if;
  update public.tasks set is_completed = false, is_failed = false, is_active = false, is_pending = false,
         completed_at = null, started_at = null, is_paused = false, paused_at = null
   where id = p_id;
end $$;

-- Free "revive" used to exist client-side. Reawakening now has a price: a B-rank gate.
create or replace function public.begin_arise() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); p public.user_profiles; v_id uuid;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;
  if p.status <> 'DECEASED' then
    return jsonb_build_object('ok', true, 'spawned', false, 'reason', 'not_deceased');
  end if;
  select id into v_id from public.tasks
   where user_id = v_uid and is_system_generated and not is_completed and not is_failed and title like '🌅 ARISE:%' limit 1;
  if v_id is null then
    insert into public.tasks (user_id, assigned_to, created_by, title, description, points, category, priority, xp_tier,
                              is_system_generated, deadline)
    values (v_uid, v_uid, v_uid, '🌅 ARISE: Reawakening Ritual',
            'SYSTEM: Conquer this gate to rise from death. Completing any B-rank or higher gate restores half of your decayed XP.',
            25, 'General', 'URGENT', 'High', true, private.today_for(v_uid) + 1)
    returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'spawned', true, 'id', v_id);
end $$;

-- Spend XP on a reward. System rewards are reusable; custom rewards are one-shot.
create or replace function public.claim_reward(p_reward_id uuid default null, p_system_key text default null,
                                               p_trigger_gate uuid default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); p public.user_profiles; rule public.reward_tiers;
  v_name text; v_cost integer; v_tier text; r public.rewards; s public.system_rewards;
  v_exp timestamptz := now() + interval '72 hours';
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;

  if p_system_key is not null then
    select * into s from public.system_rewards where key = p_system_key;
    if not found then perform private.fail('REWARD_NOT_FOUND', 'That reward does not exist.'); end if;
    v_name := s.name; v_cost := s.xp_cost; v_tier := s.tier;
  else
    select * into r from public.rewards where id = p_reward_id and user_id = v_uid for update;
    if not found then perform private.fail('REWARD_NOT_FOUND', 'That reward does not exist.'); end if;
    if r.is_claimed then perform private.fail('ALREADY_CLAIMED', 'You already manifested this reward.'); end if;
    v_name := r.name; v_cost := r.xp_cost;
    v_tier := case when r.tier ~ '^[1-5]$' then r.tier else '1' end;
  end if;

  select * into rule from public.reward_tiers where tier = v_tier;
  if coalesce(p.streak_count, 0) < rule.min_streak then
    perform private.fail('STREAK_LOCK', format('This tier requires a %s-day streak.', rule.min_streak));
  end if;
  if private.rank_index(p.player_rank) < rule.min_rank_idx then
    perform private.fail('RANK_LOCK', format('This tier requires %s-Rank standing.', (array['E','D','C','B','A','S','SS'])[rule.min_rank_idx + 1]));
  end if;
  if rule.dm_block and coalesce(p.dark_mana, 0) > 0 then
    perform private.fail('MANA_CORRUPTION', 'Clear your Dark Mana debt to unlock high-tier rewards.');
  end if;
  if rule.needs_trigger then
    if p_trigger_gate is null then
      perform private.fail('TRIGGER_REQUIRED', 'Select a gate you conquered in the last 48 hours to anchor this reward.');
    end if;
    if not exists (select 1 from public.tasks
                    where id = p_trigger_gate and (user_id = v_uid or assigned_to = v_uid)
                      and is_completed and not is_failed and completed_at > now() - interval '48 hours') then
      perform private.fail('TRIGGER_INVALID', 'That gate was not conquered in the last 48 hours.');
    end if;
    if exists (select 1 from public.reward_claims where trigger_gate_id = p_trigger_gate) then
      perform private.fail('TRIGGER_USED', 'That gate already anchored a reward. Conquer a new one.');
    end if;
  end if;
  if coalesce(p.total_points, 0) < v_cost then
    perform private.fail('INSUFFICIENT_XP', 'You do not have enough XP to manifest this reward.');
  end if;

  update public.user_profiles
     set total_points = total_points - v_cost, spent_xp = spent_xp + v_cost
   where user_id = v_uid;
  insert into public.reward_claims (user_id, reward_id, system_key, name, tier, xp_cost, trigger_gate_id, expires_at)
  values (v_uid, r.id, p_system_key, v_name, v_tier, v_cost, p_trigger_gate, v_exp);
  perform private.record_xp(v_uid, 'reward_claim', -v_cost, v_cost, false, r.id,
            jsonb_build_object('name', v_name, 'tier', v_tier, 'system', p_system_key is not null));
  if r.id is not null then
    update public.rewards set is_claimed = true, claimed_at = now(), expires_at = v_exp, trigger_gate_id = p_trigger_gate
     where id = r.id;
  end if;

  perform private.refresh_progression(v_uid);
  return jsonb_build_object('ok', true, 'name', v_name, 'cost', v_cost, 'expires_at', v_exp,
                            'profile', private.profile_snapshot(v_uid));
end $$;

-- Redeem Dark Mana through a punishment. Dual cost: 1.5× the Dark Mana in XP — a sacrifice
-- (it lowers standing, unlike spending on rewards).
create or replace function public.redeem_dark_mana(p_amount integer, p_punishment_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); p public.user_profiles; v_amt integer; v_cost integer; v_new_dm integer; v_lost integer;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if p_amount is null or p_amount < 1 then perform private.fail('INVALID_AMOUNT', 'Amount must be at least 1.'); end if;
  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;
  if coalesce(p.dark_mana, 0) = 0 then perform private.fail('NO_DARK_MANA', 'You carry no Dark Mana debt.'); end if;

  v_amt := least(p_amount, p.dark_mana);
  v_cost := floor(v_amt * 1.5)::integer;
  v_new_dm := p.dark_mana - v_amt;

  update public.user_profiles
     set total_points = greatest(-5000, coalesce(total_points, 0) - v_cost),
         dark_mana = v_new_dm,
         dark_mana_started_at = case when v_new_dm = 0 then null else dark_mana_started_at end
   where user_id = v_uid;
  v_lost := p.total_points - greatest(-5000, p.total_points - v_cost);
  if v_lost > 0 then
    perform private.record_xp(v_uid, 'redeem', -v_lost, v_lost, false, p_punishment_id,
              jsonb_build_object('dark_mana_cleared', v_amt));
  end if;
  if p_punishment_id is not null then
    update public.punishments set triggered = triggered + 1 where id = p_punishment_id and user_id = v_uid;
  end if;

  perform private.refresh_progression(v_uid);
  return jsonb_build_object('ok', true, 'dark_mana_cleared', v_amt, 'xp_cost', v_lost, 'profile', private.profile_snapshot(v_uid));
end $$;

-- Pick a difficulty. First pick is free; afterwards a 7-day cooldown applies and Hell is a
-- 30-day lock-in (previously nothing stopped you flipping to Easy to dodge a penalty).
create or replace function public.select_mode(p_mode text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); p public.user_profiles; cfg public.game_modes; v_end timestamptz;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  select * into cfg from public.game_modes where name = p_mode;
  if not found then perform private.fail('INVALID_MODE', 'Unknown difficulty mode.'); end if;

  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;

  if p.mode_selected_at is not null then
    if p.current_mode = p_mode then
      return jsonb_build_object('ok', true, 'changed', false, 'profile', private.profile_snapshot(v_uid));
    end if;
    if p.current_mode = 'Hell' and p.season_end_date is not null and p.season_end_date > now() then
      perform private.fail('HELL_LOCK_IN', format('Hell is a 30-day lock-in. It ends on %s.', to_char(p.season_end_date, 'YYYY-MM-DD')));
    end if;
    if p.last_mode_switch is not null and p.last_mode_switch > now() - make_interval(days => cfg.switch_cooldown_days) then
      perform private.fail('MODE_COOLDOWN', format('You can switch modes again on %s.',
        to_char(p.last_mode_switch + make_interval(days => cfg.switch_cooldown_days), 'YYYY-MM-DD')));
    end if;
  end if;

  v_end := case when cfg.season_days is not null then now() + make_interval(days => cfg.season_days) end;

  update public.season_records set end_date = now(), final_xp = coalesce(p.total_points, 0), status = 'completed'
   where user_id = v_uid and status = 'active';
  insert into public.season_records (user_id, mode, start_date, end_date, status)
  values (v_uid, p_mode, now(), v_end, 'active');

  update public.user_profiles
     set current_mode = p_mode, season_end_date = v_end, last_mode_switch = now(),
         mode_selected_at = coalesce(mode_selected_at, now())
   where user_id = v_uid;

  perform private.refresh_progression(v_uid);
  return jsonb_build_object('ok', true, 'changed', true, 'season_end_date', v_end, 'profile', private.profile_snapshot(v_uid));
end $$;

-- One call that replaces the Dashboard's ~25-roundtrip waterfall (sweeps, 12 parallel
-- queries, per-row UPDATE loops, `select *` over every task ever created).
create or replace function public.get_dashboard() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); p public.user_profiles; cfg public.game_modes; v_today date;
  v_flow integer; v_c7 integer; v_f7 integer; v_pend integer; v_avg numeric; v_rating double precision;
  v_guild jsonb;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;
  if not found then return jsonb_build_object('profile_missing', true); end if;

  cfg := private.cfg(p.current_mode);
  v_today := private.today_for(v_uid);

  select count(*) into v_flow from public.xp_events
   where user_id = v_uid and kind = 'complete' and counts_weekly and created_at > now() - interval '90 minutes';

  -- Playmaker rating: 40% completion rate, 30% avg XP, 20% streak (30d cap), 10% ego.
  select count(*) filter (where is_completed and not is_failed), count(*) filter (where is_failed)
    into v_c7, v_f7 from public.tasks
   where user_id = v_uid and completed_at > now() - interval '7 days';
  select count(*) into v_pend from public.tasks where user_id = v_uid and is_pending and not is_completed;
  select coalesce(avg(raw), 0) into v_avg from public.xp_events
   where user_id = v_uid and kind = 'complete' and created_at > now() - interval '7 days';
  v_rating := case when (v_c7 + v_f7 + v_pend) = 0 then 0 else
      round(((v_c7::numeric / (v_c7 + v_f7 + v_pend)) * 100 * 0.4 + least(100, v_avg) * 0.3
             + least(100, coalesce(p.streak_count, 0) / 30.0 * 100) * 0.2 + least(100, coalesce(p.ego_score, 0)) * 0.1) * 10) / 10 end;

  update public.user_profiles set last_heartbeat = now(),
         playmaker_rating = case when playmaker_rating is distinct from v_rating then v_rating else playmaker_rating end
   where user_id = v_uid;

  select jsonb_build_object('id', g.id, 'name', g.name) into v_guild
    from public.guilds g where g.id = p.guild_id;

  return jsonb_build_object(
    'activeCount',    (select count(*) from public.tasks where user_id = v_uid and not is_completed and not is_pending and not is_failed),
    'pendingCount',   v_pend,
    'completedCount', (select count(*) from public.tasks where user_id = v_uid and is_completed and not is_failed
                          and (completed_at at time zone p.timezone)::date = v_today),
    'failedCount',    (select count(*) from public.tasks where user_id = v_uid and is_failed
                          and (completed_at at time zone p.timezone)::date = v_today),
    'totalXp', coalesce(p.total_points, 0), 'total_points', coalesce(p.total_points, 0),
    'spent_xp', p.spent_xp, 'standing_xp', p.standing_xp,
    'level', p.level, 'streak_count', coalesce(p.streak_count, 0),
    'player_rank', p.player_rank, 'player_title', p.player_title, 'status', p.status,
    'dark_mana', coalesce(p.dark_mana, 0), 'current_mode', p.current_mode, 'ego_score', coalesce(p.ego_score, 0),
    'season_end_date', p.season_end_date, 'playmaker_rating', coalesce(v_rating, 0),
    'last_heartbeat', now(), 'timezone', p.timezone,
    'needs_mode_selection', p.mode_selected_at is null,
    'guild', v_guild, 'guild_title', p.guild_title,
    'domain_physical', coalesce(p.domain_physical, 10), 'domain_mind', coalesce(p.domain_mind, 10),
    'domain_soul', coalesce(p.domain_soul, 10), 'domain_execution', coalesce(p.domain_execution, 10),
    'domain_builder', coalesce(p.domain_builder, 10),
    'weekly_xp', private.weekly_xp(v_uid), 'weekly_target', cfg.stagnant_threshold,
    'flow', jsonb_build_object('count', v_flow, 'active', v_flow >= 5),
    'weeklyHistory', (select coalesce(jsonb_agg(jsonb_build_object('date', to_char(dd, 'YYYY-MM-DD'), 'daily_points', coalesce(up.daily_points, 0)) order by dd), '[]'::jsonb)
                        from (select v_today - 6 + i as dd from generate_series(0, 6) i) days
                        left join public.user_points up on up.user_id = v_uid and up.date = days.dd),
    'monthlyHistory', (select coalesce(jsonb_agg(jsonb_build_object('date', to_char(dd, 'YYYY-MM-DD'), 'daily_points', coalesce(up.daily_points, 0)) order by dd), '[]'::jsonb)
                        from (select v_today - 29 + i as dd from generate_series(0, 29) i) days
                        left join public.user_points up on up.user_id = v_uid and up.date = days.dd),
    'categoryDistribution', (select coalesce(jsonb_agg(jsonb_build_object('category', cat, 'points', pts) order by pts desc), '[]'::jsonb)
                               from (select coalesce(meta ->> 'category', 'General') as cat, sum(raw)::integer as pts
                                       from public.xp_events
                                      where user_id = v_uid and kind = 'complete' and created_at > now() - interval '30 days'
                                      group by 1) c),
    'activeTasks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
                      select id, title, is_completed, is_pending, is_failed, is_active, started_at, priority, xp_tier,
                             category, time, points, deadline
                        from public.tasks
                       where user_id = v_uid and not is_completed and not is_pending
                       order by created_at desc limit 10) x),
    'completedTasks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
                      select id, title, coalesce(nullif(xp_awarded, 0), points) as points, completed_at
                        from public.tasks
                       where user_id = v_uid and is_completed and not is_failed
                       order by completed_at desc nulls last limit 5) x),
    'clanMembers', (select coalesce(jsonb_agg(jsonb_build_object('clan_id', cm.clan_id, 'role', cm.role,
                                'clans', jsonb_build_object('id', c.id, 'name', c.name))), '[]'::jsonb)
                      from public.clan_members cm join public.clans c on c.id = cm.clan_id where cm.user_id = v_uid),
    'shadows', (select coalesce(jsonb_agg(to_jsonb(s) order by s.bonus_value desc nulls last), '[]'::jsonb)
                  from public.shadows s where s.user_id = v_uid)
  );
end $$;

-- System-gate manifestation. This used to run (and race, creating duplicates) inside every
-- page load. Now it is one idempotent call: at most one open gate per clause.
create or replace function public.sync_system_gates() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); p public.user_profiles; v_today date; v_trial uuid;
begin
  if v_uid is null then return; end if;
  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;
  v_today := private.today_for(v_uid);

  -- 1. Penalty Zone: Dark Mana debt while in PENALTY.
  if coalesce(p.dark_mana, 0) > 0 and p.status = 'PENALTY'
     and not exists (select 1 from public.tasks where user_id = v_uid and is_system_generated and not is_completed
                       and not is_failed and title = '🚨 PENALTY: Penalty Zone: Physical Trial') then
    insert into public.tasks (user_id, assigned_to, created_by, title, category, points, xp_tier, priority,
                              is_system_generated, description, deadline)
    values (v_uid, v_uid, v_uid, '🚨 PENALTY: Penalty Zone: Physical Trial', 'Punishment', 25, 'High', 'URGENT', true,
            'SYSTEM: Clear your Dark Mana debt through physical discipline. 100 Pushups, 100 Situps, 100 Squats, 10km Run.',
            v_today + 1);
  end if;

  -- 2. Weekly Trial: one per rolling 7 days, only once the hunter has conquered at least one
  --    gate (a Legendary trial in someone's very first session is noise, not a challenge).
  if exists (select 1 from public.tasks where user_id = v_uid and is_completed and not is_failed and not is_system_generated)
     and not exists (select 1 from public.tasks where user_id = v_uid and is_weekly_trial and created_at > now() - interval '7 days') then
    insert into public.tasks (user_id, assigned_to, created_by, title, category, points, xp_tier, priority,
                              is_system_generated, is_weekly_trial, description, deadline)
    values (v_uid, v_uid, v_uid,
            case when coalesce(p.streak_count, 0) > 0 and p.streak_count % 7 = 0
                 then format('Weekly Trial: [SYSTEM_SURVIVAL_TEST] - Day %s', p.streak_count)
                 else 'Weekly Trial: [SYSTEM_SURVIVAL_TEST]' end,
            'General', 100, 'Legendary', 'URGENT', true, true,
            'The System demands proof of growth. Manifest and conquer 3 nested objectives to unlock the Boss Chamber.',
            v_today + 7)
    returning id into v_trial;

    insert into public.tasks (user_id, assigned_to, created_by, parent_id, title, description, category, points,
                              xp_tier, priority, is_system_generated)
    select v_uid, v_uid, v_uid, v_trial, s.title, s.descr, 'General', s.pts, 'High', 'High', true
      from (values ('Phase 1: [IDENTIFY_WEAKNESS]',     'Define the core obstacle you will overcome this week.', 15),
                   ('Phase 2: [EXECUTION_CHAMBER]',     'Perform the primary labor required for growth.', 25),
                   ('Phase 3: [LIMIT_BREAK_PROTOCOL]',  'Push beyond your comfort zone to finalize the trial.', 50)) s(title, descr, pts);
  end if;

  -- 3. Ego Stabilization: S-rank hunters who have gone STAGNANT.
  if p.player_rank = 'S' and p.status = 'STAGNANT'
     and not exists (select 1 from public.tasks where user_id = v_uid and is_system_generated and not is_completed
                       and not is_failed and title = '🌀 Monarch''s Trial: [EGO_STABILIZATION]') then
    insert into public.tasks (user_id, assigned_to, created_by, title, category, points, xp_tier, priority,
                              is_system_generated, description, deadline)
    values (v_uid, v_uid, v_uid, '🌀 Monarch''s Trial: [EGO_STABILIZATION]', 'Mindfulness', 35, 'Super', 'High', true,
            'SYSTEM: Your S-Rank ego is destabilizing. Realign your focus through deep work or meditation.', v_today + 3);
  end if;
end $$;
