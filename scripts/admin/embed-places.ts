/**
 * Backfill embeddings for places without them.
 *
 * Calls the embed-content Edge Function in parallel batches.
 * Naturally resumable: only processes places where embedding IS NULL.
 *
 * Usage:
 *   npm run admin:embed-places
 *   npm run admin:embed-places -- --concurrency 10  (default: 5)
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const BATCH_SIZE = 100    // rows fetched per DB page
const DEFAULT_CONCURRENCY = 5  // concurrent Edge Function calls

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const FUNCTION_URL = `${process.env.SUPABASE_URL!}/functions/v1/embed-content`
const AUTH_HEADER = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`

function placeToText(r: { name: string; cuisine_type: string | null; suburb: string | null; city: string | null }): string {
  return [r.name, r.cuisine_type, r.suburb, r.city].filter(Boolean).join(' ').trim()
}

async function embedAndSave(place: { id: string; name: string; cuisine_type: string | null; suburb: string | null; city: string | null }): Promise<boolean> {
  const text = placeToText(place)
  if (!text) return false

  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': AUTH_HEADER },
      body: JSON.stringify({ type: 'embed', text }),
    })
    if (!res.ok) {
      console.error(`  [embed] HTTP ${res.status} for place ${place.id}`)
      return false
    }
    const json = await res.json() as { embedding?: number[] }
    if (!Array.isArray(json.embedding)) return false

    const { error } = await supabase.from('places').update({ embedding: json.embedding }).eq('id', place.id)
    if (error) {
      console.error(`  [embed] DB write failed for ${place.id}: ${error.message}`)
      return false
    }
    return true
  } catch (err) {
    console.error(`  [embed] Error for ${place.id}: ${err}`)
    return false
  }
}

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = []
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const task = tasks[i++]
      if (task) results.push(await task())
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

async function main() {
  const concurrency = parseInt(
    process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] ?? '',
    10,
  ) || DEFAULT_CONCURRENCY

  console.log(`\nEmbedding places (concurrency=${concurrency})…`)

  // Count total to embed
  const { count } = await supabase
    .from('places')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null)

  console.log(`Total places without embeddings: ${count ?? '?'}\n`)

  let from = 0
  let totalProcessed = 0
  let totalFailed = 0

  while (true) {
    const { data, error } = await supabase
      .from('places')
      .select('id, name, cuisine_type, suburb, city')
      .is('embedding', null)
      .range(from, from + BATCH_SIZE - 1)
      .order('id')

    if (error || !data || data.length === 0) break

    const tasks = data.map(place => () => embedAndSave(place))
    const results = await runWithConcurrency(tasks, concurrency)

    const succeeded = results.filter(Boolean).length
    const failed = results.length - succeeded
    totalProcessed += succeeded
    totalFailed += failed
    from += BATCH_SIZE

    process.stdout.write(`\r  Embedded: ${totalProcessed} | Failed: ${totalFailed} | Page from: ${from}`)

    if (data.length < BATCH_SIZE) break
  }

  console.log(`\n\nDone. Embedded: ${totalProcessed} | Failed: ${totalFailed}`)
}

void main()
