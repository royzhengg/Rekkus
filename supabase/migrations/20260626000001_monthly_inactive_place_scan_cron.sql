-- B-612: Monthly pg_cron job for scan_inactive_places()
-- Owner: Places domain — public.scan_inactive_places()
-- Schedule: 1st of each month, 02:00 UTC (lowest expected traffic; UTC avoids DST shifts)
-- Depends on: B-601 (function defined), pg_cron extension
-- Enable pg_cron: Supabase dashboard → Database → Extensions → pg_cron
--
-- Note: "inactivity" means no POSTS in N months, not no activity of any kind.
-- Saves/collections/likes do not reset the inactivity clock.
--
-- Note: place_closure_signals has no unique index for signal_type = 'inactivity',
-- so the INSERT guard below (NOT EXISTS on active signal) prevents monthly accumulation.
-- resolved_at exists on the table (introduced in B-601, line 51 of 20260624000006).
-- Signals self-expire after 180 days. Future migration should replace the NOT EXISTS
-- guard with a partial unique index on (place_id, signal_type)
-- WHERE signal_type = 'inactivity' AND resolved_at IS NULL — database-level invariants
-- are stronger than query-level guards.
--
-- Note: cron registration is a no-op if pg_cron is not enabled. The job will not exist
-- after migration if pg_cron is absent. Verify with:
--   SELECT * FROM cron.job WHERE jobname = 'places-monthly-inactive-scan';
--
-- Monitoring (all runs):
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'places-monthly-inactive-scan')
--   order by start_time desc limit 20;
--
-- Monitoring (failures only):
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'places-monthly-inactive-scan')
--     and status <> 'succeeded'
--   order by start_time desc;
--
-- Rollback:
--   do $$ declare v bigint;
--   begin for v in select jobid from cron.job where jobname = 'places-monthly-inactive-scan'
--   loop perform cron.unschedule(v); end loop; end $$;
--
-- Scalability: convert to next_review_at queue model when scan duration > 60 s
-- OR places table > 500k rows — whichever comes first.
--
-- Future: replace posts subquery with place_stats.last_post_at once that column exists
-- (B-603 shipped last_activity_at only; a dedicated last_post_at column is still needed).

-- 1. Replace scan_inactive_places() with set-based, advisory-locked version.
CREATE OR REPLACE FUNCTION public.scan_inactive_places(inactivity_months integer DEFAULT 12)
RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  -- Namespaced key prevents collision with other advisory locks.
  v_lock_key bigint      := hashtext('rekkus:places:scan_inactive_places')::bigint;
  v_cutoff   timestamptz := now() - make_interval(months => inactivity_months);
  v_count    integer     := 0;
BEGIN
  -- One concurrent execution only (cron + manual RPC race protection).
  -- Returns 0 immediately if another run holds the lock.
  IF NOT pg_try_advisory_lock(v_lock_key) THEN
    RETURN 0;
  END IF;

  BEGIN
    INSERT INTO public.place_closure_signals (
      place_id, signal_type, signal_value, confidence, metadata, expires_at
    )
    SELECT
      p.id,
      'inactivity',
      'closed',
      0.20,
      jsonb_build_object('inactivity_months', inactivity_months, 'scanned_at', now()),
      now() + interval '180 days'
    FROM public.places p
    WHERE p.place_status IN ('active', 'temporarily_closed')
      AND p.status_locked = false
      AND p.created_at < v_cutoff
      -- No recent posts.
      AND NOT EXISTS (
            SELECT 1 FROM public.posts po
            WHERE  po.place_id   = p.id
              AND  po.deleted_at IS NULL
              AND  po.created_at > v_cutoff
          )
      -- No active inactivity signal already exists (place_closure_signals has no unique
      -- index for inactivity type, so this guard prevents monthly row accumulation).
      -- resolved_at IS NULL excludes manually-resolved signals so a new one can be created.
      AND NOT EXISTS (
            SELECT 1 FROM public.place_closure_signals pcs
            WHERE  pcs.place_id    = p.id
              AND  pcs.signal_type = 'inactivity'
              AND  pcs.resolved_at IS NULL
              AND  pcs.expires_at  > now()
          )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(v_lock_key);
    RAISE;
  END;

  PERFORM pg_advisory_unlock(v_lock_key);
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.scan_inactive_places(integer) FROM PUBLIC;

-- 2. Register monthly cron job (idempotent via jobid-based unschedule).
do $$
declare
  v_jobid bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Unschedule by jobid — name-based cron.unschedule is not portable across pg_cron versions.
    for v_jobid in
      select jobid from cron.job where jobname = 'places-monthly-inactive-scan'
    loop
      perform cron.unschedule(v_jobid);
    end loop;

    perform cron.schedule(
      'places-monthly-inactive-scan',
      '0 2 1 * *',
      $cron$
        select public.scan_inactive_places();
      $cron$
    );
  end if;
end;
$$;
