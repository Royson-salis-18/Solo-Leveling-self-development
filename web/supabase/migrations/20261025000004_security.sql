-- ============================================================================
-- 04 · SECURITY LOCKDOWN
--
-- Before this migration any signed-in user could, from the browser console:
--   • set their own total_points / level / rank / status / streak / dark_mana
--   • mint XP_BOOST items or Legendary shadows (inventory & shadows were FOR ALL)
--   • add or remove ANYONE from ANY clan/guild, and delete other clans' events
--   • read every other user's email address
--   • DM any user (no friendship needed) and "accept" their own friend request
--
-- Model now: tables are read-only to clients (plus a few safe, column-limited
-- writes); every game-state change goes through the SECURITY DEFINER RPCs in 02/03.
--
-- Postgres policies are PERMISSIVE and OR together, so we drop *every* existing
-- policy on these tables first — a single forgotten "allow all" policy (e.g. one
-- created in the dashboard) would otherwise silently defeat everything below.
-- ============================================================================

-- ── 0. signed-out visitors get nothing, and new tables are closed by default ─
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
-- Supabase auto-grants ALL on every new table to `authenticated` (RLS is then the only guard).
-- Secure by default instead: a new table needs an explicit GRANT, so forgetting one fails
-- loudly rather than exposing data.
alter default privileges in schema public revoke all on tables from authenticated;

-- ── 1. enable RLS and wipe every pre-existing policy ─────────────────────────
do $$
declare
  t text; r record;
  tables text[] := array[
    'user_profiles','tasks','user_points','xp_events','reward_claims','rewards','punishments','inventory',
    'shadows','skills','notifications','friendship','direct_messages','global_chat','clans','clan_members',
    'clan_invites','guilds','guild_members','guild_invites','clan_events','guild_events','challenges',
    'season_records','game_modes','reward_tiers','system_rewards','shadow_catalog','category_stats','item_catalog'];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from authenticated', t);
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', r.policyname, t);
    end loop;
  end loop;
end $$;

-- PII hygiene: tasks / user_points once carried a denormalised email. Nothing writes it now,
-- and an assignee could read the assigner's address from it.
update public.tasks       set email = null where email is not null;
update public.user_points set email = null where email is not null;

-- ── 2. profiles ──────────────────────────────────────────────────────────────
-- Own row only. Other players are read through public_profiles (no email, no Dark Mana,
-- no timezone, no activity timestamps).
grant select on public.user_profiles to authenticated;
create policy profiles_select_own on public.user_profiles for select to authenticated using (user_id = auth.uid());

-- Players may edit cosmetics only. XP, level, rank, title, status, streak, dark mana, mode,
-- clan/guild membership and guild_title are server-owned.
grant update (name, bio, avatar_url, player_class, player_job, monarch_allegiance,
              weapon_of_choice, gear_style, age, guild_aura_card, guild_logo)
  on public.user_profiles to authenticated;
create policy profiles_update_own on public.user_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Validate cosmetic edits only when the value actually changes, so a legacy row with an odd
-- value can never wedge the server-side functions that update the same row.
-- SECURITY DEFINER: the trigger fires as the signed-in player, who has no access to `private`,
-- but it must call private.title_for when a class changes.
create or replace function private.profile_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.name is distinct from old.name and char_length(btrim(coalesce(new.name, ''))) not between 1 and 40 then
    raise exception 'INVALID_NAME: A name needs 1–40 characters.' using errcode = 'P0001';
  end if;
  if new.bio is distinct from old.bio and char_length(coalesce(new.bio, '')) > 500 then
    raise exception 'INVALID_BIO: A bio can be at most 500 characters.' using errcode = 'P0001';
  end if;
  if new.avatar_url is distinct from old.avatar_url and char_length(coalesce(new.avatar_url, '')) > 2000 then
    raise exception 'INVALID_AVATAR: Avatar URL is too long.' using errcode = 'P0001';
  end if;
  if new.age is distinct from old.age and new.age is not null and new.age not between 5 and 120 then
    raise exception 'INVALID_AGE: Enter a realistic age.' using errcode = 'P0001';
  end if;
  if new.player_class is distinct from old.player_class then
    if new.player_class not in ('Warrior','Mage','Assassin','Tank','Healer','Archer','Necromancer','Tamer','Craftsman','Scout') then
      raise exception 'INVALID_CLASS: Unknown class.' using errcode = 'P0001';
    end if;
    new.player_title := private.title_for(new.player_class, coalesce(new.total_points, 0) + coalesce(new.spent_xp, 0));
  end if;
  return new;
end $$;

drop trigger if exists trg_profile_guard on public.user_profiles;
create trigger trg_profile_guard before update on public.user_profiles
  for each row execute function private.profile_guard();

