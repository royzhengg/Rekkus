-- Domain: Search
-- Owner: Search / Discovery
-- Classification: Metadata
-- Lifecycle: Core
-- Source of Truth: Yes

-- suburb_aliases
create table if not exists public.suburb_aliases (
  id             serial primary key,
  alias          text   not null unique,
  canonical_name text   not null,
  lat            double precision,
  lng            double precision
);

-- suburb_lookups
create table if not exists public.suburb_lookups (
  id       serial primary key,
  name     text   not null,
  state    text,
  postcode text,
  lat      double precision,
  lng      double precision
);

-- Indexes
create unique index if not exists suburb_lookups_name_state_uidx on public.suburb_lookups (lower(name), coalesce(state, ''));
create index if not exists suburb_lookups_name_trgm_idx on public.suburb_lookups using gin (name extensions.gin_trgm_ops);
create index if not exists suburb_lookups_lower_name_idx on public.suburb_lookups (lower(name));
