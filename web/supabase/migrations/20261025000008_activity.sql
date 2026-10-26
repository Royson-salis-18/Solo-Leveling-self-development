-- ============================================================================
-- 08 · ACTIVITY RECORD
-- One round trip for the "conquest record" (heatmap + totals) shown on the dashboard and the
-- mobile home. Read-only: derived from the XP ledger, so it can't be forged.
-- ============================================================================
create or replace function public.get_activity(p_days integer default 140) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); p public.user_profiles; v_today date; v_n integer; v_start date;
begin
  if v_uid is null then perform private.fail('NOT_AUTHENTICATED', 'Sign in required.'); end if;
  select * into p from public.user_profiles where user_id = v_uid;
  if not found then return jsonb_build_object('days', '[]'::jsonb, 'totals', '{}'::jsonb); end if;

  v_today := private.today_for(v_uid);
  v_n     := least(greatest(coalesce(p_days, 140), 7), 400);
  v_start := v_today - (v_n - 1);

  return jsonb_build_object(
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', to_char(x.d, 'YYYY-MM-DD'),
               'points', greatest(coalesce(up.daily_points, 0), 0),
               'conquests', coalesce(c.n, 0)) order by x.d), '[]'::jsonb)
        from (select g.ts::date as d from generate_series(v_start::timestamp, v_today::timestamp, interval '1 day') g(ts)) x
        left join public.user_points up on up.user_id = v_uid and up.date = x.d
        left join (select (created_at at time zone p.timezone)::date as day, count(*)::integer as n
                     from public.xp_events
                    where user_id = v_uid and kind = 'complete'
                      and created_at >= (v_start::timestamp at time zone p.timezone)
                    group by 1) c on c.day = x.d
    ),
    'totals', jsonb_build_object(
      'conquests',  (select count(*) from public.xp_events where user_id = v_uid and kind = 'complete'),
      'active_days', (select count(*) from public.user_points where user_id = v_uid and daily_points > 0),
      'avg_xp_active_day', (select coalesce(round(avg(daily_points)), 0) from public.user_points where user_id = v_uid and daily_points > 0),
      'best_streak', greatest(coalesce(p.best_streak, 0), coalesce(p.streak_count, 0)),
      'since', (p.created_at at time zone p.timezone)::date));
end $$;

revoke all on function public.get_activity(integer) from public, anon, authenticated;
grant execute on function public.get_activity(integer) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_friend(uuid, uuid), private.is_clan_officer(uuid, uuid), private.is_clan_member(uuid, uuid),
  private.is_guild_officer(uuid, uuid), private.is_guild_member(uuid, uuid)
  to authenticated;
