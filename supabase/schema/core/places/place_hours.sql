-- Domain: Core
-- Owner: Discovery
-- Classification: Metadata
-- Lifecycle: Core
-- Source of Truth: Yes

-- place_opening_hours: source priority owner > community > google > osm
create table if not exists public.place_opening_hours (
  id         uuid        primary key default gen_random_uuid(),
  place_id   uuid        not null references public.places(id) on delete cascade,
  source     text        not null check (source in ('osm', 'google', 'owner', 'community')),
  hours_text text,
  hours_json jsonb,
  is_current boolean     not null default true,
  confidence numeric(3,2) default 0.50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create unique index if not exists place_opening_hours_current_uniq on public.place_opening_hours (place_id, source) where is_current = true;
