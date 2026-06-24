-- B-600: Cuisine Normalisation Engine — Generic Taxonomy Foundation
-- Replaces flat cuisine_aliases with a typed, hierarchical taxonomy engine.
-- Tables: taxonomy_nodes, taxonomy_aliases, place_taxonomies, taxonomy_unmapped
-- Helpers: resolve_taxonomy_slug, get_taxonomy_family, get_taxonomy_ancestors
-- Updates: expand_search_cuisines, search_text_fallback

-- =============================================================
-- 1. taxonomy_nodes — canonical hierarchy (immutable after insert)
-- =============================================================

create table public.taxonomy_nodes (
  id            uuid        primary key default gen_random_uuid(),
  slug          text        not null,
  name          text        not null,
  taxonomy_type text        not null
    check (taxonomy_type in ('cuisine','food_category','venue_type','dietary','style')),
  parent_id     uuid        references public.taxonomy_nodes(id),
  path          text        not null,
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now(),
  constraint no_self_ref     check (parent_id != id),
  constraint slug_normalised check (slug = lower(trim(slug))),
  unique (slug, taxonomy_type)
);

create index taxonomy_nodes_parent_idx on public.taxonomy_nodes(parent_id)
  where parent_id is not null;
create index taxonomy_nodes_type_idx   on public.taxonomy_nodes(taxonomy_type);
create index taxonomy_nodes_path_idx   on public.taxonomy_nodes(path text_pattern_ops);

alter table public.taxonomy_nodes enable row level security;
create policy "taxonomy_nodes_read" on public.taxonomy_nodes for select using (true);

-- Path trigger: sets materialised path on INSERT only
create or replace function public.set_taxonomy_path() returns trigger
language plpgsql as $$
declare v_parent_path text;
begin
  if new.parent_id is null then
    new.path := new.slug;
  else
    select path into v_parent_path from public.taxonomy_nodes where id = new.parent_id;
    if v_parent_path is null then
      raise exception 'taxonomy parent % not found', new.parent_id;
    end if;
    new.path := v_parent_path || '/' || new.slug;
  end if;
  return new;
end;
$$;

-- Immutability trigger: taxonomy nodes are append-only
create or replace function public.block_taxonomy_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'taxonomy_nodes is append-only; changes require a migration (B-600)';
end;
$$;

create trigger taxonomy_nodes_set_path
  before insert on public.taxonomy_nodes
  for each row execute function public.set_taxonomy_path();

create trigger taxonomy_nodes_immutable
  before update or delete on public.taxonomy_nodes
  for each row execute function public.block_taxonomy_mutation();

-- =============================================================
-- 2. Seed: cuisine nodes — two passes (roots first, children second)
-- Target: 57 rows (10 roots + 47 children)
-- =============================================================

-- Pass 1: root nodes (parent_id = null, path = slug)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id) values
  -- Parent groups
  ('asian',          'Asian',          'cuisine', null),
  ('european',       'European',       'cuisine', null),
  ('south-asian',    'South Asian',    'cuisine', null),
  ('middle-eastern', 'Middle Eastern', 'cuisine', null),
  ('latin-american', 'Latin American', 'cuisine', null),
  ('african',        'African',        'cuisine', null),
  -- Standalone cuisines (no meaningful parent in v1)
  ('american',          'American',          'cuisine', null),
  ('mediterranean',     'Mediterranean',     'cuisine', null),
  ('modern-australian', 'Modern Australian', 'cuisine', null),
  ('fusion',            'Fusion',            'cuisine', null);

-- Pass 2: children (require parent to exist for path trigger)
-- Children of asian (14)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'cuisine', (select id from public.taxonomy_nodes where slug = 'asian' and taxonomy_type = 'cuisine')
from (values
  ('chinese',     'Chinese'),
  ('japanese',    'Japanese'),
  ('korean',      'Korean'),
  ('thai',        'Thai'),
  ('vietnamese',  'Vietnamese'),
  ('malaysian',   'Malaysian'),
  ('indonesian',  'Indonesian'),
  ('filipino',    'Filipino'),
  ('taiwanese',   'Taiwanese'),
  ('cambodian',   'Cambodian'),
  ('laotian',     'Laotian'),
  ('singaporean', 'Singaporean'),
  ('burmese',     'Burmese'),
  ('hong-kong',   'Hong Kong')
) v(slug, name);

