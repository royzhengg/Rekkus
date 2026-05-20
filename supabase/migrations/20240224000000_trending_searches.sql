-- Trending searches: pre-aggregated from analytics_events with recency weighting

create table if not exists public.trending_searches (
  id serial primary key,
  query text not null unique,
  search_count integer not null default 0,
  score real not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.trending_searches enable row level security;

create policy "Anyone can read trending_searches"
  on public.trending_searches for select using (true);

create index if not exists trending_searches_score_idx
  on public.trending_searches (score desc);

create or replace function public.refresh_trending_queries()
returns void language sql security definer set search_path = public as $$
  insert into public.trending_searches (query, search_count, score, updated_at)
  select
    metadata->>'query' as query,
    count(*)::integer as search_count,
    -- recency-weighted: queries from last 6h count 2x, last 24h count 1x
    sum(case when created_at >= now() - interval '6 hours' then 2.0 else 1.0 end)::real as score,
    now()
  from public.analytics_events
  where event_type = 'search_query'
    and created_at >= now() - interval '24 hours'
    and metadata->>'query' is not null
    and length(trim(metadata->>'query')) >= 2
  group by metadata->>'query'
  on conflict (query) do update set
    search_count = excluded.search_count,
    score = excluded.score,
    updated_at = now();
$$;

-- Initial population (will be empty on first run, fills as users search)
select public.refresh_trending_queries();
