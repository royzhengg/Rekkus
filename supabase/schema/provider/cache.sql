-- Domain: Provider
-- Owner: Data / Import Pipelines
-- Classification: Provider-managed
-- Lifecycle: Provider-managed
-- Source of Truth: No

-- place_provider_cache
create table if not exists public.place_provider_cache (
  id                   uuid          default gen_random_uuid() primary key,
  place_id             uuid          references public.places(id) on delete cascade,
  source_type          text          not null,
  source_id            text          not null,
  field_mask           text[],
  normalized_payload   jsonb         not null default '{}'::jsonb,
  raw_payload          jsonb,
  attribution_required boolean       not null default false,
  attribution_text     text,
  cacheability         text          not null,
  retention_policy     text          not null,
  freshness_state      text          not null default 'fresh' check (
                         freshness_state in ('fresh', 'stale', 'expired', 'restricted')),
  fetched_at           timestamptz   not null default now(),
  stale_at             timestamptz,
  expires_at           timestamptz
);