-- Children of european (11)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'cuisine', (select id from public.taxonomy_nodes where slug = 'european' and taxonomy_type = 'cuisine')
from (values
  ('italian',      'Italian'),
  ('french',       'French'),
  ('spanish',      'Spanish'),
  ('greek',        'Greek'),
  ('german',       'German'),
  ('british',      'British'),
  ('portuguese',   'Portuguese'),
  ('polish',       'Polish'),
  ('russian',      'Russian'),
  ('ukrainian',    'Ukrainian'),
  ('scandinavian', 'Scandinavian')
) v(slug, name);

-- Children of south-asian (5)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'cuisine', (select id from public.taxonomy_nodes where slug = 'south-asian' and taxonomy_type = 'cuisine')
from (values
  ('indian',       'Indian'),
  ('sri-lankan',   'Sri Lankan'),
  ('nepalese',     'Nepalese'),
  ('pakistani',    'Pakistani'),
  ('bangladeshi',  'Bangladeshi')
) v(slug, name);

-- Children of middle-eastern (8)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'cuisine', (select id from public.taxonomy_nodes where slug = 'middle-eastern' and taxonomy_type = 'cuisine')
from (values
  ('lebanese', 'Lebanese'),
  ('turkish',  'Turkish'),
  ('persian',  'Persian'),
  ('moroccan', 'Moroccan'),
  ('israeli',  'Israeli'),
  ('egyptian', 'Egyptian'),
  ('syrian',   'Syrian'),
  ('afghan',   'Afghan')
) v(slug, name);

-- Children of latin-american (6)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'cuisine', (select id from public.taxonomy_nodes where slug = 'latin-american' and taxonomy_type = 'cuisine')
from (values
  ('mexican',     'Mexican'),
  ('brazilian',   'Brazilian'),
  ('peruvian',    'Peruvian'),
  ('argentinian', 'Argentinian'),
  ('colombian',   'Colombian'),
  ('caribbean',   'Caribbean')
) v(slug, name);

-- Children of african (3)
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select slug, name, 'cuisine', (select id from public.taxonomy_nodes where slug = 'african' and taxonomy_type = 'cuisine')
from (values
  ('ethiopian',   'Ethiopian'),
  ('west-african', 'West African'),
  ('north-african', 'North African')
) v(slug, name);

-- =============================================================
-- 3. Migrate cuisine_aliases → taxonomy_aliases
-- =============================================================

-- Rename old table
alter table public.cuisine_aliases rename to cuisine_aliases_v1;

-- Report aliases that cannot migrate (cuisine not in new taxonomy)
do $$ declare unmapped_count int; unmapped_sample text; begin
  select count(*), string_agg(alias || ' -> ' || cuisine_type, ', ' order by alias)
  into unmapped_count, unmapped_sample
  from public.cuisine_aliases_v1
  where lower(trim(cuisine_type)) not in (
    select slug from public.taxonomy_nodes where taxonomy_type = 'cuisine'
  );
  raise notice 'B-600: % cuisine_aliases_v1 rows cannot migrate (cuisine not in taxonomy): %',
    unmapped_count, left(coalesce(unmapped_sample, 'none'), 400);
end $$;

-- New taxonomy_aliases table
create table public.taxonomy_aliases (
  id            uuid primary key default gen_random_uuid(),
  node_id       uuid not null references public.taxonomy_nodes(id) on delete cascade,
  taxonomy_type text not null,
  alias         text not null check (alias = lower(trim(alias))),
  unique (alias, taxonomy_type)
);

create index taxonomy_aliases_node_idx on public.taxonomy_aliases(node_id);

alter table public.taxonomy_aliases enable row level security;
create policy "taxonomy_aliases_read" on public.taxonomy_aliases for select using (true);

-- Trigger: denormalise taxonomy_type from node on insert
create or replace function public.set_taxonomy_alias_type() returns trigger
language plpgsql as $$
begin
  select taxonomy_type into new.taxonomy_type
  from public.taxonomy_nodes where id = new.node_id;
  if new.taxonomy_type is null then
    raise exception 'taxonomy node % not found', new.node_id;
  end if;
  return new;
end;
$$;

create trigger taxonomy_aliases_set_type
  before insert on public.taxonomy_aliases
  for each row execute function public.set_taxonomy_alias_type();

