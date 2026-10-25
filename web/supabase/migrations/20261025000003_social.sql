-- ============================================================================
-- 03 · SOCIAL RPCs  (clans, guilds, invites, assigned quests, duels, gifts)
--
-- Replaces direct client writes that had no authorisation at all:
--   • "inviting" someone force-added them to your clan/guild (no consent)
--   • anyone could assign any user a task with arbitrary XP
--   • duel baselines were client-supplied, so duels could be rigged
--   • the daily gift cooldown lived in localStorage
-- ============================================================================

-- ── helpers (also used by RLS policies in 04) ───────────────────────────────

create or replace function private.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.friendship
     where status = 'accepted'
       and ((requester_id = a and receiver_id = b) or (requester_id = b and receiver_id = a)))
$$;

create or replace function private.is_clan_officer(p_clan uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.clan_members
                  where clan_id = p_clan and user_id = p_uid and role in ('leader', 'officer'))
$$;

create or replace function private.is_clan_member(p_clan uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.clan_members where clan_id = p_clan and user_id = p_uid)
$$;

create or replace function private.is_guild_officer(p_guild uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.guild_members
                  where guild_id = p_guild and user_id = p_uid and role in ('leader', 'officer'))
$$;

create or replace function private.is_guild_member(p_guild uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.guild_members where guild_id = p_guild and user_id = p_uid)
$$;

-- One clan per player (the app assumed it; the schema allowed several). Only added when the
-- existing data already satisfies it, so this migration can never fail on legacy rows.
do $$ begin
  if not exists (select 1 from public.clan_members group by user_id having count(*) > 1) then
    create unique index if not exists clan_members_one_clan_idx on public.clan_members (user_id);
  else
    raise notice 'clan_members has users in several clans; skipping one-clan-per-user index (enforced by RPC for new joins).';
  end if;
  if not exists (select 1 from public.guild_members group by user_id having count(*) > 1) then
    create unique index if not exists guild_members_one_guild_idx on public.guild_members (user_id);
  end if;
  if not exists (select 1 from public.friendship group by least(requester_id, receiver_id), greatest(requester_id, receiver_id) having count(*) > 1) then
    create unique index if not exists friendship_pair_idx
      on public.friendship (least(requester_id, receiver_id), greatest(requester_id, receiver_id));
  end if;
end $$;

-- Backfill guild_members from profiles (guild membership used to live only in user_profiles.guild_id).
insert into public.guild_members (guild_id, user_id, role)
select up.guild_id, up.user_id, case when g.leader_id = up.user_id then 'leader' else 'member' end
  from public.user_profiles up join public.guilds g on g.id = up.guild_id
 where up.guild_id is not null
on conflict (guild_id, user_id) do nothing;

-- Backfill clan_members for clan leaders created before membership rows existed.
insert into public.clan_members (clan_id, user_id, role)
select c.id, c.leader_id, 'leader' from public.clans c
 where c.leader_id is not null
   and not exists (select 1 from public.clan_members m where m.clan_id = c.id and m.user_id = c.leader_id)
   and not exists (select 1 from public.clan_members m where m.user_id = c.leader_id)
on conflict do nothing;

-- ── hunter lookup ────────────────────────────────────────────────────────────
-- The old get_profile_by_hunter_code compared the column with itself (`hunter_code =
-- UPPER(hunter_code)`, because the parameter shadowed the column) and so returned an arbitrary
-- profile. This one actually matches the code, accepts a full UUID too, and exposes nothing but
-- the bare minimum needed to send a request.
drop function if exists public.get_profile_by_hunter_code(text);

