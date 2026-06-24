-- Domain: Search
-- Owner: Search / Discovery
-- Classification: Derived
-- Lifecycle: Temporary
-- Source of Truth: No

-- trending_searches
create table if not exists public.trending_searches (
  id           serial      primary key,
  query        text        not null unique,
  search_count integer     not null default 0,
  score        real        not null default 0,
  updated_at   timestamptz not null default now()
);

-- Indexes
create index if not exists trending_searches_score_idx on public.trending_searches (score desc);
