import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isFeatureFlagOverrideRow } from '../_shared/guards.ts'

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

Deno.serve(async () => {
  const admin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('feature_flag_overrides')
    .select('flag_name, enabled, expires_at')
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  if (error) {
    return Response.json({ overrides: [] }, { status: 200 })
  }

  const overrides = (data ?? [])
    .filter(isFeatureFlagOverrideRow)
    .map(row => ({
      flag_name: row.flag_name,
      enabled: row.enabled,
      expires_at: row.expires_at,
    }))

  return Response.json({ overrides })
})
