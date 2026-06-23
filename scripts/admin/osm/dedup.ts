import { SupabaseClient } from '@supabase/supabase-js'
import { TransformedRow } from './transform'

// Import-time dedup is intentionally a no-op:
//   • OSM upserts are keyed on osm_id — no OSM-vs-OSM duplicates possible.
//   • Cross-source dedup (OSM vs Google vs user-created) is handled post-import
//     by scripts/admin/osm/canonicalise.ts, which calls find_place_merge_candidates()
//     + merge_places() RPCs with configurable confidence thresholds.
// Per-row spatial dedup at import time would require a pg direct connection
// (Supabase REST client cannot issue parameterised ST_DWithin per-row) and adds
// complexity without benefit since canonicalise.ts covers the same ground safely.
export async function dedupBatch(
  _supabase: SupabaseClient,
  _rows: TransformedRow[],
): Promise<Set<string>> {
  return new Set()
}
