-- ============================================================================
-- BEHAVIOUR TESTS — gate plans, lapse diagnosis, reflection, pledges (escrow, dividend,
-- forfeiture, no double pay), insights, and isolation between players.
-- ============================================================================
create or replace function private.rng() returns double precision language sql volatile as $$ select 0.99999::float8 $$;
select (now() at time zone 'UTC')::date as today \gset

select tests.mkuser('e60_Ana') as ana \gset
select tests.mkuser('e60_Ben') as ben \gset
select tests.mkuser('e60_Cy')  as cy  \gset
select tests.mkuser('e60_Dee') as dee \gset
select tests.logout();
update public.user_profiles set mode_selected_at = now(), current_mode = 'Normal', total_points = 100
 where user_id in (:'ana', :'ben', :'dee');
update public.user_profiles set mode_selected_at = now(), current_mode = 'Normal', total_points = 3 where user_id = :'cy';

-- ── A. gate plans ────────────────────────────────────────────────────────────
select tests.login(:'ana'::uuid);
select tests.gate('Write the report', 'Mid', 'Work', 2) as g1 \gset
select public.set_gate_plan(:'g1'::uuid, jsonb_build_object('cue', '  After breakfast  ', 'obstacle', repeat('x', 500),
         'then', 'just two minutes', 'pair', 'podcast', 'evil', 'x')) as pl \gset
