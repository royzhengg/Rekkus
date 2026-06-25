-- Migration: B-611 Google OPERATIONAL Sync Job
-- Creates scheduled worker that polls Google Places business_status daily.
-- Depends on: place_closure_signals, reopen_place(), place_provider_cache (20260624000006)
-- Advisory lock key: hashtext('rekkus:google-operational-sync')
--   Document this string here; renaming the feature must NOT change the hash value.
--
-- ── Operational runbook ────────────────────────────────────────────────────────
-- Duration expectations: < 30 s normal · < 2 min acceptable · > 5 min investigate
-- Failure alerting:
--   • > 5 consecutive failed cron runs
--   • aborted:true in response (OVER_QUERY_LIMIT / REQUEST_DENIED / CIRCUIT_BREAKER)
--   • google_errors + db_errors > 10% of processed
--   • zero processed for 3+ consecutive days
--
-- Monitor cron runs:
--   SELECT start_time, end_time, status, return_message
--   FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'google-operational-sync')
--   ORDER BY start_time DESC LIMIT 10;
--
-- Failures only:
--   SELECT start_time, return_message
--   FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'google-operational-sync')
--     AND status <> 'succeeded'
--   ORDER BY start_time DESC;
--
-- Rollback:
--   DO $$ DECLARE v BIGINT;
--   BEGIN FOR v IN SELECT jobid FROM cron.job WHERE jobname = 'google-operational-sync'
--   LOOP PERFORM cron.unschedule(v); END LOOP; END $$;
--   DROP FUNCTION IF EXISTS public.trigger_google_operational_sync();
--   DROP FUNCTION IF EXISTS public.get_places_for_google_sync(integer);
--   DROP FUNCTION IF EXISTS public.acquire_google_sync_lock();
--   DROP FUNCTION IF EXISTS public.release_google_sync_lock();
--   DROP INDEX IF EXISTS public.idx_ppc_google_sync;
--   -- reopen_place() idempotency patch: redeploy 20260624000006
--
-- Scalability note:
--   Add next_google_sync_at (indexed) queue column to places when table exceeds 500k rows
--   or job routinely runs > 5 min — turns repeated ORDER BY stale_at scans into O(1) reads.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── Index: support get_places_for_google_sync LEFT JOIN + ORDER BY ──────────

CREATE INDEX IF NOT EXISTS idx_ppc_google_sync
  ON public.place_provider_cache (source_type, stale_at, place_id)
  WHERE source_type = 'google_places';

-- ─── Batch polling queue ──────────────────────────────────────────────────────
-- Returns places due for a Google business_status check, staleness-ordered.
-- Permanently closed places re-enter the queue after 90 days (self-healing for
-- Google corrections and ownership transfers).

CREATE OR REPLACE FUNCTION public.get_places_for_google_sync(
  batch_size integer DEFAULT 25
)
RETURNS TABLE (
  id              uuid,
  google_place_id text,
  place_status    public.place_status
)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT p.id, p.google_place_id, p.place_status
  FROM   public.places p
  LEFT JOIN public.place_provider_cache c
    ON  c.place_id    = p.id
    AND c.source_type = 'google_places'
  WHERE  p.google_place_id IS NOT NULL
    AND  p.status_locked = false
    AND  (
      p.place_status != 'permanently_closed'
      OR c.stale_at IS NULL
      OR c.stale_at < now() - interval '90 days'
    )
  ORDER BY c.stale_at ASC NULLS FIRST, p.id
  LIMIT batch_size;
$$;

REVOKE ALL ON FUNCTION public.get_places_for_google_sync(integer) FROM PUBLIC;

-- ─── Advisory lock helpers ────────────────────────────────────────────────────
-- Session-scoped: lock releases automatically on connection close if the Edge
-- Function crashes before calling release_google_sync_lock().

CREATE OR REPLACE FUNCTION public.acquire_google_sync_lock()
RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT pg_try_advisory_lock(hashtext('rekkus:google-operational-sync')::bigint);
$$;

