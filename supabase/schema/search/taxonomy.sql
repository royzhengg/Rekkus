-- ============================================================================
-- Domain:       Search
-- Owner:        Search / Discovery
-- Canonical:    Yes
-- Lifecycle:    Core
-- Owned tables: cuisine_aliases
-- Dependencies: (none)
-- Included by:  scripts/build-schema.sh
-- Note:         taxonomy_nodes, taxonomy_aliases added via migration only.
--               See supabase/migrations/20260624000004_cuisine_taxonomy.sql
-- ============================================================================

-- cuisine_aliases: legacy per-cuisine alias vocabulary. See also taxonomy_aliases (migration-only).
create table if not exists public.cuisine_aliases (
  cuisine_type text not null,
  alias        text not null,
  created_at   timestamptz not null default now(),
  primary key (cuisine_type, alias)
);
