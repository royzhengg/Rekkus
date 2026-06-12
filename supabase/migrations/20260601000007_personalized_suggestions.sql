-- B-557: server-side personalized no-results suggestions.
-- Additive RPC only; no persisted user data or new mutable entity is introduced.

create or replace function public.get_personalized_suggestions(
  p_user_id uuid,
  p_failed_query text,
  p_limit integer default 3
)
returns table (
  query text,
  score numeric,
  source text
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      p_user_id as user_id,
      lower(trim(regexp_replace(coalesce(p_failed_query, ''), '\s+', ' ', 'g'))) as failed_query,
      greatest(1, least(coalesce(p_limit, 3), 10)) as result_limit
  ),
  search_history as (
    select
      lower(trim(metadata->>'query')) as query,
      count(*)::numeric * 1.0 as score,
      'search_history'::text as source
    from public.analytics_events, params
    where auth.uid() = params.user_id
      and analytics_events.user_id = params.user_id
      and event_type = 'search_query'
      and created_at >= now() - interval '90 days'
      and metadata ? 'query'
    group by lower(trim(metadata->>'query'))
  ),
  engagement_cuisines as (
    select
      lower(trim(metadata->>'cuisine_type')) as query,
      sum(case event_type when 'post_save' then 3 when 'place_save' then 3 else 1 end)::numeric as score,
      'engagement_cuisine'::text as source
    from public.analytics_events, params
    where auth.uid() = params.user_id
      and analytics_events.user_id = params.user_id
      and event_type in ('post_view', 'post_save', 'place_view', 'place_save')
      and created_at >= now() - interval '90 days'
      and metadata ? 'cuisine_type'
    group by lower(trim(metadata->>'cuisine_type'))
  ),
  saved_post_cuisines as (
    select
      lower(trim(p.cuisine_type)) as query,
      count(*)::numeric * 3.0 as score,
      'saved_post'::text as source
    from public.saves s
    join public.posts p on p.id = s.post_id
    join params on true
    where auth.uid() = params.user_id
      and s.user_id = params.user_id
      and p.cuisine_type is not null
    group by lower(trim(p.cuisine_type))
  ),
  saved_place_cuisines as (
    select
      lower(trim(r.cuisine_type)) as query,
      count(*)::numeric * 3.0 as score,
      'saved_place'::text as source
    from public.saved_locations sl
    join public.restaurants r on r.id = sl.restaurant_id
    join params on true
    where auth.uid() = params.user_id
      and sl.user_id = params.user_id
      and r.cuisine_type is not null
    group by lower(trim(r.cuisine_type))
  ),
  saved_dish_cuisines as (
    select
      lower(trim(d.cuisine_type)) as query,
      count(*)::numeric * 4.0 as score,
      'saved_dish'::text as source
    from public.saved_dishes sd
    join public.dishes d on d.id = sd.dish_id
    join params on true
    where auth.uid() = params.user_id
      and sd.user_id = params.user_id
      and d.cuisine_type is not null
    group by lower(trim(d.cuisine_type))
  ),
  topic_follows as (
    select
      lower(trim(topic)) as query,
      count(*)::numeric * 2.0 as score,
      'topic_follow'::text as source
    from public.user_topic_follows utf
    join params on true
    where auth.uid() = params.user_id
      and utf.user_id = params.user_id
    group by lower(trim(topic))
  ),
  user_cuisine_terms as (
    select query from engagement_cuisines
    union
    select query from saved_post_cuisines
    union
    select query from saved_place_cuisines
    union
    select query from saved_dish_cuisines
    union
    select query from topic_follows
  ),
  taste_adjacent_trending as (
    select
      lower(trim(ts.query)) as query,
      max(ts.score)::numeric * 0.25 as score,
      'taste_trending'::text as source
    from public.trending_searches ts
    join user_cuisine_terms uct
      on lower(ts.query) like '%' || uct.query || '%'
      or uct.query like '%' || lower(ts.query) || '%'
    where ts.near_city = 'global'
      and ts.user_count >= 2
      and ts.updated_at >= now() - interval '7 days'
    group by lower(trim(ts.query))
  ),
  global_trending as (
    select
      lower(trim(query)) as query,
      max(score)::numeric * 0.05 as score,
      'global_trending'::text as source
    from public.trending_searches
    where near_city = 'global'
      and user_count >= 2
      and updated_at >= now() - interval '7 days'
    group by lower(trim(query))
  ),
  candidates as (
    select * from search_history
    union all select * from engagement_cuisines
    union all select * from saved_post_cuisines
    union all select * from saved_place_cuisines
    union all select * from saved_dish_cuisines
    union all select * from topic_follows
    union all select * from taste_adjacent_trending
    union all select * from global_trending
  ),
  filtered as (
    select
      trim(regexp_replace(query, '\s+', ' ', 'g')) as normalized_query,
      score,
      source
    from candidates, params
    where query is not null
      and length(trim(query)) > 1
      and lower(trim(regexp_replace(query, '\s+', ' ', 'g'))) <> params.failed_query
  ),
  aggregated as (
    select
      normalized_query as query,
      sum(score) as score
    from filtered
    group by normalized_query
  ),
  best_source as (
    select distinct on (normalized_query)
      normalized_query,
      source
    from filtered
    order by normalized_query, score desc, source asc
  )
  select
    aggregated.query,
    aggregated.score,
    best_source.source
  from aggregated
  join best_source on best_source.normalized_query = aggregated.query
  order by aggregated.score desc, aggregated.query asc
  limit (select result_limit from params);
$$;

revoke all on function public.get_personalized_suggestions(uuid, text, integer) from public;
grant execute on function public.get_personalized_suggestions(uuid, text, integer) to authenticated;
