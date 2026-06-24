-- Domain: Core
-- Owner: Discovery
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- places
create table if not exists public.places (
  id                          uuid          default gen_random_uuid() primary key,
  name                        text          not null,
  address                     text,
  city                        text,
  country                     text,
  suburb                      text,
  latitude                    double precision,
  longitude                   double precision,
  place_geog                  extensions.geography(Point, 4326)
                              generated always as (
                                case
                                  when latitude is null or longitude is null then null
                                  else extensions.ST_SetSRID(
                                    extensions.ST_MakePoint(longitude, latitude), 4326
                                  )::extensions.geography
                                end
                              ) stored,
  google_place_id             text,
  cuisine_type                text,
  price_range                 integer,
  google_rating               numeric(2,1),
  google_review_count         integer,
  google_photo_refs           text[],
  open_now                    boolean,
  open_now_checked_at         timestamptz,
  canonical_source            text          not null default 'rekkus',
  metadata_confidence         numeric(3,2)  not null default 0.50,
  verification_status         text          not null default 'unverified',
  community_verification_score integer      not null default 0,
  community_verified_at       timestamptz,
  owner_content_status        text          not null default 'none',
  metadata_source_priority    text          not null default 'rekkus_first',
  primary_photo_source        text          not null default 'rekkus_post',
  created_by                  uuid          references public.users(id) on delete set null,
  embedding                   extensions.vector(384),
  embedding_hash              text,
  created_at                  timestamptz   not null default now(),
  updated_at                  timestamptz   not null default now(),
  -- Lifecycle + identity additions (OSM schema)
  verification_level          public.verification_level not null default 'osm_only',
  place_status                public.place_status not null default 'active',
  created_source              text,
  deleted_at                  timestamptz,
  merged_into_place_id        uuid,
  osm_id                      text unique,
  slug                        text unique,
  cuisine_slug                text
);

-- Indexes
create index if not exists idx_places_google_place_id on public.places (google_place_id);
create index if not exists idx_places_lower_name on public.places (lower(name));
create index if not exists idx_places_city on public.places (city);
create index if not exists idx_places_cuisine_type on public.places (cuisine_type);
create index if not exists places_geog_idx on public.places using gist (place_geog)
  where place_geog is not null;
create index if not exists places_search_tsv_idx on public.places using gin (
  to_tsvector('simple',
    coalesce(name, '') || ' ' ||
    coalesce(cuisine_type, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(address, '')
  )
);
create index if not exists places_embedding_idx on public.places using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

-- OSM schema indexes on places
create index if not exists idx_places_osm_id on public.places (osm_id) where osm_id is not null;
create index if not exists idx_places_verification_level on public.places (verification_level);
create index if not exists idx_places_status on public.places (place_status);
create index if not exists idx_places_deleted_at on public.places (deleted_at) where deleted_at is not null;
create index if not exists idx_places_cuisine_slug on public.places (cuisine_slug) where cuisine_slug is not null;
create index if not exists idx_places_slug on public.places (slug) where slug is not null;
create index if not exists idx_places_active on public.places (id) where place_status = 'active' and deleted_at is null;

-- posts / saved_places: trigger write-path and repair/validate
create index if not exists posts_place_id_idx        on public.posts (place_id) where place_id is not null;
create index if not exists saved_places_place_id_idx on public.saved_places (place_id);
