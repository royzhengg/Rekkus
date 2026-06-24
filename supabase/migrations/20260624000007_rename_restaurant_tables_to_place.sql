-- Phase 2: Rename restaurant_* tables to place_*
-- Standardises all table names on the canonical entity name "place".
--
-- Conflict resolutions (tables with name clashes):
--   restaurant_sources  → place_provenance       (place_sources already exists: simpler payload cache)
--   restaurant_aliases  → place_provider_links   (place_aliases already exists: search text aliases)
--
-- Straightforward renames:
--   restaurant_provider_cache   → place_provider_cache
--   restaurant_observations     → place_observations
--   restaurant_audit_events     → place_audit_events
--   restaurant_ownership_events → place_ownership_events
--   restaurant_merge_events     → place_merge_events

-- =============================================================================
-- 1. restaurant_audit_events → place_audit_events
--    (must precede merge_events and ownership_events, which FK into it)
-- =============================================================================
alter table public.restaurant_audit_events rename to place_audit_events;
alter table public.place_audit_events rename column restaurant_id to place_id;

-- Rename index
drop index if exists idx_restaurant_audit_events_restaurant;
create index if not exists idx_place_audit_events_place
  on public.place_audit_events (place_id, created_at desc);

-- =============================================================================
-- 2. restaurant_ownership_events → place_ownership_events
-- =============================================================================
alter table public.restaurant_ownership_events rename to place_ownership_events;
alter table public.place_ownership_events rename column restaurant_id to place_id;

drop index if exists idx_restaurant_ownership_events_restaurant;
drop index if exists idx_restaurant_ownership_events_actor;
create index if not exists idx_place_ownership_events_place
  on public.place_ownership_events (place_id, created_at desc);
create index if not exists idx_place_ownership_events_actor
  on public.place_ownership_events (actor_id, created_at desc);

-- =============================================================================
-- 3. restaurant_merge_events → place_merge_events
-- =============================================================================
alter table public.restaurant_merge_events rename to place_merge_events;
alter table public.place_merge_events rename column canonical_restaurant_id to canonical_place_id;
alter table public.place_merge_events rename column merged_restaurant_id to merged_place_id;

drop index if exists idx_restaurant_merge_events_canonical;
create index if not exists idx_place_merge_events_canonical
  on public.place_merge_events (canonical_place_id, created_at desc);

-- =============================================================================
-- 4. restaurant_sources → place_provenance
--    (place_sources already exists as a simpler payload cache table)
-- =============================================================================
alter table public.restaurant_sources rename to place_provenance;
alter table public.place_provenance rename column restaurant_id to place_id;

drop index if exists idx_restaurant_sources_unique_source;
drop index if exists idx_restaurant_sources_restaurant;
create unique index if not exists idx_place_provenance_unique_source
  on public.place_provenance (source_type, source_id) where source_id is not null;
create index if not exists idx_place_provenance_place
  on public.place_provenance (place_id);

-- =============================================================================
-- 5. restaurant_aliases → place_provider_links
--    (place_aliases already exists as search text aliases)
-- =============================================================================
alter table public.restaurant_aliases rename to place_provider_links;
alter table public.place_provider_links rename column restaurant_id to place_id;

drop index if exists idx_restaurant_aliases_provider_place;
create unique index if not exists idx_place_provider_links_provider
  on public.place_provider_links (provider, provider_place_id)
  where provider is not null and provider_place_id is not null;

-- =============================================================================
-- 6. restaurant_provider_cache → place_provider_cache
-- =============================================================================
alter table public.restaurant_provider_cache rename to place_provider_cache;
alter table public.place_provider_cache rename column restaurant_id to place_id;

-- =============================================================================
-- 7. restaurant_observations → place_observations
-- =============================================================================
alter table public.restaurant_observations rename to place_observations;
alter table public.place_observations rename column restaurant_id to place_id;

-- =============================================================================
-- 8. data_repair_events.restaurant_id → place_id
--    (table defined in 20240204000000_restaurant_history_and_repairs.sql)
-- =============================================================================
alter table public.data_repair_events rename column restaurant_id to place_id;

drop index if exists idx_data_repair_events_restaurant;
create index if not exists idx_data_repair_events_place
  on public.data_repair_events (place_id, created_at desc);

-- =============================================================================
-- RLS: re-enable on renamed tables (policies reference table by OID so survive
-- renames, but enabling is idempotent and safe to repeat)
-- =============================================================================
alter table public.place_provenance       enable row level security;
alter table public.place_provider_links   enable row level security;
alter table public.place_audit_events     enable row level security;
alter table public.place_ownership_events enable row level security;
alter table public.place_merge_events     enable row level security;
alter table public.place_provider_cache   enable row level security;
alter table public.place_observations     enable row level security;
