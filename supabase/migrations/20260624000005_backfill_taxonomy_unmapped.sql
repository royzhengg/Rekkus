-- Migration: 20260624000005_backfill_taxonomy_unmapped
-- Backfill taxonomy_unmapped from historical places data.
-- The original cuisine_taxonomy migration (20260624000004) only backfilled
-- place_taxonomies; taxonomy_unmapped is populated by the trigger going
-- forward but was empty for pre-existing places.

insert into public.taxonomy_unmapped (raw_value, occurrences, first_seen_at, last_seen_at)
select
  trim(lower(s.raw_slug))                      as raw_value,
  count(*)                                      as occurrences,
  min(p.created_at)                             as first_seen_at,
  max(coalesce(p.updated_at, p.created_at))     as last_seen_at
from public.places p
cross join lateral (
  select trim(lower(raw)) as raw_slug
  from regexp_split_to_table(coalesce(p.cuisine_slug, ''), '\s*;\s*') as raw
) s
where trim(s.raw_slug) <> ''
  and resolve_taxonomy_slug(s.raw_slug, 'cuisine') is null
group by trim(lower(s.raw_slug))
on conflict (raw_value) do update
  set occurrences   = excluded.occurrences,
      last_seen_at  = excluded.last_seen_at;

do $$ declare unmapped_count int; begin
  select count(*) into unmapped_count from public.taxonomy_unmapped;
  raise notice 'B-600: taxonomy_unmapped backfill complete — % distinct raw values', unmapped_count;
end $$;
