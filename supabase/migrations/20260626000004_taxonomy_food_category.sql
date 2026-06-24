-- B-608: Taxonomy food_category nodes
-- Seeds 33 food_category nodes with hierarchy (5 parent groups + 16 children + 12 standalone).
-- Removes transient dish-level cuisine aliases now that food_category exists.
-- Adds resolve_all_taxonomy_matches() — single helper that covers all taxonomy types.
-- Updates search_text_fallback and expand_search_cuisines to expand across taxonomy types.
--
-- Slug policy (Option A): same slug is allowed across taxonomy types.
-- venue_type:cafe and food_category:cafe are distinct nodes; unique(slug, taxonomy_type) enforces this.
-- Do not add a global unique(slug) constraint — it would force artificial naming.

-- =============================================================
-- 1. Composite index for type-first scans in resolve_all_taxonomy_matches
-- =============================================================

create index if not exists taxonomy_nodes_type_slug_idx
  on public.taxonomy_nodes(taxonomy_type, slug);

-- =============================================================
-- 2. Seed food_category nodes — two passes (parents first, children second)
--
-- Hierarchy rule: every node is either a standalone root (no children yet)
-- or belongs to a named parent group. No node sits outside a group while a sibling has one.
--
-- Parent groups (5):  noodles, dumplings, grills, beverages, dessert
-- Standalone roots (12): pizza, burger, bbq, tacos, curry, pasta, salad, sandwich,
--                         sushi, hotpot, bento, banh-mi, fried-chicken, yakitori, shawarma, kebab
--
-- NOTE: grills is a SEARCH CONVENIENCE grouping, not a culinary claim.
--       Yakitori (Japanese), shawarma (Middle Eastern), bbq are different traditions.
--       Searching "grills" expands to all children — that is the intent.
-- =============================================================

-- Pass 1: parent group roots (parent_id = null)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id) values
  ('noodles',   'Noodles',   'food_category', null),
  ('dumplings', 'Dumplings', 'food_category', null),
  ('grills',    'Grills',    'food_category', null),
  ('beverages', 'Beverages', 'food_category', null),
  ('dessert',   'Dessert',   'food_category', null);

-- Pass 2: standalone roots (no children in this migration)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id) values
  ('pizza',         'Pizza',         'food_category', null),
  ('burger',        'Burger',        'food_category', null),
  ('tacos',         'Tacos',         'food_category', null),
  ('curry',         'Curry',         'food_category', null),
  ('pasta',         'Pasta',         'food_category', null),
  ('salad',         'Salad',         'food_category', null),
  ('sandwich',      'Sandwich',      'food_category', null),
  ('sushi',         'Sushi',         'food_category', null),
  ('hotpot',        'Hotpot',        'food_category', null),
  ('bento',         'Bento',         'food_category', null),
  ('banh-mi',       'Banh Mi',       'food_category', null),
  ('fried-chicken', 'Fried Chicken', 'food_category', null);

-- Pass 3: children of noodles (5)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'food_category',
  (select id from public.taxonomy_nodes where slug = 'noodles' and taxonomy_type = 'food_category')
from (values
  ('ramen', 'Ramen'),
  ('pho',   'Pho'),
  ('laksa', 'Laksa'),
  ('udon',  'Udon'),
  ('soba',  'Soba')
) v(slug, name);

-- Pass 4: children of dumplings (3)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'food_category',
  (select id from public.taxonomy_nodes where slug = 'dumplings' and taxonomy_type = 'food_category')
from (values
  ('gyoza',         'Gyoza'),
  ('xiao-long-bao', 'Xiao Long Bao'),
  ('dim-sum',       'Dim Sum')
) v(slug, name);

-- Pass 5: children of grills (4)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'food_category',
  (select id from public.taxonomy_nodes where slug = 'grills' and taxonomy_type = 'food_category')
from (values
  ('bbq',      'BBQ'),
  ('yakitori', 'Yakitori'),
  ('shawarma', 'Shawarma'),
  ('kebab',    'Kebab')
) v(slug, name);

-- Pass 6: children of beverages (3)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'food_category',
  (select id from public.taxonomy_nodes where slug = 'beverages' and taxonomy_type = 'food_category')