create or replace function public.find_hunter(p_code text)
returns table (user_id uuid, name text, level integer, player_rank text, player_class text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_code text := btrim(coalesce(p_code, ''));
begin
  if auth.uid() is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if char_length(v_code) < 6 then return; end if;
  return query
    select up.user_id, up.name, up.level, up.player_rank, up.player_class
      from public.user_profiles up
     where (char_length(v_code) = 36 and up.user_id::text = lower(v_code))
        or (char_length(v_code) <> 36 and up.hunter_code = upper(v_code))
     limit 1;
end $$;

-- ── clans ────────────────────────────────────────────────────────────────────

create or replace function public.create_clan(p_name text, p_desc text default '') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_name text := btrim(coalesce(p_name, '')); v_id uuid;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    perform private.fail('INVALID_NAME', 'A clan name needs 2–40 characters.');
  end if;
  if private.plan_limit(v_uid, 'can_create_groups') = 0 then
    perform private.fail('PLAN_LIMIT', 'Creating a clan is a Pro feature. You can still join one by invitation.');
  end if;
  if exists (select 1 from public.clan_members where user_id = v_uid) then
    perform private.fail('ALREADY_IN_CLAN', 'Leave your current clan first.');
  end if;
  if exists (select 1 from public.clans where lower(name) = lower(v_name)) then
    perform private.fail('NAME_TAKEN', 'A clan with that name already exists.');
  end if;

  insert into public.clans (name, description, leader_id) values (v_name, left(coalesce(p_desc, ''), 300), v_uid)
  returning id into v_id;
  insert into public.clan_members (clan_id, user_id, role) values (v_id, v_uid, 'leader');
  update public.user_profiles set clan_id = v_id where user_id = v_uid;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.invite_to_clan(p_target uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_clan uuid; v_name text; v_inviter text;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if p_target = v_uid then perform private.fail('INVALID_TARGET', 'You cannot invite yourself.'); end if;
  select m.clan_id, c.name into v_clan, v_name from public.clan_members m join public.clans c on c.id = m.clan_id
   where m.user_id = v_uid and m.role in ('leader', 'officer');
  if v_clan is null then perform private.fail('NOT_OFFICER', 'Only a clan leader or officer can invite.'); end if;
  if not exists (select 1 from public.user_profiles where user_id = p_target) then
    perform private.fail('HUNTER_NOT_FOUND', 'That hunter does not exist.');
  end if;
  if exists (select 1 from public.clan_members where user_id = p_target) then
    perform private.fail('ALREADY_IN_CLAN', 'That hunter already belongs to a clan.');
  end if;
  if (select count(*) from public.clan_members where clan_id = v_clan) >= 5 then
    perform private.fail('CLAN_FULL', 'A clan holds at most 5 hunters.');
  end if;
  if exists (select 1 from public.clan_invites where clan_id = v_clan and invitee_id = p_target and status = 'pending') then
    perform private.fail('ALREADY_INVITED', 'That hunter already has a pending invitation.');
  end if;

  insert into public.clan_invites (clan_id, inviter_id, invitee_id, status) values (v_clan, v_uid, p_target, 'pending');
  select name into v_inviter from public.user_profiles where user_id = v_uid;
  perform private.notify(p_target, '🛡️ CLAN INVITATION', format('%s invited you to join %s.', coalesce(v_inviter, 'A hunter'), v_name), 'invite', '/arena');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.respond_clan_invite(p_invite uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); i public.clan_invites;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  select * into i from public.clan_invites where id = p_invite and invitee_id = v_uid and status = 'pending' for update;
  if not found then perform private.fail('INVITE_NOT_FOUND', 'That invitation is no longer available.'); end if;

  if not p_accept then
    update public.clan_invites set status = 'rejected' where id = i.id;
    return jsonb_build_object('ok', true, 'joined', false);
  end if;

  if exists (select 1 from public.clan_members where user_id = v_uid) then
    perform private.fail('ALREADY_IN_CLAN', 'Leave your current clan first.');
  end if;
  if (select count(*) from public.clan_members where clan_id = i.clan_id) >= 5 then
    perform private.fail('CLAN_FULL', 'That clan is already full.');
  end if;
  insert into public.clan_members (clan_id, user_id, role) values (i.clan_id, v_uid, 'member');
  update public.user_profiles set clan_id = i.clan_id where user_id = v_uid;
  update public.clan_invites set status = 'accepted' where id = i.id;
  update public.clan_invites set status = 'rejected' where invitee_id = v_uid and status = 'pending' and id <> i.id;
  return jsonb_build_object('ok', true, 'joined', true);
end $$;

create or replace function public.leave_clan() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); m public.clan_members; v_heir uuid;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  select * into m from public.clan_members where user_id = v_uid for update;
  if not found then return jsonb_build_object('ok', true, 'left', false); end if;

  delete from public.clan_members where id = m.id;
  update public.user_profiles set clan_id = null where user_id = v_uid;

  if m.role = 'leader' then
    select user_id into v_heir from public.clan_members where clan_id = m.clan_id
     order by (role = 'officer') desc, joined_at asc limit 1;
    if v_heir is null then
      delete from public.clans where id = m.clan_id;               -- last one out
    else
      update public.clan_members set role = 'leader' where clan_id = m.clan_id and user_id = v_heir;
      update public.clans set leader_id = v_heir where id = m.clan_id;
      perform private.notify(v_heir, '👑 YOU LEAD THE CLAN', 'The previous leader left. The clan is yours.', 'system', '/arena');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'left', true);
