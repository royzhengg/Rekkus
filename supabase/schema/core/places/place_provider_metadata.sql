-- Domain: Core
-- Owner: Discovery / Provider
-- Classification: Metadata
-- Lifecycle: Provider-managed
-- Source of Truth: No

-- place_provider_metadata: owned by import/enrichment pipelines only
create table if not exists public.place_provider_metadata (
  place_id            uuid        primary key references public.places(id) on delete cascade,
  amenity_type        text,
  brand               text,
  brand_wikidata      text,
  operator            text,
  price_level         integer,
  floor_level         text,
  start_date          text,
  wikidata_id         text,
  wikipedia_url       text,
  image_url           text,
  description         text,
  alt_names           jsonb,
  state               text,
  postcode            text,
  osm_import_run_id   uuid        references public.osm_import_runs(id),
  osm_imported_at     timestamptz,
  osm_check_date      date,
  last_osm_sync_at    timestamptz,
  last_google_sync_at timestamptz,
  raw_osm_tags        jsonb,      -- archive only; never use in WHERE/ORDER BY of search queries
  updated_at          timestamptz not null default now()
);

-- Indexes
create index if not exists idx_ppm_amenity_type on public.place_provider_metadata (amenity_type) where amenity_type is not null;
create index if not exists idx_ppm_wikidata_id on public.place_provider_metadata (wikidata_id) where wikidata_id is not null;
create index if not exists idx_ppm_brand on public.place_provider_metadata (lower(brand)) where brand is not null;
create index if not exists idx_ppm_state on public.place_provider_metadata (state) where state is not null;
create index if not exists idx_ppm_alt_names on public.place_provider_metadata using gin (alt_names) where alt_names is not null;
