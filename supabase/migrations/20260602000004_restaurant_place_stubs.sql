-- Lightweight place_id stub cache for Google autocomplete results.
-- Stores only place_id + display name, TTL = 30 days (within Google Places TOS carve-out).
-- On selection, the full restaurant record is persisted via upsertRestaurant instead.

create table if not exists restaurant_place_stubs (
  place_id   text primary key,
  name       text not null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create index if not exists restaurant_place_stubs_expires_at_idx
  on restaurant_place_stubs (expires_at);

-- RLS: public read-only (stubs are non-sensitive display names), service role for writes
alter table restaurant_place_stubs enable row level security;

create policy "place_stubs_select"
  on restaurant_place_stubs for select
  using (expires_at > now());
