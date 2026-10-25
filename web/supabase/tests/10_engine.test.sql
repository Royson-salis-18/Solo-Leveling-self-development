-- ============================================================================
-- ENGINE TESTS — expected values are derived by hand from the documented rules
-- (docs/GAME_RULES.md), not copied from the implementation's output.
-- ============================================================================
-- Deterministic luck: never lucky unless the chance is 100%.
create or replace function private.rng() returns double precision language sql volatile as $$ select 0.99999::float8 $$;

select (now() at time zone 'UTC')::date as today \gset

-- ── A. profile defaults & mode selection ─────────────────────────────────────
select tests.mkuser('Alice') as a \gset
select tests.mkuser('Dora')  as d \gset
select tests.eq('new profile: UTC by default', (select timezone from public.user_profiles where user_id = :'a'), 'UTC');
select tests.eq('new profile: standing = balance + spent', (select standing_xp from public.user_profiles where user_id = :'a'), 0);
select tests.ok('new profile: must pick a mode', (select mode_selected_at is null from public.user_profiles where user_id = :'a'));

select tests.login(:'a'::uuid);
select (public.select_mode('Normal') ->> 'changed') as changed \gset
select tests.eq('select_mode: first pick is free', :'changed', 'true');
select tests.throws('select_mode: 7-day cooldown', $$select public.select_mode('Hard')$$, 'MODE_COOLDOWN%');
select tests.eq('select_mode: same mode is a no-op', (public.select_mode('Normal') ->> 'changed'), 'false');
select tests.throws('select_mode: unknown mode', $$select public.select_mode('Nightmare')$$, 'INVALID_MODE%');

select tests.login(:'d'::uuid);
select public.select_mode('Hell');
select tests.ok('Hell sets a 30-day season', (select season_end_date > now() + interval '29 days' from public.user_profiles where user_id = :'d'));
select tests.throws('Hell is a lock-in', $$select public.select_mode('Easy')$$, 'HELL_LOCK_IN%');

-- ── B. save_gate validation: the server decides what a gate is worth ─────────
select tests.login(:'a'::uuid);
select tests.gate('Run 5k', 'Mid', 'Fitness', 2, '{"points": 99999}') as g1 \gset
select tests.eq('save_gate: client-supplied points are ignored', (select points from public.tasks where id = :'g1'), 15);
select tests.eq('save_gate: assigned to self', (select assigned_to from public.tasks where id = :'g1'), :'a'::uuid);
select tests.throws('save_gate: blank title', $$select public.save_gate('{"title":"   "}')$$, 'INVALID_TITLE%');
select tests.throws('save_gate: S-rank needs a prep window',
  $$select public.save_gate(jsonb_build_object('title','x','xp_tier','Legendary','start_time','00:01','deadline',(now() at time zone 'UTC')::date))$$,
  'TEMPORAL_ANOMALY%');
select (public.save_gate('{"title":"No deadline", "xp_tier":"Legendary"}') ->> 'id') as g_nodl \gset
select tests.eq('no deadline ⇒ auto E-rank tier', (select xp_tier from public.tasks where id = :'g_nodl'), 'Low');
select tests.eq('no deadline ⇒ 5 XP', (select points from public.tasks where id = :'g_nodl'), 5);
select tests.throws('save_gate: bad date', $$select public.save_gate('{"title":"x","deadline":"not-a-date"}')$$, 'INVALID_DEADLINE%');