create or replace view public.public_profiles with (security_invoker = false) as
select user_id, name,
       case when char_length(avatar_url) <= 2000 then avatar_url end as avatar_url,
       bio, player_class, player_rank, player_title, player_job, monarch_allegiance,
       level, total_points, standing_xp, status, streak_count, current_mode,
       guild_id, clan_id, guild_title, guild_logo, guild_aura_card,
       weapon_of_choice, gear_style,
       domain_physical, domain_mind, domain_soul, domain_execution, domain_builder,
       ego_score, playmaker_rating, created_at
  from public.user_profiles;
grant select on public.public_profiles to authenticated;

-- ── 3. read-only game state (writes only via RPC) ────────────────────────────
grant select on public.tasks, public.user_points, public.xp_events, public.reward_claims,
                public.inventory, public.season_records, public.challenges to authenticated;

create policy tasks_select_own       on public.tasks         for select to authenticated using (user_id = auth.uid() or assigned_to = auth.uid());
create policy points_select_own      on public.user_points   for select to authenticated using (user_id = auth.uid());
create policy xp_events_select_own   on public.xp_events     for select to authenticated using (user_id = auth.uid());
create policy claims_select_own      on public.reward_claims for select to authenticated using (user_id = auth.uid());
create policy inventory_select_own   on public.inventory     for select to authenticated using (user_id = auth.uid());
create policy seasons_select_own     on public.season_records for select to authenticated using (user_id = auth.uid());
create policy challenges_select_own  on public.challenges    for select to authenticated using (creator_id = auth.uid() or opponent_id = auth.uid());

