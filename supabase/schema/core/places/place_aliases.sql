-- Domain: Core
-- Owner: Discovery
-- Classification: Metadata
-- Lifecycle: Core
-- Source of Truth: Yes

-- place_aliases: highest ROI for search quality; expand without code changes
create table if not exists public.place_aliases (
  id         uuid        primary key default gen_random_uuid(),
  place_id   uuid        not null references public.places(id) on delete cascade,
  alias      text        not null,
  source     text        not null check (source in ('osm', 'community', 'admin', 'cuisine_taxonomy')),
  created_at timestamptz not null default now()
);

-- place_merge_log: safe deduplication history
create table if not exists public.place_merge_log (
  id             uuid        primary key default gen_random_uuid(),
  old_place_id   uuid        not null,   -- intentionally not a FK; old place is soft-deleted
  new_place_id   uuid        not null references public.places(id) on delete cascade,
  merged_by      uuid        references public.users(id) on delete set null,
  reason         text,
  created_at     timestamptz not null default now()
);

-- Indexes
create unique index if not exists place_aliases_uniq on public.place_aliases (place_id, lower(alias));
create index if not exists idx_place_aliases_alias on public.place_aliases using gin (to_tsvector('simple', alias));
