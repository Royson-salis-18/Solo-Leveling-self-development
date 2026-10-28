-- ============================================================================
-- 09 · BEHAVIOUR ENGINE
-- Mechanics taken from the self-regulation literature rather than from casino design.
-- Every rule here is server-side, idempotent and bounded; the client only displays it.
--
--   gate plans      if-then cue · obstacle → fallback · temptation pairing     (implementation intentions, WOOP)
--   lapse diagnosis one question after a miss: what actually got in the way?    (troubleshooting, not shame)
--   reflection      one minute at the end of the day                            (learning by thinking)
--   pledges         stake XP on a gate; keep it and it returns with a dividend  (commitment device, loss aversion)
--   insights        what the player's own history says works for them           (self-perception, calibration)
--
-- Deliberately NOT here: XP for reflecting or planning. Paying for an activity people would do anyway
-- can erode the motivation behind it, so those get feedback in words, not points.
-- ============================================================================

-- ── schema ───────────────────────────────────────────────────────────────────
alter table public.xp_events drop constraint if exists xp_events_kind_check;
alter table public.xp_events add constraint xp_events_kind_check check (kind in
  ('complete','burst','arise','fail','decay','postpone','redeem','reward_claim','admin',
   'bounty','achievement','boss','referral','pledge'));

alter table public.tasks add column if not exists plan jsonb;
alter table public.tasks drop constraint if exists tasks_plan_is_object;
alter table public.tasks add constraint tasks_plan_is_object check (plan is null or jsonb_typeof(plan) = 'object');

