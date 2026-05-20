import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Generates 384-dim embeddings via Supabase's built-in gte-small model (free, no API key)
// and stores them on posts/restaurants for semantic search fallback.
//
// Trigger: DB webhook on posts INSERT/UPDATE and restaurants INSERT/UPDATE
// (Configure in Supabase Dashboard → Database → Webhooks)
//
// Backfill: POST /functions/v1/embed-content with body { type: 'backfill', entity_type: 'post' | 'restaurant' }
// to embed all existing rows that have embedding IS NULL.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function embedText(text: string): Promise<number[]> {
  const model = new Supabase.ai.Session('gte-small')
  const result = await model.run(text, { mean_pool: true, normalize: true })
  return result as number[]
}

function postToText(post: { best_dish?: string | null; caption?: string | null; cuisine_type?: string | null }): string {
  return [post.best_dish, post.caption, post.cuisine_type]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function restaurantToText(r: { name?: string | null; cuisine_type?: string | null; suburb?: string | null; city?: string | null }): string {
  return [r.name, r.cuisine_type, r.suburb, r.city]
    .filter(Boolean)
    .join(' ')
    .trim()
}

Deno.serve(async (req) => {
  try {
    const body = await req.json()

    // DB webhook trigger path
    if (body.type === 'INSERT' || body.type === 'UPDATE') {
      const { table, record } = body
      if (!record?.id) return new Response('ok', { status: 200 })

      let text = ''
      if (table === 'posts') {
        text = postToText(record)
      } else if (table === 'restaurants') {
        text = restaurantToText(record)
      } else {
        return new Response('unsupported table', { status: 200 })
      }

      if (!text) return new Response('no text', { status: 200 })

      const embedding = await embedText(text)
      await supabase.from(table).update({ embedding }).eq('id', record.id)
      return new Response('embedded', { status: 200 })
    }

    // Backfill path: embed all rows where embedding IS NULL
    if (body.type === 'backfill') {
      const { entity_type } = body
      const table = entity_type === 'restaurant' ? 'restaurants' : 'posts'

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
          const text = table === 'posts' ? postToText(row as any) : restaurantToText(row as any)
          if (!text) continue
          try {
            const embedding = await embedText(text)
            await supabase.from(table).update({ embedding }).eq('id', row.id)
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
