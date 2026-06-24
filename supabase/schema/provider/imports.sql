-- Domain: Provider
-- Owner: Data / Import Pipelines
-- Classification: Provider-managed
-- Lifecycle: Provider-managed
-- Source of Truth: No

-- ---------------------------------------------------------------------------
-- OSM IMPORT RUNS
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