from (values
  ('coffee',     'Coffee'),
  ('tea',        'Tea'),
  ('bubble-tea', 'Bubble Tea')
) v(slug, name);

-- Pass 7: children of dessert (1)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'food_category',
  (select id from public.taxonomy_nodes where slug = 'dessert' and taxonomy_type = 'food_category')
from (values
  ('ice-cream', 'Ice Cream')
) v(slug, name);

-- Verify node count
do $$ declare n int; begin
  select count(*) into n from public.taxonomy_nodes where taxonomy_type = 'food_category';
  raise notice 'B-608: % food_category nodes seeded (expect 33)', n;
  if n <> 33 then
    raise exception 'B-608: expected 33 food_category nodes, got %', n;
  end if;
end $$;

-- =============================================================
-- 3. Remove transient dish-level cuisine aliases
--    bbq/barbeque/barbecue → american were pragmatic V1 shortcuts.
--    Now that bbq is a food_category node, these aliases are redundant and misleading.
-- =============================================================

delete from public.taxonomy_aliases
where alias in ('bbq', 'barbeque', 'barbecue')
  and taxonomy_type = 'cuisine';

-- =============================================================
-- 4. Seed food_category aliases (curated, high-confidence only)
--    Aliases that are truly synonymous — no parent-child relationships via aliases.
-- =============================================================

insert into public.taxonomy_aliases (node_id, alias)
select n.id, a.alias
from (values
  -- bbq synonyms
  ('bbq',        'barbeque'),
  ('bbq',        'barbecue'),
  -- ramen
  ('ramen',      'ramen noodles'),
  -- noodles (parent group)
  ('noodles',    'noodle soup'),
  -- pho
  ('pho',        'pho noodles'),
  -- gyoza
  ('gyoza',      'pot stickers'),
  ('gyoza',      'potstickers'),
  -- dim-sum: 'dim sum' → dim-sum slug (hyphen normalisation); yum cha is common APAC alternative
  ('dim-sum',    'dim sum'),
  ('dim-sum',    'yum cha'),
  -- hotpot
  ('hotpot',     'hot pot'),
  ('hotpot',     'shabu shabu'),
  -- banh-mi: 'banh mi' without hyphen
  ('banh-mi',    'banh mi'),
  -- bubble-tea
  ('bubble-tea', 'boba'),
  ('bubble-tea', 'boba tea')
) a(slug, alias)
join public.taxonomy_nodes n on n.slug = a.slug and n.taxonomy_type = 'food_category'
on conflict (alias, taxonomy_type) do nothing;

-- =============================================================
-- 5. resolve_all_taxonomy_matches() — single helper covering all taxonomy types
--    Returns per-type match_weight so scoring stays differentiated.
--    A query may resolve to multiple types simultaneously (Option A slug policy).
--    Each type returns at most one resolved node.
--
--    Scaling note: scans `select distinct taxonomy_type from taxonomy_nodes` on every search.
--    At 4–10 types this is negligible. If type count grows materially, promote to
--    taxonomy_types table (B-611) and replace this dynamic scan with a table join.
-- =============================================================

create or replace function public.resolve_all_taxonomy_matches(
  p_query text
) returns table (
  taxonomy_type  text,
  resolved_slug  text,
  family_slugs   text[],
  match_weight   numeric
) language sql stable security definer set search_path = public as $$
  select
    n.taxonomy_type,
    n.slug                                                                     as resolved_slug,
    (select array_agg(t)
     from public.get_taxonomy_family(n.slug, n.taxonomy_type) t)               as family_slugs,
    case n.taxonomy_type
      when 'cuisine'       then 0.65::numeric
      when 'food_category' then 0.63::numeric
      when 'venue_type'    then 0.62::numeric
      when 'dietary'       then 0.62::numeric
      else                      0.60::numeric
    end                                                                        as match_weight
  from (select distinct taxonomy_type from public.taxonomy_nodes) types
  cross join lateral (
    select public.resolve_taxonomy_slug(lower(trim(p_query)), types.taxonomy_type) as slug
  ) r
  join public.taxonomy_nodes n
    on  n.slug          = r.slug
    and n.taxonomy_type = types.taxonomy_type
  where r.slug is not null
$$;

grant execute on function public.resolve_all_taxonomy_matches(text) to authenticated, anon;