-- Migrate old rows (only those whose cuisine_type maps to a seeded slug)
insert into public.taxonomy_aliases (node_id, alias)
select n.id, lower(trim(ca.alias))
from public.cuisine_aliases_v1 ca
join public.taxonomy_nodes n
  on n.slug = lower(trim(ca.cuisine_type)) and n.taxonomy_type = 'cuisine'
on conflict (alias, taxonomy_type) do nothing;

-- Drop old table
drop table public.cuisine_aliases_v1;

-- Seed additional aliases
insert into public.taxonomy_aliases (node_id, alias)
select n.id, a.alias
from (values
  ('vietnamese',    'viet'),
  ('vietnamese',    'viet food'),
  ('vietnamese',    'vietnamese food'),
  ('indonesian',    'indo'),
  ('indonesian',    'indonesian food'),
  ('american',      'bbq'),
  ('american',      'barbeque'),
  ('american',      'barbecue'),
  ('asian',         'east asian'),
  ('asian',         'eastern asian'),
  ('middle-eastern','middle east'),
  ('asian',         'south east asian'),
  ('asian',         'southeast asian'),
  ('modern-australian', 'modern australian'),
  ('modern-australian', 'mod oz')
) a(slug, alias)
join public.taxonomy_nodes n on n.slug = a.slug and n.taxonomy_type = 'cuisine'
on conflict (alias, taxonomy_type) do nothing;

-- =============================================================
-- 4. place_taxonomies — place → taxonomy node junction
-- =============================================================

create table public.place_taxonomies (
  place_id  uuid not null references public.places(id) on delete cascade,
  node_id   uuid not null references public.taxonomy_nodes(id) on delete cascade,
  source    text not null default 'osm'
    check (source in ('osm','manual','ai','user')),
  primary key (place_id, node_id)
);

create index place_taxonomies_node_idx on public.place_taxonomies(node_id);

alter table public.place_taxonomies enable row level security;
create policy "place_taxonomies_read" on public.place_taxonomies for select using (true);

-- =============================================================
-- 5. taxonomy_unmapped — tracks unresolved place cuisine values
-- =============================================================

create table public.taxonomy_unmapped (
  raw_value            text        primary key,
  occurrences          int         not null default 1,
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz not null default now(),
  resolved_to_node_id  uuid        references public.taxonomy_nodes(id) on delete set null
);

create index taxonomy_unmapped_occurrences_idx on public.taxonomy_unmapped(occurrences desc);

alter table public.taxonomy_unmapped enable row level security;
create policy "taxonomy_unmapped_read" on public.taxonomy_unmapped for select using (true);

-- =============================================================
-- 6. Helper functions
-- =============================================================

-- resolve_taxonomy_slug: canonical slug lookup + alias fallback; returns NULL when unmapped
create or replace function public.resolve_taxonomy_slug(
  p_input text,
  p_type  text default 'cuisine'
) returns text language sql stable security definer as $$
  select coalesce(
    (select slug from public.taxonomy_nodes
     where slug = lower(trim(p_input)) and taxonomy_type = p_type),
    (select n.slug from public.taxonomy_aliases a
     join public.taxonomy_nodes n on n.id = a.node_id
     where a.alias = lower(trim(p_input)) and n.taxonomy_type = p_type
     limit 1)
  );
$$;

grant execute on function public.resolve_taxonomy_slug(text, text) to authenticated, anon;

-- get_taxonomy_family: slug + all descendants via materialised path (no recursive CTE needed)
create or replace function public.get_taxonomy_family(
  p_slug text,
  p_type text default 'cuisine'
) returns setof text language sql stable security definer as $$
  select n2.slug
  from public.taxonomy_nodes n1
  join public.taxonomy_nodes n2
    on (n2.path = n1.path or n2.path like n1.path || '/%')
    and n2.taxonomy_type = n1.taxonomy_type
  where n1.slug = lower(trim(p_slug)) and n1.taxonomy_type = p_type;
$$;

grant execute on function public.get_taxonomy_family(text, text) to authenticated, anon;

