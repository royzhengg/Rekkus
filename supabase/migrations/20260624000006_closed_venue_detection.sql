-- B-601: Closed venue detection
-- Signal-based architecture: closure signals are recorded independently;
-- place_status is resolved from them via resolve_place_status().
-- Detection is separated from decision.
--
-- Signals table grows append-only; resolved_at and expires_at keep it clean.
-- Inactivity scanner: call monthly via pg_cron or admin RPC.
--   SELECT public.scan_inactive_places();
-- Future optimisation: replace posts join with place_stats.last_post_at once B-603 ships.

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE public.place_closure_signal_type AS ENUM (
  'provider_status',   -- Google, Apple, OSM, etc. (provider stored in metadata)
  'community_reports',
  'owner_claim',
  'inactivity',
  'admin_override',
  'reopen'
);

-- Named place_signal_value (not place_closure_signal_value) because 'open' is
-- a status signal, not a closure signal.
CREATE TYPE public.place_signal_value AS ENUM (
  'closed',
  'open'
);

-- ─── New columns on places ───────────────────────────────────────────────────

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS status_locked           boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closure_signal_source   text,
  ADD COLUMN IF NOT EXISTS closure_signal_metadata jsonb,
  ADD COLUMN IF NOT EXISTS closure_signal_at       timestamptz;

-- closure_signal_* are CACHE FIELDS only — always derived by resolve_place_status().
-- Never write to them directly; they are never the source of truth.

-- ─── place_closure_signals ───────────────────────────────────────────────────

CREATE TABLE public.place_closure_signals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id     uuid        NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  signal_type  public.place_closure_signal_type NOT NULL,
  signal_value public.place_signal_value        NOT NULL,
  confidence   numeric(3,2) NOT NULL DEFAULT 0.50,
  metadata     jsonb,
  detected_at  timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  resolved_at  timestamptz
);

-- Expiry policy (set at insert time):
--   community_reports : now() + 90 days
--   inactivity        : now() + 180 days
--   reopen            : now() + 30 days
--   provider_status   : NULL (no expiry)
--   admin_override    : NULL
--   owner_claim       : NULL

-- Confidence → resulting status:
--   admin_override              1.00  permanently_closed
--   provider_status PERMANENT   0.95  permanently_closed
--   provider_status TEMPORARY   0.80  temporarily_closed
--   owner_claim                 0.85  temporarily_closed
--   community_reports           0.45  unverified   (launch default; raise to temporarily_closed later)
--   inactivity                  0.20  unverified

-- Confidence threshold: confidence >= 0.40 required for temporarily_closed /
-- permanently_closed.  Lower-confidence signals (inactivity) can still produce
-- unverified but never auto-close a venue.

-- Performance indexes
CREATE INDEX idx_pcs_place      ON public.place_closure_signals(place_id);
CREATE INDEX idx_pcs_active     ON public.place_closure_signals(place_id, signal_value, resolved_at)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_pcs_unresolved ON public.place_closure_signals(place_id, resolved_at);

-- DB-level deduplication (all inserts use ON CONFLICT DO NOTHING)
CREATE UNIQUE INDEX idx_pcs_provider_dedup
  ON public.place_closure_signals (
    place_id,
    signal_type,
    (metadata->>'provider'),
    (metadata->>'business_status')
  )
  WHERE signal_type = 'provider_status' AND resolved_at IS NULL;

CREATE UNIQUE INDEX idx_pcs_community_dedup
  ON public.place_closure_signals (place_id, signal_type)
  WHERE signal_type = 'community_reports' AND resolved_at IS NULL;

-- provider_status signals must carry provider + business_status in metadata
ALTER TABLE public.place_closure_signals
  ADD CONSTRAINT chk_provider_status_metadata
  CHECK (
    signal_type <> 'provider_status'
    OR (metadata ? 'provider' AND metadata ? 'business_status')
  );