create table if not exists public.gate_lapses (
  task_id    uuid primary key references public.tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  reason     text not null check (reason in ('too_big','forgot','low_energy','distracted','unclear','no_time','other')),
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists gate_lapses_user_idx on public.gate_lapses (user_id, created_at desc);

create table if not exists public.reflections (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  worked     text,
  change     text,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- task_id goes NULL if the gate is deleted: deleting a pledged gate is not a way out of the pledge.
create table if not exists public.gate_pledges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid references public.tasks(id) on delete set null,
  title      text not null,
  stake      integer not null check (stake in (5, 10, 20)),
  status     text not null default 'open' check (status in ('open','kept','forfeited')),
  dividend   integer not null default 0,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create unique index if not exists gate_pledges_one_per_task on public.gate_pledges (task_id) where task_id is not null;
create index if not exists gate_pledges_user_idx on public.gate_pledges (user_id, status, created_at desc);

alter table public.gate_lapses enable row level security;
alter table public.reflections enable row level security;
alter table public.gate_pledges enable row level security;
revoke all on public.gate_lapses, public.reflections, public.gate_pledges from public, anon, authenticated;
grant select on public.gate_lapses, public.reflections, public.gate_pledges to authenticated;
drop policy if exists gate_lapses_select_own on public.gate_lapses;
drop policy if exists reflections_select_own on public.reflections;
drop policy if exists gate_pledges_select_own on public.gate_pledges;
create policy gate_lapses_select_own on public.gate_lapses for select to authenticated using (user_id = auth.uid());
create policy reflections_select_own on public.reflections for select to authenticated using (user_id = auth.uid());
create policy gate_pledges_select_own on public.gate_pledges for select to authenticated using (user_id = auth.uid());

-- ── gate plan ────────────────────────────────────────────────────────────────
-- cue     "After breakfast, at my desk"      WHEN/WHERE it starts         (implementation intention)
-- obstacle "I'll be tired after work"         what is most likely to stop it (mental contrasting)
-- then    "I'll do just the first 2 minutes"  the pre-decided response
-- pair    "Podcast"                           a treat allowed only during this gate (temptation bundling)
create or replace function public.set_gate_plan(p_task uuid, p_plan jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); t public.tasks; v_plan jsonb := '{}'::jsonb; v_val text; k text; v_len integer;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if p_plan is not null and jsonb_typeof(p_plan) <> 'object' then
    perform private.fail('INVALID_INPUT', 'Malformed plan.');
  end if;
  select * into t from public.tasks where id = p_task for update;
  if not found or t.user_id <> v_uid then perform private.fail('GATE_NOT_FOUND', 'That gate does not exist.'); end if;
  if t.is_completed then perform private.fail('GATE_CLOSED', 'This gate is already resolved.'); end if;

  foreach k in array array['cue', 'obstacle', 'then', 'pair'] loop
    v_len := case k when 'then' then 160 when 'pair' then 80 else 120 end;
    v_val := left(btrim(coalesce(p_plan ->> k, '')), v_len);
    if v_val <> '' then v_plan := v_plan || jsonb_build_object(k, v_val); end if;
  end loop;

  update public.tasks set plan = nullif(v_plan, '{}'::jsonb) where id = p_task;
  return jsonb_build_object('ok', true, 'plan', nullif(v_plan, '{}'::jsonb));
end $$;

-- ── lapse diagnosis ──────────────────────────────────────────────────────────
-- A miss is information. One tap says what got in the way, and the app answers with a fix
-- (smaller step, a cue, a different time) instead of a penalty speech. One diagnosis per gate.
create or replace function public.log_lapse(p_task uuid, p_reason text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); t public.tasks; v_today date;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if p_reason is null or p_reason not in ('too_big','forgot','low_energy','distracted','unclear','no_time','other') then
    perform private.fail('INVALID_REASON', 'Pick one of the listed reasons.');
  end if;
  perform private.tick_user(v_uid);
  select * into t from public.tasks where id = p_task;
  if not found or t.user_id <> v_uid then perform private.fail('GATE_NOT_FOUND', 'That gate does not exist.'); end if;
  v_today := private.today_for(v_uid);
  if not (coalesce(t.is_failed, false) or coalesce(t.is_pending, false) or (not t.is_completed and t.deadline is not null and t.deadline < v_today)) then
    perform private.fail('NOT_MISSED', 'Only a missed gate can be diagnosed.');
  end if;
  insert into public.gate_lapses (task_id, user_id, reason, note)
  values (p_task, v_uid, p_reason, nullif(left(btrim(coalesce(p_note, '')), 240), ''))
  on conflict (task_id) do update set reason = excluded.reason, note = excluded.note;
  return jsonb_build_object('ok', true, 'reason', p_reason, 'tier', t.xp_tier, 'category', t.category,
                            'title', t.title, 'had_plan', t.plan is not null);
end $$;

-- ── daily reflection ─────────────────────────────────────────────────────────
create or replace function public.save_reflection(p_worked text, p_change text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_day date; v_w text; v_c text; v_first boolean; v_days integer;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  v_w := nullif(left(btrim(coalesce(p_worked, '')), 400), '');
  v_c := nullif(left(btrim(coalesce(p_change, '')), 400), '');
  if v_w is null and v_c is null then perform private.fail('EMPTY_REFLECTION', 'Write one line, even a short one.'); end if;
  v_day := private.today_for(v_uid);
  v_first := not exists (select 1 from public.reflections where user_id = v_uid and day = v_day);
  insert into public.reflections (user_id, day, worked, change) values (v_uid, v_day, v_w, v_c)
  on conflict (user_id, day) do update set worked = excluded.worked, change = excluded.change;
  select count(*) into v_days from public.reflections where user_id = v_uid and day > v_day - 14;
  return jsonb_build_object('ok', true, 'first_today', v_first, 'days_14', v_days);
end $$;

-- ── pledges ──────────────────────────────────────────────────────────────────
-- Stake 5 / 10 / 20 XP on a C-rank-or-higher gate that has a deadline. The stake is escrowed
-- (moved from total_points to spent_xp, so level and rank do not move). Conquer the gate and it comes back
-- with a small dividend; miss the deadline, abandon or delete it and the stake is gone.
-- No dividend on easy or deadline-less gates and at most two open pledges, so it cannot be farmed.
create or replace function private.pledge_dividend(p_stake integer) returns integer
language sql immutable as $$ select least(5, greatest(1, p_stake / 4)) $$;

create or replace function private.settle_pledges(p_uid uuid) returns jsonb
language plpgsql as $$
declare
  r record; v_today date; v_kept jsonb := '[]'::jsonb; v_lost jsonb := '[]'::jsonb; v_div integer; v_id uuid;
begin
  -- profile lock first (global lock order)
  perform 1 from public.user_profiles where user_id = p_uid for update;
  v_today := private.today_for(p_uid);

  for r in
    select g.id, g.stake, g.title, g.task_id,
           case when t.id is null then 'forfeit'
                when t.is_completed and not coalesce(t.is_failed, false) then 'keep'
                when coalesce(t.is_failed, false) then 'forfeit'
                when t.deadline is not null and t.deadline < v_today then 'forfeit'
                else null end as verdict
      from public.gate_pledges g
      left join public.tasks t on t.id = g.task_id
     where g.user_id = p_uid and g.status = 'open'
  loop
    continue when r.verdict is null;
    v_id := null;
    -- claim the row first: whoever flips the status owns the settlement, so a repeat call pays nothing twice
    update public.gate_pledges set status = case r.verdict when 'keep' then 'kept' else 'forfeited' end, settled_at = now()
     where id = r.id and status = 'open' returning id into v_id;
    continue when v_id is null;

    if r.verdict = 'keep' then
      v_div := private.pledge_dividend(r.stake);
      update public.user_profiles set total_points = coalesce(total_points, 0) + r.stake,
                                      spent_xp = greatest(0, spent_xp - r.stake) where user_id = p_uid;
      update public.gate_pledges set dividend = v_div where id = r.id;
      perform private.grant_xp(p_uid, 'pledge', v_div, jsonb_build_object('title', r.title, 'stake', r.stake));
      perform private.notify(p_uid, '🤝 PLEDGE KEPT', format('“%s”. %s XP returned plus %s dividend.', left(r.title, 60), r.stake, v_div), 'achievement', '/dungeon-gate');
      v_kept := v_kept || jsonb_build_object('title', r.title, 'stake', r.stake, 'dividend', v_div);
    else
      perform private.notify(p_uid, '🕯️ PLEDGE LET GO',
        format('“%s” slipped, and %s XP went with it. It happens. Decide what you would change, then pledge again when you are ready.', left(r.title, 60), r.stake),
        'system', '/dungeon-gate');
      v_lost := v_lost || jsonb_build_object('title', r.title, 'stake', r.stake);
    end if;
  end loop;
  return jsonb_build_object('kept', v_kept, 'forfeited', v_lost);
end $$;

create or replace function public.pledge_gate(p_task uuid, p_stake integer) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); t public.tasks; p public.user_profiles; v_today date; v_open integer;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if p_stake is null or p_stake not in (5, 10, 20) then perform private.fail('INVALID_STAKE', 'Stake 5, 10 or 20 XP.'); end if;
  perform private.tick_user(v_uid);
  perform private.settle_pledges(v_uid);
  select * into p from public.user_profiles where user_id = v_uid for update;
  select * into t from public.tasks where id = p_task for update;
  if not found or t.user_id <> v_uid then perform private.fail('GATE_NOT_FOUND', 'That gate does not exist.'); end if;
  v_today := private.today_for(v_uid);
  if t.is_completed or coalesce(t.is_failed, false) then perform private.fail('GATE_CLOSED', 'This gate is already resolved.'); end if;
  if t.deadline is null or t.deadline < v_today then perform private.fail('PLEDGE_NEEDS_DEADLINE', 'A pledge needs a deadline that has not passed.'); end if;
  if coalesce(t.xp_tier, 'Low') = 'Low' then perform private.fail('PLEDGE_TOO_EASY', 'Pledges are for C-rank gates and above.'); end if;
  if exists (select 1 from public.gate_pledges where task_id = p_task) then perform private.fail('ALREADY_PLEDGED', 'This gate already carries a pledge.'); end if;
  select count(*) into v_open from public.gate_pledges where user_id = v_uid and status = 'open';
  if v_open >= 2 then perform private.fail('TOO_MANY_PLEDGES', 'Two open pledges at a time. Keep one first.'); end if;
  if coalesce(p.total_points, 0) < p_stake then perform private.fail('INSUFFICIENT_XP', 'You need the XP in hand to stake it.'); end if;

  update public.user_profiles set total_points = total_points - p_stake, spent_xp = spent_xp + p_stake where user_id = v_uid;
  insert into public.gate_pledges (user_id, task_id, title, stake) values (v_uid, p_task, t.title, p_stake);
  return jsonb_build_object('ok', true, 'stake', p_stake, 'dividend', private.pledge_dividend(p_stake), 'profile', private.profile_snapshot(v_uid));
end $$;

-- A conquest settles any pledge it satisfied, inside the same transaction as the payout.
do $$
begin
  if not exists (select 1 from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
                  where n.nspname = 'private' and pr.proname = 'after_conquest_base') then
    alter function private.after_conquest(uuid, uuid, boolean, integer, text, integer) rename to after_conquest_base;
  end if;
end $$;

create or replace function private.after_conquest(p_uid uuid, p_task uuid, p_first boolean, p_xp integer,
                                                  p_tier text, p_streak integer) returns jsonb
language plpgsql as $$
declare v_base jsonb; v_pledge jsonb;
begin
  v_base := private.after_conquest_base(p_uid, p_task, p_first, p_xp, p_tier, p_streak);
  v_pledge := private.settle_pledges(p_uid);
  return v_base || jsonb_build_object('pledge', v_pledge);
end $$;

-- ── insights + state, one round trip ─────────────────────────────────────────
create or replace function public.get_behavior(p_days integer default 60) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); p public.user_profiles; v_today date; v_n integer; v_since timestamptz;
  v_plan jsonb; v_hours jsonb; v_wd jsonb; v_tiers jsonb; v_recent jsonb; v_lapses jsonb; v_cats jsonb;
  v_last date; v_settled jsonb;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;
  if not found then return jsonb_build_object('profile_missing', true); end if;
  v_settled := private.settle_pledges(v_uid);
  v_today := private.today_for(v_uid);
  v_n := least(greatest(coalesce(p_days, 60), 14), 180);
  v_since := ((v_today - v_n)::timestamp at time zone p.timezone);

  -- Resolved gates in the window: finished, failed, or past their deadline. System-made gates and boss stages are excluded.
  with g as (
    select coalesce(t.xp_tier, 'Low') as tier,
           (t.is_completed and not coalesce(t.is_failed, false)) as done,
           coalesce((t.plan ->> 'cue') is not null or (t.plan ->> 'then') is not null, false) as planned,
           t.created_at
      from public.tasks t
     where t.user_id = v_uid and t.created_at >= v_since
       and not coalesce(t.is_system_generated, false) and t.parent_id is null
       and (t.is_completed or (t.deadline is not null and t.deadline < v_today)))
  select
    (select jsonb_build_object(
        'planned',   jsonb_build_object('n', count(*) filter (where planned),     'done', count(*) filter (where planned and done)),
        'unplanned', jsonb_build_object('n', count(*) filter (where not planned), 'done', count(*) filter (where not planned and done)),
        'n', count(*), 'done', count(*) filter (where done)) from g),
    (select coalesce(jsonb_object_agg(tier, jsonb_build_object('n', n, 'done', d)), '{}'::jsonb)
       from (select tier, count(*) n, count(*) filter (where done) d from g group by tier) x),
    (select jsonb_build_object('n', count(*), 'done', count(*) filter (where done),
              'hard_n', count(*) filter (where tier <> 'Low'), 'hard_done', count(*) filter (where tier <> 'Low' and done))
       from (select * from g order by created_at desc limit 14) r)
  into v_plan, v_tiers, v_recent;

  select jsonb_agg(coalesce(c.n, 0) order by h.h) into v_hours
    from generate_series(0, 23) h(h)
    left join (select extract(hour from created_at at time zone p.timezone)::integer as h, count(*)::integer n
                 from public.xp_events where user_id = v_uid and kind = 'complete' and created_at >= v_since group by 1) c on c.h = h.h;

  select jsonb_agg(coalesce(c.n, 0) order by d.d) into v_wd
    from generate_series(0, 6) d(d)
    left join (select extract(dow from created_at at time zone p.timezone)::integer as d, count(*)::integer n
                 from public.xp_events where user_id = v_uid and kind = 'complete' and created_at >= v_since group by 1) c on c.d = d.d;

  select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'n', n) order by n desc), '[]'::jsonb) into v_lapses
    from (select reason, count(*)::integer n from public.gate_lapses where user_id = v_uid and created_at >= v_since group by reason) l;

  select coalesce(jsonb_agg(jsonb_build_object('category', cat, 'n', n) order by n desc), '[]'::jsonb) into v_cats
    from (select meta ->> 'category' as cat, count(*)::integer n from public.xp_events
           where user_id = v_uid and kind = 'complete' and meta ->> 'category' is not null group by 1 order by 2 desc limit 24) c;

  select max(date) into v_last from public.user_points where user_id = v_uid and daily_points > 0;

  return jsonb_build_object(
    'today', to_char(v_today, 'YYYY-MM-DD'),
    'dow', extract(dow from v_today)::integer,
    'dom', extract(day from v_today)::integer,
    'window_days', v_n,
    'plan_effect', v_plan, 'tiers', v_tiers, 'recent', v_recent,
    'hours', v_hours, 'weekdays', v_wd, 'lapses', v_lapses, 'categories', v_cats,
    'settled', v_settled,
    'pledges', jsonb_build_object(
      'open', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'task_id', g.task_id, 'title', g.title, 'stake', g.stake,
                      'dividend', private.pledge_dividend(g.stake), 'deadline', t.deadline) order by g.created_at), '[]'::jsonb)
                 from public.gate_pledges g left join public.tasks t on t.id = g.task_id where g.user_id = v_uid and g.status = 'open'),
      'kept_total',      (select count(*) from public.gate_pledges where user_id = v_uid and status = 'kept'),
      'forfeited_total', (select count(*) from public.gate_pledges where user_id = v_uid and status = 'forfeited')),
    'unexamined', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'tier', t.xp_tier, 'category', t.category,
                          'deadline', t.deadline, 'had_plan', t.plan is not null) order by t.created_at desc), '[]'::jsonb)
                     from (select * from public.tasks
                            where user_id = v_uid and created_at >= now() - interval '14 days'
                              and not coalesce(is_system_generated, false) and parent_id is null
                              and (coalesce(is_failed, false) or coalesce(is_pending, false) or (not is_completed and deadline is not null and deadline < v_today))
                              and not exists (select 1 from public.gate_lapses l where l.task_id = tasks.id)
                            order by created_at desc limit 3) t),
    'reflection', jsonb_build_object(
      'today', exists (select 1 from public.reflections where user_id = v_uid and day = v_today),
      'days_14', (select count(*) from public.reflections where user_id = v_uid and day > v_today - 14),
      'last', (select jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'change', change)
                 from public.reflections where user_id = v_uid and change is not null and day < v_today order by day desc limit 1)),
    'rhythm', jsonb_build_object(
      'days_since_conquest', case when v_last is null then null else v_today - v_last end,
      'this_week_xp', (select coalesce(sum(greatest(daily_points, 0)), 0) from public.user_points where user_id = v_uid and date > v_today - 7),
      'prev_week_xp', (select coalesce(sum(greatest(daily_points, 0)), 0) from public.user_points where user_id = v_uid and date <= v_today - 7 and date > v_today - 14),
      'streak', coalesce(p.streak_count, 0), 'best_streak', coalesce(p.best_streak, 0)));
end $$;

revoke all on function public.set_gate_plan(uuid, jsonb), public.log_lapse(uuid, text, text), public.save_reflection(text, text),
  public.pledge_gate(uuid, integer), public.get_behavior(integer) from public, anon, authenticated;
grant execute on function public.set_gate_plan(uuid, jsonb), public.log_lapse(uuid, text, text), public.save_reflection(text, text),
  public.pledge_gate(uuid, integer), public.get_behavior(integer) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_friend(uuid, uuid), private.is_clan_officer(uuid, uuid), private.is_clan_member(uuid, uuid),
  private.is_guild_officer(uuid, uuid), private.is_guild_member(uuid, uuid)
  to authenticated;
