// Architectural invariants:
// 1. This Edge Function owns orchestration only. Never directly update places.place_status.
// 2. place_closure_signals is authoritative for closure state. place_provider_cache is operational metadata.
// 3. All Google status literals come from GOOGLE_STATUS / BUSINESS_STATUS enums; never inline strings.
// 4. Ignore unknown Google response fields; never fail because Google adds new fields.
// 5. Every SQL interval derived from PROVIDER_CACHE_TTL_DAYS must be documented alongside it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_CONCURRENCY = 5
const REQUEST_TIMEOUT_MS = 10_000
const MAX_CONSECUTIVE_ERRORS = 20
const TOTAL_ATTEMPTS = 3
const RETRY_BASE_MS = 500
// Google ToS: 30-day content TTL. stale_at = now() + PROVIDER_CACHE_TTL_DAYS days.
// The 90-day permanently_closed recheck interval in get_places_for_google_sync is independent.
const PROVIDER_CACHE_TTL_DAYS = 30

const GOOGLE_STATUS = {
  OK: 'OK',
  OVER_QUERY_LIMIT: 'OVER_QUERY_LIMIT',
  REQUEST_DENIED: 'REQUEST_DENIED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_PLACE_ID: 'INVALID_PLACE_ID',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

const BUSINESS_STATUS = {
  OPERATIONAL: 'OPERATIONAL',
  CLOSED_TEMPORARILY: 'CLOSED_TEMPORARILY',
  CLOSED_PERMANENTLY: 'CLOSED_PERMANENTLY',
} as const

type GoogleSyncAction =
  | { type: 'REOPEN' }
  | { type: 'INSERT_SIGNAL'; normalizedStatus: 'permanently_closed' | 'temporarily_closed' }
  | { type: 'UPDATE_CACHE_ONLY'; reason: string }
  | { type: 'SKIP'; reason: string }
  | { type: 'RETRY' }
  | { type: 'ABORT'; reason: string }

function classifyGoogleResponse(
  googleStatus: string | null | undefined,
  businessStatus: string | null | undefined,
  placeStatus: string,
): GoogleSyncAction {
  if (googleStatus === GOOGLE_STATUS.OVER_QUERY_LIMIT) {
    return { type: 'ABORT', reason: GOOGLE_STATUS.OVER_QUERY_LIMIT }
  }
  if (googleStatus === GOOGLE_STATUS.REQUEST_DENIED) {
    return { type: 'ABORT', reason: GOOGLE_STATUS.REQUEST_DENIED }
  }
  if (
    googleStatus === GOOGLE_STATUS.INVALID_REQUEST ||
    googleStatus === GOOGLE_STATUS.NOT_FOUND ||
    googleStatus === GOOGLE_STATUS.INVALID_PLACE_ID
  ) {
    return { type: 'SKIP', reason: googleStatus }
  }
  if (googleStatus === GOOGLE_STATUS.UNKNOWN_ERROR || googleStatus !== GOOGLE_STATUS.OK) {
    return { type: 'RETRY' }
  }
  // googleStatus === OK
  if (!businessStatus || !Object.values(BUSINESS_STATUS).includes(businessStatus as (typeof BUSINESS_STATUS)[keyof typeof BUSINESS_STATUS])) {
    return { type: 'SKIP', reason: 'UNKNOWN_BUSINESS_STATUS' }
  }
  if (businessStatus === BUSINESS_STATUS.OPERATIONAL) {
    if (placeStatus === 'active') {
      return { type: 'UPDATE_CACHE_ONLY', reason: 'ALREADY_ACTIVE' }
    }
    return { type: 'REOPEN' }
  }
  if (businessStatus === BUSINESS_STATUS.CLOSED_PERMANENTLY) {
    return { type: 'INSERT_SIGNAL', normalizedStatus: 'permanently_closed' }
  }
  if (businessStatus === BUSINESS_STATUS.CLOSED_TEMPORARILY) {
    return { type: 'INSERT_SIGNAL', normalizedStatus: 'temporarily_closed' }
  }
  return { type: 'SKIP', reason: 'UNHANDLED_BUSINESS_STATUS' }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

Deno.serve(async (req: Request) => {
  const startedAt = new Date().toISOString()
  const startTime = Date.now()

  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (!cronSecret || req.headers.get('x-cron-key') !== cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const googleKey = Deno.env.get('GOOGLE_PLACES_KEY') ?? ''
  const batchSize = parseInt(Deno.env.get('GOOGLE_SYNC_BATCH_SIZE') ?? '2147483647', 10)

  const admin = createClient(supabaseUrl, cronSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: locked, error: lockError } = await admin.rpc('acquire_google_sync_lock')
  if (lockError || !locked) {
    return new Response(
      JSON.stringify({ ok: false, skipped: true, reason: 'ALREADY_RUNNING' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let processed = 0
  let reopened = 0
  let closedPermanently = 0
  let closedTemporarily = 0
  let skipped = 0
  let googleErrors = 0
  let dbErrors = 0
  let validationErrors = 0
  let networkErrors = 0
  let retriedRequests = 0
  let aborted = false
  let abortReason: string | null = null
  let googleCalls = 0
  let consecutiveErrors = 0

  try {
    const { data: places, error: placesError } = await admin.rpc('get_places_for_google_sync', {
      batch_size: batchSize,
    })

    if (placesError) {
      console.error(JSON.stringify({ job: 'google-operational-sync', event: 'places_fetch_error', error: placesError.message }))
      return new Response(
        JSON.stringify({ ok: false, error: placesError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!places || (places as unknown[]).length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          processed: 0,
          reopened: 0,
          closed_permanently: 0,
          closed_temporarily: 0,
          skipped: 0,
          google_errors: 0,
          db_errors: 0,
          validation_errors: 0,
          network_errors: 0,
          retried_requests: 0,
          aborted: false,
          abort_reason: null,
          google_calls: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    type PlaceRow = { id: string; google_place_id: string; place_status: string }
    const rows = places as PlaceRow[]

    for (let i = 0; i < rows.length; i += MAX_CONCURRENCY) {
      if (aborted) break
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        aborted = true
        abortReason = 'CIRCUIT_BREAKER'
        break
      }

      const batch = rows.slice(i, i + MAX_CONCURRENCY)
      await Promise.allSettled(
        batch.map(async ({ id, google_place_id, place_status }) => {
          let attempt = 0

          while (attempt < TOTAL_ATTEMPTS) {
            attempt++
            let googleStatus: string | null = null
            let businessStatus: string | null = null

            try {
              const url =
                `https://maps.googleapis.com/maps/api/place/details/json` +
                `?place_id=${encodeURIComponent(google_place_id)}&fields=business_status&key=${googleKey}`
              googleCalls++
              const json = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS) as Record<string, unknown>
              googleStatus = (json?.status as string) ?? null
              businessStatus = ((json?.result as Record<string, unknown>)?.business_status as string) ?? null
            } catch (fetchErr: unknown) {
              const errName = fetchErr instanceof Error ? fetchErr.name : ''
              const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
              console.warn(JSON.stringify({
                job: 'google-operational-sync',
                place_id: id,
                google_status: null,
                business_status: null,
                action: 'network_error',
                attempt,
                error: errMsg,
              }))
              if (attempt < TOTAL_ATTEMPTS) {
                retriedRequests++
                const jitter = (Math.random() - 0.5) * RETRY_BASE_MS
                await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1) + jitter)
                continue
              }
              void errName
              networkErrors++
              consecutiveErrors++
              processed++
              return
            }

            const action = classifyGoogleResponse(googleStatus, businessStatus, place_status)

            console.warn(JSON.stringify({
              job: 'google-operational-sync',
              place_id: id,
              google_status: googleStatus,
              business_status: businessStatus,
              action: action.type,
              attempt,
            }))

            if (action.type === 'ABORT') {
              aborted = true
              abortReason = action.reason
              consecutiveErrors++
              processed++
              return
            }

            if (action.type === 'RETRY') {
              if (attempt < TOTAL_ATTEMPTS) {
                retriedRequests++
                const jitter = (Math.random() - 0.5) * RETRY_BASE_MS
                await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1) + jitter)
                continue
              }
              googleErrors++
              consecutiveErrors++
              processed++
              return
            }

            if (action.type === 'SKIP') {
              validationErrors++
              consecutiveErrors = 0
              skipped++
              processed++
              return
            }

            // OK response — reset circuit breaker
            consecutiveErrors = 0

            if (action.type === 'UPDATE_CACHE_ONLY') {
              skipped++
            } else if (action.type === 'REOPEN') {
              const { error: reopenError } = await admin.rpc('reopen_place', {
                p_place_id: id,
                p_source: 'google_operational',
              })
              if (reopenError) {
                console.error(JSON.stringify({
                  job: 'google-operational-sync',
                  place_id: id,
                  event: 'reopen_error',
                  error: reopenError.message,
                }))
                dbErrors++
                processed++
                return
              }
              reopened++
            } else if (action.type === 'INSERT_SIGNAL') {
              const confidence = action.normalizedStatus === 'permanently_closed' ? 0.95 : 0.80
              const { error: signalError } = await admin
                .from('place_closure_signals')
                .insert({
                  place_id: id,
                  signal_type: 'provider_status',
                  signal_value: 'closed',
                  confidence,
                  metadata: {
                    provider: 'google',
                    business_status: businessStatus,
                    normalized_status: action.normalizedStatus,
                    checked_at: new Date().toISOString(),
                  },
                })
              if (signalError) {
                if (signalError.code === '23505') {
                  skipped++
                } else {
                  console.error(JSON.stringify({
                    job: 'google-operational-sync',
                    place_id: id,
                    event: 'signal_insert_error',
                    error: signalError.message,
                  }))
                  dbErrors++
                  processed++
                  return
                }
              } else {
                if (action.normalizedStatus === 'permanently_closed') closedPermanently++
                else closedTemporarily++
              }
            }

            // Update provider cache after any successful OK response
            const staleAt = new Date(
              Date.now() + PROVIDER_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
            ).toISOString()
            const { error: cacheError } = await admin
              .from('place_provider_cache')
              .upsert(
                {
                  place_id: id,
                  source_type: 'google_places',
                  source_id: google_place_id,
                  field_mask: ['business_status'],
                  normalized_payload: { business_status: businessStatus },
                  attribution_required: true,
                  attribution_text: 'Google',
                  cacheability: 'place_id_permanent_content_restricted',
                  retention_policy: 'retain_place_id_refresh_content_by_terms',
                  freshness_state: 'fresh',
                  fetched_at: new Date().toISOString(),
                  stale_at: staleAt,
                },
                { onConflict: 'source_type,source_id' },
              )
            if (cacheError) {
              console.error(JSON.stringify({
                job: 'google-operational-sync',
                place_id: id,
                event: 'cache_upsert_error',
                error: cacheError.message,
              }))
              dbErrors++
              // Cache failure is best-effort; do not abort or skip the action already taken above
            }

            processed++
            return
          }
        }),
      )
    }
  } finally {
    // Best-effort: advisory locks are session-scoped so the DB releases on connection close anyway.
    try {
      await admin.rpc('release_google_sync_lock')
    } catch (e: unknown) {
      console.error(JSON.stringify({
        job: 'google-operational-sync',
        event: 'lock_release_failed',
        error: e instanceof Error ? e.message : String(e),
      }))
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      processed,
      reopened,
      closed_permanently: closedPermanently,
      closed_temporarily: closedTemporarily,
      skipped,
      google_errors: googleErrors,
      db_errors: dbErrors,
      validation_errors: validationErrors,
      network_errors: networkErrors,
      retried_requests: retriedRequests,
      aborted,
      abort_reason: abortReason,
      google_calls: googleCalls,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
