-- Search history aggregate RPC
-- Keeps app reads off raw analytics_events scans while preserving analytics_events as the write log.

create or replace function public.get_recent_search_history(
  max_results integer default 10,
  lookback_days integer default 30
)
returns table (
  query text,
  last_searched_at timestamptz,
  search_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      trim(metadata->>'query') as query,
      created_at
    from public.analytics_events
    where auth.uid() is not null
      and user_id = auth.uid()
      and event_type = 'search_query'
      and created_at >= now() - make_interval(days => greatest(1, least(coalesce(lookback_days, 30), 365)))
      and metadata ? 'query'
  )
  select
    query,
    max(created_at) as last_searched_at,
    count(*)::integer as search_count
  from normalized
  where query is not null
    and length(query) > 1
  group by lower(query), query
  order by last_searched_at desc, search_count desc
  limit greatest(1, least(coalesce(max_results, 10), 50));
$$;

revoke all on function public.get_recent_search_history(integer, integer) from public;
grant execute on function public.get_recent_search_history(integer, integer) to authenticated;
