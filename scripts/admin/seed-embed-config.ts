/**
 * Seeds the service_role_key into app_config so the DB embed trigger
 * can call the embed-content Edge Function.
 *
 * Run once after deploying the 20260623000004_place_embed_trigger migration.
 * Re-run after rotating the service role key.
 *
 * Usage: npm run admin:seed-embed-config
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { error } = await supabase.from('app_config').upsert(
    { key: 'service_role_key', value: process.env.SUPABASE_SERVICE_ROLE_KEY! },
    { onConflict: 'key' },
  )
  if (error) {
    console.error('Failed to seed service_role_key:', error.message)
    process.exit(1)
  }
  console.log('service_role_key seeded into app_config.')
}

void main()
