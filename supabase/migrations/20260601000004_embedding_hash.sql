-- Add embedding_hash to posts and restaurants so embed-content can skip
-- re-embedding when text hasn't changed (e.g. a photo-only update fires the
-- same webhook as a caption edit but shouldn't recompute the vector).
--
-- The hash is a hex-encoded SHA-256 of the concatenated text fields that
-- feed embedText() in supabase/functions/embed-content/index.ts.
-- It is written atomically alongside the embedding column.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS embedding_hash TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS embedding_hash TEXT;
