-- B-549: trending dishes for DiscoveryPage
-- Returns dishes ranked by 7-day save+post activity.
-- security definer: saved_dishes RLS is auth.uid() = user_id; aggregate count only, no saver identity.
--
-- Depends on: 20240229000000_dishes.sql (dishes table),
--             20260526000003_dish_details_saved_library.sql (saved_dishes table),
--             20260601000000_search_dishes_full_text.sql (post_photos join pattern)

create or replace function public.fetch_trending_dishes(
  limit_count int default 10,
  lookback_days int default 7
)
returns table (
  id uuid,
  name text,
  cuisine_type text,
  top_photo_url text,
  save_count bigint,
  post_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with recent_saves as (
    select dish_id, count(*) as recent_save_count
    from saved_dishes
    where created_at >= now() - (lookback_days || ' days')::interval
    group by dish_id
  ),
  recent_posts as (
    select dish_id, count(*) as recent_post_count
    from posts
    where dish_id is not null
      and deleted_at is null
      and created_at >= now() - (lookback_days || ' days')::interval
    group by dish_id
  ),
  trending as (
    select
      coalesce(rs.dish_id, rp.dish_id) as dish_id,
      coalesce(rs.recent_save_count, 0) as recent_save_count,
      coalesce(rp.recent_post_count, 0) as recent_post_count
    from recent_saves rs
    full join recent_posts rp on rp.dish_id = rs.dish_id
  )
  select
    d.id,
    d.name,
    d.cuisine_type,
    (
      select coalesce(pp.processed_url, pp.thumbnail_url)
      from posts p
      join post_photos pp on pp.post_id = p.id and pp.deleted_at is null
      where p.dish_id = d.id
        and p.deleted_at is null
        and pp.media_type = 'image'
      order by p.created_at desc
      limit 1
    ) as top_photo_url,
    (select count(*) from saved_dishes sd where sd.dish_id = d.id) as save_count,
    (select count(*) from posts p where p.dish_id = d.id and p.deleted_at is null) as post_count
  from dishes d
  join trending t on t.dish_id = d.id
  order by (t.recent_save_count * 3 + t.recent_post_count) desc
  limit limit_count
$$;

grant execute on function public.fetch_trending_dishes(int, int) to authenticated, anon;
