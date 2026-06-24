-- Fix: enable RLS on place_closure_signals.
-- The table was created in 20260624000006_closed_venue_detection.sql without RLS.
-- All writes go through security-definer RPCs (resolve_place_status, applyProviderClosureSignal,
-- record_community_closure_report). No direct client write path exists or is intended.
-- Reads are public so the closure banner can display without authentication.

alter table public.place_closure_signals enable row level security;

-- Anyone can read closure signals (closure banners are public-facing)
create policy "place_closure_signals: public read"
  on public.place_closure_signals for select
  using (true);

-- No direct client inserts/updates/deletes — all mutations go through security-definer functions.
-- This means the table is effectively write-protected from the client tier.
