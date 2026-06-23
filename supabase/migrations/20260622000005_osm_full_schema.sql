-- =============================================================================
-- OSM full schema: enums, slim places additions, 11 domain-owned tables
-- Domain ownership model: places = identity only; all metadata in domain tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.verification_level as enum (
    'user_created',       -- user typed a new place; not yet confirmed
    'osm_only',           -- OSM import; no further verification
    'osm_google',         -- OSM + Google cache enrichment applied
    'community_verified', -- ≥3 unique users, ≥7 days apart
    'owner_verified'      -- owner claimed + verified
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.place_status as enum (
    'active',
    'temporarily_closed',
    'permanently_closed',
    'unverified'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.place_trait_slug as enum (
    'date_night', 'cheap_eats', 'study_spot', 'group_dining',
    'late_night', 'hidden_gem', 'family_friendly', 'romantic',
    'outdoor', 'fast_casual', 'special_occasion'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. osm_import_runs (no FK deps; created first so place_provider_metadata can ref it)
-- RLS: service_role only (admin/import script access)
-- ---------------------------------------------------------------------------

create table if not exists public.osm_import_runs (
  id           uuid        primary key default gen_random_uuid(),
  state        text        not null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  imported     integer     not null default 0,
  updated      integer     not null default 0,
  skipped      integer     not null default 0,
  report       jsonb
);

-- ---------------------------------------------------------------------------
-- 3. Slim additions to places (identity + lifecycle only)
-- ---------------------------------------------------------------------------

alter table public.places
  add column if not exists verification_level  public.verification_level not null default 'osm_only',
  add column if not exists place_status        public.place_status not null default 'active',
  add column if not exists created_source      text,
  add column if not exists deleted_at          timestamptz,
  add column if not exists merged_into_place_id uuid,
  add column if not exists osm_id              text,
  add column if not exists slug                text,
  add column if not exists cuisine_slug        text;

-- Unique constraints (separate statements so IF NOT EXISTS works per constraint)
do $$ begin
  alter table public.places add constraint places_osm_id_unique unique (osm_id);
exception when duplicate_table or duplicate_object then null; end $$;

do $$ begin
  alter table public.places add constraint places_slug_unique unique (slug);
exception when duplicate_table or duplicate_object then null; end $$;

-- Indexes on places (places_geog_idx already exists from earlier migration)
create index if not exists idx_places_osm_id
  on public.places (osm_id) where osm_id is not null;
create index if not exists idx_places_verification_level
  on public.places (verification_level);
create index if not exists idx_places_status
  on public.places (place_status);
create index if not exists idx_places_deleted_at
  on public.places (deleted_at) where deleted_at is not null;
create index if not exists idx_places_cuisine_slug
  on public.places (cuisine_slug) where cuisine_slug is not null;
create index if not exists idx_places_slug
  on public.places (slug) where slug is not null;
-- Partial index for active-place queries (most common filter)
create index if not exists idx_places_active
  on public.places (id)
  where place_status = 'active' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4. place_contact — owned by contact enrichment features
-- ---------------------------------------------------------------------------

create table if not exists public.place_contact (
  place_id                 uuid        primary key references public.places(id) on delete cascade,
  phone                    text,
  website                  text,
  instagram_url            text,
  facebook_url             text,
  tiktok_url               text,
  last_verified_at         timestamptz,
  last_owner_update_at     timestamptz,
  last_community_update_at timestamptz,
  updated_at               timestamptz not null default now()
);

create index if not exists idx_place_contact_website
  on public.place_contact (lower(website)) where website is not null;

alter table public.place_contact enable row level security;
create policy "Public read place_contact"
  on public.place_contact for select using (true);
create policy "Service role manages place_contact"
  on public.place_contact for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 5. place_features — aggregation table for venue characteristics
--    (accessibility, dietary, payments, facilities grouped for convenience;
--     may split into narrower domains in a future migration)
-- ---------------------------------------------------------------------------

create table if not exists public.place_features (
  place_id        uuid        primary key references public.places(id) on delete cascade,
  wheelchair      text,       -- 'yes' | 'no' | 'limited'
  outdoor_seating boolean,
  takeaway        boolean,
  delivery        boolean,
  dietary_flags   text[],     -- ['vegan', 'halal', 'vegetarian', 'kosher', 'gluten_free']
  payment_methods text[],
  smoking         text,
  internet_access text,
  capacity        integer,
  updated_at      timestamptz not null default now()
);

create index if not exists idx_place_features_wheelchair
  on public.place_features (wheelchair) where wheelchair is not null;
create index if not exists idx_place_features_dietary
  on public.place_features using gin (dietary_flags) where dietary_flags is not null;
create index if not exists idx_place_features_payment
  on public.place_features using gin (payment_methods) where payment_methods is not null;

alter table public.place_features enable row level security;
create policy "Public read place_features"
  on public.place_features for select using (true);
create policy "Service role manages place_features"
  on public.place_features for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 6. place_provider_metadata — owned by import/enrichment pipelines only
-- ---------------------------------------------------------------------------

create table if not exists public.place_provider_metadata (
  place_id            uuid        primary key references public.places(id) on delete cascade,
  amenity_type        text,
  brand               text,
  brand_wikidata      text,
  operator            text,
  price_level         integer,    -- nullable; never used in ranking (OSM quality inconsistent)
  floor_level         text,
  start_date          text,
  wikidata_id         text,
  wikipedia_url       text,
  image_url           text,
  description         text,
  alt_names           jsonb,      -- {"en": "...", "zh": "..."} — future: place_localisations
  state               text,       -- 'NSW' | 'VIC' | etc. (from OSM addr:state)
  postcode            text,
  osm_import_run_id   uuid        references public.osm_import_runs(id),
  osm_imported_at     timestamptz,
  osm_check_date      date,
  last_osm_sync_at    timestamptz,
  last_google_sync_at timestamptz,
  raw_osm_tags        jsonb,      -- archive only; never use in WHERE/ORDER BY of search queries
  updated_at          timestamptz not null default now()
);

create index if not exists idx_ppm_amenity_type
  on public.place_provider_metadata (amenity_type) where amenity_type is not null;
create index if not exists idx_ppm_wikidata_id
  on public.place_provider_metadata (wikidata_id) where wikidata_id is not null;
create index if not exists idx_ppm_brand
  on public.place_provider_metadata (lower(brand)) where brand is not null;
create index if not exists idx_ppm_state
  on public.place_provider_metadata (state) where state is not null;
create index if not exists idx_ppm_alt_names
  on public.place_provider_metadata using gin (alt_names) where alt_names is not null;

alter table public.place_provider_metadata enable row level security;
create policy "Public read place_provider_metadata"
  on public.place_provider_metadata for select using (true);
create policy "Service role manages place_provider_metadata"
  on public.place_provider_metadata for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 7. place_stats — derived cache; events (posts, saves, etc.) are truth
-- ---------------------------------------------------------------------------

create table if not exists public.place_stats (
  place_id         uuid          primary key references public.places(id) on delete cascade,
  post_count       integer       not null default 0,
  save_count       integer       not null default 0,
  collection_count integer       not null default 0,
  visit_count      integer       not null default 0,
  trending_score   numeric(6,3)  not null default 0,
  last_activity_at timestamptz,
  updated_at       timestamptz   not null default now()
);

create index if not exists idx_place_stats_trending
  on public.place_stats (trending_score desc);
create index if not exists idx_place_stats_post_count
  on public.place_stats (post_count desc);

alter table public.place_stats enable row level security;
create policy "Public read place_stats"
  on public.place_stats for select using (true);
create policy "Service role manages place_stats"
  on public.place_stats for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 8. place_aliases — highest ROI for search quality; expand without code changes
-- ---------------------------------------------------------------------------

create table if not exists public.place_aliases (
  id         uuid        primary key default gen_random_uuid(),
  place_id   uuid        not null references public.places(id) on delete cascade,
  alias      text        not null,
  source     text        not null check (source in ('osm', 'community', 'admin', 'cuisine_taxonomy')),
  created_at timestamptz not null default now()
);

create unique index if not exists place_aliases_uniq
  on public.place_aliases (place_id, lower(alias));
create index if not exists idx_place_aliases_alias
  on public.place_aliases using gin (to_tsvector('simple', alias));

alter table public.place_aliases enable row level security;
create policy "Public read place_aliases"
  on public.place_aliases for select using (true);
create policy "Service role manages place_aliases"
  on public.place_aliases for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 9. place_traits — community-inferred vibes; controlled enum vocabulary
-- ---------------------------------------------------------------------------

create table if not exists public.place_traits (
  id         uuid                    primary key default gen_random_uuid(),
  place_id   uuid                    not null references public.places(id) on delete cascade,
  trait_slug public.place_trait_slug not null,
  confidence numeric(3,2)            not null default 0.50,
  source     text                    not null check (source in ('community', 'admin', 'ai')),
  created_at timestamptz             not null default now()
);

create unique index if not exists place_traits_uniq
  on public.place_traits (place_id, trait_slug);
create index if not exists idx_place_traits_slug
  on public.place_traits (trait_slug);

alter table public.place_traits enable row level security;
create policy "Public read place_traits"
  on public.place_traits for select using (true);
create policy "Service role manages place_traits"
  on public.place_traits for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 10. place_merge_log — safe deduplication history
-- ---------------------------------------------------------------------------

create table if not exists public.place_merge_log (
  id             uuid        primary key default gen_random_uuid(),
  old_place_id   uuid        not null,   -- intentionally not a FK; old place is soft-deleted
  new_place_id   uuid        not null references public.places(id) on delete cascade,
  merged_by      uuid        references public.users(id) on delete set null,
  reason         text,                   -- 'osm_dedup' | 'community_report' | 'admin'
  created_at     timestamptz not null default now()
);

alter table public.place_merge_log enable row level security;
create policy "Service role manages place_merge_log"
  on public.place_merge_log for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 11. place_sources — raw provider payloads (selective retention; see retention policy)
-- ---------------------------------------------------------------------------

create table if not exists public.place_sources (
  id         uuid        primary key default gen_random_uuid(),
  place_id   uuid        not null references public.places(id) on delete cascade,
  source     text        not null check (source in ('osm', 'google', 'owner', 'user', 'admin')),
  payload    jsonb       not null,
  fetched_at timestamptz not null default now()
  -- Retention: osm=always, google=on enrichment events only, owner/user/admin=always
);

create index if not exists idx_place_sources_place_id
  on public.place_sources (place_id);
create index if not exists idx_place_sources_source
  on public.place_sources (source);

alter table public.place_sources enable row level security;
create policy "Service role manages place_sources"
  on public.place_sources for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 12. place_opening_hours — provider-agnostic hours; source priority: owner > community > google > osm
-- ---------------------------------------------------------------------------

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

create unique index if not exists place_opening_hours_current_uniq
  on public.place_opening_hours (place_id, source) where is_current = true;

alter table public.place_opening_hours enable row level security;
create policy "Public read place_opening_hours"
  on public.place_opening_hours for select using (true);
create policy "Service role manages place_opening_hours"
  on public.place_opening_hours for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 13. search_analytics — what users actually want; becomes the product roadmap
-- ---------------------------------------------------------------------------

create table if not exists public.search_analytics (
  id               uuid             primary key default gen_random_uuid(),
  user_id          uuid             references public.users(id) on delete set null,
  query            text             not null,
  results_count    integer          not null default 0,
  clicked_place_id uuid             references public.places(id) on delete set null,
  filters          jsonb,
  session_id       text,
  search_lat       double precision,
  search_lng       double precision,
  search_region    text,            -- coarse label e.g. 'Sydney' for grouping analytics
  created_at       timestamptz      not null default now()
);

create index if not exists idx_search_analytics_query
  on public.search_analytics (lower(query));
create index if not exists idx_search_analytics_created_at
  on public.search_analytics (created_at);

alter table public.search_analytics enable row level security;
create policy "Users read own search_analytics"
  on public.search_analytics for select using (auth.uid() = user_id);
create policy "Service role manages search_analytics"
  on public.search_analytics for all using (auth.role() = 'service_role');
create policy "Insert search_analytics"
  on public.search_analytics for insert with check (true);
