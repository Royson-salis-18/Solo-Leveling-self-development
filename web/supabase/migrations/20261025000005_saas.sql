-- ============================================================================
-- 05 · SaaS LAYER  (plans, subscriptions, usage quotas, data export & deletion)
--
-- Billing-provider-agnostic. A provider webhook (see supabase/functions/stripe-webhook)
-- writes `subscriptions` using the service role; the app only ever READS entitlements.
-- Absent subscription row == Free plan.
--
-- Pricing and limits are DATA, not code: edit the `plans` rows, no deploy needed.
-- A NULL / missing limit key means "unlimited".
-- ============================================================================

create table if not exists public.plans (
  id                   text primary key,
  name                 text not null,
  description          text not null default '',
  price_cents_monthly  integer not null default 0,
  price_cents_yearly   integer,
  limits               jsonb not null default '{}'::jsonb,
  features             jsonb not null default '[]'::jsonb,
  sort_order           integer not null default 0,
  is_public            boolean not null default true
);

-- Placeholder pricing/limits — product decisions for the owner to tune.
insert into public.plans (id, name, description, price_cents_monthly, price_cents_yearly, limits, features, sort_order) values
  ('free', 'Free', 'Everything you need to build the habit.', 0, 0,
   '{"max_active_gates": 25, "ai_messages_per_day": 5, "can_create_groups": 0}',
   '["Up to 25 active gates","All four difficulty modes","Streaks, ranks, shadows & rewards","5 Oracle AI messages / day","Join clans & guilds by invitation"]', 1),
  ('pro', 'Pro', 'For hunters who want the full System.', 700, 6000,
   '{"ai_messages_per_day": 100, "can_create_groups": 1}',
   '["Unlimited active gates","100 Oracle AI messages / day","Create your own clan & guild","Priority support","Early access to new features"]', 2)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, features = excluded.features, sort_order = excluded.sort_order;
-- (prices/limits of existing rows are deliberately NOT overwritten on re-run, so edits stick)

