-- Domain: Analytics
-- Owner: Data / Platform
-- Classification: Analytics
-- Lifecycle: Core
-- Source of Truth: Yes

-- analytics_events
create table if not exists public.analytics_events (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references public.users(id) on delete set null,
  event_type    text        not null,
  entity_type   text,
  entity_id     uuid,
  metadata      jsonb,
  event_version integer     not null default 1,
  created_at    timestamptz default now()
);

-- Indexes
create index if not exists idx_analytics_entity on public.analytics_events (entity_type, entity_id, created_at desc);
create index if not exists idx_analytics_type_created on public.analytics_events (event_type, created_at desc);
create index if not exists idx_analytics_retention on public.analytics_events (created_at desc);
