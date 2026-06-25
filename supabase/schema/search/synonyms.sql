-- ============================================================================
-- Domain:       Search
-- Owner:        Search / Discovery
-- Canonical:    Yes
-- Lifecycle:    Core
-- Owned tables: search_synonyms
-- Dependencies: (none)
-- Included by:  scripts/build-schema.sh
-- ============================================================================

-- search_synonyms: DB-backed synonym vocabulary for cuisine, occasion, and dietary filters.
-- Public-read reference data; operator/admin writes happen outside client scope.
create table if not exists public.search_synonyms (
  id         bigserial primary key,
  term       text not null,
  canonical  text not null,
  type       text not null check (type in ('cuisine', 'occasion', 'dietary')),
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint search_synonyms_non_empty check (
    btrim(term) <> '' and btrim(canonical) <> ''
  )
);

create unique index if not exists search_synonyms_type_term_canonical_uidx
  on public.search_synonyms (type, lower(term), lower(canonical));

create index if not exists search_synonyms_enabled_type_term_idx
  on public.search_synonyms (enabled, type, lower(term));
