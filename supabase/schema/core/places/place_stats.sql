-- Domain: Core
-- Owner: Discovery
-- Classification: Metadata
-- Lifecycle: Derived
-- Source of Truth: No

-- place_stats: raw factual counters only (post_count, save_count, collection_count,
-- last_activity_at). Derived ranking signals such as trending_score live in
-- place_search_index. Never write derived scores here.
create table if not exists public.place_stats (
  place_id         uuid    primary key references public.places(id) on delete cascade,
  post_count       bigint  not null default 0,
  save_count       bigint  not null default 0,
  collection_count bigint  not null default 0,
  visit_count      integer not null default 0,
  last_activity_at timestamptz,
  updated_at       timestamptz not null default now()
);

-- Indexes
create index if not exists idx_place_stats_post_count    on public.place_stats (post_count desc);
create index if not exists idx_place_stats_last_activity on public.place_stats (last_activity_at);