-- get_taxonomy_ancestors: slug + all ancestors via path decomposition
create or replace function public.get_taxonomy_ancestors(
  p_slug text,
  p_type text default 'cuisine'
) returns setof text language sql stable security definer as $$
  select n2.slug
  from public.taxonomy_nodes n1
  join public.taxonomy_nodes n2
    on n1.path like n2.path || '%'
    and n2.taxonomy_type = n1.taxonomy_type
  where n1.slug = lower(trim(p_slug)) and n1.taxonomy_type = p_type;
$$;

grant execute on function public.get_taxonomy_ancestors(text, text) to authenticated, anon;

-- =============================================================
-- 7. Diagnostic: unmapped place cuisine_slug values
-- =============================================================

do $$ declare unmapped_count int; unmapped_sample text; begin
  select count(distinct cuisine_slug),
         string_agg(distinct cuisine_slug, ', ' order by cuisine_slug)
  into unmapped_count, unmapped_sample
  from public.places
  where cuisine_slug is not null and trim(cuisine_slug) <> ''
    and resolve_taxonomy_slug(lower(trim(cuisine_slug)), 'cuisine') is null;
  raise notice 'B-600: % distinct place cuisine_slug values unmapped (drives future taxonomy scope): %',
    unmapped_count, left(coalesce(unmapped_sample, 'none'), 400);
end $$;

-- =============================================================
-- 8. Trigger: sync_place_taxonomies on places.cuisine_slug
--    Bulk import note: disable trigger for batches > 1k places;
--    run backfill directly, then re-enable.
-- =============================================================

create or replace function public.sync_place_taxonomies_fn() returns trigger
language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT' or old.cuisine_slug is distinct from new.cuisine_slug) then
    delete from public.place_taxonomies where place_id = new.id;

    -- Insert resolved taxonomy rows (resolves each semicolon-split slug once via LATERAL)
    insert into public.place_taxonomies (place_id, node_id, source)
    select new.id, n.id, 'osm'
    from   regexp_split_to_table(coalesce(new.cuisine_slug, ''), '\s*;\s*') as s(raw_slug)
    cross  join lateral (select resolve_taxonomy_slug(trim(lower(s.raw_slug)), 'cuisine') as resolved) r
    join   public.taxonomy_nodes n on n.slug = r.resolved and n.taxonomy_type = 'cuisine'
    where  trim(s.raw_slug) <> ''
    on conflict do nothing;

    -- Track unresolved values for future taxonomy scoping
    insert into public.taxonomy_unmapped (raw_value, occurrences, last_seen_at)
    select trim(lower(s.raw_slug)), 1, now()
    from   regexp_split_to_table(coalesce(new.cuisine_slug, ''), '\s*;\s*') as s(raw_slug)
    where  trim(s.raw_slug) <> ''
      and  resolve_taxonomy_slug(trim(lower(s.raw_slug)), 'cuisine') is null
    on conflict (raw_value) do update
      set occurrences = taxonomy_unmapped.occurrences + 1,
          last_seen_at = now();
  end if;
  return new;
end;
$$;

create trigger sync_place_taxonomies
after insert or update of cuisine_slug on public.places
for each row execute function public.sync_place_taxonomies_fn();

-- =============================================================
-- 9. Backfill: populate place_taxonomies from existing places
--    Uses same split logic as trigger (critical for compound slugs like japanese;asian)
-- =============================================================

do $$ declare pre_count int; begin
  select count(*) into pre_count from public.place_taxonomies;
  raise notice 'B-600: pre-backfill place_taxonomies rows: %', pre_count;
end $$;

-- EXPLAIN ANALYZE: places > 10k rows; idx_places_cuisine_slug index used
insert into public.place_taxonomies (place_id, node_id, source)
select p.id, n.id, 'osm'
from   public.places p
cross  join lateral (
  select trim(lower(s.raw_slug)) as raw_slug
  from   regexp_split_to_table(coalesce(p.cuisine_slug, ''), '\s*;\s*') as s(raw_slug)
  where  trim(s.raw_slug) <> ''
) split
cross  join lateral (select resolve_taxonomy_slug(split.raw_slug, 'cuisine') as resolved) r
join   public.taxonomy_nodes n on n.slug = r.resolved and n.taxonomy_type = 'cuisine'
where  p.cuisine_slug is not null and trim(p.cuisine_slug) <> ''
on conflict do nothing;

do $$ declare
  total_mappings int;
  mapped_places  int;
  total_places   int;
