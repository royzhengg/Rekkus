import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAW_ANALYTICS_RETENTION_DAYS = 90

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function createAdminClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
}

Deno.serve(async (req: Request) => {
  const expectedKey = Deno.env.get('ANALYTICS_RETENTION_KEY')
  if (expectedKey) {
    const actualKey = req.headers.get('x-cron-key')
    if (actualKey !== expectedKey) return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - RAW_ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await admin
    .from('analytics_events')
    .delete()
    .lt('created_at', cutoff)

  if (error) {
    return Response.json({ ok: false, cutoff, error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, cutoff, retention_days: RAW_ANALYTICS_RETENTION_DAYS })
})
