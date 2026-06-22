import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  embedTable,
  isPostTextRow,
  isRecord,
  isPlaceTextRow,
  isDishTextRow,
  postToText,
  placeToText,
  dishToText,
  type EmbedTable,
} from '../_shared/guards.ts'

// Generates 384-dim embeddings via Supabase's built-in gte-small model (free, no API key).
//
// Trigger modes:
//   DB webhook on posts/places/dishes INSERT/UPDATE
//   POST { type: 'backfill', entity_type: 'post' | 'place' | 'dish' } — embeds all rows with embedding IS NULL
//   POST { type: 'embed', text: string } — embeds arbitrary text, returns { embedding: number[] }

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

// Writes embedding to the correct side table (post_embeddings, dish_embeddings) or
// directly to the places row, matching each entity's storage pattern.
async function writeEmbedding(table: EmbedTable, id: string, embedding: number[]): Promise<void> {
  if (table === 'posts') {
    const { error } = await supabase
      .from('post_embeddings')
      .upsert({ post_id: id, embedding }, { onConflict: 'post_id' })
    if (error) throw error
  } else if (table === 'dishes') {
    const { error } = await supabase
      .from('dish_embeddings')
      .upsert({ dish_id: id, embedding, updated_at: new Date().toISOString() }, { onConflict: 'dish_id' })
    if (error) throw error
  } else {
    const { error } = await supabase.from('places').update({ embedding }).eq('id', id)
    if (error) throw error
  }
}

Deno.serve(async (req) => {
  try {
    const body: unknown = await req.json()

    // Direct embed path: { type: 'embed', text: string } → { embedding: number[] }
    if (isRecord(body) && body.type === 'embed') {
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) return new Response(JSON.stringify({ error: 'text is required' }), { status: 400 })
      const embedding = await embedText(text)
      return new Response(JSON.stringify({ embedding }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

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
      } else if (table === 'dishes') {
        if (!isDishTextRow(record)) return new Response('ok', { status: 200 })
        text = dishToText(record)
      } else {
        if (!isPlaceTextRow(record)) return new Response('ok', { status: 200 })
        text = placeToText(record)
      }

      if (!text) return new Response('no text', { status: 200 })

      const embedding = await embedText(text)
      await writeEmbedding(table, record.id, embedding)
      return new Response('embedded', { status: 200 })
    }

    // Backfill path: embed all rows where embedding IS NULL
    if (isRecord(body) && body.type === 'backfill') {
      const entityType = body.entity_type
      const table: EmbedTable =
        entityType === 'place' ? 'places' : entityType === 'dish' ? 'dishes' : 'posts'

      let processed = 0
      let from = 0
      const batchSize = 50

      while (true) {
        let query
        if (table === 'dishes') {
          // Dishes that have no entry in dish_embeddings yet
          query = supabase
            .from('dishes')
            .select('id, name, cuisine_type')
            .not('id', 'in', `(select dish_id from dish_embeddings)`)
            .range(from, from + batchSize - 1)
        } else if (table === 'posts') {
          // Posts that have no entry in post_embeddings yet
          query = supabase
            .from('posts')
            .select('id, must_order, caption, cuisine_type')
            .not('id', 'in', `(select post_id from post_embeddings)`)
            .is('deleted_at', null)
            .range(from, from + batchSize - 1)
        } else {
          query = supabase
            .from('places')
            .select('id, name, cuisine_type, suburb, city')
            .is('embedding', null)
            .range(from, from + batchSize - 1)
        }

        const { data, error } = await query
        if (error || !data || data.length === 0) break

        for (const row of data) {
          let text = ''
          if (table === 'posts') {
            text = isPostTextRow(row) ? postToText(row) : ''
          } else if (table === 'dishes') {
            text = isDishTextRow(row) ? dishToText(row) : ''
          } else {
            text = isPlaceTextRow(row) ? placeToText(row) : ''
          }
          if (!text || typeof row.id !== 'string') continue
          try {
            const embedding = await embedText(text)
            await writeEmbedding(table, row.id, embedding)
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
