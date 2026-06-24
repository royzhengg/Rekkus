-- Domain: Foundation
-- Owner: Platform
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- =============================================================================
-- ENUMS
-- =============================================================================

create type public.verification_level as enum (
  'user_created',       -- user typed a new place; not yet confirmed
  'osm_only',           -- OSM import; no further verification
  'osm_google',         -- OSM + Google cache enrichment applied
  'community_verified', -- ≥3 unique users, ≥7 days apart
  'owner_verified'      -- owner claimed + verified
);

create type public.place_status as enum (
  'active',
  'temporarily_closed',
  'permanently_closed',
  'unverified'
);

create type public.place_trait_slug as enum (
  'date_night', 'cheap_eats', 'study_spot', 'group_dining',
  'late_night', 'hidden_gem', 'family_friendly', 'romantic',
  'outdoor', 'fast_casual', 'special_occasion'
);