end $$;

-- ── guilds ───────────────────────────────────────────────────────────────────

create or replace function public.create_guild(p_name text, p_desc text default '', p_min_rank text default 'E',
                                               p_logo text default '⚜️', p_aura text default 'shadow') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_name text := btrim(coalesce(p_name, '')); v_id uuid;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    perform private.fail('INVALID_NAME', 'A guild name needs 2–40 characters.');
  end if;
  if private.plan_limit(v_uid, 'can_create_groups') = 0 then
    perform private.fail('PLAN_LIMIT', 'Creating a guild is a Pro feature. You can still join one by invitation.');
  end if;
  if exists (select 1 from public.guild_members where user_id = v_uid) then
    perform private.fail('ALREADY_IN_GUILD', 'Leave your current guild first.');
  end if;
  if exists (select 1 from public.guilds where lower(name) = lower(v_name)) then
    perform private.fail('NAME_TAKEN', 'A guild with that name already exists.');
  end if;

  insert into public.guilds (name, description, leader_id, member_count, min_rank, logo_url, aura_theme)
  values (v_name, left(coalesce(p_desc, ''), 300), v_uid, 1,
          case when p_min_rank in ('E','D','C','B','A','S','SS') then p_min_rank else 'E' end,
          left(coalesce(p_logo, '⚜️'), 16), left(coalesce(p_aura, 'shadow'), 24))
  returning id into v_id;
  insert into public.guild_members (guild_id, user_id, role) values (v_id, v_uid, 'leader');
  update public.user_profiles
     set guild_id = v_id, guild_title = 'Guild Master',
         guild_logo = left(coalesce(p_logo, '⚜️'), 16), guild_aura_card = left(coalesce(p_aura, 'shadow'), 24)
   where user_id = v_uid;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.invite_to_guild(p_target uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); g public.guilds; v_inviter text; v_rank text;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if p_target = v_uid then perform private.fail('INVALID_TARGET', 'You cannot invite yourself.'); end if;
  select gu.* into g from public.guild_members m join public.guilds gu on gu.id = m.guild_id
   where m.user_id = v_uid and m.role in ('leader', 'officer');
  if not found then perform private.fail('NOT_OFFICER', 'Only a guild master or officer can invite.'); end if;
  select player_rank into v_rank from public.user_profiles where user_id = p_target;
  if v_rank is null then perform private.fail('HUNTER_NOT_FOUND', 'That hunter does not exist.'); end if;
  if private.rank_index(v_rank) < private.rank_index(g.min_rank) then
    perform private.fail('RANK_TOO_LOW', format('%s requires %s-rank or higher.', g.name, g.min_rank));
  end if;
  if exists (select 1 from public.guild_members where user_id = p_target) then
    perform private.fail('ALREADY_IN_GUILD', 'That hunter already belongs to a guild.');
  end if;
  if (select count(*) from public.guild_members where guild_id = g.id) >= 20 then
    perform private.fail('GUILD_FULL', 'A guild holds at most 20 hunters.');
  end if;
  if exists (select 1 from public.guild_invites where guild_id = g.id and invitee_id = p_target and status = 'pending') then
    perform private.fail('ALREADY_INVITED', 'That hunter already has a pending invitation.');
  end if;

  insert into public.guild_invites (guild_id, inviter_id, invitee_id) values (g.id, v_uid, p_target);
  select name into v_inviter from public.user_profiles where user_id = v_uid;
  perform private.notify(p_target, '⚜️ GUILD INVITATION', format('%s invited you to join %s.', coalesce(v_inviter, 'A hunter'), g.name), 'invite', '/arena');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.respond_guild_invite(p_invite uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); i public.guild_invites; g public.guilds;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  select * into i from public.guild_invites where id = p_invite and invitee_id = v_uid and status = 'pending' for update;
  if not found then perform private.fail('INVITE_NOT_FOUND', 'That invitation is no longer available.'); end if;

  if not p_accept then
    update public.guild_invites set status = 'rejected' where id = i.id;
    return jsonb_build_object('ok', true, 'joined', false);
  end if;

  if exists (select 1 from public.guild_members where user_id = v_uid) then
    perform private.fail('ALREADY_IN_GUILD', 'Leave your current guild first.');
  end if;
  select * into g from public.guilds where id = i.guild_id for update;
  if (select count(*) from public.guild_members where guild_id = g.id) >= 20 then
    perform private.fail('GUILD_FULL', 'That guild is already full.');
  end if;
  insert into public.guild_members (guild_id, user_id, role) values (g.id, v_uid, 'member');
  update public.guilds set member_count = (select count(*) from public.guild_members where guild_id = g.id) where id = g.id;
  update public.user_profiles
     set guild_id = g.id, guild_title = 'Member', guild_logo = g.logo_url, guild_aura_card = g.aura_theme
   where user_id = v_uid;
  update public.guild_invites set status = 'accepted' where id = i.id;
  update public.guild_invites set status = 'rejected' where invitee_id = v_uid and status = 'pending' and id <> i.id;
  return jsonb_build_object('ok', true, 'joined', true);
