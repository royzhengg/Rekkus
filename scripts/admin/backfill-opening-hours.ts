/**
 * Backfill place_opening_hours from raw_osm_tags stored in place_provider_metadata.
 *
 * Run after deploying 20260623000005_fix_opening_hours_constraint.sql.
 * Safe to re-run: upserts on (place_id, source) conflict target.
 *
 * Usage: npm run admin:backfill-hours
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const BATCH_SIZE = 500

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  console.log('\nBackfilling opening hours from raw_osm_tags…')

  let from = 0
  let totalInserted = 0
  let totalSkipped = 0

  while (true) {
    const { data, error } = await supabase
      .from('place_provider_metadata')
      .select('place_id, raw_osm_tags')
      .not('raw_osm_tags', 'is', null)
      .range(from, from + BATCH_SIZE - 1)
      .order('place_id')

    if (error) {
      console.error('  [backfill] fetch error:', error.message)
      break
    }
    if (!data || data.length === 0) break

    const hoursRows: { place_id: string; source: string; hours_text: string; is_current: boolean }[] = []
    for (const row of data) {
      const tags = row.raw_osm_tags as Record<string, string> | null
      const hoursText = tags?.['opening_hours']
      if (hoursText && hoursText.trim()) {
        hoursRows.push({
          place_id: row.place_id,
          source: 'osm',
          hours_text: hoursText.trim(),
          is_current: true,
        })
      } else {
        totalSkipped++
      }
    }

    if (hoursRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('place_opening_hours')
        .upsert(hoursRows, { onConflict: 'place_id,source' })

      if (upsertError) {
        console.error('  [backfill] upsert error:', upsertError.message)
      } else {
        totalInserted += hoursRows.length
      }
    }

    from += BATCH_SIZE
    process.stdout.write(`\r  Inserted: ${totalInserted} | Skipped (no hours): ${totalSkipped} | Page from: ${from}`)

    if (data.length < BATCH_SIZE) break
  }

  console.log(`\n\nDone. Inserted: ${totalInserted} | Skipped: ${totalSkipped}`)
}

void main()
