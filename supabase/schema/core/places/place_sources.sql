-- Domain: Core
-- Owner: Discovery
-- Classification: Metadata
-- Lifecycle: Core
-- Source of Truth: Yes

-- place_sources: raw provider payloads (selective retention)
create table if not exists public.place_sources (
  id         uuid        primary key default gen_random_uuid(),
  place_id   uuid        not null references public.places(id) on delete cascade,
  source     text        not null check (source in ('osm', 'google', 'owner', 'user', 'admin')),
  payload    jsonb       not null,
  fetched_at timestamptz not null default now()
);

-- place_stubs (Google autocomplete cache, TTL 30 days)
create table if not exists public.place_stubs (
  place_id   text        primary key,
  name       text        not null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_place_sources_place_id on public.place_sources (place_id);
create index if not exists idx_place_sources_source on public.place_sources (source);
create index if not exists place_stubs_expires_at_idx on public.place_stubs (expires_at);
