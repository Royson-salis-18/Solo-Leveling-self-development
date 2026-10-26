-- Activity record: derived from the ledger, scoped to the caller, bounded.
create or replace function private.rng() returns double precision language sql volatile as $$ select 0.99999::float8 $$;
select (now() at time zone 'UTC')::date as today \gset

select tests.mkuser('e50_Ana') as ana \gset
select tests.mkuser('e50_Ben') as ben \gset
select tests.logout();
-- Ana: 2 conquests today, 1 three days ago; Ben has nothing
insert into public.user_points (user_id, date, daily_points) values (:'ana', :'today'::date, 30), (:'ana', :'today'::date - 3, 15), (:'ana', :'today'::date - 5, -40);
insert into public.xp_events (user_id, kind, delta, raw, counts_weekly, meta, created_at) values
  (:'ana', 'complete', 15, 15, true, '{}', now()), (:'ana', 'complete', 15, 15, true, '{}', now()),
  (:'ana', 'complete', 15, 15, true, '{}', now() - interval '3 days');

select tests.login(:'ana'::uuid);
select public.get_activity(14) as act \gset
select tests.eq('activity: requested window length', jsonb_array_length(:'act'::jsonb -> 'days'), 14);
select tests.eq('activity: last day is today', (:'act'::jsonb -> 'days' -> 13 ->> 'date'), :'today');
select tests.eq('activity: today has 2 conquests', (:'act'::jsonb -> 'days' -> 13 ->> 'conquests')::int, 2);
select tests.eq('activity: today points', (:'act'::jsonb -> 'days' -> 13 ->> 'points')::int, 30);
select tests.eq('activity: 3 days ago has 1 conquest', (:'act'::jsonb -> 'days' -> 10 ->> 'conquests')::int, 1);
select tests.eq('activity: negative days clamp to 0 for display', (:'act'::jsonb -> 'days' -> 8 ->> 'points')::int, 0);
select tests.eq('activity: empty days are present and zero', (:'act'::jsonb -> 'days' -> 0 ->> 'conquests')::int, 0);
select tests.eq('totals: conquests', (:'act'::jsonb #>> '{totals,conquests}')::int, 3);
select tests.eq('totals: active days', (:'act'::jsonb #>> '{totals,active_days}')::int, 2);
select tests.eq('totals: avg XP on active days', (:'act'::jsonb #>> '{totals,avg_xp_active_day}')::int, 23);   -- (30+15)/2 = 22.5 → 23
select tests.eq('activity: window is clamped (min 7)', jsonb_array_length(public.get_activity(1) -> 'days'), 7);
select tests.eq('activity: window is clamped (max 400)', jsonb_array_length(public.get_activity(100000) -> 'days'), 400);

select tests.login(:'ben'::uuid);
select public.get_activity(7) as bact \gset
select tests.eq('isolation: another player sees none of it', (:'bact'::jsonb #>> '{totals,conquests}')::int, 0);
select tests.eq('isolation: zero active days', (:'bact'::jsonb #>> '{totals,active_days}')::int, 0);
select tests.anon();
select tests.throws('anon cannot read activity', $$select public.get_activity(7)$$, 'permission denied%');
select tests.logout();