end $$;

create or replace function public.leave_guild() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); m public.guild_members; v_heir uuid;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  select * into m from public.guild_members where user_id = v_uid for update;
  if not found then return jsonb_build_object('ok', true, 'left', false); end if;

  delete from public.guild_members where id = m.id;
  update public.user_profiles set guild_id = null, guild_title = '', guild_logo = '', guild_aura_card = '' where user_id = v_uid;

  if m.role = 'leader' then
    select user_id into v_heir from public.guild_members where guild_id = m.guild_id
     order by (role = 'officer') desc, joined_at asc limit 1;
    if v_heir is null then
      delete from public.guilds where id = m.guild_id;
    else
      update public.guild_members set role = 'leader' where guild_id = m.guild_id and user_id = v_heir;
      update public.guilds set leader_id = v_heir where id = m.guild_id;
      update public.user_profiles set guild_title = 'Guild Master' where user_id = v_heir;
      perform private.notify(v_heir, '👑 YOU LEAD THE GUILD', 'The previous guild master left. The guild is yours.', 'system', '/arena');
    end if;
  end if;
  update public.guilds set member_count = (select count(*) from public.guild_members where guild_id = m.guild_id)
   where id = m.guild_id;
  return jsonb_build_object('ok', true, 'left', true);
end $$;

create or replace function public.my_invites() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'clan', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'name', c.name, 'inviter', up.name, 'created_at', i.created_at) order by i.created_at desc)
                        from public.clan_invites i join public.clans c on c.id = i.clan_id
                        left join public.user_profiles up on up.user_id = i.inviter_id
                       where i.invitee_id = auth.uid() and i.status = 'pending'), '[]'::jsonb),
    'guild', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'name', g.name, 'inviter', up.name, 'created_at', i.created_at) order by i.created_at desc)
                        from public.guild_invites i join public.guilds g on g.id = i.guild_id
                        left join public.user_profiles up on up.user_id = i.inviter_id
                       where i.invitee_id = auth.uid() and i.status = 'pending'), '[]'::jsonb))
