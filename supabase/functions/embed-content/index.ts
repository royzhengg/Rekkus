import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  embedTable,
  isPostTextRow,
  isRecord,
  isRestaurantTextRow,
  postToText,
  restaurantToText,
  type EmbedTable,
} from '../_shared/guards.ts'

// Generates 384-dim embeddings via Supabase's built-in gte-small model (free, no API key)
// and stores them on posts/restaurants for semantic search fallback.
//
// Trigger: DB webhook on posts INSERT/UPDATE and restaurants INSERT/UPDATE
// (Configure in Supabase Dashboard → Database → Webhooks)
//
// Backfill: POST /functions/v1/embed-content with body { type: 'backfill', entity_type: 'post' | 'restaurant' }
// to embed all existing rows that have embedding IS NULL.

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const supabase = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')
)

async function embedText(text: string): Promise<number[]> {
  const model = new Supabase.ai.Session('gte-small')
  const result = await model.run(text, { mean_pool: true, normalize: true })
  if (!Array.isArray(result) || !result.every(value => typeof value === 'number')) {
    throw new Error('Embedding model returned invalid vector')
  }
  return result
}

Deno.serve(async (req) => {
  try {
    const body: unknown = await req.json()

    // DB webhook trigger path
    if (isRecord(body) && (body.type === 'INSERT' || body.type === 'UPDATE')) {
      const { table: rawTable, record } = body
      const table = embedTable(rawTable)
      if (!table) return new Response('unsupported table', { status: 200 })
      if (!isRecord(record) || typeof record.id !== 'string') return new Response('ok', { status: 200 })

      let text = ''
      if (table === 'posts') {
        if (!isPostTextRow(record)) return new Response('ok', { status: 200 })
        text = postToText(record)
      } else {
        if (!isRestaurantTextRow(record)) return new Response('ok', { status: 200 })
        text = restaurantToText(record)
      }

      if (!text) return new Response('no text', { status: 200 })

      const embedding = await embedText(text)
      const { error } = await supabase.from(table).update({ embedding }).eq('id', record.id)
      if (error) throw error
      return new Response('embedded', { status: 200 })
    }

    // Backfill path: embed all rows where embedding IS NULL
    if (isRecord(body) && body.type === 'backfill') {
      const entityType = isRecord(body) ? body.entity_type : null
      const table: EmbedTable = entityType === 'restaurant' ? 'restaurants' : 'posts'

      let processed = 0
      let from = 0
      const batchSize = 50

      while (true) {
        let query = supabase
          .from(table)
          .select('id, best_dish, caption, cuisine_type, name, suburb, city')
          .is('embedding', null)
          .range(from, from + batchSize - 1)

        if (table === 'posts') {
          query = query.is('deleted_at', null)
        }

        const { data, error } = await query
        if (error || !data || data.length === 0) break

        for (const row of data) {
          const text =
            table === 'posts'
              ? isPostTextRow(row) ? postToText(row) : ''
              : isRestaurantTextRow(row) ? restaurantToText(row) : ''
          if (!text) continue
          try {
            const embedding = await embedText(text)
            const { error } = await supabase.from(table).update({ embedding }).eq('id', row.id)
            if (error) throw error
            processed++
          } catch {
            // Skip rows that fail; they can be retried
          }
        }

        from += batchSize
        if (data.length < batchSize) break
      }

      return new Response(JSON.stringify({ processed }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response('unknown request type', { status: 400 })
  } catch (err) {
    console.error('embed-content error:', err)
    return new Response('error', { status: 500 })
  }
})
