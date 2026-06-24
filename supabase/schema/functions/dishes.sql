-- Domain: Functions / Dishes
-- Owner: Discovery
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- find_or_create_dish
create or replace function public.find_or_create_dish(
  p_name          text,
  p_place_id      uuid,
  p_cuisine_type  text    DEFAULT NULL,
  p_created_by    uuid    DEFAULT NULL,
  p_context       jsonb   DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id         uuid;
  v_normalized text    := lower(trim(p_name));
  v_is_new     boolean := false;
BEGIN
  -- Fast path: dish already exists
  SELECT id INTO v_id
  FROM public.dishes
  WHERE name_normalized = v_normalized
    AND place_id = p_place_id
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Insert, ignoring conflict from concurrent callers
  INSERT INTO public.dishes (name, place_id, cuisine_type, created_by)
  VALUES (p_name, p_place_id, p_cuisine_type, p_created_by)
  ON CONFLICT (name_normalized, place_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    v_is_new := true;
  ELSE
    -- A concurrent insert won the race — fetch its id
    SELECT id INTO v_id
    FROM public.dishes
    WHERE name_normalized = v_normalized
      AND place_id = p_place_id
    LIMIT 1;
  END IF;

  -- Audit only genuinely new dishes
  IF v_is_new THEN
    INSERT INTO public.dish_audit_events (dish_id, user_id, event_type, context)
    VALUES (v_id, p_created_by, 'created', p_context);
  END IF;

  RETURN v_id;
END;
$$;

-- fetch_trending_dishes
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

-- Grants
grant execute on function public.fetch_trending_dishes(int, int) to authenticated, anon;
