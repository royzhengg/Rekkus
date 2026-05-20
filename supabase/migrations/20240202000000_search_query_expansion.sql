CREATE OR REPLACE FUNCTION public.expand_search_cuisines(
  query_text text,
  max_cuisines integer DEFAULT 3
)
RETURNS TABLE (
  cuisine_type text,
  match_count integer
)
LANGUAGE sql
STABLE
AS $$
WITH normalized AS (
  SELECT lower(trim(regexp_replace(coalesce(query_text, ''), '[^[:alnum:][:space:]-]', ' ', 'g'))) AS q
),
terms AS (
  SELECT DISTINCT term
  FROM normalized,
  LATERAL regexp_split_to_table(q, '[[:space:]]+') AS term
  WHERE length(term) >= 2
    AND term NOT IN (
      'food', 'restaurant', 'restaurants', 'place', 'places', 'spot', 'spots',
      'the', 'a', 'an', 'in', 'at', 'for', 'and', 'or', 'near', 'with',
      'best', 'good', 'great', 'nice'
    )
),
post_matches AS (
  SELECT DISTINCT p.id, lower(p.cuisine_type) AS cuisine_type
  FROM public.posts p
  LEFT JOIN public.restaurants r ON r.id = p.restaurant_id
  LEFT JOIN public.post_hashtags ph ON ph.post_id = p.id
  LEFT JOIN public.hashtags h ON h.id = ph.hashtag_id
  CROSS JOIN normalized n
  WHERE p.cuisine_type IS NOT NULL
    AND trim(p.cuisine_type) <> ''
    AND n.q <> ''
    AND (
      lower(coalesce(p.caption, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(p.best_dish, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(p.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.name, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.city, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.address, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(h.name, '')) LIKE '%' || n.q || '%'
      OR EXISTS (
        SELECT 1
        FROM terms t
        WHERE lower(coalesce(p.caption, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(p.best_dish, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.name, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.cuisine_type, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.city, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.address, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(h.name, '')) LIKE '%' || t.term || '%'
      )
    )
),
restaurant_matches AS (
  SELECT DISTINCT r.id, lower(r.cuisine_type) AS cuisine_type
  FROM public.restaurants r
  CROSS JOIN normalized n
  WHERE r.cuisine_type IS NOT NULL
    AND trim(r.cuisine_type) <> ''
    AND n.q <> ''
    AND (
      lower(coalesce(r.name, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.city, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.address, '')) LIKE '%' || n.q || '%'
      OR EXISTS (
        SELECT 1
        FROM terms t
        WHERE lower(coalesce(r.name, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.cuisine_type, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.city, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.address, '')) LIKE '%' || t.term || '%'
      )
    )
),
signals AS (
  SELECT cuisine_type, 2 AS weight FROM post_matches
  UNION ALL
  SELECT cuisine_type, 1 AS weight FROM restaurant_matches
)
SELECT
  initcap(cuisine_type) AS cuisine_type,
  sum(weight)::integer AS match_count
FROM signals
GROUP BY cuisine_type
ORDER BY match_count DESC, cuisine_type ASC
LIMIT greatest(1, least(coalesce(max_cuisines, 3), 10));
$$;
