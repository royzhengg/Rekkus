-- B-631: FK columns missing a valid leading-column index in the public schema.
--
-- PostgreSQL int2vector notes:
--   ix.indkey is int2vector (0-based subscripts). ix.indkey[0] is the first key column.
--   ix.indnkeyatts counts key columns only (excludes INCLUDE columns).
--   We check ix.indkey[0:ix.indnkeyatts-1] to get only key columns, avoiding false
--   coverage from INCLUDE-column-only indexes.
--
-- Excluded index types:
--   partial    (indpred IS NOT NULL)  — not guaranteed to cover all FK values
--   invalid    (NOT indisvalid)       — not yet committed / failed build
--   building   (NOT indisready)       — CREATE INDEX CONCURRENTLY in progress
--   expression (indexprs IS NOT NULL) — functional index; column number in indkey is 0

-- ─── Query 1: FK columns without a covering leading-column index ───────────────

SELECT
  rel.relname                                                           AS table_name,
  string_agg(att.attname, ', ' ORDER BY ord.pos)                       AS fk_columns,
  c.conname                                                             AS fk_name,
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS '
    || rel.relname || '_'
    || string_agg(att.attname, '_' ORDER BY ord.pos)
    || '_idx ON public.' || rel.relname
    || ' (' || string_agg(att.attname, ', ' ORDER BY ord.pos) || ');'  AS suggested_fix
FROM pg_constraint c
JOIN pg_class     rel ON rel.oid  = c.conrelid
JOIN pg_namespace ns  ON ns.oid   = rel.relnamespace
JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS ord(attnum, pos) ON true
JOIN pg_attribute att
  ON att.attrelid = c.conrelid
 AND att.attnum   = ord.attnum
LEFT JOIN pg_index ix
  ON  ix.indrelid  = c.conrelid
  -- leading column of index must be first column of FK
  AND ix.indkey[0] = c.conkey[0]
  -- all FK key columns must be covered by index key columns (not INCLUDE columns)
  AND c.conkey <@ (
        SELECT array_agg(k)::smallint[]
        FROM   unnest(ix.indkey[0:ix.indnkeyatts - 1]) AS k
      )
  AND ix.indisvalid
  AND ix.indisready
  AND ix.indpred   IS NULL   -- exclude partial indexes
  AND ix.indexprs  IS NULL   -- exclude expression indexes
WHERE c.contype  = 'f'
  AND ns.nspname = 'public'
  AND ix.indrelid IS NULL    -- no matching index found
GROUP BY rel.relname, c.conname
ORDER BY rel.relname, c.conname;

-- ─── Query 2: Duplicate indexes (same table + same leading-column set) ─────────
-- These are hard failures: two indexes doing the same job wastes write overhead.

SELECT
  rel.relname                                                         AS table_name,
  string_agg(ix.indexrelid::regclass::text, ', ' ORDER BY ix.indexrelid) AS duplicate_indexes,
  array_to_string(
    ARRAY(
      SELECT a.attname
      FROM   unnest(ix.indkey[0:ix.indnkeyatts - 1]) AS k
      JOIN   pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k
      ORDER BY ordinality
    ), ', '
  )                                                                   AS key_columns,
  'DROP INDEX CONCURRENTLY IF EXISTS '
    || min(ix.indexrelid::regclass::text) || ';'                      AS suggested_fix
FROM pg_index ix
JOIN pg_class rel ON rel.oid  = ix.indrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'public'
  AND ix.indisvalid
  AND ix.indisready
  AND ix.indpred  IS NULL
  AND ix.indexprs IS NULL
  AND NOT ix.indisprimary
  AND NOT ix.indisunique
GROUP BY rel.relname, ix.indrelid, ix.indkey, ix.indnkeyatts
HAVING count(*) OVER (
  PARTITION BY rel.relname,
               ix.indkey[0:ix.indnkeyatts - 1]
) > 1
ORDER BY rel.relname;

-- ─── Query 3: Redundant indexes (subset subsumed by a wider index) ────────────
-- Warnings only: a single-column index (a) is redundant when (a, b) exists.

SELECT
  rel.relname  AS table_name,
  narrow.indexrelid::regclass::text  AS narrow_index,
  wide.indexrelid::regclass::text    AS subsuming_index,
  'DROP INDEX CONCURRENTLY IF EXISTS '
    || narrow.indexrelid::regclass::text || '; -- subsumed by '
    || wide.indexrelid::regclass::text   AS suggested_fix
FROM pg_index narrow
JOIN pg_class     rel ON rel.oid  = narrow.indrelid
JOIN pg_namespace ns  ON ns.oid   = rel.relnamespace
JOIN pg_index wide
  ON  wide.indrelid  = narrow.indrelid
  AND wide.indexrelid <> narrow.indexrelid
  -- narrow key columns are a leading prefix of wide key columns
  AND narrow.indkey[0:narrow.indnkeyatts - 1] <@
        (SELECT array_agg(k)::int2[]
         FROM   unnest(wide.indkey[0:wide.indnkeyatts - 1]) AS k)
  AND narrow.indnkeyatts < wide.indnkeyatts
  AND wide.indisvalid  AND wide.indisready
  AND wide.indpred  IS NULL
  AND wide.indexprs IS NULL
WHERE ns.nspname = 'public'
  AND narrow.indisvalid  AND narrow.indisready
  AND narrow.indpred  IS NULL
  AND narrow.indexprs IS NULL
  AND NOT narrow.indisprimary
  AND NOT narrow.indisunique
  AND NOT wide.indisprimary
  AND NOT wide.indisunique
ORDER BY rel.relname, narrow.indexrelid::regclass::text;
