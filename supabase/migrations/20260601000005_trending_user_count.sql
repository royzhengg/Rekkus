-- B-550 follow-up: track distinct user count per trending query so single-user
-- searches don't surface as globally trending; add 30-min refresh schedule.

alter table public.trending_searches
  add column if not exists user_count integer not null default 1;

create or replace function public.refresh_trending_queries()
returns void language sql security definer set search_path = public as $$
  with recent_searches as (
    select
      trim(metadata->>'query') as query,
      coalesce(nullif(trim(metadata->>'near_city'), ''), 'global') as near_city,
      user_id,
      created_at
    from public.analytics_events
    where event_type = 'search_query'
      and created_at >= now() - interval '24 hours'
      and metadata->>'query' is not null
      and length(trim(metadata->>'query')) >= 2
  ),
  partitioned as (
    select query, 'global'::text as near_city, user_id, created_at
    from recent_searches
    union all
    select query, near_city, user_id, created_at
    from recent_searches
    where lower(near_city) <> 'global'
  )
  insert into public.trending_searches (query, near_city, search_count, user_count, score, updated_at)
  select
    query,
    near_city,
    count(*)::integer as search_count,
    count(distinct user_id)::integer as user_count,
    sum(case when created_at >= now() - interval '6 hours' then 2.0 else 1.0 end)::real as score,
    now()
  from partitioned
  group by query, near_city
  on conflict (query, near_city) do update set
    search_count = excluded.search_count,
    user_count   = excluded.user_count,
    score        = excluded.score,
    updated_at   = now();
$$;

-- Backfill user_count for any existing rows using the updated function.
select public.refresh_trending_queries();

-- Register a 30-minute refresh schedule if pg_cron is enabled.
-- Enable it in Supabase dashboard → Database → Extensions → pg_cron.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule(
      'refresh-trending-queries',
      '*/30 * * * *',
      'select public.refresh_trending_queries()'
    );
  end if;
end; $$;
