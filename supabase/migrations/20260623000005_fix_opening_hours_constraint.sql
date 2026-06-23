-- Fix place_opening_hours upsert: partial unique index cannot be used as
-- PostgREST conflict target. Add a non-partial unique constraint so that
-- `onConflict: 'place_id,source'` works in the ingest script.
--
-- The partial index (where is_current = true) stays for query performance.
-- The unique constraint covers all rows regardless of is_current.

alter table public.place_opening_hours
  add constraint place_opening_hours_place_source_uniq
  unique (place_id, source);
