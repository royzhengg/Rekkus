import { GOOGLE_PLACES_KEY } from '@/lib/config'
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

function logProviderUsage(event: ProviderUsageEvent) {
  supabase.auth
    .getUser()
    .then(({ data }) => {
      const userId = data.user?.id
      if (!userId) return null
      return (supabase.from('analytics_events') as any).insert({
        user_id: userId,
        event_type: event.cacheStatus === 'hit' ? 'provider_cache_hit' : 'google_fallback_used',
        entity_type: 'restaurant',
        entity_id: null,
        metadata: event,
      })
    })
    .catch(() => null)
}

async function cachedJson<T>(
  key: string,
  url: string,
  event: Omit<ProviderUsageEvent, 'cacheStatus'>
): Promise<T | null> {
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) {
    logProviderUsage({ ...event, cacheStatus: 'hit' })
    return cached.value as T
  }

  const existing = inflight.get(key)
  if (existing) {
    logProviderUsage({ ...event, cacheStatus: 'deduped' })
    return existing as Promise<T>
  }

  logProviderUsage({ ...event, cacheStatus: 'miss' })
  const request = fetch(url)
    .then(res => res.json())
    .then(json => {
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: json })
      inflight.delete(key)
      return json as T
    })
    .catch(() => {
      inflight.delete(key)
      logProviderUsage({ ...event, cacheStatus: 'error' })
      return null
    })

  inflight.set(key, request)
  return request
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

  const locationParam = location ? `&location=${location.lat},${location.lng}&radius=10000` : ''
  const sessionTokenParam = sessionToken ? `&sessiontoken=${encodeURIComponent(sessionToken)}` : ''
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}${locationParam}${sessionTokenParam}&types=establishment&key=${GOOGLE_PLACES_KEY}`
  return (
    (await cachedJson<{ predictions?: unknown[] }>(
      `autocomplete:${q}:${locationParam}:${sessionToken ?? ''}`,
      url,
      baseEvent
    )) ?? {
      predictions: [],
    }
  )
}

export async function fetchPlaceDetailsJson<T>(
  placeId: string,
  fields: string
): Promise<{ result?: T } | null> {
  if (!GOOGLE_PLACES_KEY || !placeId) return null
  if (!fields.trim()) return null
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_PLACES_KEY}`
  return cachedJson<{ result?: T }>(`details:${placeId}:${fields}`, url, {
    provider: 'google_places',
    requestType: 'details',
    feature: 'restaurant_detail',
    fallbackReason: 'missing_or_stale_local_metadata',
    estimatedCostClass: 'paid_provider',
  })
}

export async function fetchPlaceTextSearchJson<T>(query: string): Promise<{ results?: T[] } | null> {
  const q = query.trim()
  if (!GOOGLE_PLACES_KEY || q.length < MIN_AUTOCOMPLETE_LENGTH) return null
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${GOOGLE_PLACES_KEY}`
  return cachedJson<{ results?: T[] }>(`textsearch:${q}`, url, {
    provider: 'google_places',
    requestType: 'textsearch',
    feature: 'geocode_fallback',
    fallbackReason: 'missing_coordinates',
    estimatedCostClass: 'paid_provider',
  })
}

export async function fetchAreaSuggestionsJson(
  input: string,
  userLocation?: { lat: number; lng: number } | null
): Promise<{
  predictions: Array<{
    place_id: string
    description: string
    structured_formatting: { main_text: string; secondary_text: string }
  }>
}> {
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
  const result = await cachedJson<{ predictions?: unknown[] }>(cacheKey, url, baseEvent)
  return { predictions: ((result?.predictions ?? []) as any[]).slice(0, 8) }
}

export function buildGooglePlacePhotoUrl(photoReference: string, maxWidth = 800): string {
  if (!GOOGLE_PLACES_KEY || !photoReference) return ''
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${GOOGLE_PLACES_KEY}`
}
