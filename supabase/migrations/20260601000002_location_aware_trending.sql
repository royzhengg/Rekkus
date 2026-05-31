-- B-550: partition trending searches by city while preserving global fallback rows.

alter table public.trending_searches
  add column if not exists near_city text not null default 'global';

alter table public.trending_searches
  drop constraint if exists trending_searches_query_key;

alter table public.trending_searches
  add constraint trending_searches_query_near_city_key unique (query, near_city);

create index if not exists trending_searches_near_city_score_idx
  on public.trending_searches (near_city, score desc, updated_at desc);

create or replace function public.refresh_trending_queries()
returns void language sql security definer set search_path = public as $$
  with recent_searches as (
    select
      trim(metadata->>'query') as query,
      coalesce(nullif(trim(metadata->>'near_city'), ''), 'global') as near_city,
      created_at
    from public.analytics_events
    where event_type = 'search_query'
      and created_at >= now() - interval '24 hours'
      and metadata->>'query' is not null
      and length(trim(metadata->>'query')) >= 2
  ),
  partitioned as (
    select query, 'global'::text as near_city, created_at
    from recent_searches
    union all
    select query, near_city, created_at
    from recent_searches
    where lower(near_city) <> 'global'
  )
  insert into public.trending_searches (query, near_city, search_count, score, updated_at)
  select
    query,
    near_city,
    count(*)::integer as search_count,
    -- recency-weighted: queries from last 6h count 2x, last 24h count 1x
    sum(case when created_at >= now() - interval '6 hours' then 2.0 else 1.0 end)::real as score,
    now()
  from partitioned
  group by query, near_city
  on conflict (query, near_city) do update set
    search_count = excluded.search_count,
    score = excluded.score,
    updated_at = now();
$$;

select public.refresh_trending_queries();