REVOKE ALL ON FUNCTION public.acquire_google_sync_lock() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.release_google_sync_lock()
RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT pg_advisory_unlock(hashtext('rekkus:google-operational-sync')::bigint);
$$;

REVOKE ALL ON FUNCTION public.release_google_sync_lock() FROM PUBLIC;

-- ─── reopen_place() idempotency patch ─────────────────────────────────────────
-- Adds early-return guard so calling reopen_place() on an already-active place
-- with no unresolved closed signals is a safe no-op. Eliminates the race where
-- the Edge Function reads place_status before calling this RPC.

CREATE OR REPLACE FUNCTION public.reopen_place(
  p_place_id uuid,
  p_source   text,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_confidence numeric(3,2);
  v_status     public.place_status;
BEGIN
  SELECT place_status INTO v_status
  FROM   public.places
  WHERE  id = p_place_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- No-op if already active with no unresolved closed signals.
  IF v_status = 'active' AND NOT EXISTS (
    SELECT 1 FROM public.place_closure_signals
    WHERE  place_id     = p_place_id
      AND  signal_value = 'closed'
      AND  resolved_at IS NULL
  ) THEN RETURN; END IF;

  v_confidence := CASE p_source
    WHEN 'admin'              THEN 1.00
    WHEN 'google_operational' THEN 0.85
    WHEN 'owner_claim'        THEN 0.85
    WHEN 'post'               THEN 0.30
    ELSE                           0.30
  END;

  UPDATE public.place_closure_signals
  SET    resolved_at = now()
  WHERE  place_id    = p_place_id
    AND  signal_value = 'closed'
    AND  resolved_at IS NULL
    AND  signal_type IN ('community_reports', 'inactivity');

  IF v_confidence >= 0.85 THEN
    UPDATE public.place_closure_signals
    SET    resolved_at = now()
    WHERE  place_id    = p_place_id
      AND  signal_value = 'closed'
      AND  resolved_at IS NULL
      AND  signal_type IN ('provider_status', 'owner_claim');
  END IF;

  IF v_confidence = 1.00 THEN
    UPDATE public.place_closure_signals
    SET    resolved_at = now()
    WHERE  place_id    = p_place_id
      AND  signal_value = 'closed'
      AND  resolved_at IS NULL;
  END IF;

  INSERT INTO public.place_closure_signals (
    place_id, signal_type, signal_value, confidence, metadata, expires_at
  ) VALUES (
    p_place_id,
    'reopen',
    'open',
    v_confidence,
    coalesce(p_metadata, jsonb_build_object('source', p_source)),
    now() + interval '30 days'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_place(uuid, text, jsonb) FROM PUBLIC;

-- ─── pg_net trigger ───────────────────────────────────────────────────────────
-- Called by pg_cron; also safe to call manually for ad-hoc runs.
-- Advisory lock lives in the Edge Function so it covers both scheduled and manual invocations.

CREATE OR REPLACE FUNCTION public.trigger_google_operational_sync()
RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, net
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT value INTO v_url FROM public.app_config WHERE key = 'supabase_url';
  SELECT value INTO v_key FROM public.app_config WHERE key = 'service_role_key';

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'trigger_google_operational_sync: missing app_config keys (supabase_url / service_role_key)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/google-operational-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key,
      'x-cron-key',    v_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_google_operational_sync() FROM PUBLIC;

-- ─── pg_cron registration (idempotent) ────────────────────────────────────────
-- Schedule: daily 03:30 UTC
-- Cron offset rationale: inactive scan = 02:00, analytics = 03:00, Google sync = 03:30

DO $$
DECLARE v_jobid bigint;
BEGIN
  FOR v_jobid IN
    SELECT jobid FROM cron.job WHERE jobname = 'google-operational-sync'
  LOOP
    PERFORM cron.unschedule(v_jobid);
  END LOOP;

  PERFORM cron.schedule(
    'google-operational-sync',
    '30 3 * * *',
    'SELECT public.trigger_google_operational_sync()'
  );
END $$;
