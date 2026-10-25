-- ============================================================================
-- SaaS TESTS — plans, quotas, entitlements, export, deletion
-- ============================================================================
create or replace function private.rng() returns double precision language sql volatile as $$ select 0.99999::float8 $$;

select tests.mkuser('Free1') as f \gset
select tests.login(:'f'::uuid); select public.select_mode('Normal');

-- ── entitlements ─────────────────────────────────────────────────────────────
select public.get_entitlements() as ent \gset
select tests.eq('free plan by default', (:'ent'::jsonb #>> '{plan,id}'), 'free');
select tests.eq('free: gate limit visible', (:'ent'::jsonb #>> '{limits,max_active_gates}')::int, 25);
select tests.eq('free: AI limit visible', (:'ent'::jsonb #>> '{limits,ai_messages_per_day}')::int, 5);
select tests.eq('usage starts at zero', (:'ent'::jsonb #>> '{usage,ai_messages_today}')::int, 0);

-- ── plan limit on active gates ───────────────────────────────────────────────
select tests.logout();
insert into public.tasks (user_id, assigned_to, created_by, title, xp_tier, points)
  select :'f', :'f', :'f', 'filler ' || i, 'Low', 5 from generate_series(1, 25) i;
select tests.login(:'f'::uuid);
select tests.throws('free: 26th active gate is refused', $$select tests.gate('one too many', 'Low', 'General', 5)$$, 'PLAN_LIMIT%');
select tests.logout();
select tests.pro(:'f'::uuid);
select tests.login(:'f'::uuid);
select tests.ok('pro: no gate cap', tests.gate('now it works', 'Low', 'General', 5) is not null);
select tests.eq('pro plan reported', (public.get_entitlements() #>> '{plan,id}'), 'pro');

-- ── AI quota (atomic daily counter) ──────────────────────────────────────────
select tests.mkuser('Chatty') as c \gset
select tests.login(:'c'::uuid);
select public.select_mode('Normal');
select count(*) filter (where (public.consume_ai_message() ->> 'allowed')::boolean) as allowed from generate_series(1, 8) \gset
select tests.eq('free: exactly 5 AI messages per day', :'allowed'::int, 5);
select tests.eq('free: the 6th is denied with the limit', (public.consume_ai_message() ->> 'limit')::int, 5);
select tests.eq('usage is counted', (public.get_entitlements() #>> '{usage,ai_messages_today}')::int, 5);
select tests.throws('quota cannot be reset by the client', $$delete from public.usage_counters$$, 'permission denied%');
select tests.throws('quota cannot be edited by the client', $$update public.usage_counters set count = 0$$, 'permission denied%');
select tests.logout();
select tests.pro(:'c'::uuid);
update public.usage_counters set count = 99 where user_id = :'c';
select tests.login(:'c'::uuid);
select tests.eq('pro: 100th message allowed', (public.consume_ai_message() ->> 'allowed'), 'true');
select tests.eq('pro: 101st denied', (public.consume_ai_message() ->> 'allowed'), 'false');

-- ── subscription lifecycle ───────────────────────────────────────────────────
select tests.mkuser('Lapse') as l \gset
select tests.logout();
insert into public.subscriptions (user_id, plan_id, status, current_period_end) values (:'l', 'pro', 'active', now() + interval '5 days');
select tests.eq('active paid plan', private.plan_id(:'l'::uuid), 'pro');
update public.subscriptions set current_period_end = now() - interval '2 days' where user_id = :'l';
select tests.eq('lapsed 2 days: inside the 3-day grace', private.plan_id(:'l'::uuid), 'pro');
update public.subscriptions set current_period_end = now() - interval '4 days' where user_id = :'l';
select tests.eq('lapsed 4 days: back to free', private.plan_id(:'l'::uuid), 'free');
update public.subscriptions set current_period_end = now() + interval '5 days', status = 'canceled' where user_id = :'l';
select tests.eq('canceled: back to free', private.plan_id(:'l'::uuid), 'free');
update public.subscriptions set status = 'past_due' where user_id = :'l';
select tests.eq('past_due keeps access during grace', private.plan_id(:'l'::uuid), 'pro');
update public.subscriptions set status = 'trialing' where user_id = :'l';
select tests.eq('trialing counts as paid', private.plan_id(:'l'::uuid), 'pro');
select tests.eq('plan_limit: NULL means unlimited', private.plan_limit(:'l'::uuid, 'max_active_gates') is null, true);
select tests.eq('plan_limit: free has a numeric limit', private.plan_limit(:'f'::uuid, 'max_active_gates') is null, true);  -- Free1 is Pro now

-- ── plans are data ───────────────────────────────────────────────────────────
update public.plans set limits = jsonb_set(limits, '{ai_messages_per_day}', '7') where id = 'free';
select tests.mkuser('Plain') as p \gset
select tests.login(:'p'::uuid);
select tests.eq('editing a plan row changes behaviour with no deploy', (public.get_entitlements() #>> '{limits,ai_messages_per_day}')::int, 7);
select tests.logout();
update public.plans set limits = jsonb_set(limits, '{ai_messages_per_day}', '5') where id = 'free';

-- ── export & deletion ────────────────────────────────────────────────────────
select tests.mkuser('Leaver') as lv \gset
select tests.mkuser('Heir')   as heir \gset
select tests.pro(:'lv'::uuid);
select tests.login(:'lv'::uuid); select public.select_mode('Normal');
select tests.gate('keepsake', 'Mid', 'Fitness', 2) as ks \gset
select public.complete_gate(:'ks'::uuid);
select (public.create_clan('Leaver''s Legion') ->> 'id') as lclan \gset
select tests.login(:'lv'::uuid);
select public.invite_to_clan(:'heir'::uuid);
select tests.logout();
select id as linv from public.clan_invites where invitee_id = :'heir' \gset
select tests.login(:'heir'::uuid); select public.select_mode('Normal');
select public.respond_clan_invite(:'linv'::uuid, true);

select tests.login(:'lv'::uuid);
select public.export_my_data() as ex \gset
select tests.eq('export: includes my profile', (:'ex'::jsonb #>> '{profile,user_id}'), :'lv');
select tests.ok('export: includes my gates', jsonb_array_length(:'ex'::jsonb -> 'tasks') >= 1);
select tests.ok('export: includes my XP history', jsonb_array_length(:'ex'::jsonb -> 'xp_events') >= 1);
select tests.eq('export: nobody else''s profile', (select count(*)::int from jsonb_array_elements(:'ex'::jsonb -> 'tasks') t where t ->> 'user_id' <> :'lv' and t ->> 'assigned_to' <> :'lv'), 0);
select tests.eq('export: billing identifiers are stripped', (:'ex'::jsonb #> '{subscription,provider_customer_id}') is null, true);

select public.delete_my_account();
select tests.logout();
select tests.eq('delete: auth user gone', (select count(*)::int from auth.users where id = :'lv'), 0);
select tests.eq('delete: profile gone', (select count(*)::int from public.user_profiles where user_id = :'lv'), 0);
select tests.eq('delete: gates gone', (select count(*)::int from public.tasks where user_id = :'lv'), 0);
select tests.eq('delete: ledger gone', (select count(*)::int from public.xp_events where user_id = :'lv'), 0);
select tests.eq('delete: subscription row gone', (select count(*)::int from public.subscriptions where user_id = :'lv'), 0);
select tests.eq('delete: clan survives under the heir', (select leader_id from public.clans where id = :'lclan'), :'heir'::uuid);
select tests.eq('delete: heir promoted', (select role from public.clan_members where user_id = :'heir'), 'leader');
select tests.ok('delete: other players untouched', exists (select 1 from public.user_profiles where user_id = :'heir'));
select tests.anon();
select tests.throws('delete: anon cannot call it', $$select public.delete_my_account()$$, 'permission denied%');
select tests.throws('export: anon cannot call it', $$select public.export_my_data()$$, 'permission denied%');