-- =============================================================
-- 6. Update search_text_fallback — taxonomy-aware via resolve_all_taxonomy_matches
--    Replaces the simple B-603 version with taxonomy CTEs + LEFT JOIN pattern.
--    score::real appears twice: maps to (semantic_similarity, final_score) in the return signature.
--    Text fallback doesn't compute a distinct semantic score, so both columns carry the same value.
-- =============================================================

create or replace function public.search_text_fallback(
  p_query    text,
  p_limit    integer          default 20,
  p_near_lat double precision default null,
  p_near_lng double precision default null
)
returns table (
  entity_type        text,
  entity_id          uuid,
  semantic_similarity real,
  final_score        real,
  display_data       jsonb
)
language sql stable security definer set search_path = public, extensions
as $$
  with
  -- Resolve query across all taxonomy types.
  -- A query may produce multiple rows when the same slug exists in multiple types (e.g. cafe).
  taxonomy_matches as (
    select * from public.resolve_all_taxonomy_matches(p_query)
  ),
  -- Single join replaces N correlated EXISTS subqueries (one per taxonomy type).
  -- max(match_weight) selects the highest-scoring type when multiple match.
  matched_places as (
    select pt.place_id,
           max(tm.match_weight) as match_weight
    from public.place_taxonomies pt
    join public.taxonomy_nodes n on n.id = pt.node_id
    join taxonomy_matches tm
      on  tm.taxonomy_type = n.taxonomy_type
      and n.slug = any(tm.family_slugs)
    group by pt.place_id
  )
  select entity_type, entity_id, score::real, score::real, display_data
  from (
    (
      select
        'place'::text as entity_type,
        psi.place_id  as entity_id,
        (
          case
            when psi.search_name =    lower(p_query)               then 0.90
            when psi.search_name like lower(p_query) || '%'        then 0.80
            when psi.search_name like '%' || lower(p_query) || '%' then 0.70
            when psi.cuisine_slug ilike '%' || p_query || '%'      then 0.65
            when mp.place_id is not null                           then coalesce(mp.match_weight, 0.63)
            when psi.suburb ilike '%' || p_query || '%'            then 0.55
            else 0.50
          end
          *
          case
            when p_near_lat is not null and p_near_lng is not null
              and psi.lat is not null and psi.lng is not null
            then 1.0 / (1.0 + (
              ST_Distance(
                ST_SetSRID(ST_MakePoint(psi.lng, psi.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(p_near_lng, p_near_lat), 4326)::geography
              ) / 1000.0 / 20.0
            ))
            else 1.0
          end
          + least(2.0, ln(1.0 + psi.trending_score))
        ) as score,
        jsonb_build_object(
          'name',               p.name,
          'address',            p.address,
          'city',               p.city,
          'suburb',             p.suburb,
          'cuisine_type',       p.cuisine_type,
          'google_place_id',    p.google_place_id,
          'latitude',           psi.lat,
          'longitude',          psi.lng,
          'google_rating',      p.google_rating,
          'google_review_count',p.google_review_count
        ) as display_data
      from public.place_search_index psi
      join public.places p on p.id = psi.place_id
      left join matched_places mp on mp.place_id = psi.place_id
      where
        psi.search_name  like '%' || lower(p_query) || '%'
        or psi.cuisine_slug ilike '%' || p_query || '%'
        or psi.suburb       ilike '%' || p_query || '%'
        or mp.place_id is not null
      order by score desc
      limit p_limit
    )
    union all
    (
      select
        'dish'::text as entity_type,
        d.id         as entity_id,
        case
          when lower(d.name) =    lower(p_query)               then 0.85
          when lower(d.name) like lower(p_query) || '%'        then 0.75
          when lower(d.name) like '%' || lower(p_query) || '%' then 0.65
          when lower(d.cuisine_type) ilike '%' || p_query || '%' then 0.55
          else 0.50
        end as score,
        jsonb_build_object(
          'name',        d.name,
          'cuisine_type',d.cuisine_type,
          'save_count',  (select count(*) from public.saved_dishes sd where sd.dish_id = d.id),
          'post_count',  (select count(*) from public.posts po where po.dish_id = d.id and po.deleted_at is null)
        ) as display_data
      from public.dishes d
      where
        d.name         ilike '%' || p_query || '%'
        or d.cuisine_type ilike '%' || p_query || '%'
      order by score desc
      limit greatest(p_limit / 2, 5)
    )
  ) r(entity_type, entity_id, score, display_data)
  order by score desc
  limit p_limit;
$$;

grant execute on function public.search_text_fallback(text, integer, double precision, double precision)
  to authenticated, anon;

grant execute on function public.search_text_fallback(text, integer)
  to authenticated, anon;

-- =============================================================
-- 7. Update expand_search_cuisines — add food_category expansion
--    When the query resolves as a food_category slug, add those slugs to the signals
--    at weight 3 (same as cuisine taxonomy_expansion). This lets "ramen" zero-result
--    recovery infer relevant cuisine/category intent from existing Rekkus evidence.
-- =============================================================

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
  LEFT JOIN public.places pl ON pl.id = p.place_id
  LEFT JOIN public.post_hashtags ph ON ph.post_id = p.id
  LEFT JOIN public.hashtags h ON h.id = ph.hashtag_id
  CROSS JOIN normalized n
  WHERE p.cuisine_type IS NOT NULL
    AND trim(p.cuisine_type) <> ''
    AND n.q <> ''
    AND (
      lower(coalesce(p.caption, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(p.must_order, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(p.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.name, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.city, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.address, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(h.name, '')) LIKE '%' || n.q || '%'
      OR EXISTS (
        SELECT 1
        FROM terms t
        WHERE lower(coalesce(p.caption, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(p.must_order, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.name, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.city, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.address, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(h.name, '')) LIKE '%' || t.term || '%'
      )
    )
),
place_matches AS (
  SELECT DISTINCT pl.id, lower(pl.cuisine_type) AS cuisine_type
  FROM public.places pl
  CROSS JOIN normalized n
  WHERE pl.cuisine_type IS NOT NULL
    AND trim(pl.cuisine_type) <> ''
    AND n.q <> ''
    AND (
      lower(coalesce(pl.name, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.city, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.address, '')) LIKE '%' || n.q || '%'
      OR EXISTS (
        SELECT 1
        FROM terms t
        WHERE lower(coalesce(pl.name, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.city, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.address, '')) LIKE '%' || t.term || '%'
      )
    )
),
taxonomy_expansion AS (
  -- Cuisine hierarchy expansion (weight 3)
  SELECT f.slug AS cuisine_type, 3 AS weight
  FROM (
    SELECT resolve_taxonomy_slug(lower(trim(coalesce(query_text, ''))), 'cuisine') AS resolved_slug
  ) rs
  CROSS JOIN LATERAL (
    SELECT * FROM get_taxonomy_family(coalesce(rs.resolved_slug, ''), 'cuisine')
  ) f(slug)
  WHERE rs.resolved_slug IS NOT NULL AND f.slug IS NOT NULL AND f.slug <> ''
),
food_category_expansion AS (
  -- food_category hierarchy expansion (weight 3)
  -- Enables "ramen" → {ramen, noodles, udon, soba, pho, laksa} in zero-result fallback
  SELECT f.slug AS cuisine_type, 3 AS weight
  FROM (
    SELECT resolve_taxonomy_slug(lower(trim(coalesce(query_text, ''))), 'food_category') AS resolved_slug
  ) rs
  CROSS JOIN LATERAL (
    SELECT * FROM get_taxonomy_family(coalesce(rs.resolved_slug, ''), 'food_category')
  ) f(slug)
  WHERE rs.resolved_slug IS NOT NULL AND f.slug IS NOT NULL AND f.slug <> ''
),
signals AS (
  SELECT cuisine_type, 2 AS weight FROM post_matches
  UNION ALL
  SELECT cuisine_type, 1 AS weight FROM place_matches
  UNION ALL
  SELECT cuisine_type, 3 AS weight FROM taxonomy_expansion
  UNION ALL
  SELECT cuisine_type, 3 AS weight FROM food_category_expansion
)
SELECT
  initcap(cuisine_type) AS cuisine_type,
  sum(weight)::integer AS match_count
FROM signals
GROUP BY cuisine_type
ORDER BY match_count DESC, cuisine_type ASC
LIMIT greatest(1, least(coalesce(max_cuisines, 3), 10));
$$;

grant execute on function public.expand_search_cuisines(text, integer) to authenticated, anon;
