-- ============================================================================
-- Domain:       Search
-- Owner:        Search / Discovery
-- Canonical:    No
-- Lifecycle:    Derived
-- Owned tables: place_popularity_cache
-- Dependencies: core/places/places.sql
-- Included by:  scripts/build-schema.sh
-- ============================================================================

-- place_popularity_cache: derived ranking signals refreshed by refresh_place_popularity_cache().
-- Rebuild: truncate and re-run refresh_place_popularity_cache(). Source tables: posts, post_reactions.
create table if not exists public.place_popularity_cache (
  place_id              uuid primary key references public.places(id) on delete cascade,
  post_count            integer not null default 0,
  interaction_count_30d integer not null default 0,
  avg_food_rating       numeric(3,2),
  food_rating_count     integer not null default 0,
  updated_at            timestamptz not null default now()
);
