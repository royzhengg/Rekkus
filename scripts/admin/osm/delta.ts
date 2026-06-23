import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { AU_STATES, StateBbox } from './states'
import { fetchState } from './fetch'
import { transform } from './transform'
import { ingestDelta, DeltaStats } from './ingest-delta'

function parseArgs() {
  const args = process.argv.slice(2)
  const state = args.find((_, i) => args[i - 1] === '--state')
  const dryRun = args.includes('--dry-run')
  return { state, dryRun }
}

async function run() {
  const { state: stateFilter, dryRun } = parseArgs()

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // ws constructor signature differs from Supabase's WebSocketLikeConstructor — cast required
    { realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket } },
  )

  let states: StateBbox[]
  if (stateFilter) {
    const found = AU_STATES.find(s => s.code === stateFilter.toUpperCase())
    if (!found) { console.error(`Unknown state: ${stateFilter}`); process.exit(1) }
    states = [found]
  } else {
    states = AU_STATES
  }

  if (dryRun) console.log('DRY RUN — no database writes')

  const report: Record<string, DeltaStats & { state: string }> = {}

  for (const st of states) {
    console.log(`\n▶ ${st.name} (${st.code})`)

    let importRunId = ''
    if (!dryRun) {
      const { data } = await supabase
        .from('osm_import_runs')
        .insert({ state: st.code, report: { run_type: 'delta' } })
        .select('id')
        .single()
      importRunId = data?.id ?? ''
    }

    // Delta always fetches fresh data — forceRefresh=true bypasses the 7-day cache
    const elements = await fetchState(st, dryRun, true)
    const rows = elements.flatMap(el => {
      const r = transform(el, st.capital)
      return r ? [r] : []
    })

    console.log(`  ${elements.length} elements → ${rows.length} valid rows`)

    const stats = await ingestDelta(supabase, rows, importRunId, dryRun)

    if (!dryRun && importRunId) {
      await supabase
        .from('osm_import_runs')
        .update({
          completed_at: new Date().toISOString(),
          updated: stats.updated,
          skipped: stats.skipped + stats.logged,
          report: { run_type: 'delta', logged_protected: stats.logged },
        })
        .eq('id', importRunId)
    }

    report[st.code] = { state: st.code, ...stats }
    console.log(`  ✓ updated=${stats.updated} logged=${stats.logged} skipped=${stats.skipped}`)
  }

  console.log('\n── Delta summary ───────────────────────────────')
  console.log('State  Updated  Logged   Skipped')
  for (const r of Object.values(report)) {
    console.log(`${r.state.padEnd(6)} ${String(r.updated).padEnd(8)} ${String(r.logged).padEnd(8)} ${r.skipped}`)
  }
}

run().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