$$;

-- ── assigned quests ──────────────────────────────────────────────────────────
-- The task is OWNED by the assignee (so it appears in their gates and pays them), created_by
-- records the assigner, and the XP value comes from the tier, never from the caller.
create or replace function public.assign_quest(p_target uuid, p_title text, p_category text default 'General',
                                               p_tier text default 'Low', p_priority text default 'Normal',
                                               p_deadline date default null, p_description text default '') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); v_title text := btrim(coalesce(p_title, '')); v_tier text; v_prio text; v_id uuid; v_ok boolean;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if p_target = v_uid then perform private.fail('INVALID_TARGET', 'Use "Manifest Gate" for your own quests.'); end if;
  if char_length(v_title) < 1 or char_length(v_title) > 200 then
    perform private.fail('INVALID_TITLE', 'A quest needs a name (1–200 characters).');
  end if;

  v_ok := exists (select 1 from public.clan_members a join public.clan_members b on b.clan_id = a.clan_id
                   where a.user_id = v_uid and a.role in ('leader', 'officer') and b.user_id = p_target)
       or exists (select 1 from public.guild_members a join public.guild_members b on b.guild_id = a.guild_id
                   where a.user_id = v_uid and a.role in ('leader', 'officer') and b.user_id = p_target);
  if not v_ok then
    perform private.fail('NOT_AUTHORIZED', 'You can only assign quests to members of a clan or guild you lead.');
  end if;
  if (select count(*) from public.tasks where user_id = p_target and created_by = v_uid
        and not is_completed and not is_failed) >= 5 then
    perform private.fail('TOO_MANY_ASSIGNED', 'That hunter already has 5 open quests from you.');
  end if;

  v_tier := case when p_tier in ('Low','Mid','High','Super','Legendary') then p_tier else 'Low' end;
  v_prio := case when p_priority in ('Low','Normal','High','URGENT') then p_priority else 'Normal' end;

  insert into public.tasks (user_id, assigned_to, created_by, title, description, category, priority, xp_tier, points, deadline)
  values (p_target, p_target, v_uid, v_title, left(coalesce(p_description, ''), 2000),
          left(coalesce(nullif(btrim(p_category), ''), 'General'), 60), v_prio, v_tier,
          private.tier_points(v_tier), p_deadline)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- ── duels ────────────────────────────────────────────────────────────────────

create or replace function public.create_challenge(p_opponent uuid, p_target integer, p_days integer) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_name text;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if p_opponent = v_uid then perform private.fail('INVALID_TARGET', 'You cannot challenge yourself.'); end if;
  if not private.is_friend(v_uid, p_opponent) then
    perform private.fail('NOT_FRIENDS', 'You can only duel hunters in your party. Send a friend request first.');
  end if;
  if p_target is null or p_target < 20 or p_target > 1000 then
    perform private.fail('INVALID_TARGET_XP', 'The target must be between 20 and 1000 XP.');
  end if;
  if p_days is null or p_days < 1 or p_days > 14 then
    perform private.fail('INVALID_DURATION', 'A duel lasts 1–14 days.');
  end if;
  if exists (select 1 from public.challenges where status = 'active'
              and ((creator_id = v_uid and opponent_id = p_opponent) or (creator_id = p_opponent and opponent_id = v_uid))) then
    perform private.fail('DUEL_EXISTS', 'You already have an active duel with this hunter.');
  end if;
  if (select count(*) from public.challenges where status = 'active' and (creator_id = v_uid or opponent_id = v_uid)) >= 3 then
    perform private.fail('TOO_MANY_DUELS', 'You can run at most 3 duels at a time.');
  end if;

  insert into public.challenges (creator_id, opponent_id, target_points, creator_start_pts, opponent_start_pts, expires_at, status)
  values (v_uid, p_opponent, p_target, 0, 0, now() + make_interval(days => p_days), 'active')
  returning id into v_id;
  select name into v_name from public.user_profiles where user_id = v_uid;
  perform private.notify(p_opponent, '⚔️ NEW CHALLENGE', format('%s challenged you to a %s XP duel!', coalesce(v_name, 'A hunter'), p_target), 'duel', '/arena');
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Active duels plus any resolved in the last 3 days, with live progress. Resolves finished
-- duels as a side effect (so a winner is declared the first time anyone looks).
create or replace function public.list_challenges() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  perform private.resolve_challenges(v_uid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'creator_id', c.creator_id, 'opponent_id', c.opponent_id,
             'creator_name', coalesce(a.name, 'Unknown'), 'opponent_name', coalesce(b.name, 'Unknown'),
             'target_points', c.target_points, 'expires_at', c.expires_at, 'status', c.status, 'winner_id', c.winner_id,
             'creator_pts', private.earned_since(c.creator_id, c.created_at),
             'opponent_pts', private.earned_since(c.opponent_id, c.created_at)) order by c.created_at desc)
      from public.challenges c
      left join public.user_profiles a on a.user_id = c.creator_id
      left join public.user_profiles b on b.user_id = c.opponent_id
     where (c.creator_id = v_uid or c.opponent_id = v_uid)
       and (c.status = 'active' or c.expires_at > now() - interval '3 days')), '[]'::jsonb);
