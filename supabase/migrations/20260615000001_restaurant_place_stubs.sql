-- B-587: restaurant_place_stubs — short-lived Google Place ID stubs for autocomplete cache
-- These are transient references used to resolve place_id from a Google place_id quickly
-- without a full Google API round-trip on every autocomplete interaction.
-- TTL-based; stale rows are safe to purge. No FK to places (stubs may pre-date a full upsert).

CREATE TABLE IF NOT EXISTS public.restaurant_place_stubs (
  place_id   text        PRIMARY KEY,
  name       text        NOT NULL,
  expires_at timestamptz NOT NULL
);

COMMENT ON TABLE public.restaurant_place_stubs IS
  'Short-lived Google Place ID stubs for autocomplete fast-path resolution. '
  'Rows are upserted on autocomplete interactions and expire after 24 hours. '
  'Safe to truncate; no FKs. Not user-owned; no RLS required.';

CREATE INDEX IF NOT EXISTS restaurant_place_stubs_expires_at_idx
  ON public.restaurant_place_stubs (expires_at);
