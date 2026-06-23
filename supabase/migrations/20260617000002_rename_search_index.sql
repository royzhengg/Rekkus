-- Rename restaurants_search_tsv_idx → places_search_tsv_idx.
-- The table was already renamed restaurants → places in 20260614000001,
-- but PostgreSQL does not auto-rename indexes on table rename.
ALTER INDEX IF EXISTS public.restaurants_search_tsv_idx RENAME TO places_search_tsv_idx;