end $$;

-- ── daily gift ───────────────────────────────────────────────────────────────

create table if not exists public.item_catalog (
  name text primary key, description text not null, item_type text not null,
  item_category text not null, rarity text not null, giftable boolean not null default false
);
insert into public.item_catalog (name, description, item_type, item_category, rarity, giftable) values
  ('Starter Blade',          'A basic hunter''s blade.',                                              'WEAPON', 'Weapon', 'E-Rank', true),
  ('Slayer''s Saber',        'A sharp saber preferred by low-rank agility hunters.',                  'WEAPON', 'Weapon', 'D-Rank', true),
  ('Kasaka''s Venom Fang',   'A dagger made from the tooth of a Great Kasaka. Deals poison damage.',  'WEAPON', 'Weapon', 'C-Rank', true),
  ('Knight Killer',          'A heavy dagger designed to pierce thick armor.',                        'WEAPON', 'Weapon', 'B-Rank', true),
  ('Poison Needle',          'A hidden weapon that deals massive damage over time.',                  'WEAPON', 'Weapon', 'B-Rank', true),
  ('Holy Orb',               'Emits a light that burns undead and heals allies.',                     'WEAPON', 'Weapon', 'B-Rank', true),
  ('Baruka''s Dagger',       'The dagger of the Ice Elf King Baruka. Imbued with cold.',              'WEAPON', 'Weapon', 'A-Rank', true),
  ('Orb of Avarice',         'A magic orb that doubles the power of fire magic.',                     'WEAPON', 'Weapon', 'A-Rank', true),
  ('Dragon''s Breath',       'A bow that fires arrows made of pure mana.',                            'WEAPON', 'Weapon', 'A-Rank', true),
  ('Shield of the Eternal',  'A shield that can withstand the breath of a dragon.',                   'WEAPON', 'Weapon', 'A-Rank', true),
  ('Grimoire of Souls',      'Allows the user to store and summon captured spirits.',                 'WEAPON', 'Weapon', 'A-Rank', true),
  ('Star-Fall Bow',          'Arrows fired from this bow fall like meteorites.',                      'WEAPON', 'Weapon', 'A-Rank', true)
on conflict (name) do nothing;

