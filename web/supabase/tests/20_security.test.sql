-- ============================================================================
-- SECURITY / ABUSE TESTS — every statement here is something a hostile signed-in user
-- (or an anonymous visitor) could try from the browser console with the public anon key.
-- ============================================================================
create or replace function private.rng() returns double precision language sql volatile as $$ select 0.99999::float8 $$;
select (now() at time zone 'UTC')::date as today \gset

-- Mallory is the attacker; Victim and Bystander are ordinary players.
select tests.mkuser('Mallory')  as m \gset
select tests.mkuser('Victim')   as v \gset
select tests.mkuser('Bystander') as by \gset
select tests.login(:'m'::uuid); select public.select_mode('Normal');
select tests.login(:'v'::uuid); select public.select_mode('Normal');
select tests.login(:'by'::uuid); select public.select_mode('Normal');

-- ── 0. sign-up keeps every class the UI offers (Register offers "Ranger", Profile offers "Archer")
select tests.logout();
select tests.mkuser('RangerGuy', 'Ranger') as u_ranger \gset
select tests.mkuser('ArcherGal', 'Archer') as u_archer \gset
select tests.mkuser('Hacker', 'Overlord') as u_junk \gset
select tests.eq('sign-up: Ranger is kept', (select player_class from public.user_profiles where user_id = :'u_ranger'), 'Ranger');
select tests.eq('sign-up: Archer is kept', (select player_class from public.user_profiles where user_id = :'u_archer'), 'Archer');
select tests.eq('sign-up: junk class falls back to Warrior', (select player_class from public.user_profiles where user_id = :'u_junk'), 'Warrior');

