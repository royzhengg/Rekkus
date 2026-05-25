-- OPS hardening: runtime flag overrides, analytics versioning, and raw-event retention.

CREATE TABLE IF NOT EXISTS public.feature_flag_overrides (
  flag_name text PRIMARY KEY,
  enabled boolean NOT NULL,
  reason text NOT NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client feature flag override access" ON public.feature_flag_overrides;
CREATE POLICY "No client feature flag override access" ON public.feature_flag_overrides
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_active
  ON public.feature_flag_overrides (expires_at, updated_at DESC);

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS event_version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_analytics_retention
  ON public.analytics_events (created_at);