-- 06:00–22:00 (the player's local time), once per local day. Server-checked: the old cooldown
-- lived in localStorage.
create or replace function public.claim_daily_gift() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); p public.user_profiles; v_local timestamp; v_today date; v_item public.item_catalog;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  perform private.tick_user(v_uid);
  select * into p from public.user_profiles where user_id = v_uid;
  v_local := now() at time zone p.timezone;
  v_today := v_local::date;

  if extract(hour from v_local) < 6 or extract(hour from v_local) >= 22 then
    perform private.fail('WINDOW_CLOSED', 'The System Gift window is open 06:00–22:00 (your local time).');
  end if;
  if exists (select 1 from public.inventory where user_id = v_uid and (metadata ->> 'gift_date') = v_today::text) then
    perform private.fail('ALREADY_CLAIMED', 'You already claimed today''s gift. The System prepares another tomorrow.');
  end if;

  select * into v_item from public.item_catalog where giftable order by random() limit 1;
  insert into public.inventory (user_id, name, description, item_type, item_category, rarity, quantity, metadata)
  values (v_uid, v_item.name, v_item.description || ' [SYSTEM_RENTAL]', v_item.item_type, v_item.item_category,
          v_item.rarity, 1, jsonb_build_object('durability', 100, 'is_rental', true, 'gift_date', v_today));
  return jsonb_build_object('ok', true, 'name', v_item.name, 'rarity', v_item.rarity);
end $$;

-- A profile row is normally created by the sign-up trigger; this heals the rare missing case
-- (replaces a direct client INSERT).
create or replace function public.ensure_profile() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); u record;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  if exists (select 1 from public.user_profiles where user_id = v_uid) then return; end if;
  select id, email, raw_user_meta_data into u from auth.users where id = v_uid;
  insert into public.user_profiles (user_id, email, hunter_code, name, player_class, player_rank, player_title)
  values (v_uid, u.email, upper(substr(v_uid::text, 1, 8)),
          left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)), 40),
          'Warrior', 'E', 'Newcomer')
  on conflict (user_id) do nothing;
end $$;

-- ── sign-up trigger: validated + hardened ───────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_class text := coalesce(new.raw_user_meta_data ->> 'player_class', 'Warrior');
begin
  if v_class not in ('Warrior','Mage','Assassin','Tank','Healer','Archer','Ranger','Necromancer','Tamer','Craftsman','Scout') then
    v_class := 'Warrior';
  end if;
  insert into public.user_profiles (user_id, email, hunter_code, name, player_class, player_rank, player_title)
  values (new.id, new.email, upper(substr(new.id::text, 1, 8)),
          left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'Hunter'), 40),
          v_class, 'E', 'Newcomer')
  on conflict (user_id) do nothing;
  return new;
end $$;

-- ── notification triggers: fix the self-assignment spam, harden search_path ──
-- (Every gate a player created for themselves used to fire "You have been assigned a new quest".)
create or replace function public.notify_on_task_assignment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.assigned_to is not null and new.created_by is not null and new.created_by <> new.assigned_to
     and (tg_op = 'INSERT' or old.assigned_to is distinct from new.assigned_to) then
    insert into public.notifications (user_id, title, message, type, link)
    values (new.assigned_to, 'New Mission Assigned',
            'A leader assigned you a new quest: ' || new.title, 'assignment', '/dungeon-gate');
  end if;
  return new;
end $$;

create or replace function public.notify_on_direct_message() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare sender_name text;
begin
  select name into sender_name from public.user_profiles where user_id = new.sender_id;
  insert into public.notifications (user_id, title, message, type, link)
  values (new.receiver_id, 'New Message',
          coalesce(sender_name, 'A hunter') || ': ' || left(new.message, 50) || case when length(new.message) > 50 then '...' else '' end,
          'message', '/social?chat=' || new.sender_id);
  return new;
end $$;

create or replace function public.notify_on_friendship() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare requester_name text;
begin
  if tg_op = 'INSERT' then
    select name into requester_name from public.user_profiles where user_id = new.requester_id;
    insert into public.notifications (user_id, title, message, type, link)
    values (new.receiver_id, 'Companion Invitation',
            coalesce(requester_name, 'A hunter') || ' wants to join your party.', 'friend', '/social');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    select name into requester_name from public.user_profiles where user_id = new.receiver_id;
    insert into public.notifications (user_id, title, message, type, link)
    values (new.requester_id, 'Invitation Accepted',
            coalesce(requester_name, 'The hunter') || ' has joined your party.', 'friend', '/social');
  end if;
  return new;
end $$;