-- ── 1. cannot write game state on your own profile ──────────────────────────
select tests.login(:'m'::uuid);
select tests.throws('own XP is read-only',        $$update public.user_profiles set total_points = 999999 where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('own level is read-only',     $$update public.user_profiles set level = 99 where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('own rank is read-only',      $$update public.user_profiles set player_rank = 'SS' where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('own title is read-only',     $$update public.user_profiles set player_title = 'God' where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('own status is read-only',    $$update public.user_profiles set status = 'ACTIVE' where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('own streak is read-only',    $$update public.user_profiles set streak_count = 999 where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('own dark mana is read-only', $$update public.user_profiles set dark_mana = 0 where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('own ego is read-only',       $$update public.user_profiles set ego_score = 9999 where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('own mode is read-only (no dodging penalties)', $$update public.user_profiles set current_mode = 'Easy' where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('own stats are read-only',    $$update public.user_profiles set domain_mind = 100 where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('cannot self-join a clan via profile', $$update public.user_profiles set clan_id = gen_random_uuid() where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('cannot fake guild_title',    $$update public.user_profiles set guild_title = 'Guild Master' where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('cannot touch spent_xp',      $$update public.user_profiles set spent_xp = -5000 where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('cannot rewrite timezone directly (validated RPC only)', $$update public.user_profiles set timezone = 'Mars/X' where user_id = auth.uid()$$, 'permission denied%');
select tests.throws('cannot insert a second profile', $$insert into public.user_profiles (user_id, name) values (gen_random_uuid(), 'x')$$, 'permission denied%');
select tests.throws('cannot delete own profile directly', $$delete from public.user_profiles where user_id = auth.uid()$$, 'permission denied%');

-- cosmetics still work, and are validated
select tests.eq('cosmetic edit allowed', tests.affected($$update public.user_profiles set name = 'Mal', bio = 'hi' where user_id = auth.uid()$$), 1);
select tests.throws('name too long',   $$update public.user_profiles set name = repeat('x', 41) where user_id = auth.uid()$$, 'INVALID_NAME%');
select tests.throws('empty name',      $$update public.user_profiles set name = '  ' where user_id = auth.uid()$$, 'INVALID_NAME%');
select tests.throws('bio too long',    $$update public.user_profiles set bio = repeat('x', 501) where user_id = auth.uid()$$, 'INVALID_BIO%');
select tests.throws('avatar too long', $$update public.user_profiles set avatar_url = repeat('x', 2001) where user_id = auth.uid()$$, 'INVALID_AVATAR%');
select tests.throws('bad age',         $$update public.user_profiles set age = 3 where user_id = auth.uid()$$, 'INVALID_AGE%');
select tests.throws('unknown class',   $$update public.user_profiles set player_class = 'Overlord' where user_id = auth.uid()$$, 'INVALID_CLASS%');
update public.user_profiles set player_class = 'Mage' where user_id = :'m';
select tests.eq('class change re-derives the title', (select player_title from public.user_profiles where user_id = :'m'), 'Code Weaver');

-- ── 2. privacy: other players' data ─────────────────────────────────────────
select tests.eq('profiles: only my own row is readable', (select count(*)::int from public.user_profiles), 1);
select tests.eq('profiles: a victim row by id is invisible', (select count(*)::int from public.user_profiles where user_id = :'v'), 0);
select tests.eq('emails: cannot read anyone else''s', (select count(*)::int from public.user_profiles where email like '%@test.local' and user_id <> :'m'), 0);
select tests.ok('public_profiles: leaderboard data is visible', (select count(*) from public.public_profiles) >= 3);
select tests.throws('public_profiles: has no email column', $$select email from public.public_profiles$$, '%column "email" does not exist%');
select tests.throws('public_profiles: has no dark_mana column', $$select dark_mana from public.public_profiles$$, '%does not exist%');
select tests.throws('public_profiles: has no timezone column', $$select timezone from public.public_profiles$$, '%does not exist%');
select tests.eq('tasks: cannot see a victim''s tasks', (select count(*)::int from public.tasks where user_id = :'v'), 0);
select tests.eq('xp ledger: cannot read a victim''s history', (select count(*)::int from public.xp_events where user_id = :'v'), 0);
select tests.eq('inventory: cannot read a victim''s items', (select count(*)::int from public.inventory where user_id = :'v'), 0);

select tests.ok('public_activity: weekly counts are visible to every player', (select count(*) from public.public_activity) >= 1);
select tests.throws('public_activity: exposes no task content', $$select title from public.public_activity$$, '%does not exist%');

select tests.ok('public_conquests: category + XP of a rival, no titles', (select count(*) from public.public_conquests where user_id <> auth.uid()) >= 1);
select tests.throws('public_conquests: no task titles', $$select title from public.public_conquests$$, '%does not exist%');
select tests.ok('clan leaderboard is aggregated in the database', (select count(*) from public.clan_leaderboard) >= 0);
select tests.throws('leaderboards: no member emails', $$select email from public.guild_leaderboard$$, '%does not exist%');

-- ── 3. anonymous visitors get nothing (except public pricing) ───────────────
select tests.anon();
select tests.throws('anon: no profiles',  $$select * from public.user_profiles$$, 'permission denied%');
select tests.throws('anon: no public_profiles', $$select * from public.public_profiles$$, 'permission denied%');
select tests.throws('anon: no tasks',     $$select * from public.tasks$$, 'permission denied%');
select tests.throws('anon: cannot call complete_gate', $$select public.complete_gate(gen_random_uuid())$$, 'permission denied%');
select tests.throws('anon: cannot call get_dashboard', $$select public.get_dashboard()$$, 'permission denied%');
select tests.throws('anon: cannot find hunters', $$select * from public.find_hunter('ABCDEF12')$$, 'permission denied%');
select tests.ok('anon: pricing is public', (select count(*) from public.plans) >= 2);
select tests.throws('anon: cannot edit pricing', $$update public.plans set price_cents_monthly = 0$$, 'permission denied%');

-- ── 4. game tables are write-protected ──────────────────────────────────────
select tests.login(:'m'::uuid);
select tests.mktask(:'m'::uuid, 'mine') as mine \gset
select tests.throws('tasks: no direct insert',  $$insert into public.tasks (user_id, title, points) values (auth.uid(), 'x', 1000)$$, 'permission denied%');
select tests.throws('tasks: no direct update',  $$update public.tasks set points = 1000, is_completed = true$$, 'permission denied%');
select tests.throws('tasks: no direct delete',  $$delete from public.tasks$$, 'permission denied%');
select tests.throws('inventory: cannot mint an XP_BOOST', $$insert into public.inventory (user_id, name, item_type, quantity) values (auth.uid(), 'Boost', 'XP_BOOST', 999999)$$, 'permission denied%');
select tests.throws('inventory: no direct update', $$update public.inventory set quantity = 999$$, 'permission denied%');
select tests.throws('shadows: cannot mint a Mythic', $$insert into public.shadows (user_id, name, rarity, bonus_value) values (auth.uid(), 'Ashborn', 'Mythic', 99)$$, 'permission denied%');
select tests.throws('ledger: no direct insert', $$insert into public.xp_events (user_id, kind, delta) values (auth.uid(), 'admin', 99999)$$, 'permission denied%');
select tests.throws('daily points: no direct insert', $$insert into public.user_points (user_id, date, daily_points) values (auth.uid(), current_date, 99999)$$, 'permission denied%');
select tests.throws('claims: no direct insert', $$insert into public.reward_claims (user_id, name, tier, xp_cost, expires_at) values (auth.uid(), 'x', '1', 0, now())$$, 'permission denied%');
select tests.throws('notifications: cannot forge', $$insert into public.notifications (user_id, title) values (auth.uid(), 'You won!')$$, 'permission denied%');
select tests.throws('challenges: cannot forge a win', $$insert into public.challenges (creator_id, opponent_id, expires_at, status, winner_id) values (auth.uid(), auth.uid(), now(), 'completed', auth.uid())$$, 'permission denied%');
select tests.throws('season records: no direct insert', $$insert into public.season_records (user_id, mode) values (auth.uid(), 'Hell')$$, 'permission denied%');
select tests.throws('plans: no writes', $$insert into public.plans (id, name) values ('hack', 'x')$$, 'permission denied%');
select tests.throws('subscriptions: cannot grant yourself Pro', $$insert into public.subscriptions (user_id, plan_id) values (auth.uid(), 'pro')$$, 'permission denied%');
select tests.throws('usage: cannot reset your own AI quota', $$delete from public.usage_counters$$, 'permission denied%');
select tests.throws('reference data: no writes', $$update public.game_modes set xp_multiplier = 100$$, 'permission denied%');
select tests.throws('reference data: no writes (rewards)', $$update public.system_rewards set xp_cost = 0$$, 'permission denied%');
select tests.eq('notifications: mark-read is allowed', tests.affected($$update public.notifications set is_read = true where user_id = auth.uid()$$) >= 0, true);
select tests.throws('notifications: cannot edit content', $$update public.notifications set title = 'x'$$, 'permission denied%');

-- ── 5. private internals are unreachable ────────────────────────────────────
select tests.throws('private fns are not callable', $$select private.record_xp(auth.uid(), 'admin', 99999, 99999, false, null, '{}')$$, 'permission denied%');
select tests.throws('private fns are not callable (tick)', $$select private.tick_user(auth.uid())$$, 'permission denied%');
select tests.throws('cannot plant code in private', $$create function private.evil() returns int language sql as 'select 1'$$, 'permission denied%');
select tests.throws('cannot create objects in public', $$create table public.evil (id int)$$, 'permission denied%');
select tests.ok('legacy hunter-code function is gone', to_regprocedure('public.get_profile_by_hunter_code(text)') is null);

-- ── 6. rewards & punishments: narrow writes ─────────────────────────────────
select tests.eq('custom reward: own insert works', tests.affected($$insert into public.rewards (user_id, name, xp_cost, tier) values (auth.uid(), 'Pizza', 10, '1')$$), 1);
select tests.throws('custom reward: cannot pre-claim', $$insert into public.rewards (user_id, name, xp_cost, tier, is_claimed) values (auth.uid(), 'x', 0, '1', true)$$, 'permission denied%');
select tests.throws('custom reward: cannot set expiry', $$insert into public.rewards (user_id, name, xp_cost, tier, expires_at) values (auth.uid(), 'x', 0, '1', now() + interval '1 year')$$, 'permission denied%');
select tests.throws('custom reward: cannot gift to a victim', format($q$insert into public.rewards (user_id, name, xp_cost, tier) values ('%s', 'x', 0, '1')$q$, :'v'), '%row-level security%');
select tests.throws('custom reward: negative cost rejected', $$insert into public.rewards (user_id, name, xp_cost, tier) values (auth.uid(), 'x', -5, '1')$$, '%violates check constraint%');
select tests.throws('custom reward: absurd cost rejected', $$insert into public.rewards (user_id, name, xp_cost, tier) values (auth.uid(), 'x', 99999999, '1')$$, '%violates check constraint%');
select tests.throws('punishment: cannot reset trigger count', $$update public.punishments set triggered = 0$$, 'permission denied%');

-- ── 7. friendships & DMs ────────────────────────────────────────────────────
select tests.eq('friend request: allowed', tests.affected(format($q$insert into public.friendship (requester_id, receiver_id, status) values ('%s', '%s', 'pending')$q$, :'m', :'v')), 1);
select tests.throws('friend request: cannot forge an accepted friendship', format($q$insert into public.friendship (requester_id, receiver_id, status) values ('%s', '%s', 'accepted')$q$, :'m', :'by'), '%row-level security%');
select tests.throws('friend request: cannot impersonate someone else', format($q$insert into public.friendship (requester_id, receiver_id, status) values ('%s', '%s', 'pending')$q$, :'v', :'by'), '%row-level security%');
select tests.throws('friend request: not with yourself', format($q$insert into public.friendship (requester_id, receiver_id, status) values ('%s', '%s', 'pending')$q$, :'m', :'m'), '%row-level security%');
select tests.eq('friend request: requester cannot accept their own', tests.affected(format($q$update public.friendship set status = 'accepted' where requester_id = '%s'$q$, :'m')), 0);
select tests.eq('friend request: still pending', (select status from public.friendship where requester_id = :'m' and receiver_id = :'v'), 'pending');
select tests.throws('DM: strangers cannot message you', format($q$insert into public.direct_messages (sender_id, receiver_id, message) values ('%s', '%s', 'spam')$q$, :'m', :'v'), '%row-level security%');
select tests.login(:'v'::uuid);
select tests.eq('friend request: the receiver can accept', tests.affected(format($q$update public.friendship set status = 'accepted' where receiver_id = '%s'$q$, :'v')), 1);
select tests.login(:'m'::uuid);
select tests.eq('DM: friends can message', tests.affected(format($q$insert into public.direct_messages (sender_id, receiver_id, message) values ('%s', '%s', 'hello')$q$, :'m', :'v')), 1);
select tests.throws('DM: cannot spoof the sender', format($q$insert into public.direct_messages (sender_id, receiver_id, message) values ('%s', '%s', 'x')$q$, :'v', :'m'), '%row-level security%');
select tests.throws('DM: length limit', format($q$insert into public.direct_messages (sender_id, receiver_id, message) values ('%s', '%s', repeat('x', 2001))$q$, :'m', :'v'), '%violates check constraint%');
select tests.login(:'by'::uuid);
select tests.eq('DM: a bystander cannot read it', (select count(*)::int from public.direct_messages), 0);

-- ── 8. clans: membership only through RPC, with consent ─────────────────────
select tests.login(:'m'::uuid);
select tests.throws('clan: free plan cannot create groups', $$select public.create_clan('Dark Brotherhood')$$, 'PLAN_LIMIT%');
select tests.pro(:'m'::uuid);
select (public.create_clan('Dark Brotherhood', 'we ride') ->> 'id') as clan \gset
select tests.throws('clan: only one clan per hunter', $$select public.create_clan('Another')$$, 'ALREADY_IN_CLAN%');
select tests.throws('clan: names are unique (case-insensitive)', $$select public.create_clan('dark brotherhood')$$, 'ALREADY_IN_CLAN%');
select tests.login(:'by'::uuid);
select tests.throws('clan: cannot self-insert a membership', format($q$insert into public.clan_members (clan_id, user_id, role) values ('%s', '%s', 'leader')$q$, :'clan', :'by'), 'permission denied%');
select tests.throws('clan: cannot take over a clan', format($q$update public.clans set leader_id = '%s' where id = '%s'$q$, :'by', :'clan'), 'permission denied%');
select tests.throws('clan: cannot delete a clan', format($q$delete from public.clans where id = '%s'$q$, :'clan'), 'permission denied%');
select tests.throws('clan: non-officers cannot invite', format($q$select public.invite_to_clan('%s')$q$, :'v'), 'NOT_OFFICER%');
select tests.login(:'m'::uuid);
select public.invite_to_clan(:'by'::uuid);
select tests.throws('clan: duplicate invite refused', format($q$select public.invite_to_clan('%s')$q$, :'by'), 'ALREADY_INVITED%');
select tests.eq('clan: invitee is NOT force-added', (select count(*)::int from public.clan_members where user_id = :'by'), 0);
select id as inv from public.clan_invites where invitee_id = :'by' \gset
select tests.login(:'v'::uuid);
select tests.eq('clan: invites are private to inviter/invitee', (select count(*)::int from public.clan_invites), 0);
select tests.throws('clan: a third party cannot accept someone else''s invite', format($q$select public.respond_clan_invite('%s', true)$q$, :'inv'), 'INVITE_NOT_FOUND%');
select tests.login(:'by'::uuid);
select tests.ok('clan: the invitee sees their invite', jsonb_array_length(public.my_invites() -> 'clan') = 1);
select (public.respond_clan_invite(:'inv'::uuid, true) ->> 'joined') as joined \gset
select tests.eq('clan: invitee accepts', :'joined', 'true');
select tests.eq('clan: membership recorded', (select role from public.clan_members where user_id = :'by'), 'member');

-- fill the clan to 5 and check the cap
select tests.logout();
create or replace function tests.join_clan(p_name text, p_leader uuid) returns void language plpgsql as $$
declare u uuid := tests.mkuser(p_name); i uuid;
begin
  perform tests.login(p_leader); perform public.invite_to_clan(u);
  perform tests.login(u);
  select id into i from public.clan_invites where invitee_id = u and status = 'pending';
  perform public.respond_clan_invite(i, true);
end $$;
select tests.join_clan('C3', :'m'::uuid);
select tests.join_clan('C4', :'m'::uuid);
select tests.join_clan('C5', :'m'::uuid);
select tests.mkuser('C6') as c6 \gset
select tests.login(:'m'::uuid);
select tests.throws('clan: capped at 5', format($q$select public.invite_to_clan('%s')$q$, :'c6'), 'CLAN_FULL%');

-- events: officers only, bounded rewards, visible to members only
select tests.login(:'by'::uuid);
select tests.throws('clan events: a plain member cannot create one', format($q$insert into public.clan_events (clan_id, creator_id, title) values ('%s', '%s', 'x')$q$, :'clan', :'by'), '%row-level security%');
select tests.login(:'m'::uuid);
select tests.eq('clan events: the leader can', tests.affected(format($q$insert into public.clan_events (clan_id, creator_id, title, xp_reward, status) values ('%s', '%s', 'Raid night', 100, 'active')$q$, :'clan', :'m')), 1);
select tests.throws('clan events: absurd reward rejected', format($q$insert into public.clan_events (clan_id, creator_id, title, xp_reward) values ('%s', '%s', 'x', 99999)$q$, :'clan', :'m'), '%violates check constraint%');
select tests.login(:'v'::uuid);
select tests.eq('clan events: outsiders cannot see them', (select count(*)::int from public.clan_events), 0);
select tests.eq('clan events: outsiders cannot delete them', tests.affected($$delete from public.clan_events$$), 0);
select tests.login(:'by'::uuid);
select tests.eq('clan events: members can see them', (select count(*)::int from public.clan_events), 1);

-- ── 9. assigned quests ──────────────────────────────────────────────────────
select tests.login(:'v'::uuid);
select tests.throws('assign: strangers cannot assign you quests', format($q$select public.assign_quest('%s', 'Do my taxes')$q$, :'by'), 'NOT_AUTHORIZED%');
select tests.login(:'m'::uuid);
select tests.throws('assign: not to yourself', format($q$select public.assign_quest('%s', 'x')$q$, :'m'), 'INVALID_TARGET%');
select tests.throws('assign: outsiders are off limits', format($q$select public.assign_quest('%s', 'x')$q$, :'v'), 'NOT_AUTHORIZED%');
select (public.assign_quest(:'by'::uuid, 'Scout the north', 'General', 'Mid', 'High', null, 'go') ->> 'id') as aq \gset
select tests.logout();
select tests.eq('assign: owned by the assignee', (select user_id from public.tasks where id = :'aq'), :'by'::uuid);
select tests.eq('assign: remembers the assigner', (select created_by from public.tasks where id = :'aq'), :'m'::uuid);
select tests.eq('assign: XP comes from the tier, not the caller', (select points from public.tasks where id = :'aq'), 15);
select tests.ok('assign: assignee is notified', exists (select 1 from public.notifications where user_id = :'by' and title = 'New Mission Assigned'));
select tests.login(:'m'::uuid);
select tests.throws('assign: the assigner cannot cash it in', format($q$select public.complete_gate('%s')$q$, :'aq'), 'GATE_NOT_FOUND%');
select tests.login(:'by'::uuid);
select tests.ok('assign: the assignee sees it', exists (select 1 from public.tasks where id = :'aq'));
-- Mid 15 × General 0.7 = 10.5 → 11
select tests.eq('assign: assignee is paid', (public.complete_gate(:'aq'::uuid) #>> '{xp,earned}')::int, 11);
-- Self-created gates must not claim "you have been assigned a quest".
select tests.logout();
select tests.eq('no self-assignment notification spam', (select count(*)::int from public.notifications where user_id = :'m' and title = 'New Mission Assigned'), 0);

-- ── 10. cross-user tampering via RPCs ────────────────────────────────────────
select tests.login(:'v'::uuid);
select tests.gate('victim secret', 'Mid', 'Fitness', 2) as vg \gset
select tests.login(:'m'::uuid);
select tests.throws('rpc: cannot complete another player''s gate', format($q$select public.complete_gate('%s')$q$, :'vg'), 'GATE_NOT_FOUND%');
select tests.throws('rpc: cannot fail another player''s gate', format($q$select public.fail_gate('%s')$q$, :'vg'), 'GATE_NOT_FOUND%');
select tests.throws('rpc: cannot edit another player''s gate', format($q$select public.save_gate('{"title":"pwned"}', '%s')$q$, :'vg'), 'GATE_NOT_FOUND%');
select tests.throws('rpc: cannot start another player''s raid', format($q$select public.raid_action('%s', 'start')$q$, :'vg'), 'GATE_NOT_FOUND%');
select tests.throws('rpc: cannot reactivate another player''s gate', format($q$select public.reactivate_gate('%s')$q$, :'vg'), 'GATE_NOT_FOUND%');
select public.delete_gate(:'vg'::uuid);
select tests.logout();
select tests.ok('rpc: delete_gate on someone else''s gate is a no-op', exists (select 1 from public.tasks where id = :'vg'));
insert into public.rewards (user_id, name, xp_cost, tier) values (:'v', 'Victim treat', 1, '1') returning id as vrew \gset
select tests.login(:'m'::uuid);
select tests.throws('rpc: cannot claim another player''s reward', format($q$select public.claim_reward(p_reward_id => '%s')$q$, :'vrew'), 'REWARD_NOT_FOUND%');

-- mass assignment: extra keys in the payload are ignored
select (public.save_gate('{"title":"sneaky","xp_tier":"Low","points":1000,"is_completed":true,"xp_paid":true,"user_id":"00000000-0000-0000-0000-000000000001","is_system_generated":true,"completed_at":"2020-01-01"}') ->> 'id') as sg \gset
select tests.logout();
select tests.eq('mass-assignment: stays open', (select is_completed from public.tasks where id = :'sg'), false);
select tests.eq('mass-assignment: points from tier', (select points from public.tasks where id = :'sg'), 5);
select tests.eq('mass-assignment: stays mine', (select user_id from public.tasks where id = :'sg'), :'m'::uuid);
select tests.eq('mass-assignment: not system generated', (select is_system_generated from public.tasks where id = :'sg'), false);
select tests.eq('mass-assignment: unpaid', (select xp_paid from public.tasks where id = :'sg'), false);

-- ── 11. duels ────────────────────────────────────────────────────────────────
select tests.login(:'m'::uuid);
select tests.throws('duel: friends only', format($q$select public.create_challenge('%s', 100, 3)$q$, :'by'), 'NOT_FRIENDS%');
select tests.throws('duel: not yourself', format($q$select public.create_challenge('%s', 100, 3)$q$, :'m'), 'INVALID_TARGET%');
select tests.throws('duel: target floor', format($q$select public.create_challenge('%s', 5, 3)$q$, :'v'), 'INVALID_TARGET_XP%');
select tests.throws('duel: duration cap', format($q$select public.create_challenge('%s', 100, 99)$q$, :'v'), 'INVALID_DURATION%');
select (public.create_challenge(:'v'::uuid, 50, 3) ->> 'id') as duel \gset
select tests.throws('duel: one at a time per pair', format($q$select public.create_challenge('%s', 50, 3)$q$, :'v'), 'DUEL_EXISTS%');
select tests.logout();
select tests.eq('duel: baselines are server-set (cannot be rigged)', (select creator_start_pts + opponent_start_pts from public.challenges where id = :'duel'), 0);
-- Mallory earns 60 XP AFTER the duel started; Victim only 20.
insert into public.xp_events (user_id, kind, delta, raw, counts_weekly) values (:'m', 'complete', 60, 60, true), (:'v', 'complete', 20, 20, true);
select tests.login(:'v'::uuid);
select public.list_challenges() as lc \gset
select tests.eq('duel: resolved on view', (:'lc'::jsonb #>> '{0,status}'), 'completed');
select tests.eq('duel: first to the target wins', (:'lc'::jsonb #>> '{0,winner_id}'), :'m');
select tests.eq('duel: progress is earned XP, not balance', (:'lc'::jsonb #>> '{0,opponent_pts}')::int, 20);
select tests.logout();
select tests.ok('duel: winner notified', exists (select 1 from public.notifications where user_id = :'m' and title like '%DUEL WON%'));
select tests.ok('duel: loser notified', exists (select 1 from public.notifications where user_id = :'v' and title like '%DUEL LOST%'));
-- expiry
select tests.login(:'m'::uuid);
select (public.create_challenge(:'v'::uuid, 900, 1) ->> 'id') as duel2 \gset
select tests.logout();
update public.challenges set expires_at = now() - interval '1 hour' where id = :'duel2';
select tests.login(:'m'::uuid);
select public.list_challenges();
select tests.logout();
select tests.eq('duel: expires when nobody gets there', (select status from public.challenges where id = :'duel2'), 'expired');

-- ── 12. hunter lookup ───────────────────────────────────────────────────────
select tests.login(:'by'::uuid);
select tests.eq('find_hunter: by code', (select user_id from public.find_hunter((select hunter_code from public.user_profiles where user_id = auth.uid()))), :'by'::uuid);
select tests.eq('find_hunter: wrong code finds nothing (the old RPC returned a random profile)', (select count(*)::int from public.find_hunter('ZZZZZZZZ')), 0);
select tests.eq('find_hunter: too short finds nothing', (select count(*)::int from public.find_hunter('AB')), 0);
select tests.eq('find_hunter: by full id', (select name from public.find_hunter(:'m')), 'Mal');
select tests.throws('find_hunter: never leaks email', $$select email from public.find_hunter('ABCDEF12')$$, '%column "email" does not exist%');

-- ── 13. daily gift: server-side window + once per day ───────────────────────
select tests.mkuser('Gifty') as g \gset
select tests.login(:'g'::uuid);
select public.select_mode('Normal');
select tests.logout();
select name as tz_noon from pg_timezone_names where name like 'Etc/GMT%' and extract(hour from now() at time zone name) = 12 limit 1 \gset
select name as tz_night from pg_timezone_names where name like 'Etc/GMT%' and extract(hour from now() at time zone name) = 3 limit 1 \gset
select tests.login(:'g'::uuid);
select public.set_timezone(:'tz_night');
select tests.throws('gift: closed at 03:00 local', $$select public.claim_daily_gift()$$, 'WINDOW_CLOSED%');
select public.set_timezone(:'tz_noon');
select (public.claim_daily_gift() ->> 'name') as gift \gset
select tests.ok('gift: opens at noon local', :'gift' is not null);
select tests.throws('gift: once per local day', $$select public.claim_daily_gift()$$, 'ALREADY_CLAIMED%');
select tests.eq('gift: stored as a rental', (select (metadata ->> 'is_rental')::boolean from public.inventory where user_id = auth.uid()), true);
