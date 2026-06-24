-- Domain: Search
-- Owner: Search / Analytics
-- Classification: Analytics
-- Lifecycle: Core
-- Source of Truth: Yes

-- search_events: structured search analytics for post-launch analysis of failing queries
create table if not exists public.search_events (
  id                  uuid        default gen_random_uuid() primary key,
  query               text        not null,
  results_count       int         not null,
  clicked_entity_id   uuid,
  clicked_entity_kind text        check (clicked_entity_kind in ('place', 'dish', 'post')),
  user_id             uuid        references public.users(id) on delete set null,
  created_at          timestamptz default now()
);

-- search_analytics: what users actually search for; feeds product roadmap
create table if not exists public.search_analytics (
  id               uuid             primary key default gen_random_uuid(),
  user_id          uuid             references public.users(id) on delete set null,
  query            text             not null,
  results_count    integer          not null default 0,
  clicked_place_id uuid             references public.places(id) on delete set null,
  filters          jsonb,
  session_id       text,
  search_lat       double precision,
  search_lng       double precision,
  search_region    text,
  created_at       timestamptz      not null default now()
);

-- Indexes
create index if not exists idx_search_events_query on public.search_events (query, created_at desc);
create index if not exists idx_search_events_zero on public.search_events (created_at desc) where results_count = 0;

create index if not exists idx_search_analytics_query on public.search_analytics (lower(query));
create index if not exists idx_search_analytics_created_at on public.search_analytics (created_at);
