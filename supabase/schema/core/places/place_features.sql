-- Domain: Core
-- Owner: Discovery
-- Classification: Metadata
-- Lifecycle: Core
-- Source of Truth: Yes

-- place_features: aggregation table for venue characteristics
-- (accessibility, dietary, payments grouped for convenience; may split in a future migration)
create table if not exists public.place_features (
  place_id        uuid        primary key references public.places(id) on delete cascade,
  wheelchair      text,
  outdoor_seating boolean,
  takeaway        boolean,
  delivery        boolean,
  dietary_flags   text[],
  payment_methods text[],
  smoking         text,
  internet_access text,
  capacity        integer,
  updated_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_place_features_wheelchair on public.place_features (wheelchair) where wheelchair is not null;
create index if not exists idx_place_features_dietary on public.place_features using gin (dietary_flags) where dietary_flags is not null;
create index if not exists idx_place_features_payment on public.place_features using gin (payment_methods) where payment_methods is not null;
