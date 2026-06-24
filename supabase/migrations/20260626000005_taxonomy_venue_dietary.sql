-- B-609: Taxonomy venue_type + dietary nodes
-- Seeds 23 venue_type nodes (flat) and 5 dietary nodes (vegetarian → vegan hierarchy).
-- No search_text_fallback changes needed: resolve_all_taxonomy_matches() + matched_places
-- LEFT JOIN from B-608 handles venue_type and dietary automatically.
-- Both types are searchable as soon as nodes exist.

-- =============================================================
-- 1. Seed venue_type nodes (23, all flat)
--    Flat for v1; hierarchy (bar → pub, wine-bar, cocktail-bar) deferred until
--    OSM/Google import data volume justifies it.
--    food-hall is semantically distinct from food-court (modern curated hall vs
--    traditional stall format) — seeded separately.
-- =============================================================

insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id) values
  ('cafe',             'Cafe',             'venue_type', null),
  ('bakery',           'Bakery',           'venue_type', null),
  ('restaurant',       'Restaurant',       'venue_type', null),
  ('bar',              'Bar',              'venue_type', null),
  ('pub',              'Pub',              'venue_type', null),
  ('brewery',          'Brewery',          'venue_type', null),
  ('wine-bar',         'Wine Bar',         'venue_type', null),
  ('cocktail-bar',     'Cocktail Bar',     'venue_type', null),
  ('fast-food',        'Fast Food',        'venue_type', null),
  ('food-truck',       'Food Truck',       'venue_type', null),
  ('takeaway',         'Takeaway',         'venue_type', null),
  ('buffet',           'Buffet',           'venue_type', null),
  ('food-court',       'Food Court',       'venue_type', null),
  ('food-hall',        'Food Hall',        'venue_type', null),
  ('market',           'Market',           'venue_type', null),
  ('deli',             'Deli',             'venue_type', null),
  ('dessert-shop',     'Dessert Shop',     'venue_type', null),
  ('ice-cream-shop',   'Ice Cream Shop',   'venue_type', null),
  ('bubble-tea-shop',  'Bubble Tea Shop',  'venue_type', null),
  ('roastery',         'Roastery',         'venue_type', null),
  ('izakaya',          'Izakaya',          'venue_type', null),
  ('steakhouse',       'Steakhouse',       'venue_type', null),
  ('brunch-spot',      'Brunch Spot',      'venue_type', null);

do $$ declare n int; begin
  select count(*) into n from public.taxonomy_nodes where taxonomy_type = 'venue_type';
  raise notice 'B-609: % venue_type nodes seeded (expect 23)', n;
  if n <> 23 then
    raise exception 'B-609: expected 23 venue_type nodes, got %', n;
  end if;
end $$;

-- =============================================================
-- 2. Seed dietary nodes (5 with hierarchy: vegetarian → vegan)
--    vegan is a strict subset of vegetarian; get_taxonomy_family('vegetarian')
--    returns {vegetarian, vegan} so searching "vegetarian" surfaces vegan places too.
-- =============================================================

-- Pass 1: roots
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id) values
  ('vegetarian', 'Vegetarian', 'dietary', null),
  ('gluten-free', 'Gluten-Free', 'dietary', null),
  ('halal',       'Halal',       'dietary', null),
  ('kosher',      'Kosher',      'dietary', null);

-- Pass 2: vegan under vegetarian
insert into public.taxonomy_nodes (slug, name, taxonomy_type, parent_id)
select 'vegan', 'Vegan', 'dietary',
  (select id from public.taxonomy_nodes where slug = 'vegetarian' and taxonomy_type = 'dietary');

do $$ declare n int; begin
  select count(*) into n from public.taxonomy_nodes where taxonomy_type = 'dietary';
  raise notice 'B-609: % dietary nodes seeded (expect 5)', n;
  if n <> 5 then
    raise exception 'B-609: expected 5 dietary nodes, got %', n;
  end if;
end $$;

-- Verify vegan is under vegetarian
do $$ begin
  if not exists (
    select 1 from public.get_taxonomy_family('vegetarian', 'dietary')
    where get_taxonomy_family = 'vegan'
  ) then
    raise exception 'B-609: vegan not in get_taxonomy_family(vegetarian, dietary)';
  end if;
  raise notice 'B-609: dietary hierarchy verified — vegan is child of vegetarian';
end $$;

-- =============================================================
-- 3. Seed venue_type aliases
-- =============================================================

insert into public.taxonomy_aliases (node_id, alias)
select n.id, a.alias
from (values
  ('pub',          'gastropub'),
  ('food-truck',   'food truck'),
  ('food-hall',    'food hall'),
  ('food-court',   'food court'),
  ('bubble-tea-shop', 'boba shop'),
  ('bubble-tea-shop', 'boba cafe'),
  ('brunch-spot',  'brunch restaurant'),
  ('fast-food',    'fast food'),
  ('ice-cream-shop', 'ice cream parlour'),
  ('ice-cream-shop', 'ice cream parlor')
) a(slug, alias)
join public.taxonomy_nodes n on n.slug = a.slug and n.taxonomy_type = 'venue_type'
on conflict (alias, taxonomy_type) do nothing;

-- =============================================================
-- 4. Seed dietary aliases
-- =============================================================

insert into public.taxonomy_aliases (node_id, alias)
select n.id, a.alias
from (values
  ('vegetarian', 'veggie'),
  ('gluten-free', 'gluten free'),
  ('gluten-free', 'gf'),
  ('halal',       'halal certified')
) a(slug, alias)
join public.taxonomy_nodes n on n.slug = a.slug and n.taxonomy_type = 'dietary'
on conflict (alias, taxonomy_type) do nothing;

-- =============================================================
-- 5. Final verification: search_text_fallback compiles with new types
-- =============================================================

do $$ begin
  perform * from public.search_text_fallback('vegan'::text,    5, null::double precision, null::double precision) limit 0;
  perform * from public.search_text_fallback('cafe'::text,     5, null::double precision, null::double precision) limit 0;
  perform * from public.search_text_fallback('izakaya'::text,  5, null::double precision, null::double precision) limit 0;
  perform * from public.search_text_fallback('halal'::text,    5, null::double precision, null::double precision) limit 0;
  raise notice 'B-609: search_text_fallback compiles and returns for all new taxonomy types';
end $$;