begin
  select count(*)              into total_mappings from public.place_taxonomies;
  select count(distinct place_id) into mapped_places  from public.place_taxonomies;
  select count(*)              into total_places   from public.places
    where cuisine_slug is not null and trim(cuisine_slug) <> '';
  -- Note: total_mappings > mapped_places is expected (e.g. japanese;asian → 2 rows per place)
  raise notice 'B-600: % taxonomy mappings across % distinct places (% places had cuisine data)',
    total_mappings, mapped_places, total_places;
end $$;

-- =============================================================
-- 10. Update expand_search_cuisines() — add taxonomy hierarchy expansion
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
  -- Expand query via taxonomy alias resolution + hierarchy (weight 3 = higher than post/place evidence)
  SELECT f.slug AS cuisine_type, 3 AS weight
  FROM (
    SELECT resolve_taxonomy_slug(lower(trim(coalesce(query_text, ''))), 'cuisine') AS resolved_slug
  ) rs
  CROSS JOIN LATERAL (
    SELECT * FROM get_taxonomy_family(coalesce(rs.resolved_slug, ''), 'cuisine')
  ) f(slug)
  WHERE rs.resolved_slug IS NOT NULL AND f.slug IS NOT NULL AND f.slug <> ''
),
signals AS (
  SELECT cuisine_type, 2 AS weight FROM post_matches
  UNION ALL
  SELECT cuisine_type, 1 AS weight FROM place_matches
  UNION ALL
  SELECT cuisine_type, 3 AS weight FROM taxonomy_expansion
)
SELECT
  initcap(cuisine_type) AS cuisine_type,
  sum(weight)::integer AS match_count
FROM signals
GROUP BY cuisine_type
ORDER BY match_count DESC, cuisine_type ASC
LIMIT greatest(1, least(coalesce(max_cuisines, 3), 10));
$$;

-- =============================================================
-- 11. Update search_text_fallback() — taxonomy-aware scoring tiers
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
  -- Resolve query to canonical cuisine slug once (alias-aware); NULL when unmapped
  resolved_cuisine as (
    select resolve_taxonomy_slug(lower(trim(p_query)), 'cuisine') as slug
  ),
  -- All descendants + slug itself aggregated into text[]; NULL when query unmapped
  cuisine_family as (
    select array_agg(t) as slugs
    from resolved_cuisine rc
    cross join lateral get_taxonomy_family(rc.slug, 'cuisine') t
    where rc.slug is not null
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
            -- Tier 1: direct taxonomy match (place tagged exactly with this cuisine slug)
            when exists (
              select 1 from public.place_taxonomies pt
              join public.taxonomy_nodes n on n.id = pt.node_id
              where pt.place_id = psi.place_id
                and n.slug = lower(trim(p_query))
                and n.taxonomy_type = 'cuisine'
            ) then 0.70
            -- Tier 2: hierarchy / alias expansion (place is a descendant of the queried group)
            when exists (
              select 1 from public.place_taxonomies pt
              join public.taxonomy_nodes n on n.id = pt.node_id
              where pt.place_id = psi.place_id
                and n.slug = any(coalesce((select slugs from cuisine_family), '{}'))
                and n.taxonomy_type = 'cuisine'
            ) then 0.60
            when psi.suburb ilike '%' || p_query || '%' then 0.55
            -- Tier 3: ilike fallback for unmapped OSM cuisine_slug values
            when psi.cuisine_slug ilike '%' || p_query || '%' then 0.50
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
      where
        psi.search_name  like '%' || lower(p_query) || '%'
        or psi.cuisine_slug ilike '%' || p_query || '%'
        or psi.suburb       ilike '%' || p_query || '%'
        or exists (
          select 1 from public.place_taxonomies pt
          join public.taxonomy_nodes n on n.id = pt.node_id
          where pt.place_id = psi.place_id
            and n.slug = any(coalesce((select slugs from cuisine_family), '{}'))
        )
      order by score desc
      limit p_limit
    )
    union all
    (
      select
        'dish'::text as entity_type,
        d.id         as entity_id,
        case
          when lower(d.name)         =    lower(p_query)               then 0.85
          when lower(d.name)         like lower(p_query) || '%'        then 0.75
          when lower(d.name)         like '%' || lower(p_query) || '%' then 0.65
          when lower(d.cuisine_type) ilike '%' || p_query || '%'       then 0.55
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
