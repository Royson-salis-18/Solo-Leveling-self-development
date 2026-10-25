-- ============================================================================
-- ENGAGEMENT TESTS — streak freezes, bounties + chest, trophies, world boss, comeback,
-- referrals, nudges, and the security of all of it.
-- ============================================================================
create or replace function private.rng() returns double precision language sql volatile as $$ select 0.99999::float8 $$;
select (now() at time zone 'UTC')::date as today \gset
create or replace function tests.ev(p_uid uuid, p_tier text, p_raw integer, p_cat text) returns void
language plpgsql security definer as $$
begin
  insert into public.xp_events (user_id, kind, delta, raw, counts_weekly, meta, created_at)
  values (p_uid, 'complete', p_raw, p_raw, p_tier <> 'Low', jsonb_build_object('tier', p_tier, 'category', p_cat),
          (((now() at time zone 'UTC')::date)::timestamp at time zone 'UTC') + interval '1 hour');
end $$;
create or replace function tests.inv(p_uid uuid, p_type text) returns integer language sql security definer as $$
  select coalesce(sum(quantity), 0)::integer from public.inventory where user_id = p_uid and item_type = p_type
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- ── A. Streak Freezes ────────────────────────────────────────────────────────
select tests.mkuser('e40_Fay') as fay \gset
select tests.mkuser('e40_Gus') as gus \gset
select tests.mkuser('e40_Hal') as hal \gset
select tests.logout();
update public.user_profiles set mode_selected_at = now(), current_mode = 'Normal' where user_id in (:'fay', :'gus', :'hal');
update public.user_profiles
   set streak_count = 10, best_streak = 10, last_active_date = :'today'::date - 3, last_tick_date = :'today'::date - 3,
       streak_freezes = case user_id when :'fay' then 2 when :'gus' then 0 else 2 end,
       last_comeback_date = :'today'::date
 where user_id in (:'fay', :'gus');

