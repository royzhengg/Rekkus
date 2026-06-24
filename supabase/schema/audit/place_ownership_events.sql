-- Domain: Audit
-- Owner: Platform / Compliance
-- Classification: Audit
-- Lifecycle: Core
-- Source of Truth: Yes

-- place_provenance: data rights and governance tracking
-- (distinct from place_sources, which is a simpler raw-payload cache in core/)
create table if not exists public.place_provenance (
  id                    uuid          default gen_random_uuid() primary key,
  place_id              uuid          not null references public.places(id) on delete cascade,
  source_type           text          not null check (source_type in (
                          'rekkus', 'google_places', 'osm', 'owner_submitted',
                          'user_created', 'admin_created', 'future_provider')),
  source_id             text,
  source_payload        jsonb,
  source_rights         text          not null default 'first_party',
  attribution_required  boolean       not null default false,
  cacheability          text          not null default 'permanent_identifier',
  retention_policy      text          not null default 'retain_until_unlinked_or_place_deleted',
  confidence            numeric(3,2)  not null default 0.50,
  created_by            uuid          references public.users(id) on delete set null,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

-- place_provider_links: external provider ID mappings and name/address variants
-- (distinct from place_aliases, which is a simpler search-quality alias table in core/)
create table if not exists public.place_provider_links (
  id            uuid          default gen_random_uuid() primary key,
  place_id      uuid          not null references public.places(id) on delete cascade,
  provider      text,
  provider_place_id text,
  alias_name    text,
  alias_address text,
  reason        text          not null,
  confidence    numeric(3,2)  not null default 0.50,
  status        text          not null default 'active' check (status in ('active', 'superseded', 'rejected')),
  created_by    uuid          references public.users(id) on delete set null,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

-- place_audit_events: structured audit log for all place-related operations
create table if not exists public.place_audit_events (
  id                  uuid        default gen_random_uuid() primary key,
  actor_type          text        not null default 'system',
  actor_id            uuid,
  action              text        not null,
  entity_type         text        not null,
  entity_id           uuid,
  place_id            uuid        references public.places(id) on delete set null,
  source_type         text,
  reason              text,
  before_summary      jsonb,
  after_summary       jsonb,
  request_id          text,
  job_id              text,
  compliance_category text,
  rollback_reference  text,
  created_at          timestamptz not null default now()
);

-- place_ownership_events: historical audit log for ownership claim/transfer events
-- Canonical state (who currently owns a place) lives in core/places/place_owners.sql.
create table if not exists public.place_ownership_events (
  id                uuid        default gen_random_uuid() primary key,
  place_id          uuid        not null references public.places(id) on delete cascade,
  event_type        text        not null check (event_type in (
                      'claim_submitted', 'claim_approved', 'claim_rejected',
                      'ownership_transferred', 'ownership_removed')),
  actor_id          uuid        references public.users(id) on delete set null,
  previous_owner_id uuid        references public.users(id) on delete set null,
  new_owner_id      uuid        references public.users(id) on delete set null,
  source_type       text        not null default 'owner_submitted',
  reason            text,
  evidence_summary  jsonb       not null default '{}'::jsonb,
  status            text        not null default 'pending' check (
                      status in ('pending', 'approved', 'rejected', 'superseded')),
  audit_event_id    uuid        references public.place_audit_events(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- Indexes
create unique index if not exists idx_place_provenance_unique_source on public.place_provenance (source_type, source_id)
  where source_id is not null;
create index if not exists idx_place_provenance_place on public.place_provenance (place_id);

create index if not exists idx_place_audit_events_place on public.place_audit_events (place_id, created_at desc);

create index if not exists idx_place_ownership_events_place on public.place_ownership_events (place_id, created_at desc);
create index if not exists idx_place_ownership_events_actor on public.place_ownership_events (actor_id, created_at desc);

create unique index if not exists idx_place_provider_links_provider on public.place_provider_links (provider, provider_place_id)
  where provider is not null and provider_place_id is not null;
