-- B-544: Canonical dish entity search
-- Adds search_dishes_full_text RPC that queries dishes.search_tsv (GIN index) and returns
-- canonical Dish rows with aggregate save_count and post_count.
--
-- security definer required: saved_dishes RLS is auth.uid() = user_id, so a security invoker
-- function would only count the calling user's saves. We expose aggregate count only —
-- no individual saver identity is exposed.
--
-- Uses websearch_to_tsquery('english') to match dishes.search_tsv which is generated with
-- to_tsvector('english', name). Trigram fallback on name_normalized handles short/partial queries.
--
-- Depends on: 20240229000000_dishes.sql (dishes table, search_tsv, dishes_search_tsv_idx),
--             20260526000003_dish_details_saved_library.sql (saved_dishes table)

create or replace function public.search_dishes_full_text(
  query text,
  near_lat double precision default null,
  near_lng double precision default null,
  max_results integer default 10
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
    (
      select count(*)
      from saved_dishes sd
      where sd.dish_id = d.id
    ) as save_count,
    (
      select count(*)
      from posts p
      where p.dish_id = d.id
        and p.deleted_at is null
    ) as post_count
  from dishes d
  where
    d.search_tsv @@ websearch_to_tsquery('english', search_dishes_full_text.query)
    or extensions.similarity(d.name_normalized, lower(search_dishes_full_text.query)) > 0.3
  order by
    ts_rank(d.search_tsv, websearch_to_tsquery('english', search_dishes_full_text.query)) desc,
    save_count desc
  limit search_dishes_full_text.max_results
$$;

grant execute on function public.search_dishes_full_text(text, double precision, double precision, integer)
  to authenticated, anon;
