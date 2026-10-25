-- ============================================================================
-- 06 · ROLL-OUT RECALIBRATION  (one-time, per existing profile)
--
-- The previous progression sync could never run: it selected five columns the schema had
-- dropped (stat_strength …), so the query errored, `data` was null and it returned early.
-- Level, rank, title, streak, decay and status were therefore never kept up to date for
-- existing players.
--
-- This gives every EXISTING hunter a clean slate on the new engine:
--   • no retroactive decay (the tick cursor starts today)
--   • "last active" starts today, so nobody wakes up DECEASED on launch day
--   • level / rank / title are recomputed from their real XP right now
--
-- Idempotent: it only touches profiles that have never been ticked (last_tick_date IS NULL),
-- so re-running it never resets anyone who is already on the new engine.
-- ============================================================================

do $$
declare r record;
begin
  for r in select user_id from public.user_profiles where last_tick_date is null loop
    update public.user_profiles
       set last_tick_date = current_date,
           last_active_date = current_date
     where user_id = r.user_id;
    perform private.refresh_progression(r.user_id);
  end loop;
end $$;
