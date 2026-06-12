import { analytics } from '@/lib/analytics'
import { GOOGLE_PLACES_KEY } from '@/lib/config'
import {
  type GoogleAreaSuggestion,
  googlePredictionsEnvelope,
  googleResultEnvelope,
  googleResultsEnvelope,
  hasAllowedGoogleStatus,
  isGoogleAreaSuggestion,
} from '@/lib/services/googlePlacesGuards'
import { supabase } from '@/lib/supabase'

const CACHE_TTL_MS = 5 * 60 * 1000
const MIN_AUTOCOMPLETE_LENGTH = 2
const cache = new Map<string, { expiresAt: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

type ProviderUsageEvent = {
  provider: 'google_places'
  requestType: 'autocomplete' | 'details' | 'textsearch'
  feature: string
  cacheStatus: 'hit' | 'miss' | 'deduped' | 'blocked' | 'error'
  fallbackReason?: string
  estimatedCostClass: 'free_local' | 'paid_provider'
}

function logProviderUsage(event: ProviderUsageEvent): void {
  void supabase.auth.getUser()
    .then(({ data }) => {
      analytics.providerUsage(
        data.user?.id ?? null,
        event.provider,
        event.requestType,
        event.feature,
        event.cacheStatus,
        event.fallbackReason,
        event.estimatedCostClass,
      )
      return null
    })
    .catch(() => {
      analytics.providerUsage(
        null,
        event.provider,
        event.requestType,
        event.feature,
        event.cacheStatus,
        event.fallbackReason,
        event.estimatedCostClass,
      )
    })
}

async function cachedJson<T>(
  key: string,
  url: string,
  event: Omit<ProviderUsageEvent, 'cacheStatus'>,
  normalize: (value: unknown) => T | null
): Promise<T | null> {
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) {
    logProviderUsage({ ...event, cacheStatus: 'hit' })
    const normalized = normalize(cached.value)
    if (!normalized) analytics.actionError(null, 'runtime_boundary', 'google_cache_payload_invalid')
    return normalized
  }

  const existing = inflight.get(key)
  if (existing) {
    logProviderUsage({ ...event, cacheStatus: 'deduped' })
    const value = await existing
    return normalize(value)
  }

  logProviderUsage({ ...event, cacheStatus: 'miss' })
  const request = fetch(url)
    .then(async res => {
      if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`)
      const json: unknown = await res.json()
      if (!hasAllowedGoogleStatus(json)) throw new Error('Google Places malformed or error status')
      return json
    })
    .then(json => {
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: json })
      inflight.delete(key)
      return json
    })
    .catch(() => {
      inflight.delete(key)
      logProviderUsage({ ...event, cacheStatus: 'error' })
      return null
    })

  inflight.set(key, request)
  const json = await request
  const normalized = normalize(json)
  if (json && !normalized) analytics.actionError(null, 'runtime_boundary', 'google_response_payload_invalid')
  return normalized
}

export async function fetchPlaceAutocompleteJson(
  input: string,
  location?: { lat: number; lng: number } | null,
  sessionToken?: string
): Promise<{ predictions?: unknown[] }> {
  const q = input.trim()
  const baseEvent = {
    provider: 'google_places' as const,
    requestType: 'autocomplete' as const,
    feature: 'restaurant_search',
    fallbackReason: 'local_miss_or_location_picker',
    estimatedCostClass: 'paid_provider' as const,
  }
  if (!GOOGLE_PLACES_KEY || q.length < MIN_AUTOCOMPLETE_LENGTH) {
    logProviderUsage({ ...baseEvent, cacheStatus: 'blocked' })
    return { predictions: [] }
  }

  // 50 km radius with strictbounds restricts Google to the metro area, preventing global
  // text-match results (e.g. "Beefbar Paris") from outranking nearby Sydney venues.
  const locationParam = location
    ? `&location=${location.lat},${location.lng}&radius=50000&strictbounds=true`
    : ''
  const sessionTokenParam = sessionToken ? `&sessiontoken=${encodeURIComponent(sessionToken)}` : ''
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}${locationParam}${sessionTokenParam}&types=establishment&key=${GOOGLE_PLACES_KEY}`
  return (
    (await cachedJson<{ predictions?: unknown[] }>(
      `autocomplete:${q}:${locationParam}:${sessionToken ?? ''}`,
      url,
      baseEvent,
      googlePredictionsEnvelope
    )) ?? {
      predictions: [],
    }
  )
}

export async function fetchPlaceDetailsJson<T>(
  placeId: string,
  fields: string,
  guard: (value: unknown) => value is T
): Promise<{ result?: T } | null> {
  if (!GOOGLE_PLACES_KEY || !placeId) return null
  if (!fields.trim()) return null
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_PLACES_KEY}`
  return cachedJson<{ result?: T }>(
    `details:${placeId}:${fields}`,
    url,
    {
      provider: 'google_places',
      requestType: 'details',
      feature: 'restaurant_detail',
      fallbackReason: 'missing_or_stale_local_metadata',
      estimatedCostClass: 'paid_provider',
    },
    value => googleResultEnvelope(value, guard)
  )
}

export async function fetchPlaceTextSearchJson<T>(
  query: string,
  guard: (value: unknown) => value is T,
  location?: { lat: number; lng: number } | null
): Promise<{ results?: T[] } | null> {
  const q = query.trim()
  if (!GOOGLE_PLACES_KEY || q.length < MIN_AUTOCOMPLETE_LENGTH) return null
  const locationParam = location ? `&location=${location.lat},${location.lng}&radius=20000` : ''
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}${locationParam}&key=${GOOGLE_PLACES_KEY}`
  return cachedJson<{ results?: T[] }>(
    `textsearch:${q}:${location ? `${location.lat},${location.lng}` : ''}`,
    url,
    {
      provider: 'google_places',
      requestType: 'textsearch',
      feature: location ? 'restaurant_search' : 'geocode_fallback',
      fallbackReason: location ? 'local_miss_or_location_picker' : 'missing_coordinates',
      estimatedCostClass: 'paid_provider',
    },
    value => googleResultsEnvelope(value, guard)
  )
}

export async function fetchAreaSuggestionsJson(
  input: string,
  userLocation?: { lat: number; lng: number } | null
): Promise<{ predictions: GoogleAreaSuggestion[] }> {
  const q = input.trim()
  const baseEvent = {
    provider: 'google_places' as const,
    requestType: 'autocomplete' as const,
    feature: 'area_search',
    fallbackReason: 'suburb_city_postcode_filter',
    estimatedCostClass: 'paid_provider' as const,
  }
  if (!GOOGLE_PLACES_KEY || q.length < MIN_AUTOCOMPLETE_LENGTH) {
    logProviderUsage({ ...baseEvent, cacheStatus: 'blocked' })
    return { predictions: [] }
  }
  const locationParam = userLocation
    ? `&location=${userLocation.lat},${userLocation.lng}&radius=50000`
    : ''
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}${locationParam}&types=(regions)&key=${GOOGLE_PLACES_KEY}`
  const cacheKey = `area:${q}:${locationParam}`
  const result = await cachedJson<{ predictions?: unknown[] }>(cacheKey, url, baseEvent, googlePredictionsEnvelope)
  return { predictions: (result?.predictions ?? []).filter(isGoogleAreaSuggestion).slice(0, 8) }
}

export function buildGooglePlacePhotoUrl(photoReference: string, maxWidth = 800): string {
  if (!GOOGLE_PLACES_KEY || !photoReference) return ''
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${GOOGLE_PLACES_KEY}`
}
