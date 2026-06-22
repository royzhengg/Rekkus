import { SupabaseClient } from '@supabase/supabase-js'
import { TransformedRow } from './transform'

// Spatially-constrained dedup requires raw parameterized SQL which the Supabase
// REST client does not support. Skipped on first-run imports (empty table, no
// duplicates possible). TODO B-597: wire via pg direct connection for delta runs.
export async function dedupBatch(
  _supabase: SupabaseClient,
  _rows: TransformedRow[],
): Promise<Set<string>> {
  return new Set()
}