-- ─── Status resolution ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_place_status(p_place_id uuid)
RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_locked         boolean;
  v_current_status public.place_status;
  v_new_status     public.place_status;
  v_win_source     text;
  v_win_metadata   jsonb;
  v_win_at         timestamptz;
  v_open_conf      numeric(3,2);
  v_norm           text;
BEGIN
  SELECT status_locked, place_status
  INTO   v_locked, v_current_status
  FROM   public.places
  WHERE  id = p_place_id;

  IF v_locked THEN
    RETURN;
  END IF;

  -- ── Determine highest-priority closure status ──────────────────────────────

  v_new_status := NULL;

  -- admin_override (confidence 1.00) → permanently_closed
  IF v_new_status IS NULL THEN
    SELECT detected_at, metadata
    INTO   v_win_at, v_win_metadata
    FROM   public.place_closure_signals
    WHERE  place_id    = p_place_id
      AND  signal_type = 'admin_override'
      AND  signal_value = 'closed'
      AND  resolved_at IS NULL
      AND  (expires_at IS NULL OR expires_at > now())
    LIMIT 1;
    IF FOUND THEN
      v_new_status := 'permanently_closed';
      v_win_source := 'admin_override';
    END IF;
  END IF;

  -- provider_status CLOSED_PERMANENTLY (confidence 0.95) → permanently_closed
  IF v_new_status IS NULL OR v_new_status = 'temporarily_closed' THEN
    SELECT detected_at, metadata
    INTO   v_win_at, v_win_metadata
    FROM   public.place_closure_signals
    WHERE  place_id    = p_place_id
      AND  signal_type = 'provider_status'
      AND  signal_value = 'closed'
      AND  resolved_at IS NULL
      AND  (expires_at IS NULL OR expires_at > now())
      AND  metadata->>'normalized_status' = 'permanently_closed'
    ORDER BY confidence DESC
    LIMIT 1;
    IF FOUND THEN
      v_new_status := 'permanently_closed';
      v_win_source := 'provider_status';
    END IF;
  END IF;

  -- provider_status CLOSED_TEMPORARILY (confidence 0.80) → temporarily_closed
  IF v_new_status IS NULL THEN
    SELECT detected_at, metadata
    INTO   v_win_at, v_win_metadata
    FROM   public.place_closure_signals
    WHERE  place_id    = p_place_id
      AND  signal_type = 'provider_status'
      AND  signal_value = 'closed'
      AND  resolved_at IS NULL
      AND  (expires_at IS NULL OR expires_at > now())
      AND  metadata->>'normalized_status' = 'temporarily_closed'
    ORDER BY confidence DESC
    LIMIT 1;
    IF FOUND THEN
      v_new_status := 'temporarily_closed';
      v_win_source := 'provider_status';
    END IF;
  END IF;

  -- owner_claim (confidence 0.85) → temporarily_closed
  IF v_new_status IS NULL THEN
    SELECT detected_at, metadata
    INTO   v_win_at, v_win_metadata
    FROM   public.place_closure_signals
    WHERE  place_id    = p_place_id
      AND  signal_type = 'owner_claim'
      AND  signal_value = 'closed'
      AND  resolved_at IS NULL
      AND  (expires_at IS NULL OR expires_at > now())
    LIMIT 1;
    IF FOUND THEN
      v_new_status := 'temporarily_closed';
      v_win_source := 'owner_claim';
    END IF;
  END IF;

  -- community_reports (confidence 0.45) → unverified (launch default)
  IF v_new_status IS NULL THEN
    SELECT detected_at, metadata
    INTO   v_win_at, v_win_metadata
    FROM   public.place_closure_signals
    WHERE  place_id    = p_place_id
      AND  signal_type = 'community_reports'
      AND  signal_value = 'closed'
      AND  resolved_at IS NULL
      AND  (expires_at IS NULL OR expires_at > now())
    LIMIT 1;
    IF FOUND THEN
      v_new_status := 'unverified';
      v_win_source := 'community_reports';
    END IF;
  END IF;

  -- inactivity (confidence 0.20) → unverified
  IF v_new_status IS NULL THEN
    SELECT detected_at, metadata
    INTO   v_win_at, v_win_metadata
    FROM   public.place_closure_signals
    WHERE  place_id    = p_place_id
      AND  signal_type = 'inactivity'
      AND  signal_value = 'closed'
      AND  resolved_at IS NULL
      AND  (expires_at IS NULL OR expires_at > now())
    LIMIT 1;
    IF FOUND THEN
      v_new_status := 'unverified';
      v_win_source := 'inactivity';
    END IF;
  END IF;

  -- ── No-demotion rule ───────────────────────────────────────────────────────
  -- permanently_closed can only be reversed by admin_override reopen.
  IF v_current_status = 'permanently_closed'
     AND v_new_status IS DISTINCT FROM 'permanently_closed'
     AND v_win_source IS DISTINCT FROM 'admin_override' THEN
    RETURN;
  END IF;

  -- ── Reopen evaluation (if no closure signal wins) ─────────────────────────
  IF v_new_status IS NULL THEN
    SELECT confidence
    INTO   v_open_conf
    FROM   public.place_closure_signals
    WHERE  place_id    = p_place_id
      AND  signal_value = 'open'
      AND  resolved_at IS NULL
      AND  (expires_at IS NULL OR expires_at > now())
    ORDER BY confidence DESC
    LIMIT 1;

    IF FOUND THEN
      -- Confidence < 0.40: can only clear inactivity / community_reports signals.
      -- Since those produce 'unverified' and no closure signal remains, we restore active.
      -- Confidence >= 0.85: clears provider_status and owner_claim closures too.
      -- Confidence = 1.00 (admin): clears everything.
      -- In all cases: if we reach here, no active closure signal survived → restore active.
      v_new_status := 'active';
      v_win_source := NULL;
      v_win_metadata := NULL;
      v_win_at := NULL;
    END IF;
  END IF;

  IF v_new_status IS NULL THEN
    RETURN;
  END IF;

  -- ── Write back ────────────────────────────────────────────────────────────
  UPDATE public.places
  SET
    place_status           = v_new_status,
    closure_signal_source  = v_win_source,
    closure_signal_metadata = v_win_metadata,
    closure_signal_at      = v_win_at
  WHERE id = p_place_id
    AND place_status IS DISTINCT FROM v_new_status;

  IF FOUND THEN
    INSERT INTO public.restaurant_audit_events (
      actor_type, action, entity_type, entity_id,
      source_type, reason, before_summary, after_summary
    ) VALUES (
      'system',
      'place_status_updated',
      'place',
      p_place_id,
      'database_trigger',
      'closure signal resolved: ' || coalesce(v_win_source, 'reopen'),
      jsonb_build_object('place_status', v_current_status),
      jsonb_build_object(
        'place_status', v_new_status,
        'signal_source', v_win_source,
        'signal_metadata', v_win_metadata
      )
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_place_status(uuid) FROM PUBLIC;

-- ─── Trigger: signal inserted → resolve ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.on_closure_signal_inserted()
RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  PERFORM public.resolve_place_status(NEW.place_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.on_closure_signal_inserted() FROM PUBLIC;

CREATE TRIGGER closure_signal_inserted
  AFTER INSERT ON public.place_closure_signals
  FOR EACH ROW EXECUTE FUNCTION public.on_closure_signal_inserted();

-- ─── Trigger: community reports threshold ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.maybe_flag_place_from_reports()
RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_locked        boolean;
  v_unique_count  integer;
BEGIN
  IF NEW.target_type <> 'place' THEN
    RETURN NEW;
  END IF;

  SELECT status_locked INTO v_locked
  FROM public.places
  WHERE id = NEW.target_id::uuid;

  IF NOT FOUND OR v_locked THEN
    RETURN NEW;
  END IF;

  SELECT count(DISTINCT reporter_id)
  INTO   v_unique_count
  FROM   public.content_reports
  WHERE  target_type = 'place'
    AND  target_id   = NEW.target_id;

  IF v_unique_count < 3 THEN
    RETURN NEW;
  END IF;

  -- Release the dedup slot for any expired community_reports signals.
  UPDATE public.place_closure_signals
  SET    resolved_at = now()
  WHERE  place_id    = NEW.target_id::uuid
    AND  signal_type = 'community_reports'
    AND  resolved_at IS NULL
    AND  expires_at  < now();

  INSERT INTO public.place_closure_signals (
    place_id, signal_type, signal_value, confidence, metadata, expires_at
  ) VALUES (
    NEW.target_id::uuid,
    'community_reports',
    'closed',
    0.45,
    jsonb_build_object('unique_reporters', v_unique_count, 'detected_at', now()),
    now() + interval '90 days'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_flag_place_from_reports() FROM PUBLIC;

CREATE TRIGGER community_report_closure_trigger
  AFTER INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.maybe_flag_place_from_reports();

-- ─── Inactivity scanner ───────────────────────────────────────────────────────
-- Recommended schedule: monthly via pg_cron or admin RPC.
--   SELECT public.scan_inactive_places();
-- Future optimisation: replace posts join with place_stats.last_post_at (B-603).

CREATE OR REPLACE FUNCTION public.scan_inactive_places(inactivity_months integer DEFAULT 12)
RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_place record;
BEGIN
  FOR v_place IN
    SELECT p.id
    FROM   public.places p
    WHERE  p.place_status IN ('active', 'temporarily_closed')
      AND  p.status_locked = false
      AND  p.created_at < now() - (inactivity_months || ' months')::interval
      AND  NOT EXISTS (
             SELECT 1 FROM public.posts po
             WHERE  po.place_id   = p.id
               AND  po.deleted_at IS NULL
               AND  po.created_at > now() - (inactivity_months || ' months')::interval
           )
  LOOP
    INSERT INTO public.place_closure_signals (
      place_id, signal_type, signal_value, confidence, metadata, expires_at
    ) VALUES (
      v_place.id,
      'inactivity',
      'closed',
      0.20,
      jsonb_build_object('inactivity_months', inactivity_months, 'scanned_at', now()),
      now() + interval '180 days'
    )
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.scan_inactive_places(integer) FROM PUBLIC;

-- ─── Reopen helper ───────────────────────────────────────────────────────────

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

  -- Reopen confidence by source
  v_confidence := CASE p_source
    WHEN 'admin'              THEN 1.00
    WHEN 'google_operational' THEN 0.85
    WHEN 'owner_claim'        THEN 0.85
    WHEN 'post'               THEN 0.30
    ELSE                           0.30
  END;

  -- Resolve signals BEFORE inserting the open signal, so the resolver
  -- (triggered by the INSERT below) sees a clean state.
  --
  -- Post reopens (confidence 0.30): clear community_reports and inactivity only.
  -- High-authority (>= 0.85): also clear provider_status and owner_claim.
  -- Admin (1.00): clear everything.

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

  -- Insert the open signal; the trigger calls resolve_place_status automatically.
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

-- ─── Reopen on post: fires when a post is created for a non-active place ─────
-- Only reopens temporarily_closed or unverified — never permanently_closed.

CREATE OR REPLACE FUNCTION public.maybe_reopen_place_from_post()
RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_status public.place_status;
BEGIN
  IF NEW.place_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT place_status INTO v_status
  FROM public.places
  WHERE id = NEW.place_id;

  IF v_status IN ('temporarily_closed', 'unverified') THEN
    PERFORM public.reopen_place(NEW.place_id, 'post', NULL);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_reopen_place_from_post() FROM PUBLIC;

CREATE TRIGGER post_reopen_place_trigger
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.maybe_reopen_place_from_post();
