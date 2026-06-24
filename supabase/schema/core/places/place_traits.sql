-- Domain: Core
-- Owner: Discovery
-- Classification: Metadata
-- Lifecycle: Core
-- Source of Truth: Yes

-- place_traits: community-inferred vibes; controlled enum vocabulary
create table if not exists public.place_traits (
  id         uuid                    primary key default gen_random_uuid(),
  place_id   uuid                    not null references public.places(id) on delete cascade,
  trait_slug public.place_trait_slug not null,
  confidence numeric(3,2)            not null default 0.50,
  source     text                    not null check (source in ('community', 'admin', 'ai')),
  created_at timestamptz             not null default now()
);

-- Indexes
create unique index if not exists place_traits_uniq on public.place_traits (place_id, trait_slug);
create index if not exists idx_place_traits_slug on public.place_traits (trait_slug);
