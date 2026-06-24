-- Domain: Provider
-- Owner: Data / Import Pipelines
-- Classification: Audit
-- Lifecycle: Core
-- Source of Truth: Yes

-- place_merge_events
create table if not exists public.place_merge_events (
  id                  uuid          default gen_random_uuid() primary key,
  canonical_place_id  uuid          not null references public.places(id) on delete cascade,
  merged_place_id     uuid          references public.places(id) on delete set null,
  actor_id            uuid          references public.users(id) on delete set null,
  reason              text          not null,
  confidence          numeric(3,2)  not null default 0.50,
  before_summary      jsonb         not null default '{}'::jsonb,
  after_summary       jsonb         not null default '{}'::jsonb,
  rollback_reference  text,
  audit_event_id      uuid          references public.place_audit_events(id) on delete set null,
  created_at          timestamptz   not null default now()
);

create index if not exists idx_place_merge_events_canonical
  on public.place_merge_events (canonical_place_id, created_at desc);
