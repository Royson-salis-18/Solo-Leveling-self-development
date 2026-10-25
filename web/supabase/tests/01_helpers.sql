-- Test helpers. Tiny assertion library + "log in as" helpers that emulate PostgREST by
-- switching to the `authenticated` role and setting the JWT claims that auth.uid() reads.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Create a user (the sign-up trigger creates the profile). Returns the id.
create or replace function tests.mkuser(p_name text, p_class text default 'Warrior') returns uuid
language plpgsql security definer as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_id, lower(p_name) || '@test.local', jsonb_build_object('name', p_name, 'player_class', p_class));
  return v_id;
end $$;

create or replace function tests.login(p_uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

create or replace function tests.anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  execute 'set role anon';
end $$;

create or replace function tests.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', false);
end $$;

create or replace function tests.eq(p_label text, p_actual anyelement, p_expected anyelement) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL  %  — expected [%] got [%]', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok    %', p_label;
end $$;

-- text overload: two untyped literals (e.g. psql :'var' vs 'true') can't resolve anyelement.
create or replace function tests.eq(p_label text, p_actual text, p_expected text) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL  %  — expected [%] got [%]', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok    %', p_label;
end $$;

create or replace function tests.ok(p_label text, p_cond boolean) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL  %', p_label; end if;
  raise notice 'ok    %', p_label;
end $$;

-- Assert that a statement fails and the error message matches (LIKE pattern).
create or replace function tests.throws(p_label text, p_sql text, p_like text) returns void
language plpgsql as $$
declare v_msg text; v_failed boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    v_failed := true; v_msg := sqlerrm;
  end;
  if not v_failed then raise exception 'FAIL  %  — expected an error like [%] but it succeeded', p_label, p_like; end if;
  if v_msg not like p_like then raise exception 'FAIL  %  — expected error like [%] got [%]', p_label, p_like, v_msg; end if;
  raise notice 'ok    %  (%)', p_label, left(v_msg, 70);
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- Make a task directly (bypasses RPCs) — for arranging test state as superuser.
create or replace function tests.mktask(p_uid uuid, p_title text, p_tier text default 'Mid',
                                        p_category text default 'Fitness', p_deadline date default null) returns uuid
language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into public.tasks (user_id, assigned_to, created_by, title, category, xp_tier, points, deadline)
  values (p_uid, p_uid, p_uid, p_title, p_category, p_tier,
          case p_tier when 'Legendary' then 50 when 'Super' then 35 when 'High' then 25 when 'Mid' then 15 else 5 end,
          p_deadline)
  returning id into v_id;
  return v_id;
end $$;

-- Create a gate through the real RPC, as the currently logged-in user. p_days NULL = no deadline.
create or replace function tests.gate(p_title text, p_tier text default 'Mid', p_category text default 'Fitness',
                                      p_days integer default 2, p_extra jsonb default '{}'::jsonb) returns uuid
language sql as $$
  select (public.save_gate(
            jsonb_build_object('title', p_title, 'xp_tier', p_tier, 'category', p_category,
                               'deadline', ((now() at time zone 'UTC')::date + p_days)) || p_extra) ->> 'id')::uuid
$$;

create or replace function tests.today(p_uid uuid) returns date language sql stable security definer as $$
  select private.today_for(p_uid)
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Rows touched by a statement (a policy-filtered UPDATE/DELETE affects 0 rows without erroring).
create or replace function tests.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;

-- Give a user the Pro plan (bypasses billing; superuser-side fixture).
create or replace function tests.pro(p_uid uuid) returns void language plpgsql security definer as $$
begin
  insert into public.subscriptions (user_id, plan_id, status, provider, current_period_end)
  values (p_uid, 'pro', 'active', 'test', now() + interval '20 days')
  on conflict (user_id) do update set plan_id = 'pro', status = 'active', current_period_end = now() + interval '20 days';
end $$;
grant execute on all functions in schema tests to anon, authenticated;
