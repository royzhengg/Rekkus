import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseModerateContentPayload } from '../_shared/guards.ts'

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

// Keyword blocklist for text content moderation
const BLOCKED_KEYWORDS = [
  // Grooming/solicitation patterns — kept minimal; extend via DB table in production
  'send nudes', 'send pics', 'meet irl', 'wanna meet', 'how old are you', 'are you alone',
  'keep this secret', "don't tell anyone", 'just between us',
]

// Known phishing/spam domains — extend via DB table in production
const SUSPICIOUS_DOMAINS = [
  'bit.ly', 'tinyurl.com', 'ow.ly', 't.co',
]

// Rate limit table: conversation_id -> [timestamps]
const rateLimitCache = new Map<string, number[]>()
const globalRateLimitCache = new Map<string, number[]>()

function checkRateLimit(userId: string, conversationId: string, newAccountThrottle: boolean): boolean {
  const now = Date.now()
  const windowMs = 60_000 // 1 minute

  // Per-conversation rate limit
  const convKey = `${userId}:${conversationId}`
  const convTimes = (rateLimitCache.get(convKey) ?? []).filter(t => now - t < windowMs)
  const perConvLimit = newAccountThrottle ? 5 : 10
  if (convTimes.length >= perConvLimit) return false
  convTimes.push(now)
  rateLimitCache.set(convKey, convTimes)

  // Global per-user hourly rate limit
  const hourWindowMs = 3_600_000
  const globalTimes = (globalRateLimitCache.get(userId) ?? []).filter(t => now - t < hourWindowMs)
  const globalLimit = newAccountThrottle ? 20 : 50
  if (globalTimes.length >= globalLimit) return false
  globalTimes.push(now)
  globalRateLimitCache.set(userId, globalTimes)

  return true
}

function checkTextContent(body: string): { safe: boolean; reason?: string } {
  const lower = body.toLowerCase()

  for (const keyword of BLOCKED_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { safe: false, reason: 'blocked_keyword' }
    }
  }

  // Check for suspicious URLs
  const urlPattern = /https?:\/\/([^\s/]+)/gi
  let match
  while ((match = urlPattern.exec(body)) !== null) {
    const domain = match[1].toLowerCase().split(':')[0]
    if (SUSPICIOUS_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) {
      return { safe: false, reason: 'suspicious_url' }
    }
  }

  return { safe: true }
}

async function checkMediaHash(
  hash: string,
  admin: ReturnType<typeof createClient>
): Promise<{ safe: boolean; reason?: string }> {
  // Check against NCMEC hash blocklist stored in DB
  // In production: this table is populated by NCMEC hash feed (encrypted, access-controlled)
  const { data } = await admin
    .from('csam_hash_blocklist')
    .select('id')
    .eq('hash', hash)
    .maybeSingle()

  if (data) {
    return { safe: false, reason: 'csam_detected' }
  }
  return { safe: true }
}

async function logCsamIncident(
  admin: ReturnType<typeof createClient>,
  userId: string,
  messageType: string,
  conversationId: string
) {
  await admin.from('content_reports').insert({
    reporter_id: null,
    reported_user_id: userId,
    report_type: 'csam_detected',
    source_surface: 'message_moderation',
    metadata: {
      message_type: messageType,
      conversation_id: conversationId,
      auto_detected: true,
    },
  })

  // Suspend the account pending human review
  await admin.auth.admin.updateUserById(userId, { ban_duration: '876600h' })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabaseUrl = requireEnv('SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = requireEnv('SUPABASE_ANON_KEY')

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })

  const admin = createClient(supabaseUrl, serviceKey)

  let payload: ReturnType<typeof parseModerateContentPayload>
  try {
    payload = parseModerateContentPayload(await req.json())
  } catch {
    return new Response(JSON.stringify({ safe: false, reason: 'invalid_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!payload) {
    return new Response(JSON.stringify({ safe: false, reason: 'invalid_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messageType, body, mediaHash, conversationId } = payload

  // Determine if new account (throttle applies)
  const { data: userRow } = await admin
    .from('users')
    .select('created_at')
    .eq('id', user.id)
    .single()
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const isNewAccount = userRow
    ? new Date(userRow.created_at).getTime() > sevenDaysAgo
    : false

  // Rate limit check
  if (!checkRateLimit(user.id, conversationId, isNewAccount)) {
    // Log rate limit violation to user_trust_profiles
    await admin
      .from('user_trust_profiles')
      .upsert({ user_id: user.id, violations: 1 }, { onConflict: 'user_id', ignoreDuplicates: false })
      .then(() => {})
      .catch(() => {})

    return new Response(JSON.stringify({ safe: false, reason: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Text content moderation
  if (messageType === 'text' && body) {
    const textResult = checkTextContent(body)
    if (!textResult.safe) {
      return new Response(JSON.stringify(textResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // Media hash check (CSAM)
  if (mediaHash && ['image', 'video'].includes(messageType)) {
    const mediaResult = await checkMediaHash(mediaHash, admin)
    if (!mediaResult.safe) {
      await logCsamIncident(admin, user.id, messageType, conversationId)
      return new Response(JSON.stringify(mediaResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response(JSON.stringify({ safe: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
