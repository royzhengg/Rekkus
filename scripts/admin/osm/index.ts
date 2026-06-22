import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { AU_STATES, StateBbox } from './states'
import { fetchState } from './fetch'
import { transform } from './transform'
import { dedupBatch } from './dedup'
import { ingestBatch, IngestStats } from './ingest'

function parseArgs() {
  const args = process.argv.slice(2)
  const state = args.find((_, i) => args[i - 1] === '--state')
  const resumeFrom = args.find((_, i) => args[i - 1] === '--resume-from')
  const dryRun = args.includes('--dry-run')
  return { state, resumeFrom, dryRun }
}

async function run() {
  const { state: stateFilter, resumeFrom, dryRun } = parseArgs()

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let states: StateBbox[]
  if (stateFilter) {
    const found = AU_STATES.find(s => s.code === stateFilter.toUpperCase())
    if (!found) { console.error(`Unknown state: ${stateFilter}`); process.exit(1) }
    states = [found]
  } else if (resumeFrom) {
    const idx = AU_STATES.findIndex(s => s.code === resumeFrom.toUpperCase())
    if (idx === -1) { console.error(`Unknown state: ${resumeFrom}`); process.exit(1) }
    states = AU_STATES.slice(idx)
  } else {
    states = AU_STATES
  }

  if (dryRun) console.log('DRY RUN — no database writes')

  const report: Record<string, IngestStats & { state: string }> = {}

  for (const st of states) {
    console.log(`\n▶ ${st.name} (${st.code})`)

    // Create import run record
    let importRunId = ''
    if (!dryRun) {
      const { data } = await supabase
        .from('osm_import_runs')
        .insert({ state: st.code })
        .select('id')
        .single()
      importRunId = data?.id ?? ''
    }

    const elements = await fetchState(st, dryRun)
    const rows = elements.flatMap(el => {
      const r = transform(el, st.capital)
      return r ? [r] : []
    })

    console.log(`  ${elements.length} elements → ${rows.length} valid rows`)

    const skipIds = await dedupBatch(supabase, rows)
    const stats = await ingestBatch(supabase, rows, importRunId, skipIds, dryRun)

    if (!dryRun && importRunId) {
      await supabase
        .from('osm_import_runs')
        .update({
          completed_at: new Date().toISOString(),
          imported: stats.imported,
          updated: stats.updated,
          skipped: stats.skipped,
        })
        .eq('id', importRunId)
    }

    report[st.code] = { state: st.code, ...stats }
    console.log(`  ✓ imported=${stats.imported} updated=${stats.updated} skipped=${stats.skipped}`)
  }

  console.log('\n── Import summary ──────────────────────────────')
  console.log('State  Imported  Updated  Skipped')
  for (const r of Object.values(report)) {
    console.log(`${r.state.padEnd(6)} ${String(r.imported).padEnd(9)} ${String(r.updated).padEnd(8)} ${r.skipped}`)
  }
}

run().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