select tests.login(:'fay'::uuid);
select public.get_dashboard() as d \gset
select tests.eq('freeze: streak survives a 2-day gap', (:'d'::jsonb ->> 'streak_count')::int, 10);
select tests.logout();
select tests.eq('freeze: one freeze spent', (select streak_freezes from public.user_profiles where user_id = :'fay'), 1);
select tests.eq('freeze: the bridged day counts as active', (select last_active_date from public.user_profiles where user_id = :'fay'), :'today'::date - 1);
select tests.ok('freeze: player is told', exists (select 1 from public.notifications where user_id = :'fay' and title like '%STREAK FREEZE USED%'));
select tests.login(:'fay'::uuid);
select public.complete_gate(tests.gate('keep going','Mid','Fitness',2)) as c \gset
select tests.eq('freeze: next conquest continues the streak', (:'c'::jsonb #>> '{profile,streak_count}')::int, 11);
select tests.eq('freeze: snapshot exposes freezes', (:'c'::jsonb #>> '{profile,streak_freezes}')::int, 1);

select tests.login(:'gus'::uuid);
select public.get_dashboard() as d \gset
select tests.eq('freeze: no freeze ⇒ streak resets', (:'d'::jsonb ->> 'streak_count')::int, 0);

-- earning: day 7 banks a freeze; the cap is respected
select tests.logout();
update public.user_profiles set streak_count = 6, best_streak = 6, last_active_date = :'today'::date - 1, last_tick_date = :'today'::date,
       streak_freezes = 0 where user_id = :'gus';
update public.user_profiles set streak_count = 6, best_streak = 6, last_active_date = :'today'::date - 1, last_tick_date = :'today'::date,
       streak_freezes = 2 where user_id = :'hal';
select tests.login(:'gus'::uuid);
select public.complete_gate(tests.gate('day seven','Mid','Fitness',2)) as c \gset
select tests.eq('freeze: streak hits 7', (:'c'::jsonb #>> '{profile,streak_count}')::int, 7);
select tests.eq('freeze: 7th day earns a freeze', (:'c'::jsonb #>> '{profile,streak_freezes}')::int, 1);
select tests.eq('freeze: reported to the client', (:'c'::jsonb #>> '{engagement,freeze_earned}'), 'true');
select tests.ok('trophy: Full Week unlocked', exists (select 1 from public.user_achievements where user_id = :'gus' and key = 'streak_7'));
select tests.login(:'hal'::uuid);
select public.complete_gate(tests.gate('capped','Mid','Fitness',2)) as c \gset
select tests.eq('freeze: free-plan cap of 2 holds', (:'c'::jsonb #>> '{profile,streak_freezes}')::int, 2);
select tests.logout();
select tests.pro(:'hal');
update public.user_profiles set streak_count = 13, last_active_date = :'today'::date - 1, last_freeze_grant = null where user_id = :'hal';
select tests.login(:'hal'::uuid);
select public.complete_gate(tests.gate('capped pro','Mid','Fitness',2)) as c \gset
select tests.eq('freeze: Pro cap is higher (14-day streak banks a third)', (:'c'::jsonb #>> '{profile,streak_freezes}')::int, 3);

-- ── B. Daily Bounties + chest ────────────────────────────────────────────────
select tests.mkuser('e40_Bea') as bea \gset
select tests.mkuser('e40_Cal') as cal \gset
select tests.mkuser('e40_Dax') as dax \gset
select tests.mkuser('e40_Eve') as eve \gset
select tests.logout();
update public.user_profiles set mode_selected_at = now(), current_mode = 'Normal', last_active_date = :'today'::date, last_tick_date = :'today'::date
 where user_id in (:'bea', :'cal', :'dax', :'eve');
select tests.ev(:'bea', 'Low', 5, 'General');
select tests.ev(:'cal', 'Mid', 20, 'Fitness'); select tests.ev(:'cal', 'Mid', 20, 'Learning'); select tests.ev(:'cal', 'Low', 5, 'Fitness');
select tests.ev(:'dax', 'High', 30, 'Fitness'); select tests.ev(:'dax', 'Mid', 30, 'Learning'); select tests.ev(:'dax', 'Mid', 30, 'Creative');
select tests.ev(:'dax', 'Super', 30, 'Fitness'); select tests.ev(:'dax', 'Mid', 30, 'Learning'); select tests.ev(:'dax', 'Mid', 30, 'Creative');
select tests.ev(:'eve', 'High', 30, 'Fitness'); select tests.ev(:'eve', 'Mid', 30, 'Learning'); select tests.ev(:'eve', 'Mid', 30, 'Creative');
select tests.ev(:'eve', 'Super', 30, 'Fitness'); select tests.ev(:'eve', 'Mid', 30, 'Learning'); select tests.ev(:'eve', 'Mid', 30, 'Creative');

select tests.login(:'bea'::uuid);
select public.get_engagement() as e \gset
select tests.eq('bounties: three of them', jsonb_array_length(:'e'::jsonb -> 'bounties'), 3);
select tests.eq('bounties: one per difficulty (easy → hard)', (select string_agg(x ->> 'difficulty', ',') from jsonb_array_elements(:'e'::jsonb -> 'bounties') x), '1,2,3');
select public.get_engagement() as e2 \gset
select tests.ok('bounties: stable for the whole day', (:'e'::jsonb -> 'bounties') = (:'e2'::jsonb -> 'bounties'));
select tests.ok('bounties: chest locked below 2 done', (:'e'::jsonb #>> '{chest,unlockable}') = 'false');
select tests.throws('chest: needs 2 of 3', $$select public.claim_bounty_chest()$$, 'BOUNTIES_INCOMPLETE%');

select tests.login(:'cal'::uuid);
select public.get_engagement() as e \gset
select tests.eq('bounties: exactly 2 done (easy + medium)', (:'e'::jsonb ->> 'bounties_done')::int, 2);
select tests.ok('bounties: chest unlockable at 2', (:'e'::jsonb #>> '{chest,unlockable}') = 'true');
select (public.get_dashboard() ->> 'total_points')::int as before \gset
select public.claim_bounty_chest() as ch \gset
select tests.eq('chest: unlucky roll ⇒ Common', (:'ch'::jsonb ->> 'rarity'), 'Common');
select tests.eq('chest: Common pays 15', (:'ch'::jsonb ->> 'xp')::int, 15);
select tests.eq('chest: balance +15, +10 First-Chest trophy, +10 First-Gate trophy (fixture conquests count)',
                (:'ch'::jsonb #>> '{profile,total_points}')::int, :before + 15 + 10 + 10);
select tests.throws('chest: one per day', $$select public.claim_bounty_chest()$$, 'ALREADY_CLAIMED%');
select tests.eq('chest: shown as claimed', (public.get_engagement() #>> '{chest,claimed}'), 'true');
select tests.logout();
select tests.eq('chest: ledgered as bounty XP', (select delta from public.xp_events where user_id = :'cal' and kind = 'bounty'), 15);
select tests.eq('chest: pity counter ticks', (select chest_pity from public.user_profiles where user_id = :'cal'), 1);

-- odds: a 3/3 day is luckier than a 2/3 day at the same roll
create or replace function private.rng() returns double precision language sql volatile as $$ select 0.25::float8 $$;
select tests.login(:'dax'::uuid);
select public.claim_bounty_chest() as ch \gset
select tests.eq('chest: perfect day, roll 0.25 ⇒ Rare', (:'ch'::jsonb ->> 'rarity'), 'Rare');
select tests.eq('chest: Rare pays 40', (:'ch'::jsonb ->> 'xp')::int, 40);
select tests.eq('chest: Rare drops a Surge Crystal', (:'ch'::jsonb ->> 'item'), 'Surge Crystal');
select tests.logout();
select tests.eq('chest: crystal is in the inventory', tests.inv(:'dax', 'XP_BOOST'), 1);

create or replace function private.rng() returns double precision language sql volatile as $$ select 0.01::float8 $$;
update public.user_profiles set chest_pity = 0, streak_freezes = 0 where user_id = :'eve';
select tests.login(:'eve'::uuid);
select public.claim_bounty_chest() as ch \gset
select tests.eq('chest: roll 0.01 ⇒ Epic', (:'ch'::jsonb ->> 'rarity'), 'Epic');
select tests.eq('chest: Epic pays 90 + a Streak Freeze', (:'ch'::jsonb ->> 'xp')::int, 90);
select tests.logout();
select tests.eq('chest: freeze banked', (select streak_freezes from public.user_profiles where user_id = :'eve'), 1);

-- pity timer: five Commons in a row guarantee a Rare
create or replace function private.rng() returns double precision language sql volatile as $$ select 0.99999::float8 $$;
select tests.mkuser('e40_Pia') as pia \gset
update public.user_profiles set mode_selected_at = now(), current_mode = 'Normal', last_active_date = :'today'::date,
       last_tick_date = :'today'::date, chest_pity = 5 where user_id = :'pia';
select tests.ev(:'pia', 'Mid', 20, 'Fitness'); select tests.ev(:'pia', 'Mid', 20, 'Learning'); select tests.ev(:'pia', 'Low', 5, 'Fitness');
select tests.login(:'pia'::uuid);
select public.claim_bounty_chest() as ch \gset
select tests.eq('pity: guaranteed Rare after 5 plain chests', (:'ch'::jsonb ->> 'rarity'), 'Rare');
select tests.logout();
select tests.eq('pity: counter resets', (select chest_pity from public.user_profiles where user_id = :'pia'), 0);

-- ── C. Achievements ──────────────────────────────────────────────────────────
select tests.mkuser('e40_Tia') as tia \gset
select tests.login(:'tia'::uuid);
select public.select_mode('Normal');
select public.get_achievements() as ach \gset
select tests.eq('trophies: catalog is visible', jsonb_array_length(:'ach'::jsonb) >= 25, true);
select tests.ok('trophies: locked ones carry progress', (select (x ->> 'progress')::numeric = 0 and x ->> 'unlocked_at' is null
                                                       from jsonb_array_elements(:'ach'::jsonb) x where x ->> 'key' = 'conq_10'));
select public.complete_gate(tests.gate('first blood','Mid','Fitness',2)) as c \gset
select tests.ok('trophies: First Gate unlocks on the first conquest',
                (:'c'::jsonb #> '{engagement,achievements}') @> '[{"key":"conq_1"}]'::jsonb);
select tests.eq('trophies: reward = 10 XP, paid once', (:'c'::jsonb #>> '{profile,total_points}')::int,
                (:'c'::jsonb #>> '{xp,applied}')::int + 10);
select public.complete_gate((select (x ->> 'id')::uuid from (select (public.save_gate(jsonb_build_object('title','again','xp_tier','Mid','category','Fitness','deadline', :'today'::date + 2))) x) s)) as c2 \gset
select tests.logout();
select tests.eq('trophies: unlocked once only', (select count(*)::int from public.xp_events where user_id = :'tia' and kind = 'achievement'), 1);
select tests.eq('trophies: row exists', (select count(*)::int from public.user_achievements where user_id = :'tia' and key = 'conq_1'), 1);
select tests.login(:'tia'::uuid);
select tests.ok('trophies: unlocked state is reported', (select x ->> 'unlocked_at' is not null from jsonb_array_elements(public.get_achievements()) x where x ->> 'key' = 'conq_1'));
select tests.ok('engagement: next trophy is the nearest locked one', (public.get_engagement() #>> '{achievements,next,key}') is not null);

-- ── D. World boss ────────────────────────────────────────────────────────────
select tests.logout();
select tests.ok('boss: this week''s boss exists', exists (select 1 from public.world_bosses where week_start = private.boss_week()));
select tests.eq('boss: first boss is 2,500 HP', (select hp from public.world_bosses where week_start = private.boss_week()), 2500);
select tests.eq('boss: damage = XP earned from conquests (Tia: 2 gates)',
                (select damage from public.boss_damage where week_start = private.boss_week() and user_id = :'tia'),
                (select sum(applied)::int from (select (meta ->> 'base')::int as base, delta as applied from public.xp_events
                                                where user_id = :'tia' and kind = 'complete') s));
select tests.mkuser('e40_Zed') as zed \gset
select tests.mkuser('e40_Yan') as yan \gset
select hp as hp from public.world_bosses where week_start = private.boss_week() \gset
select private.boss_week() as wk \gset
select tests.login(:'tia'::uuid);
select tests.throws('boss: loot locked while it stands', $$select public.claim_boss_reward()$$, 'BOSS_ALIVE%');
select tests.eq('boss: view reports not defeated', (public.get_engagement() #>> '{boss,defeated}'), 'false');
select tests.logout();
insert into public.boss_damage (week_start, user_id, damage) values (:'wk', :'zed', :hp) on conflict (week_start, user_id) do update set damage = excluded.damage;
select tests.login(:'tia'::uuid);
select tests.eq('boss: view reports defeated', (public.get_engagement() #>> '{boss,defeated}'), 'true');
select tests.eq('boss: contributor sees claimable loot', jsonb_array_length(public.get_engagement() #> '{boss,claimable}'), 1);
select (public.get_dashboard() ->> 'total_points')::int as before \gset
select public.claim_boss_reward() as bl \gset
select tests.eq('boss: loot = 80 XP', (:'bl'::jsonb ->> 'xp')::int, 80);
select tests.ok('boss: balance up by 80 (+75 trophy)', (:'bl'::jsonb #>> '{profile,total_points}')::int = :before + 80 + 75);
select tests.throws('boss: loot only once', $$select public.claim_boss_reward()$$, 'ALREADY_CLAIMED%');
select tests.throws('boss: old bosses expire', $$select public.claim_boss_reward(current_date - 60)$$, 'BOSS_EXPIRED%');
select tests.login(:'yan'::uuid);
select tests.throws('boss: free-riders get nothing', $$select public.claim_boss_reward()$$, 'NO_CONTRIBUTION%');
select tests.logout();
select tests.ok('boss: top contributors shown', jsonb_array_length((select private.boss_view(:'zed') -> 'top')) >= 2);

-- difficulty adapts: beaten ⇒ +15%, missed ⇒ −10% (floor 2,000)
select (private.boss_for(:'wk'::date + 7)).hp as hp_next \gset
select tests.eq('boss: beaten boss ⇒ next is 15% tougher', :hp_next, (round(:hp * 1.15 / 100.0)::int * 100));
select (private.boss_for(:'wk'::date + 14)).hp as hp_next2 \gset
select tests.eq('boss: missed boss ⇒ 10% easier', :hp_next2, greatest(2000, round(:hp_next * 0.9 / 100.0)::int * 100));
delete from public.world_bosses where week_start > :'wk'::date;

-- ── E. Comeback Surge ────────────────────────────────────────────────────────
select tests.mkuser('e40_Ned') as ned \gset
select tests.mkuser('e40_Uma') as uma \gset
update public.user_profiles set mode_selected_at = now(), current_mode = 'Easy', last_active_date = :'today'::date - 5,
       last_tick_date = :'today'::date - 5 where user_id = :'ned';
select tests.login(:'ned'::uuid);
select public.get_dashboard();
select tests.logout();
select tests.eq('comeback: 3 Surge Crystals after 5 idle days', tests.inv(:'ned', 'XP_BOOST'), 3);
select tests.ok('comeback: friendly notification', exists (select 1 from public.notifications where user_id = :'ned' and title like '%WELCOME BACK%'));
update public.user_profiles set last_tick_date = :'today'::date - 1, last_active_date = :'today'::date - 4 where user_id = :'ned';
select tests.login(:'ned'::uuid); select public.get_dashboard(); select tests.logout();
select tests.eq('comeback: once a week only', tests.inv(:'ned', 'XP_BOOST'), 3);
select tests.login(:'uma'::uuid); select public.get_dashboard(); select tests.logout();
select tests.eq('comeback: brand-new players get nothing', tests.inv(:'uma', 'XP_BOOST'), 0);

-- ── F. Referrals ─────────────────────────────────────────────────────────────
select tests.mkuser('e40_Rex') as rex \gset
select hunter_code as rex_code from public.user_profiles where user_id = :'rex' \gset
create or replace function tests.signup(p_name text, p_ref text) returns uuid language plpgsql security definer as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_id, lower(p_name) || '@test.local', jsonb_build_object('name', p_name, 'ref', p_ref));
  return v_id;
end $$;
grant execute on all functions in schema tests to anon, authenticated;
select tests.signup('e40_Kit', :'rex_code') as kit \gset
select tests.signup('e40_Lou', 'ZZZZZZZZ') as lou \gset
select tests.signup('e40_Max', 'not a code!!') as max \gset
select tests.eq('referral: valid code links the recruiter', (select referred_by from public.user_profiles where user_id = :'kit'), :'rex'::uuid);
select tests.ok('referral: unknown code is ignored', (select referred_by is null from public.user_profiles where user_id = :'lou'));
select tests.ok('referral: junk is ignored', (select referred_by is null from public.user_profiles where user_id = :'max'));
select tests.eq('referral: nothing paid at sign-up', tests.inv(:'rex', 'XP_BOOST'), 0);
select tests.login(:'kit'::uuid);
select public.select_mode('Normal');
select public.complete_gate(tests.gate('kit one','Mid','Fitness',2));
select tests.logout();
select tests.eq('referral: recruiter gets 2 crystals on the first conquest', tests.inv(:'rex', 'XP_BOOST'), 2);
select tests.eq('referral: recruit gets 1', tests.inv(:'kit', 'XP_BOOST'), 1);
select tests.ok('referral: recruiter is notified', exists (select 1 from public.notifications where user_id = :'rex' and title like '%RECRUIT ACTIVE%'));
select tests.ok('referral: Recruiter trophy unlocked', exists (select 1 from public.user_achievements where user_id = :'rex' and key = 'recruit_1'));
select tests.login(:'kit'::uuid);
select public.complete_gate(tests.gate('kit two','Mid','Fitness',2));
select tests.logout();
select tests.eq('referral: paid once, not per gate', tests.inv(:'rex', 'XP_BOOST'), 2);
select tests.login(:'rex'::uuid);
select tests.eq('referral: counts in the panel', (public.get_engagement() #>> '{referral,active}')::int, 1);
select tests.eq('referral: code in the panel', (public.get_engagement() #>> '{referral,code}'), :'rex_code');
select tests.logout();

-- farming cap: 20 paid recruits is the limit
select tests.mkuser('e40_Cap') as capu \gset
select hunter_code as cap_code from public.user_profiles where user_id = :'capu' \gset
select count(tests.signup('e40_farm' || i, :'cap_code')) from generate_series(1, 20) i;
update public.user_profiles set referral_paid = true where referred_by = :'capu';
select tests.signup('e40_Late', :'cap_code') as late \gset
select tests.login(:'late'::uuid);
select public.select_mode('Normal');
select public.complete_gate(tests.gate('late','Mid','Fitness',2));
select tests.logout();
select tests.eq('referral: no payout beyond 20 recruits', tests.inv(:'capu', 'XP_BOOST'), 0);

-- ── G. Nudges (honest: only while the streak is savable, once a day) ────────
select name as tz from pg_timezone_names where extract(hour from now() at time zone name) = 19 limit 1 \gset
select tests.mkuser('e40_Nia') as nia \gset
select tests.mkuser('e40_Oz')  as oz  \gset
select tests.mkuser('e40_Pat') as pat \gset
update public.user_profiles set timezone = :'tz', streak_count = 5,
       last_active_date = (now() at time zone :'tz')::date - 1 where user_id = :'nia';
update public.user_profiles set timezone = :'tz', streak_count = 5, streak_freezes = 1,
       last_active_date = (now() at time zone :'tz')::date where user_id = :'oz';
update public.user_profiles set timezone = :'tz', streak_count = 5,
       last_active_date = (now() at time zone :'tz')::date - 3 where user_id = :'pat';
select private.send_return_nudges() as sent \gset
select tests.ok('nudge: sent to the savable streak', exists (select 1 from public.notifications where user_id = :'nia' and title like '%streak ends at midnight%'));
select tests.ok('nudge: not to someone who already played', not exists (select 1 from public.notifications where user_id = :'oz' and title like '%midnight%'));
select tests.ok('nudge: not to a dead streak', not exists (select 1 from public.notifications where user_id = :'pat' and title like '%midnight%'));
select tests.eq('nudge: second run sends nothing new to Nia', (select count(*)::int from public.notifications where user_id = :'nia' and title like '%midnight%'), 1);
select private.send_return_nudges();
select tests.eq('nudge: once a day', (select count(*)::int from public.notifications where user_id = :'nia' and title like '%midnight%'), 1);
select tests.login(:'nia'::uuid);
select tests.eq('engagement: streak flagged at risk', (public.get_engagement() #>> '{streak,at_risk}'), 'true');
select tests.ok('engagement: countdown to local midnight', (public.get_engagement() ->> 'seconds_left')::int between 1 and 86400);
select tests.logout();

-- ── H. Security: nothing here can be forged ─────────────────────────────────
select tests.login(:'tia'::uuid);
select tests.throws('sec: cannot grant yourself freezes', $$update public.user_profiles set streak_freezes = 99 where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('sec: cannot forge a referrer', $$update public.user_profiles set referred_by = auth.uid()$$, 'permission denied%');
select tests.throws('sec: cannot insert a chest', $$insert into public.bounty_chests (user_id, day, rarity, xp) values (auth.uid(), current_date + 5, 'Epic', 9999)$$, 'permission denied%');
select tests.throws('sec: cannot unlock trophies', $$insert into public.user_achievements (user_id, key) values (auth.uid(), 'conq_500')$$, 'permission denied%');
select tests.throws('sec: cannot deal boss damage', $$insert into public.boss_damage (week_start, user_id, damage) values (private.boss_week(), auth.uid(), 99999)$$, 'permission denied%');
select tests.throws('sec: cannot rewrite the catalog', $$update public.achievement_catalog set xp_reward = 99999$$, 'permission denied%');
select tests.throws('sec: private internals stay private', $$select private.check_achievements(auth.uid())$$, 'permission denied%');
select tests.throws('sec: nudges are not client-callable', $$select private.send_return_nudges()$$, 'permission denied%');
select tests.eq('sec: sees only own chests', (select count(*)::int from public.bounty_chests where user_id <> auth.uid()), 0);
select tests.eq('sec: sees only own trophies', (select count(*)::int from public.user_achievements where user_id <> auth.uid()), 0);
select tests.eq('sec: nudge log is invisible', (select count(*)::int from information_schema.table_privileges where table_name = 'nudge_log' and grantee = 'authenticated'), 0);
select tests.anon();
select tests.throws('sec: anon has no engagement', $$select public.get_engagement()$$, 'permission denied%');
select tests.logout();
