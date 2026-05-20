import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Payload = {
  mediaIds?: string[]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server media processor is not configured.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const payload = (await req.json().catch(() => ({}))) as Payload
  const mediaIds = payload.mediaIds?.filter(Boolean) ?? []
  if (mediaIds.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // V1 orchestrator: mark queued media as ready using the best available file.
  // The row shape is intentionally future-proof for a dedicated worker/transcoder.
  const { data, error } = await supabase
    .from('post_photos')
    .select('id, url, original_url, processed_url, thumbnail_url')
    .in('id', mediaIds)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  for (const row of data ?? []) {
    const processedUrl = row.processed_url ?? row.url ?? row.original_url
    await supabase
      .from('post_photos')
      .update({
        processed_url: processedUrl,
        thumbnail_url: row.thumbnail_url ?? processedUrl,
        processing_status: processedUrl ? 'ready' : 'failed',
        processing_error: processedUrl ? null : 'No processable media URL.',
      })
      .eq('id', row.id)
  }

  return new Response(JSON.stringify({ processed: data?.length ?? 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
