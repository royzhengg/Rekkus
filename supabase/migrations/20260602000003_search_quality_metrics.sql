-- B-575: privacy-safe aggregate search quality metrics.
-- Read surface only; raw user-linked analytics_events remain governed by 90-day retention.

create index if not exists analytics_events_search_session_idx
  on public.analytics_events ((metadata->>'search_session_id'), created_at desc)
  where metadata ? 'search_session_id';

create index if not exists analytics_events_search_result_dimension_idx
  on public.analytics_events (
    event_type,
    (metadata->>'result_type'),
    (metadata->>'result_position'),
    created_at desc
  )
  where event_type in (
    'search_result_click',
    'post_view',
    'post_save',
    'place_view',
    'place_save',
    'dish_view',
    'dish_save',
    'post_published'
  );

create or replace function public.get_search_quality_metrics(
  lookback_days integer default 30
)
returns table (
  day date,
  result_type text,
  result_position integer,
  search_sessions integer,
  query_count integer,
  click_count integer,
  attributed_view_count integer,
  attributed_save_count integer,
  attributed_review_count integer,
  zero_result_count integer,
  reformulation_count integer,
  success_count integer,
  success_rate numeric,
  ctr numeric,
  zero_result_rate numeric,
  reformulation_rate numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select greatest(1, least(coalesce(lookback_days, 30), 90))::integer as days
  ),
  events as (
    select
      ae.created_at,
      ae.event_type,
      ae.metadata,
      ae.metadata->>'search_session_id' as search_session_id,
      ae.metadata->>'result_type' as result_type,
      case
        when (ae.metadata->>'result_position') ~ '^[0-9]+$'
          then (ae.metadata->>'result_position')::integer
        else null::integer
      end as result_position
    from public.analytics_events ae, params
    where ae.created_at >= now() - make_interval(days => params.days)
      and ae.event_type in (
        'search_query',
        'search_result_click',
        'search_session_end',
        'post_view',
        'post_save',
        'place_view',
        'place_save',
        'dish_view',
        'dish_save',
        'post_published'
      )
  ),
  day_keys as (
    select distinct date_trunc('day', created_at)::date as day
    from events
  ),
  dimensions as (
    select day, null::text as result_type, null::integer as result_position
    from day_keys
    union
    select
      date_trunc('day', created_at)::date as day,
      result_type,
      result_position
    from events
    where event_type = 'search_result_click'
      and result_type is not null
      and result_position is not null
  ),
  session_ends as (
    select
      date_trunc('day', created_at)::date as day,
      search_session_id,
      coalesce((metadata->>'had_results')::boolean, false) as had_results,
      coalesce((metadata->>'result_clicked')::boolean, false) as result_clicked
    from events
    where event_type = 'search_session_end'
      and search_session_id is not null
  ),
  attributed_events as (
    select
      date_trunc('day', created_at)::date as day,
      search_session_id,
      result_type,
      result_position,
      event_type
    from events
    where search_session_id is not null
      and event_type in (
        'post_view',
        'post_save',
        'place_view',
        'place_save',
        'dish_view',
        'dish_save',
        'post_published'
      )
  ),
  daily_queries as (
    select
      d.day,
      count(*) filter (where e.event_type = 'search_query')::integer as query_count,
      count(*) filter (
        where e.event_type = 'search_query'
          and e.metadata->>'previous_query' is not null
          and lower(trim(e.metadata->>'previous_query')) <> lower(trim(coalesce(e.metadata->>'query', '')))
      )::integer as reformulation_count
    from day_keys d
    left join events e on date_trunc('day', e.created_at)::date = d.day
    group by d.day
  ),
  daily_sessions as (
    select
      d.day,
      count(distinct se.search_session_id)::integer as search_sessions,
      count(distinct se.search_session_id) filter (where not se.had_results)::integer as zero_result_count,
      count(distinct se.search_session_id) filter (
        where se.result_clicked
          or exists (
            select 1
            from attributed_events attr
            where attr.search_session_id = se.search_session_id
          )
      )::integer as success_count
    from day_keys d
    left join session_ends se on se.day = d.day
    group by d.day
  ),
  daily as (
    select
      q.day,
      q.query_count,
      s.search_sessions,
      s.zero_result_count,
      q.reformulation_count,
      s.success_count
    from daily_queries q
    join daily_sessions s on s.day = q.day
  ),
  dimension_counts as (
    select
      dim.day,
      dim.result_type,
      dim.result_position,
      count(*) filter (
        where e.event_type = 'search_result_click'
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as click_count,
      count(*) filter (
        where e.event_type in ('post_view', 'place_view', 'dish_view')
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as attributed_view_count,
      count(*) filter (
        where e.event_type in ('post_save', 'place_save', 'dish_save')
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as attributed_save_count,
      count(*) filter (
        where e.event_type = 'post_published'
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as attributed_review_count
    from dimensions dim
    left join events e on date_trunc('day', e.created_at)::date = dim.day
    group by dim.day, dim.result_type, dim.result_position
  )
  select
    d.day,
    dc.result_type,
    dc.result_position,
    d.search_sessions,
    d.query_count,
    dc.click_count,
    dc.attributed_view_count,
    dc.attributed_save_count,
    dc.attributed_review_count,
    d.zero_result_count,
    d.reformulation_count,
    d.success_count,
    round(d.success_count * 100.0 / nullif(d.search_sessions, 0), 2) as success_rate,
    round(dc.click_count * 100.0 / nullif(d.query_count, 0), 2) as ctr,
    round(d.zero_result_count * 100.0 / nullif(d.search_sessions, 0), 2) as zero_result_rate,
    round(d.reformulation_count * 100.0 / nullif(d.query_count, 0), 2) as reformulation_rate
  from daily d
  join dimension_counts dc on dc.day = d.day
  order by d.day desc, dc.result_type nulls first, dc.result_position nulls first;
$$;

revoke all on function public.get_search_quality_metrics(integer) from public;
grant execute on function public.get_search_quality_metrics(integer) to anon, authenticated;