select tests.eq('plan: cue is trimmed', :'pl'::jsonb #>> '{plan,cue}', 'After breakfast');
select tests.eq('plan: obstacle is clipped to 120', length(:'pl'::jsonb #>> '{plan,obstacle}'), 120);
select tests.ok('plan: unknown keys are dropped', not (:'pl'::jsonb -> 'plan' ? 'evil'));
select tests.eq('plan: stored on the gate', (select plan ->> 'pair' from public.tasks where id = :'g1'::uuid), 'podcast');
select tests.eq('plan: empty plan clears it', (public.set_gate_plan(:'g1'::uuid, '{}'::jsonb) -> 'plan')::text, 'null');
select tests.ok('plan: column is null again', (select plan is null from public.tasks where id = :'g1'::uuid));
select tests.throws('plan: array is rejected', format($$select public.set_gate_plan(%L, '[1]'::jsonb)$$, :'g1'), '%Malformed plan%');
select tests.login(:'ben'::uuid);
select tests.throws('plan: not your gate', format($$select public.set_gate_plan(%L, '{"cue":"x"}'::jsonb)$$, :'g1'), '%That gate%');
select tests.anon();
select tests.throws('plan: anon denied', format($$select public.set_gate_plan(%L, '{}'::jsonb)$$, :'g1'), 'permission denied%');

-- ── B. lapse diagnosis ───────────────────────────────────────────────────────
select tests.login(:'ana'::uuid);
select tests.throws('lapse: a healthy gate cannot be diagnosed', format($$select public.log_lapse(%L, 'forgot')$$, :'g1'), '%Only a missed gate%');
select tests.gate('Long run', 'Mid', 'Fitness', 2) as g2 \gset
select public.fail_gate(:'g2'::uuid) as _f \gset
select tests.throws('lapse: unknown reason', format($$select public.log_lapse(%L, 'lazy')$$, :'g2'), '%Pick one%');
select public.log_lapse(:'g2'::uuid, 'too_big', 'five miles was a lot') as lp \gset
select tests.eq('lapse: reason echoed', :'lp'::jsonb ->> 'reason', 'too_big');
select public.log_lapse(:'g2'::uuid, 'forgot') as lp2 \gset
select tests.eq('lapse: one diagnosis per gate (upsert)', (select count(*)::int from public.gate_lapses where task_id = :'g2'::uuid), 1);
select tests.eq('lapse: latest reason wins', (select reason from public.gate_lapses where task_id = :'g2'::uuid), 'forgot');
select tests.logout();
select tests.mktask(:'ana', 'Old email', 'Mid', 'Work', :'today'::date - 3) as g3 \gset
update public.tasks set is_pending = true where id = :'g3'::uuid;
select tests.login(:'ana'::uuid);
select tests.eq('lapse: an overdue gate can be diagnosed', public.log_lapse(:'g3'::uuid, 'low_energy') ->> 'ok', 'true');
select tests.login(:'ben'::uuid);
select tests.throws('lapse: not your gate', format($$select public.log_lapse(%L, 'forgot')$$, :'g2'), '%That gate%');

-- ── C. reflection ────────────────────────────────────────────────────────────
select tests.login(:'ana'::uuid);
select tests.throws('reflection: empty is refused', $$select public.save_reflection('  ', '')$$, '%Write one line%');
select public.save_reflection('Started before I felt ready', 'Run in the morning') as r1 \gset
select tests.eq('reflection: first save today', :'r1'::jsonb ->> 'first_today', 'true');
select tests.eq('reflection: counts the days', (:'r1'::jsonb ->> 'days_14')::int, 1);
select public.save_reflection('Edited', null) as r2 \gset
select tests.eq('reflection: second save is an edit', :'r2'::jsonb ->> 'first_today', 'false');
select tests.eq('reflection: one row per day', (select count(*)::int from public.reflections where user_id = :'ana'), 1);
select tests.eq('reflection: edit replaces the text', (select worked from public.reflections where user_id = :'ana'), 'Edited');
select public.save_reflection(repeat('a', 900), null) as r3 \gset
select tests.eq('reflection: clipped to 400', (select length(worked) from public.reflections where user_id = :'ana'), 400);
select tests.eq('reflection: earns no XP (feedback is verbal)', (select count(*)::int from public.xp_events where user_id = :'ana' and kind not in ('fail')), 0);

-- ── D. pledges ───────────────────────────────────────────────────────────────
select tests.gate('Pledge me', 'Mid', 'Work', 2) as pm \gset
select tests.gate('No deadline', 'Mid', 'Work', null) as nd \gset
select tests.gate('Too easy', 'Low', 'Work', 2) as ez \gset
select tests.throws('pledge: only 5/10/20', format($$select public.pledge_gate(%L, 7)$$, :'pm'), '%Stake 5%');
select tests.throws('pledge: needs a deadline', format($$select public.pledge_gate(%L, 5)$$, :'nd'), '%A pledge needs a deadline%');
select tests.throws('pledge: not for E-rank', format($$select public.pledge_gate(%L, 5)$$, :'ez'), '%Pledges are for C-rank%');
select tests.logout();
select standing_xp as st0, total_points as tp0 from public.user_profiles where user_id = :'ana' \gset
select tests.login(:'ana'::uuid);
select public.pledge_gate(:'pm'::uuid, 10) as pg \gset
select tests.eq('pledge: dividend is announced', (:'pg'::jsonb ->> 'dividend')::int, 2);
select tests.logout();
select tests.eq('pledge: stake leaves the hand', (select total_points from public.user_profiles where user_id = :'ana'), :'tp0'::int - 10);
select tests.eq('pledge: stake is escrowed as spent', (select spent_xp from public.user_profiles where user_id = :'ana'), 10);
select tests.eq('pledge: level/standing does not move', (select standing_xp from public.user_profiles where user_id = :'ana'), :'st0'::int);
select tests.login(:'ana'::uuid);
select tests.throws('pledge: one per gate', format($$select public.pledge_gate(%L, 5)$$, :'pm'), '%This gate already carries%');
select tests.gate('Second', 'High', 'Work', 2) as p2 \gset
select tests.gate('Third', 'High', 'Work', 2) as p3 \gset
select public.pledge_gate(:'p2'::uuid, 5) as _p \gset
select tests.throws('pledge: two open at a time', format($$select public.pledge_gate(%L, 5)$$, :'p3'), '%Two open pledges%');

select tests.login(:'cy'::uuid);
select tests.gate('Broke', 'Mid', 'Work', 2) as cyg \gset
select tests.throws('pledge: cannot stake XP you lack', format($$select public.pledge_gate(%L, 5)$$, :'cyg'), '%You need the XP%');

-- keeping a pledge
select tests.login(:'ana'::uuid);
select public.complete_gate(:'pm'::uuid) as c \gset
select tests.eq('keep: the conquest reports the kept pledge', (:'c'::jsonb #>> '{engagement,pledge,kept,0,stake}')::int, 10);
select tests.eq('keep: dividend reported', (:'c'::jsonb #>> '{engagement,pledge,kept,0,dividend}')::int, 2);
select tests.logout();
select tests.eq('keep: status', (select status from public.gate_pledges where task_id = :'pm'::uuid), 'kept');
select tests.eq('keep: stake is out of escrow (only the other pledge is still spent)', (select spent_xp from public.user_profiles where user_id = :'ana'), 5);
select tests.eq('keep: dividend is a ledger event', (select sum(delta)::int from public.xp_events where user_id = :'ana' and kind = 'pledge'), 2);
select tests.ok('keep: player is told', exists (select 1 from public.notifications where user_id = :'ana' and title like '%PLEDGE KEPT%'));
select tests.login(:'ana'::uuid);
select public.reactivate_gate(:'pm'::uuid);
select public.complete_gate(:'pm'::uuid) as c2 \gset
select tests.logout();
select tests.eq('keep: re-completing cannot pay again', (select count(*)::int from public.xp_events where user_id = :'ana' and kind = 'pledge'), 1);
select tests.eq('keep: nor refund twice', (select spent_xp from public.user_profiles where user_id = :'ana'), 5);

-- losing a pledge: abandon
select tests.login(:'ana'::uuid);
select public.fail_gate(:'p2'::uuid) as _fail \gset
select public.get_behavior(30) as b1 \gset
select tests.eq('forfeit: abandoning settles it', jsonb_array_length(:'b1'::jsonb #> '{settled,forfeited}'), 1);
select tests.logout();
select tests.eq('forfeit: status', (select status from public.gate_pledges where task_id = :'p2'::uuid), 'forfeited');
select tests.eq('forfeit: the stake stays spent', (select spent_xp from public.user_profiles where user_id = :'ana'), 5);
select tests.ok('forfeit: told kindly', exists (select 1 from public.notifications where user_id = :'ana' and title like '%PLEDGE LET GO%'));

-- losing a pledge: deleting the gate is not an escape
select tests.login(:'ana'::uuid);
select tests.gate('Delete me', 'Mid', 'Work', 2) as dg \gset
select public.pledge_gate(:'dg'::uuid, 5) as _d \gset
select public.delete_gate(:'dg'::uuid);
select public.get_behavior(30) as b2 \gset
select tests.eq('forfeit: deleting the gate forfeits', jsonb_array_length(:'b2'::jsonb #> '{settled,forfeited}'), 1);
select tests.logout();
select tests.eq('forfeit: deleted gate leaves a dangling pledge row, closed', (select count(*)::int from public.gate_pledges where user_id = :'ana' and task_id is null and status = 'forfeited'), 1);

-- losing a pledge: the deadline passes
select tests.login(:'ana'::uuid);
select tests.gate('Slip away', 'Mid', 'Work', 2) as sg \gset
select public.pledge_gate(:'sg'::uuid, 5) as _s \gset
select tests.logout();
update public.tasks set deadline = :'today'::date - 1 where id = :'sg'::uuid;
select tests.login(:'ana'::uuid);
select public.get_behavior(30) as b3 \gset
select tests.eq('forfeit: a passed deadline forfeits', jsonb_array_length(:'b3'::jsonb #> '{settled,forfeited}'), 1);
select tests.eq('settling is idempotent', jsonb_array_length(public.get_behavior(30) #> '{settled,forfeited}'), 0);

-- ── E. insights ──────────────────────────────────────────────────────────────
select tests.logout();
insert into public.tasks (user_id, assigned_to, created_by, title, category, xp_tier, points, deadline, plan, is_completed, is_failed, completed_at)
select :'dee', :'dee', :'dee', 'g' || n, 'Work', 'Mid', 15, :'today'::date - 1,
       case when planned then '{"cue":"after lunch"}'::jsonb end, done or failed, failed, case when done or failed then now() end
  from (values (1, true, true, false), (2, true, true, false), (3, true, true, false), (4, true, false, true),
               (5, false, true, false), (6, false, false, false), (7, false, false, false), (8, false, false, false)) v(n, planned, done, failed);
insert into public.xp_events (user_id, kind, delta, raw, counts_weekly, meta, created_at)
select :'dee', 'complete', 15, 15, true, jsonb_build_object('tier', 'Mid', 'category', c),
       (:'today'::date::timestamp at time zone 'UTC') + make_interval(hours => h)
  from (values (7, 'Fitness'), (7, 'Fitness'), (7, 'Fitness'), (21, 'Work')) v(h, c);
insert into public.user_points (user_id, date, daily_points) values (:'dee', :'today'::date, 30), (:'dee', :'today'::date - 8, 20)
  on conflict (user_id, date) do update set daily_points = excluded.daily_points;

select tests.login(:'dee'::uuid);
select public.get_behavior(60) as bh \gset
select tests.eq('insights: resolved gates', (:'bh'::jsonb #>> '{plan_effect,n}')::int, 8);
select tests.eq('insights: planned gates', (:'bh'::jsonb #>> '{plan_effect,planned,n}')::int, 4);
select tests.eq('insights: planned gates finished', (:'bh'::jsonb #>> '{plan_effect,planned,done}')::int, 3);
select tests.eq('insights: unplanned gates', (:'bh'::jsonb #>> '{plan_effect,unplanned,n}')::int, 4);
select tests.eq('insights: unplanned gates finished', (:'bh'::jsonb #>> '{plan_effect,unplanned,done}')::int, 1);
select tests.eq('insights: 24 hour buckets', jsonb_array_length(:'bh'::jsonb -> 'hours'), 24);
select tests.eq('insights: 7am has three conquests', (:'bh'::jsonb #>> '{hours,7}')::int, 3);
select tests.eq('insights: 9pm has one', (:'bh'::jsonb #>> '{hours,21}')::int, 1);
select tests.eq('insights: 7 weekday buckets', jsonb_array_length(:'bh'::jsonb -> 'weekdays'), 7);
select tests.eq('insights: weekday buckets add up', (select sum(x::int)::int from jsonb_array_elements_text(:'bh'::jsonb -> 'weekdays') x), 4);
select tests.eq('insights: top category', :'bh'::jsonb #>> '{categories,0,category}', 'Fitness');
select tests.eq('insights: top category count', (:'bh'::jsonb #>> '{categories,0,n}')::int, 3);
select tests.eq('insights: this week XP', (:'bh'::jsonb #>> '{rhythm,this_week_xp}')::int, 30);
select tests.eq('insights: previous week XP', (:'bh'::jsonb #>> '{rhythm,prev_week_xp}')::int, 20);
select tests.eq('insights: conquered today', (:'bh'::jsonb #>> '{rhythm,days_since_conquest}')::int, 0);
select tests.eq('insights: failed or overdue gates await a diagnosis', jsonb_array_length(:'bh'::jsonb -> 'unexamined'), 3);
select tests.eq('insights: reflection not yet written', :'bh'::jsonb #>> '{reflection,today}', 'false');
select public.log_lapse((:'bh'::jsonb #>> '{unexamined,0,id}')::uuid, 'forgot') as _l \gset
select public.save_reflection('Did the hard one first', 'Plan the morning the night before') as _r \gset
select public.get_behavior(60) as bh2 \gset
select tests.eq('insights: lapse counted', :'bh2'::jsonb #>> '{lapses,0,reason}', 'forgot');
select tests.eq('insights: reflection recorded', :'bh2'::jsonb #>> '{reflection,today}', 'true');
select tests.eq('insights: diagnosed gate leaves the queue', jsonb_array_length(:'bh2'::jsonb -> 'unexamined'), 3);
select tests.eq('insights: window clamps low', (public.get_behavior(1) ->> 'window_days')::int, 14);
select tests.eq('insights: window clamps high', (public.get_behavior(99999) ->> 'window_days')::int, 180);

select tests.login(:'ben'::uuid);
select public.get_behavior(60) as bb \gset
select tests.eq('isolation: another player sees none of it', (:'bb'::jsonb #>> '{plan_effect,n}')::int, 0);
select tests.eq('isolation: no conquests', (select sum(x::int)::int from jsonb_array_elements_text(:'bb'::jsonb -> 'hours') x), 0);
select tests.eq('isolation: no pledges', jsonb_array_length(:'bb'::jsonb #> '{pledges,open}'), 0);
select tests.eq('isolation: cannot read another player''s pledges', (select count(*)::int from public.gate_pledges where user_id = :'ana'), 0);
select tests.eq('isolation: cannot read another player''s reflections', (select count(*)::int from public.reflections where user_id = :'ana'), 0);
select tests.throws('direct writes are closed', $$insert into public.gate_pledges (user_id, title, stake) values (auth.uid(), 'x', 5)$$, 'permission denied%');
select tests.anon();
select tests.throws('anon cannot read behaviour', $$select public.get_behavior(30)$$, 'permission denied%');
select tests.logout();