-- Shadows and skills are public flair (the War Room shows everyone's army); still read-only.
grant select on public.shadows, public.skills to authenticated;
create policy shadows_select_all on public.shadows for select to authenticated using (true);
create policy skills_select_all  on public.skills  for select to authenticated using (true);

-- ── 4. player-authored content: narrow, column-limited writes ───────────────
grant select, delete on public.rewards to authenticated;
grant insert (user_id, name, xp_cost, tier) on public.rewards to authenticated;
create policy rewards_select_own on public.rewards for select to authenticated using (user_id = auth.uid());
create policy rewards_insert_own on public.rewards for insert to authenticated
  with check (user_id = auth.uid() and char_length(btrim(name)) between 1 and 80);
create policy rewards_delete_own on public.rewards for delete to authenticated using (user_id = auth.uid());

grant select, delete on public.punishments to authenticated;
grant insert (user_id, name, xp_penalty) on public.punishments to authenticated;
create policy punishments_select_own on public.punishments for select to authenticated using (user_id = auth.uid());
create policy punishments_insert_own on public.punishments for insert to authenticated
  with check (user_id = auth.uid() and char_length(btrim(name)) between 1 and 80);
create policy punishments_delete_own on public.punishments for delete to authenticated using (user_id = auth.uid());

-- Notifications are created by the server only; players can mark read / delete their own.
grant select, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
create policy notif_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ── 5. social ────────────────────────────────────────────────────────────────
-- Friend requests: only the RECEIVER can accept (the requester used to be able to accept their
-- own request); nobody can fabricate an already-accepted friendship.
grant select, delete on public.friendship to authenticated;
grant insert (requester_id, receiver_id, status) on public.friendship to authenticated;
grant update (status) on public.friendship to authenticated;
create policy friend_select on public.friendship for select to authenticated
  using (requester_id = auth.uid() or receiver_id = auth.uid());
create policy friend_insert on public.friendship for insert to authenticated
  with check (requester_id = auth.uid() and receiver_id <> auth.uid() and status = 'pending');
create policy friend_accept on public.friendship for update to authenticated
  using (receiver_id = auth.uid() and status = 'pending')
  with check (receiver_id = auth.uid() and status = 'accepted');
create policy friend_delete on public.friendship for delete to authenticated
  using (requester_id = auth.uid() or receiver_id = auth.uid());

-- Direct messages: friends only (any user could previously message any other user).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dm_len') then
    update public.direct_messages set message = left(message, 2000) where char_length(message) > 2000;
    alter table public.direct_messages add constraint dm_len check (char_length(message) between 1 and 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chat_len') then
    update public.global_chat set message = left(message, 500) where char_length(message) > 500;
    alter table public.global_chat add constraint chat_len check (char_length(message) between 1 and 500);
  end if;
end $$;

grant select, delete on public.direct_messages to authenticated;
grant insert (sender_id, receiver_id, message) on public.direct_messages to authenticated;
create policy dm_select on public.direct_messages for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy dm_insert on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid() and private.is_friend(sender_id, receiver_id));
create policy dm_delete on public.direct_messages for delete to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

grant select on public.global_chat to authenticated;
grant insert (user_id, message) on public.global_chat to authenticated;
create policy chat_select on public.global_chat for select to authenticated using (true);
create policy chat_insert on public.global_chat for insert to authenticated with check (user_id = auth.uid());

-- ── 6. clans & guilds: rosters are visible, membership is RPC-only ──────────
grant select on public.clans, public.clan_members, public.guilds, public.guild_members to authenticated;
create policy clans_select        on public.clans         for select to authenticated using (true);
create policy clan_members_select on public.clan_members  for select to authenticated using (true);
create policy guilds_select       on public.guilds        for select to authenticated using (true);
create policy guild_members_select on public.guild_members for select to authenticated using (true);

grant select on public.clan_invites, public.guild_invites to authenticated;
create policy clan_invites_select  on public.clan_invites  for select to authenticated
  using (invitee_id = auth.uid() or inviter_id = auth.uid());
create policy guild_invites_select on public.guild_invites for select to authenticated
  using (invitee_id = auth.uid() or inviter_id = auth.uid());

-- Events: visible to the group (and, for wars, the opponent); only officers manage them.
grant select, delete on public.clan_events, public.guild_events to authenticated;
grant insert (clan_id, creator_id, title, description, event_type, opponent_clan_id, xp_reward, start_time, end_time, status)
  on public.clan_events to authenticated;
grant insert (guild_id, creator_id, title, description, event_type, opponent_guild_id, xp_reward, start_time, end_time, status)
  on public.guild_events to authenticated;
grant update (title, description, status) on public.clan_events, public.guild_events to authenticated;

create policy clan_events_select on public.clan_events for select to authenticated
  using (private.is_clan_member(clan_id, auth.uid()) or private.is_clan_member(opponent_clan_id, auth.uid()));
create policy clan_events_insert on public.clan_events for insert to authenticated
  with check (creator_id = auth.uid() and private.is_clan_officer(clan_id, auth.uid()));
create policy clan_events_update on public.clan_events for update to authenticated
  using (private.is_clan_officer(clan_id, auth.uid())) with check (private.is_clan_officer(clan_id, auth.uid()));
create policy clan_events_delete on public.clan_events for delete to authenticated
  using (private.is_clan_officer(clan_id, auth.uid()));

create policy guild_events_select on public.guild_events for select to authenticated
  using (private.is_guild_member(guild_id, auth.uid()) or private.is_guild_member(opponent_guild_id, auth.uid()));
create policy guild_events_insert on public.guild_events for insert to authenticated
  with check (creator_id = auth.uid() and private.is_guild_officer(guild_id, auth.uid()));
create policy guild_events_update on public.guild_events for update to authenticated
  using (private.is_guild_officer(guild_id, auth.uid())) with check (private.is_guild_officer(guild_id, auth.uid()));
create policy guild_events_delete on public.guild_events for delete to authenticated
  using (private.is_guild_officer(guild_id, auth.uid()));

-- ── 7. reference data: readable by signed-in users, never writable ───────────
grant select on public.game_modes, public.reward_tiers, public.system_rewards,
                public.shadow_catalog, public.category_stats, public.item_catalog to authenticated;
create policy ref_game_modes     on public.game_modes     for select to authenticated using (true);
create policy ref_reward_tiers   on public.reward_tiers   for select to authenticated using (true);
create policy ref_system_rewards on public.system_rewards for select to authenticated using (true);
create policy ref_shadow_catalog on public.shadow_catalog for select to authenticated using (true);
create policy ref_category_stats on public.category_stats for select to authenticated using (true);
create policy ref_item_catalog   on public.item_catalog   for select to authenticated using (true);

-- ── 8. function privileges ───────────────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default, and Supabase also grants it to anon. Close
-- both, then open exactly the player-facing RPCs to signed-in users.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.prorettype = 'pg_catalog.trigger'::regtype as is_trigger
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    if not r.is_trigger then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

-- Internals: callable only from inside the SECURITY DEFINER RPCs. The schema is not exposed
-- through the API; `authenticated` needs USAGE only so RLS policies can call the few helpers
-- granted below.
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
alter default privileges in schema private revoke all on functions from public;
grant execute on function
  private.is_friend(uuid, uuid), private.is_clan_officer(uuid, uuid), private.is_clan_member(uuid, uuid),
  private.is_guild_officer(uuid, uuid), private.is_guild_member(uuid, uuid)
  to authenticated;

-- Superseded by the engine's lazy daily tick (and it ignored the per-mode thresholds).
drop function if exists public.handle_deceased_hunters();
