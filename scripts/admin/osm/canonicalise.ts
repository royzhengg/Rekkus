/**
 * B-598 Place canonicalisation — batch dedup/merge pipeline
 *
 * Finds duplicate place pairs via find_place_merge_candidates() (distance +
 * name/phone/website/google_place_id fuzzy matching) and either:
 *   --dry-run   Print candidates without writing anything (default)
 *   --seed      Seed restaurant_audit_events review queue only (no merges)
 *   --execute   Execute merges for candidates above --min-confidence threshold
 *
 * Usage:
 *   npx ts-node scripts/admin/osm/canonicalise.ts [--dry-run] [--seed] [--execute]
 *     [--distance <metres>] [--name-sim <0-1>] [--min-confidence <0-1>] [--limit <n>]
 *
 * Environment: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (loaded from .env)
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2)
  const flag = (name: string) => args.includes(name)
  const opt = (name: string, fallback: string) =>
    args[args.findIndex((_, i) => args[i - 1] === name)] ?? fallback

  return {
    dryRun:        !flag('--seed') && !flag('--execute'),
    seed:          flag('--seed'),
    execute:       flag('--execute'),
    distanceM:     parseFloat(opt('--distance', '100')),
    nameSimThresh: parseFloat(opt('--name-sim', '0.80')),
    minConfidence: parseFloat(opt('--min-confidence', '0.85')),
    limit:         parseInt(opt('--limit', '500'), 10),
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MergeCandidate {
  candidate_old_id: string
  candidate_new_id: string
  old_name:         string
  new_name:         string
  distance_m:       number
  name_similarity:  number
  match_reasons:    string[]
  confidence:       number
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const cfg = parseArgs()

  if (cfg.execute && cfg.seed) {
    console.error('Use either --seed or --execute, not both.')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log('── B-598 Place canonicalisation ─────────────────────────────')
  console.log(`Mode:          ${cfg.execute ? 'EXECUTE' : cfg.seed ? 'SEED queue' : 'DRY RUN'}`)
  console.log(`Distance:      ≤ ${cfg.distanceM}m`)
  console.log(`Name sim:      ≥ ${cfg.nameSimThresh}`)
  console.log(`Min confidence:${cfg.minConfidence} (for --execute)`)
  console.log(`Limit:         ${cfg.limit} candidates`)
  console.log()

  // -------------------------------------------------------------------------
  // 1. Find candidates
  // -------------------------------------------------------------------------
  const { data: candidates, error: findErr } = await supabase.rpc(
    'find_place_merge_candidates',
    {
      p_distance_metres: cfg.distanceM,
      p_name_sim_thresh: cfg.nameSimThresh,
      p_limit:           cfg.limit,
    },
  )

  if (findErr) {
    console.error('find_place_merge_candidates error:', findErr.message)
    process.exit(1)
  }

  const rows = (candidates ?? []) as MergeCandidate[]
  console.log(`Found ${rows.length} candidate pair(s).\n`)

  if (rows.length === 0) {
    console.log('No duplicates found. Nothing to do.')
    return
  }

  // -------------------------------------------------------------------------
  // 2. Print table
  // -------------------------------------------------------------------------
  console.log(
    'Confidence  Distance  Reasons                          Old name → New name',
  )
  console.log('─'.repeat(90))
  for (const r of rows) {
    const conf    = r.confidence.toFixed(2).padEnd(11)
    const dist    = `${Math.round(r.distance_m)}m`.padEnd(9)
    const reasons = r.match_reasons.join(', ').padEnd(32)
    console.log(`${conf} ${dist} ${reasons} "${r.old_name}" → "${r.new_name}"`)
  }
  console.log()

  // -------------------------------------------------------------------------
  // 3. Seed review queue
  // -------------------------------------------------------------------------
  if (cfg.seed || cfg.dryRun) {
    if (cfg.seed) {
      const auditRows = rows.map(r => ({
        actor_type:  'system',
        action:      'place_merge_candidate',
        entity_type: 'place',
        entity_id:   r.candidate_old_id,
        source_type: 'canonicalise_script',
        before_summary: {
          old_place_id: r.candidate_old_id,
          old_name:     r.old_name,
        },
        after_summary: {
          new_place_id:     r.candidate_new_id,
          new_name:         r.new_name,
          distance_m:       r.distance_m,
          name_similarity:  r.name_similarity,
          match_reasons:    r.match_reasons,
          confidence:       r.confidence,
        },
      }))

      const { error: seedErr } = await supabase
        .from('restaurant_audit_events')
        .insert(auditRows)

      if (seedErr) {
        console.error('Seed error:', seedErr.message)
        process.exit(1)
      }
      console.log(`Seeded ${auditRows.length} review event(s) into restaurant_audit_events.`)
    } else {
      console.log('DRY RUN — no database writes. Use --seed or --execute to act.')
    }
    return
  }

  // -------------------------------------------------------------------------
  // 4. Execute merges above confidence threshold
  // -------------------------------------------------------------------------
  const toMerge = rows.filter(r => r.confidence >= cfg.minConfidence)
  const skipped = rows.length - toMerge.length

  console.log(
    `Executing ${toMerge.length} merge(s) (confidence ≥ ${cfg.minConfidence}); ` +
    `skipping ${skipped} below threshold.\n`,
  )

  let merged = 0
  let failed = 0

  for (const r of toMerge) {
    const { data: result, error: mergeErr } = await supabase.rpc('merge_places', {
      p_old_place_id: r.candidate_old_id,
      p_new_place_id: r.candidate_new_id,
      p_reason:       `osm_dedup:${r.match_reasons.join('+')}`,
      p_merged_by:    null,
    })

    if (mergeErr) {
      console.error(
        `  ✗ FAILED  "${r.old_name}" → "${r.new_name}": ${mergeErr.message}`,
      )
      failed++
      continue
    }

    const res = result as Record<string, number>
    console.log(
      `  ✓ merged  "${r.old_name}" → "${r.new_name}"` +
      `  (posts=${res.posts_repointed} saves=${res.saves_repointed}` +
      ` dishes=${res.dishes_repointed} collections=${res.collection_items_repointed})`,
    )
    merged++
  }

  console.log(`\n── Done: ${merged} merged, ${failed} failed, ${skipped} skipped (low confidence).`)

  if (failed > 0) process.exit(1)
}

run().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
