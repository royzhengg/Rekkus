// B-519/B-520: Server-side auth session audit — captures real client IP + device type.
//
// Triggered by a Database Webhook on auth.sessions INSERT:
//   Supabase Dashboard → Database → Webhooks → New webhook
//   Schema: auth | Table: sessions | Event: INSERT
//   URL: https://<project-ref>.supabase.co/functions/v1/auth-audit-hook
//   Secret: generate a random string → set as AUTH_HOOK_SECRET in Edge Function env vars
//
// Records complement the auth.users trigger (20260526000006):
//   - Trigger  (auth.users INSERT/UPDATE) → provider + source='server' — no IP available
//   - This fn  (auth.sessions INSERT)     → provider + ip_hash + device_os + source='server_session'
// Duplicate rows per login are acceptable in an append-only audit log (ADR 0011).
// logout is NOT captured here — session DELETE does not carry meaningful security context.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isRecord } from '../_shared/guards.ts'

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function detectDeviceOs(userAgent: string | null): 'ios' | 'android' | 'web' | 'unknown' {
  if (!userAgent) return 'unknown'
  const ua = userAgent.toLowerCase()
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios'
  if (ua.includes('android')) return 'android'
  if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('webkit')) return 'web'
  return 'unknown'
}

function isSessionRecord(r: unknown): r is { user_id: string; ip: string | null; user_agent: string | null } {
  return isRecord(r) && typeof r.user_id === 'string'
}

const supabase = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')
)

Deno.serve(async (req) => {
  try {
    const hookSecret = Deno.env.get('AUTH_HOOK_SECRET')
    if (hookSecret) {
      const provided = req.headers.get('x-webhook-secret') ?? req.headers.get('authorization') ?? ''
      const bearer = `Bearer ${hookSecret}`
      if (provided !== hookSecret && provided !== bearer) {
        return new Response('Unauthorized', { status: 401 })
      }
    }

    const body: unknown = await req.json()
    if (!isRecord(body) || body.type !== 'INSERT') return new Response('ok', { status: 200 })

    const { record } = body
    if (!isSessionRecord(record)) return new Response('ok', { status: 200 })

    // Determine provider from user's app_metadata — same source as the auth.users trigger.
    const { data: adminData } = await supabase.auth.admin.getUserById(record.user_id)
    const provider = (adminData?.user?.app_metadata?.provider as string | undefined) ?? 'email'
    const eventType = provider === 'email' ? 'login_email_success' : 'login_oauth_success'

    const ipHash = record.ip ? await sha256Hex(record.ip) : null
    const deviceOs = detectDeviceOs(record.user_agent)

    const context: Record<string, string> = { provider, device_os: deviceOs, source: 'server_session' }
    if (ipHash) context.ip_hash = ipHash

    // Direct insert via service role — bypasses USING(false) RLS, same as record_auth_audit_event_server.
    await supabase.from('auth_audit_events').insert({
      user_id: record.user_id,
      event_type: eventType,
      context,
    })

    return new Response('ok', { status: 200 })
  } catch (err) {
    // Audit failures must never surface error details externally.
    console.error('auth-audit-hook:', err instanceof Error ? err.message : 'unknown error')
    return new Response('ok', { status: 200 })
  }
})