-- ── C. complete_gate: XP, idempotency, no re-farming ─────────────────────────
-- Mid (15) × Fitness weight 1.2 × Normal 1.0 = 18
select public.complete_gate(:'g1'::uuid) as r \gset
select tests.eq('complete: earns 18 XP', (:'r'::jsonb #>> '{xp,earned}')::int, 18);
select tests.logout();
select tests.eq('complete: balance = 18', (select total_points from public.user_profiles where user_id = :'a'), 18);
select tests.eq('complete: streak starts at 1', (select streak_count from public.user_profiles where user_id = :'a'), 1);
select tests.eq('complete: domain_physical +1 (10→11)', (select domain_physical from public.user_profiles where user_id = :'a'), 11);
select tests.eq('complete: one ledger row', (select count(*)::int from public.xp_events where user_id = :'a' and kind = 'complete'), 1);
select tests.eq('complete: chart table updated', (select daily_points from public.user_points where user_id = :'a' and date = :'today'), 18);
select tests.eq('complete: task marked paid', (select xp_paid from public.tasks where id = :'g1'), true);

select tests.login(:'a'::uuid);
select (public.complete_gate(:'g1'::uuid) ->> 'already') as dup \gset
select tests.eq('complete twice: idempotent', :'dup', 'true');
select public.reactivate_gate(:'g1'::uuid);
select (public.complete_gate(:'g1'::uuid) #>> '{xp,paid}') as paid2 \gset
select tests.eq('complete → reactivate → complete: pays nothing', :'paid2', 'false');
select tests.logout();
select tests.eq('no XP re-farming', (select total_points from public.user_profiles where user_id = :'a'), 18);
select tests.eq('still one ledger row', (select count(*)::int from public.xp_events where user_id = :'a' and kind = 'complete'), 1);

-- ── D. boss shield & weekly trial rules ──────────────────────────────────────
select tests.login(:'a'::uuid);
select tests.gate('Boss', 'Low', 'General', 2) as boss \gset
select tests.gate('Minion', 'Low', 'General', 2, jsonb_build_object('parent_id', :'boss'::uuid)) as minion \gset
select tests.throws('boss shield blocks conquest', format($q$select public.complete_gate('%s')$q$, :'boss'), 'BOSS_SHIELD%');
select public.complete_gate(:'minion'::uuid);
select public.complete_gate(:'boss'::uuid);
select tests.ok('boss falls once minions are cleared', (select is_completed from public.tasks where id = :'boss'));
select tests.gate('Trial', 'Legendary', 'General', 3, '{"is_weekly_trial": true}') as trial \gset
select tests.throws('weekly trial needs 3 objectives', format($q$select public.complete_gate('%s')$q$, :'trial'), 'TRIAL_INCOMPLETE%');

-- ── E. E-rank daily cap = 15 XP (the old cap counted the task itself) ────────
select tests.mkuser('Carol') as c \gset
select tests.login(:'c'::uuid);
select public.select_mode('Normal');
-- Low (5) × Fitness 1.2 = 6 each → 6, 6, then only 3 of the 15 cap left, then 0.
select (public.complete_gate(tests.gate('e1','Low','Fitness',null)) #>> '{xp,earned}')::int as e1 \gset
select (public.complete_gate(tests.gate('e2','Low','Fitness',null)) #>> '{xp,earned}')::int as e2 \gset
select public.complete_gate(tests.gate('e3','Low','Fitness',null)) as e3r \gset
select public.complete_gate(tests.gate('e4','Low','Fitness',null)) as e4r \gset
select tests.eq('E cap: 1st = 6', :'e1'::int, 6);
select tests.eq('E cap: 2nd = 6', :'e2'::int, 6);
select tests.eq('E cap: 3rd limited to remaining 3', (:'e3r'::jsonb #>> '{xp,earned}')::int, 3);
select tests.eq('E cap: 3rd flagged capped', (:'e3r'::jsonb #>> '{xp,capped}'), 'true');
select tests.eq('E cap: 4th earns 0', (:'e4r'::jsonb #>> '{xp,earned}')::int, 0);
select tests.logout();
select tests.eq('E cap: total exactly 15', (select total_points from public.user_profiles where user_id = :'c'), 15);

-- ── F. failure, penalties, Dark Mana and absorption ──────────────────────────
select tests.mkuser('Dave') as dv \gset
select tests.login(:'dv'::uuid);
select public.select_mode('Normal');
select tests.gate('doomed', 'Mid', 'Fitness', 2) as doomed \gset
select public.fail_gate(:'doomed'::uuid) as f \gset
-- penalty = floor(15 gate-XP × 0.20 Normal fail rate × 1.0) = 3 ; Dark Mana +7
select tests.eq('fail: penalty 3', (:'f'::jsonb ->> 'penalty')::int, 3);
select tests.eq('fail: profile reflects it', (:'f'::jsonb #>> '{profile,total_points}')::int, -3);
select tests.eq('fail: Dark Mana +7', (:'f'::jsonb #>> '{profile,dark_mana}')::int, 7);
select tests.eq('fail: XP debt ⇒ PENALTY status', (:'f'::jsonb #>> '{profile,status}'), 'PENALTY');
select tests.ok('fail: redemption gate offered', exists (select 1 from public.tasks where user_id = :'dv' and title like '🔥 REDEMPTION:%'));
select (public.fail_gate(:'doomed'::uuid) ->> 'already') as fdup \gset
select tests.eq('fail twice: idempotent', :'fdup', 'true');
select tests.eq('fail twice: no second penalty', (select total_points from public.user_profiles where user_id = :'dv'), -3);
select tests.eq('fail twice: still 1 redemption gate', (select count(*)::int from public.tasks where user_id = :'dv' and title like '🔥 REDEMPTION:%'), 1);

-- Dopamine hole: next conquest pays the 7 Dark Mana debt first. 18 earned → 7 absorbed → 11 applied.
select public.complete_gate(tests.gate('payback','Mid','Fitness',2)) as pb \gset
select tests.eq('absorption: 7 absorbed', (:'pb'::jsonb #>> '{xp,absorbed_by_dark_mana}')::int, 7);
select tests.eq('absorption: 11 applied', (:'pb'::jsonb #>> '{xp,applied}')::int, 11);
select tests.eq('absorption: debt cleared', (:'pb'::jsonb #>> '{profile,dark_mana}')::int, 0);
select tests.eq('absorption: balance -3 + 11 = 8', (:'pb'::jsonb #>> '{profile,total_points}')::int, 8);
select tests.eq('absorption: back to ACTIVE', (:'pb'::jsonb #>> '{profile,status}'), 'ACTIVE');

-- ── G. rewards: spending XP must not de-level you ────────────────────────────
select tests.mkuser('Erin') as e \gset
select tests.login(:'e'::uuid);
select public.select_mode('Normal');
select tests.logout();
update public.user_profiles set total_points = 1000, streak_count = 5 where user_id = :'e';
select tests.login(:'e'::uuid);
select public.claim_reward(p_system_key => 'sys-r1') as cl \gset
select tests.eq('claim: cost 50 deducted', (:'cl'::jsonb #>> '{profile,total_points}')::int, 950);
select tests.eq('claim: spent tracked', (:'cl'::jsonb #>> '{profile,spent_xp}')::int, 50);
select tests.eq('claim: level from STANDING (1000 XP ⇒ L3), not balance', (:'cl'::jsonb #>> '{profile,level}')::int, 3);
select public.claim_reward(p_system_key => 'sys-r1') as cl2 \gset
select tests.eq('claim twice: still L3 after spending 100 total', (:'cl2'::jsonb #>> '{profile,level}')::int, 3);
select tests.eq('system rewards are reusable and recorded', (select count(*)::int from public.reward_claims where user_id = :'e'), 2);

select tests.logout();
update public.user_profiles set streak_count = 1 where user_id = :'e';
select tests.login(:'e'::uuid);
select tests.throws('claim: tier 1 needs a 3-day streak', $$select public.claim_reward(p_system_key => 'sys-r1')$$, 'STREAK_LOCK%');
select tests.logout();
update public.user_profiles set streak_count = 5, total_points = 10 where user_id = :'e';
select tests.login(:'e'::uuid);
select tests.throws('claim: not enough XP', $$select public.claim_reward(p_system_key => 'sys-r1')$$, 'INSUFFICIENT_XP%');

select tests.logout();
update public.user_profiles set streak_count = 7, player_rank = 'C', total_points = 5000, last_active_date = :'today', last_tick_date = :'today' where user_id = :'e';
select tests.login(:'e'::uuid);
select tests.throws('claim: tier 2 needs a trigger gate', $$select public.claim_reward(p_system_key => 'sys-r2')$$, 'TRIGGER_REQUIRED%');
select tests.gate('anchor', 'Mid', 'Fitness', 2) as anchor \gset
select public.complete_gate(:'anchor'::uuid);
select public.claim_reward(p_system_key => 'sys-r2', p_trigger_gate => :'anchor'::uuid);
select tests.ok('claim: tier 2 with a fresh trigger works', exists (select 1 from public.reward_claims where user_id = :'e' and system_key = 'sys-r2'));
select tests.throws('claim: a trigger anchors only one reward', format($q$select public.claim_reward(p_system_key => 'sys-r2', p_trigger_gate => '%s')$q$, :'anchor'), 'TRIGGER_USED%');
select tests.logout();
select tests.mktask(:'e'::uuid, 'ancient', 'Mid') as old_gate \gset
update public.tasks set is_completed = true, completed_at = now() - interval '3 days' where id = :'old_gate';
select tests.login(:'e'::uuid);
select tests.throws('claim: trigger must be < 48h old', format($q$select public.claim_reward(p_system_key => 'sys-r2', p_trigger_gate => '%s')$q$, :'old_gate'), 'TRIGGER_INVALID%');
select tests.logout();
update public.user_profiles set dark_mana = 5, streak_count = 14, player_rank = 'B' where user_id = :'e';
select tests.login(:'e'::uuid);
select tests.throws('claim: tier 3 locked by Dark Mana', $$select public.claim_reward(p_system_key => 'sys-r3', p_trigger_gate => null)$$, 'MANA_CORRUPTION%');

-- custom rewards are one-shot
select tests.logout();
update public.user_profiles set dark_mana = 0, streak_count = 5, total_points = 500 where user_id = :'e';
select tests.login(:'e'::uuid);
insert into public.rewards (user_id, name, xp_cost, tier) values (:'e', 'Ice cream', 20, '1') returning id as cr \gset
select public.claim_reward(p_reward_id => :'cr'::uuid);
select tests.ok('custom reward flagged claimed', (select is_claimed from public.rewards where id = :'cr'));
select tests.throws('custom reward cannot be claimed twice', format($q$select public.claim_reward(p_reward_id => '%s')$q$, :'cr'), 'ALREADY_CLAIMED%');

-- ── H. redeeming Dark Mana: 1.5× XP dual cost, and it DOES lower standing ───
select tests.mkuser('Frank') as fr \gset
select tests.login(:'fr'::uuid);
select public.select_mode('Normal');
select tests.logout();
update public.user_profiles set total_points = 100, dark_mana = 10, dark_mana_started_at = now() - interval '2 days' where user_id = :'fr';
select tests.login(:'fr'::uuid);
insert into public.punishments (user_id, name, xp_penalty) values (:'fr', 'Cold shower', 10) returning id as pun \gset
select public.redeem_dark_mana(10, :'pun'::uuid) as rd \gset
select tests.eq('redeem: 10 DM costs 15 XP', (:'rd'::jsonb ->> 'xp_cost')::int, 15);
select tests.eq('redeem: balance 85', (:'rd'::jsonb #>> '{profile,total_points}')::int, 85);
select tests.eq('redeem: debt cleared', (:'rd'::jsonb #>> '{profile,dark_mana}')::int, 0);
select tests.eq('redeem: punishment counted', (select triggered from public.punishments where id = :'pun'), 1);
select tests.throws('redeem: nothing left to clear', $$select public.redeem_dark_mana(5)$$, 'NO_DARK_MANA%');

-- ── I. level / rank / title, and rank protection per mode ────────────────────
select tests.mkuser('Gina', 'Warrior') as gi \gset
select tests.login(:'gi'::uuid);
select public.select_mode('Normal');
select tests.logout();
update public.user_profiles set total_points = 5000 where user_id = :'gi';
select private.refresh_progression(:'gi'::uuid);
select tests.eq('level 11 at 5000 standing', (select level from public.user_profiles where user_id = :'gi'), 11);
select tests.eq('level 11 ⇒ C-rank', (select player_rank from public.user_profiles where user_id = :'gi'), 'C');
select tests.eq('5000 XP ⇒ 3rd Warrior title', (select player_title from public.user_profiles where user_id = :'gi'), 'Vanguard');
select tests.ok('level-up notification', exists (select 1 from public.notifications where user_id = :'gi' and title like '%LEVEL UP%'));
select tests.ok('rank-up notification',  exists (select 1 from public.notifications where user_id = :'gi' and title like '%RANK UP%'));
update public.user_profiles set player_rank = 'B', total_points = 0 where user_id = :'gi';
select private.refresh_progression(:'gi'::uuid);
select tests.eq('Normal: rank cannot drop', (select player_rank from public.user_profiles where user_id = :'gi'), 'B');
update public.user_profiles set current_mode = 'Hard' where user_id = :'gi';
select private.refresh_progression(:'gi'::uuid);
select tests.eq('Hard: rank-down enabled', (select player_rank from public.user_profiles where user_id = :'gi'), 'E');

-- ── J. daily tick: decay, streak break, DECEASED, ARISE ──────────────────────
select tests.mkuser('Hank') as h \gset
select tests.login(:'h'::uuid);
select public.select_mode('Normal');
select tests.logout();
update public.user_profiles
   set total_points = 1000, last_active_date = :'today'::date - 8, last_tick_date = :'today'::date - 8,
       streak_count = 5, created_at = now() - interval '30 days'
 where user_id = :'h';
select tests.login(:'h'::uuid);
select public.get_dashboard() as dash \gset
-- idle days 1..7 elapse; Normal decays when idle > 5 (days 6,7) at min(30, 1% of 1000 = 10) = 10/day
select tests.eq('tick: 2 decay days × 10 XP', (:'dash'::jsonb ->> 'total_points')::int, 980);
select tests.eq('tick: streak broken after >1 idle day', (:'dash'::jsonb ->> 'streak_count')::int, 0);
select tests.eq('tick: weekly XP below target ⇒ STAGNANT', (:'dash'::jsonb ->> 'status'), 'STAGNANT');
select public.get_dashboard() as dash2 \gset
select tests.eq('tick: idempotent within a day', (:'dash2'::jsonb ->> 'total_points')::int, 980);
select tests.logout();
select tests.eq('tick: decay recorded in ledger', (select delta from public.xp_events where user_id = :'h' and kind = 'decay'), -20);
select tests.ok('tick: decay notification', exists (select 1 from public.notifications where user_id = :'h' and title like '%DECAY%'));

select tests.mkuser('Ivy') as iv \gset
select tests.login(:'iv'::uuid);
select public.select_mode('Normal');
select tests.logout();
update public.user_profiles
   set total_points = 1000, last_active_date = :'today'::date - 12, last_tick_date = :'today'::date - 12
 where user_id = :'iv';
select tests.login(:'iv'::uuid);
select public.get_dashboard() as ivd \gset
-- idle 1..11; decay on idle 6..11 = 6 days × 10 = 60 → 940; 12 idle days > Normal's 10 ⇒ DECEASED
select tests.eq('deceased: decayed 60', (:'ivd'::jsonb ->> 'total_points')::int, 940);
select tests.eq('deceased: status', (:'ivd'::jsonb ->> 'status'), 'DECEASED');
-- A low-rank conquest pays XP but does NOT end death.
select public.complete_gate(tests.gate('baby step','Low','General',null)) as low \gset
select tests.eq('deceased: low-rank gate pays (5×0.7=3.5→4)', (:'low'::jsonb #>> '{xp,earned}')::int, 4);
select tests.eq('deceased: still DECEASED after a low-rank gate', (:'low'::jsonb #>> '{profile,status}'), 'DECEASED');
-- ARISE: a B-rank+ conquest. High 25 × General 0.7 = 17.5 → 18, + 50% of the 60 decayed = 30
select public.complete_gate(tests.gate('ritual','High','General',2)) as ar \gset
select tests.eq('ARISE: bonus is half the decayed XP', (:'ar'::jsonb #>> '{xp,arise_bonus}')::int, 30);
select tests.eq('ARISE: ends DECEASED', (:'ar'::jsonb #>> '{profile,status}'), 'ACTIVE');
select tests.eq('ARISE: balance 940+4+18+30', (:'ar'::jsonb #>> '{profile,total_points}')::int, 992);
select tests.login(:'iv'::uuid);
select public.begin_arise() as ba \gset
select tests.eq('begin_arise: no-op when alive', (:'ba'::jsonb ->> 'spawned'), 'false');

-- ── K. weekly threshold: STAGNANT clears once enough C-rank+ XP is earned ───
select tests.mkuser('Jack') as j \gset
select tests.login(:'j'::uuid);
select public.select_mode('Normal');
select tests.logout();
update public.user_profiles set created_at = now() - interval '30 days', last_active_date = :'today', last_tick_date = :'today' where user_id = :'j';
select private.refresh_progression(:'j'::uuid);
select tests.eq('weekly: no activity ⇒ STAGNANT', (select status from public.user_profiles where user_id = :'j'), 'STAGNANT');
insert into public.xp_events (user_id, kind, delta, raw, counts_weekly) values
  (:'j', 'complete', 60, 60, true), (:'j', 'complete', 60, 60, true), (:'j', 'complete', 30, 30, true);
select private.refresh_progression(:'j'::uuid);
select tests.eq('weekly: 150 XP meets the Normal target', (select status from public.user_profiles where user_id = :'j'), 'ACTIVE');
insert into public.xp_events (user_id, kind, delta, raw, counts_weekly) values (:'j', 'complete', 500, 500, false);
select tests.eq('weekly: E-rank XP never counts', private.weekly_xp(:'j'::uuid), 150);

-- honeymoon: brand-new accounts cannot be STAGNANT in their first week
select tests.mkuser('Kim') as k \gset
select tests.login(:'k'::uuid);
select public.select_mode('Normal');
select tests.eq('new accounts: 7-day honeymoon', (public.get_dashboard() ->> 'status'), 'ACTIVE');

-- ── L. recurring gates ───────────────────────────────────────────────────────
select tests.mkuser('Liam') as l \gset
select tests.login(:'l'::uuid);
select public.select_mode('Normal');
select tests.gate('Daily stretch', 'Low', 'Fitness', 2, '{"recurrence_type":"daily"}') as rec \gset
select public.complete_gate(:'rec'::uuid);
select tests.logout();
select tests.eq('recurring: rolls to next day', (select deadline from public.tasks where id = :'rec'), tests.today(:'l'::uuid) + 1);
select tests.eq('recurring: reopened', (select is_completed from public.tasks where id = :'rec'), false);
select tests.eq('recurring: payout reset for the new cycle', (select xp_paid from public.tasks where id = :'rec'), false);
select tests.eq('recurring: history row kept', (select count(*)::int from public.tasks where user_id = :'l' and title = 'Daily stretch (Cycle Conquered)'), 1);

-- ── M. streak rules by mode ──────────────────────────────────────────────────
create or replace function tests.streak_case(p_name text, p_mode text, p_last_offset int, p_streak int) returns int
language plpgsql as $$
declare v uuid; v_today date := (now() at time zone 'UTC')::date; r jsonb;
begin
  v := tests.mkuser(p_name);
  perform tests.login(v);  perform public.select_mode(p_mode);  perform tests.logout();
  update public.user_profiles
     set last_active_date = v_today - p_last_offset, last_tick_date = v_today - p_last_offset, streak_count = p_streak
   where user_id = v;
  perform tests.login(v);
  r := public.complete_gate(tests.gate('s', 'Low', 'General', null));
  perform tests.logout();
  return (r #>> '{profile,streak_count}')::int;
end $$;
select tests.eq('streak: consecutive day ⇒ +1',            tests.streak_case('Mona',  'Normal', 1, 4), 5);
select tests.eq('streak: 1 missed day, Normal grace 1 ⇒ +1', tests.streak_case('Nina',  'Normal', 2, 4), 5);
select tests.eq('streak: 2 missed days ⇒ resets to 1',      tests.streak_case('Omar',  'Normal', 3, 4), 1);
select tests.eq('streak: Easy grace 2 forgives 2 missed',   tests.streak_case('Pia',   'Easy',   3, 4), 5);
select tests.eq('streak: Hard has no grace',                tests.streak_case('Quin',  'Hard',   2, 4), 1);

-- ── N. multipliers: resonance, flow, ego, boost ─────────────────────────────
create or replace function tests.xp_case(p_name text, p_setup text) returns jsonb
language plpgsql as $$
declare v uuid; r jsonb;
begin
  v := tests.mkuser(p_name);
  perform tests.login(v);  perform public.select_mode('Normal');  perform tests.logout();
  execute replace(p_setup, '$U', quote_literal(v::text));
  perform tests.login(v);
  r := public.complete_gate(tests.gate('m', 'Mid', 'Fitness', 2));   -- base 18 before multipliers
  perform tests.logout();
  return r;
end $$;

select tests.eq('baseline Mid×Fitness = 18', (tests.xp_case('Rick', 'select 1') #>> '{xp,earned}')::int, 18);
select tests.eq('resonance: 3 shadows capped at +25% ⇒ 22.5→23',
  (tests.xp_case('Sara', $$insert into public.shadows (user_id, name, rarity, bonus_value)
      select $U::uuid, n, 'Epic', 0.10 from unnest(array['a','b','c']) n$$) #>> '{xp,earned}')::int, 23);
select tests.eq('resonance: a single Common shadow (+2%) rounds away',
  (tests.xp_case('Tom', $$insert into public.shadows (user_id, name, rarity, bonus_value) values ($U::uuid, 'a', 'Common', 0.02)$$) #>> '{xp,earned}')::int, 18);
select tests.eq('ego > 50 ⇒ ×1.1 (19.8→20)',
  (tests.xp_case('Uma', $$update public.user_profiles set ego_score = 51 where user_id = $U::uuid$$) #>> '{xp,earned}')::int, 20);
select tests.eq('flow: 5 non-E conquests in 90 min ⇒ ×2.5',
  (tests.xp_case('Vic', $$insert into public.xp_events (user_id, kind, delta, raw, counts_weekly, created_at)
      select $U::uuid, 'complete', 10, 10, true, now() - interval '10 minutes' from generate_series(1,5)$$) #>> '{xp,earned}')::int, 45);
select tests.eq('flow: E-rank spam does NOT trigger it',
  (tests.xp_case('Wes', $$insert into public.xp_events (user_id, kind, delta, raw, counts_weekly, created_at)
      select $U::uuid, 'complete', 5, 5, false, now() - interval '10 minutes' from generate_series(1,9)$$) #>> '{xp,earned}')::int, 18);
select tests.eq('XP boost item doubles, and is consumed',
  (tests.xp_case('Xena', $$insert into public.inventory (user_id, name, item_type, quantity) values ($U::uuid, 'Boost', 'XP_BOOST', 2)$$) #>> '{xp,earned}')::int, 36);
select tests.eq('XP boost: one charge used', (select quantity from public.inventory i join public.user_profiles p using (user_id) where p.name = 'Xena'), 1);

-- Burst: lucky roll + 3rd non-E conquest in the window. A roll of 0.1 beats Normal's 25% burst
-- chance but not the 5% Mid-tier shadow chance, so only the burst fires.
create or replace function private.rng() returns double precision language sql volatile as $$ select 0.1::float8 $$;
select tests.mkuser('Yara') as y \gset
select tests.login(:'y'::uuid);
select public.select_mode('Normal');
select public.complete_gate(tests.gate('b1','Mid','Fitness',2));
select public.complete_gate(tests.gate('b2','Mid','Fitness',2));
select public.complete_gate(tests.gate('b3','Mid','Fitness',2)) as b3 \gset
-- 3rd conquest: momentum 3 ⇒ burst = round(18 × 1.0 × 0.5) = 9
select tests.eq('burst: 3-gate momentum pays a bonus', (:'b3'::jsonb #>> '{xp,burst}')::int, 9);
select tests.logout();
create or replace function private.rng() returns double precision language sql volatile as $$ select 0.99999::float8 $$;

-- ── O. shadows are unique ────────────────────────────────────────────────────
select tests.mkuser('Zed') as z \gset
select tests.login(:'z'::uuid);
select public.select_mode('Normal');
select count(public.complete_gate(tests.gate('S-'||i, 'Legendary', 'General', 2))) from generate_series(1, 10) i;
select tests.logout();
select tests.eq('shadows: 8 distinct Legendary/Mythic exist, no duplicates ever',
  (select count(distinct name)::int from public.shadows where user_id = :'z'), 8);
select tests.eq('shadows: row count equals distinct count', (select count(*)::int from public.shadows where user_id = :'z'), 8);

-- ── P. postponing ────────────────────────────────────────────────────────────
select tests.mkuser('Rae') as rae \gset
select tests.login(:'rae'::uuid);
select public.select_mode('Normal');
select tests.gate('later', 'Mid', 'Fitness', 2) as lg \gset
select public.save_gate(jsonb_build_object('title','later','xp_tier','Mid','category','Fitness',
        'deadline', ((now() at time zone 'UTC')::date + 4)), :'lg'::uuid) as pp \gset
select tests.eq('postpone: flagged', (:'pp'::jsonb ->> 'postponed'), 'true');
select tests.eq('postpone: costs 5 XP', (:'pp'::jsonb #>> '{profile,total_points}')::int, -5);
select tests.eq('postpone: +5 Dark Mana', (:'pp'::jsonb #>> '{profile,dark_mana}')::int, 5);
select tests.mkuser('Sam') as sam \gset
select tests.login(:'sam'::uuid);
select public.select_mode('Hard');
select tests.gate('later', 'Mid', 'Fitness', 2) as sg \gset
select tests.throws('Hard mode forbids postponing',
  format($q$select public.save_gate(jsonb_build_object('title','later','xp_tier','Mid','deadline', ((now() at time zone 'UTC')::date + 4)), '%s')$q$, :'sg'),
  'POSTPONE_DISABLED%');

-- ── Q. timezones: "today" is the player's local day ──────────────────────────
select tests.mkuser('Tia') as tia \gset
select tests.login(:'tia'::uuid);
select public.set_timezone('Pacific/Auckland');
select tests.eq('timezone: local date', tests.today(:'tia'::uuid), (now() at time zone 'Pacific/Auckland')::date);
select tests.throws('timezone: rejects junk', $$select public.set_timezone('Mars/Olympus')$$, 'INVALID_TIMEZONE%');

-- ── R. raid timer: pause really excludes the paused time ─────────────────────
select tests.mkuser('Uri') as uri \gset
select tests.login(:'uri'::uuid);
select public.select_mode('Normal');
select tests.gate('timed', 'Low', 'General', 2) as tg \gset
select public.raid_action(:'tg'::uuid, 'start');
select public.raid_action(:'tg'::uuid, 'pause');
select tests.logout();
update public.tasks set started_at = now() - interval '30 minutes', paused_at = now() - interval '10 minutes' where id = :'tg';
select tests.login(:'uri'::uuid);
select public.raid_action(:'tg'::uuid, 'resume');
select tests.logout();
-- started 30m ago, paused for 10m ⇒ effective start is 20m ago
select tests.ok('resume: start shifted forward by the paused duration',
  (select extract(epoch from now() - started_at) between 1190 and 1215 from public.tasks where id = :'tg'));
select tests.ok('resume: no longer paused', (select not is_paused and paused_at is null from public.tasks where id = :'tg'));

-- ── S. dashboard snapshot shape ──────────────────────────────────────────────
select tests.login(:'a'::uuid);
select public.get_dashboard() as ds \gset
select tests.eq('dashboard: 7-day history, zero-filled', jsonb_array_length(:'ds'::jsonb -> 'weeklyHistory'), 7);
select tests.eq('dashboard: 30-day history', jsonb_array_length(:'ds'::jsonb -> 'monthlyHistory'), 30);
select tests.eq('dashboard: history ends today', (:'ds'::jsonb #>> '{weeklyHistory,6,date}'), :'today');
-- Alice earned 18 (g1) + 4 (minion) + 4 (boss; Low 5 × General 0.7 = 3.5 → 4) today
select tests.eq('dashboard: today = 26 XP', (:'ds'::jsonb #>> '{weeklyHistory,6,daily_points}')::int, 26);
select tests.eq('dashboard: oldest of the 7 days is 6 days ago (old query returned the OLDEST rows ever)',
  (:'ds'::jsonb #>> '{weeklyHistory,0,date}'), to_char(:'today'::date - 6, 'YYYY-MM-DD'));
select tests.ok('dashboard: category XP from the ledger', (:'ds'::jsonb -> 'categoryDistribution') @> '[{"category":"Fitness"}]');
select tests.ok('dashboard: no mode prompt once chosen', (:'ds'::jsonb ->> 'needs_mode_selection') = 'false');

-- ── T. recurrence maths ─────────────────────────────────────────────────────
select tests.logout();
select tests.eq('next_deadline: daily', private.next_deadline('daily', 1, null, null, date '2026-03-10'), date '2026-03-11');
select tests.eq('next_deadline: every 3 days', private.next_deadline('interval', 3, null, null, date '2026-03-10'), date '2026-03-13');
-- 2026-03-10 is a Tuesday (dow 2); Mon+Fri = [1,5] ⇒ next is Friday 03-13
select tests.eq('next_deadline: weekly picks the next chosen weekday', private.next_deadline('weekly', 1, '[1,5]', null, date '2026-03-10'), date '2026-03-13');
select tests.eq('next_deadline: weekly wraps to next week', private.next_deadline('weekly', 1, '[1]', null, date '2026-03-10'), date '2026-03-16');
select tests.eq('next_deadline: monthly on the 15th', private.next_deadline('monthly', 1, null, 15, date '2026-03-10'), date '2026-04-15');
select tests.eq('next_deadline: monthly on the 31st clamps (old code jumped into March)', private.next_deadline('monthly', 1, null, 31, date '2026-01-31'), date '2026-02-28');
select tests.eq('find_next_valid: catches up past missed cycles', private.find_next_valid('daily', 1, null, null, date '2026-03-01', date '2026-03-10'), date '2026-03-10');
select tests.eq('find_next_valid: future deadline untouched', private.find_next_valid('daily', 1, null, null, date '2026-03-20', date '2026-03-10'), date '2026-03-20');

-- ── U. pure rule functions ───────────────────────────────────────────────────
select tests.eq('level: 0 XP ⇒ 1', private.calc_level(0), 1);
select tests.eq('level: 499 ⇒ 1', private.calc_level(499), 1);
select tests.eq('level: 500 ⇒ 2', private.calc_level(500), 2);
select tests.eq('level: negative XP ⇒ 1', private.calc_level(-300), 1);
select tests.eq('rank: L4 ⇒ E', private.calc_rank(4), 'E');
select tests.eq('rank: L5 ⇒ D', private.calc_rank(5), 'D');
select tests.eq('rank: L40 ⇒ S', private.calc_rank(40), 'S');
select tests.eq('rank: L101 ⇒ SS', private.calc_rank(101), 'SS');
select tests.eq('xp dampening: base 50 unchanged', private.effective_xp(50, 'Work'), 50::numeric);
select tests.eq('xp dampening: base 100 ⇒ 50+10·log10(51)', round(private.effective_xp(100, 'Work'), 2), round(50 + 10 * log(51::numeric), 2));
select tests.eq('category weight: Learning 0.8', private.effective_xp(15, 'Learning'), 12::numeric);
select tests.eq('category weight: unknown ⇒ 1.0', private.effective_xp(15, 'Whatever'), 15::numeric);
select tests.eq('title: unknown class falls back to defaults', private.title_for('Bard', 0), 'Rookie');
select tests.eq('title: Archer is now covered', private.title_for('Archer', 25000), 'Dimensional Tracker');