create table if not exists public.subscriptions (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  plan_id                   text not null default 'free' references public.plans(id),
  status                    text not null default 'active'
                              check (status in ('active','trialing','past_due','canceled','incomplete')),
  provider                  text,
  provider_customer_id      text,
  provider_subscription_id  text,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create unique index if not exists subscriptions_provider_sub_idx
  on public.subscriptions (provider, provider_subscription_id) where provider_subscription_id is not null;
create index if not exists subscriptions_customer_idx on public.subscriptions (provider, provider_customer_id);

create table if not exists public.usage_counters (
  user_id  uuid not null references auth.users(id) on delete cascade,
  metric   text not null,
  period   date not null,
  count    integer not null default 0,
  primary key (user_id, metric, period)
);

alter table public.plans          enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.usage_counters enable row level security;

do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename in ('plans','subscriptions','usage_counters') loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

revoke all on public.plans, public.subscriptions, public.usage_counters from anon, authenticated;
-- Pricing is public (the landing page reads it before sign-in).
grant select on public.plans to anon, authenticated;
create policy plans_public on public.plans for select to anon, authenticated using (is_public);
grant select on public.subscriptions, public.usage_counters to authenticated;
create policy subs_select_own  on public.subscriptions  for select to authenticated using (user_id = auth.uid());
create policy usage_select_own on public.usage_counters for select to authenticated using (user_id = auth.uid());

-- ── entitlement helpers ──────────────────────────────────────────────────────

-- Which plan applies right now. A lapsed paid plan falls back to Free after a 3-day grace.
create or replace function private.plan_id(p_uid uuid) returns text
language sql stable as $$
  select coalesce((
    select s.plan_id from public.subscriptions s
     where s.user_id = p_uid and s.plan_id <> 'free'
       and s.status in ('active', 'trialing', 'past_due')
       and (s.current_period_end is null or s.current_period_end > now() - interval '3 days')), 'free')
$$;

-- Replaces the "unlimited" stub from 02. NULL = unlimited.
create or replace function private.plan_limit(p_uid uuid, p_key text) returns integer
language sql stable as $$
  select (limits ->> p_key)::integer from public.plans where id = private.plan_id(p_uid)
$$;

-- Atomically spend one unit of a daily quota. Never exceeds the limit, even under concurrency.
create or replace function private.consume_usage(p_uid uuid, p_metric text, p_limit integer) returns integer
language plpgsql as $$
declare v_count integer;
begin
  insert into public.usage_counters as u (user_id, metric, period, count)
  values (p_uid, p_metric, private.today_for(p_uid), 1)
  on conflict (user_id, metric, period)
  do update set count = u.count + 1 where p_limit is null or u.count < p_limit
  returning count into v_count;
  return v_count;                      -- NULL when the limit was already reached
end $$;

create or replace function public.get_entitlements() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_plan text; pl public.plans; s public.subscriptions;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  v_plan := private.plan_id(v_uid);
  select * into pl from public.plans where id = v_plan;
  select * into s from public.subscriptions where user_id = v_uid;
  return jsonb_build_object(
    'plan', jsonb_build_object('id', pl.id, 'name', pl.name),
    'limits', pl.limits,
    'status', coalesce(s.status, 'active'),
    'current_period_end', s.current_period_end,
    'cancel_at_period_end', coalesce(s.cancel_at_period_end, false),
    'usage', jsonb_build_object(
      'ai_messages_today', coalesce((select count from public.usage_counters
                                      where user_id = v_uid and metric = 'ai_messages' and period = private.today_for(v_uid)), 0),
      'active_gates', (select count(*) from public.tasks where user_id = v_uid and not is_completed and not is_failed)));
end $$;

-- Called by the AI proxy (with the player's own JWT) before it spends money on a model call.
create or replace function public.consume_ai_message() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_limit integer; v_used integer;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  v_limit := private.plan_limit(v_uid, 'ai_messages_per_day');
  v_used  := private.consume_usage(v_uid, 'ai_messages', v_limit);
  if v_used is null then
    return jsonb_build_object('allowed', false, 'limit', v_limit, 'used', v_limit);
  end if;
  return jsonb_build_object('allowed', true, 'limit', v_limit, 'used', v_used);
end $$;

-- ── data portability & erasure ───────────────────────────────────────────────

create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile',        (select to_jsonb(p) from public.user_profiles p where p.user_id = v_uid),
    'tasks',          coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.tasks t where t.user_id = v_uid or t.assigned_to = v_uid), '[]'),
    'xp_events',      coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.xp_events e where e.user_id = v_uid), '[]'),
    'daily_points',   coalesce((select jsonb_agg(to_jsonb(d) order by d.date) from public.user_points d where d.user_id = v_uid), '[]'),
    'rewards',        coalesce((select jsonb_agg(to_jsonb(r)) from public.rewards r where r.user_id = v_uid), '[]'),
    'reward_claims',  coalesce((select jsonb_agg(to_jsonb(r)) from public.reward_claims r where r.user_id = v_uid), '[]'),
    'punishments',    coalesce((select jsonb_agg(to_jsonb(r)) from public.punishments r where r.user_id = v_uid), '[]'),
    'shadows',        coalesce((select jsonb_agg(to_jsonb(s)) from public.shadows s where s.user_id = v_uid), '[]'),
    'inventory',      coalesce((select jsonb_agg(to_jsonb(i)) from public.inventory i where i.user_id = v_uid), '[]'),
    'notifications',  coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at) from public.notifications n where n.user_id = v_uid), '[]'),
    'friendships',    coalesce((select jsonb_agg(to_jsonb(f)) from public.friendship f where f.requester_id = v_uid or f.receiver_id = v_uid), '[]'),
    'messages',       coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.direct_messages m where m.sender_id = v_uid or m.receiver_id = v_uid), '[]'),
    'challenges',     coalesce((select jsonb_agg(to_jsonb(c)) from public.challenges c where c.creator_id = v_uid or c.opponent_id = v_uid), '[]'),
    'seasons',        coalesce((select jsonb_agg(to_jsonb(s)) from public.season_records s where s.user_id = v_uid), '[]'),
    'subscription',   (select to_jsonb(s) - 'provider_customer_id' - 'provider_subscription_id' from public.subscriptions s where s.user_id = v_uid));
end $$;

-- Permanent. Hands clan/guild leadership to the next member first, then removes the auth user,
-- which cascades to every table that references it.
-- NOTE: this does NOT cancel a live Stripe subscription — the app calls the
-- `delete-account` edge function, which cancels billing first and then calls this.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  perform public.leave_clan();
  perform public.leave_guild();
  delete from auth.users where id = v_uid;
end $$;

-- Grants for the functions created in this file (04's blanket loop ran before they existed).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.proname in
           ('get_entitlements','consume_ai_message','export_my_data','delete_my_account')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_friend(uuid, uuid), private.is_clan_officer(uuid, uuid), private.is_clan_member(uuid, uuid),
  private.is_guild_officer(uuid, uuid), private.is_guild_member(uuid, uuid)
  to authenticated;
