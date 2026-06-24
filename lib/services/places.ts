import { reportInvalidBoundary } from '@/lib/services/boundaryTelemetry'
import {
  fetchPlaceAutocompleteJson,
  fetchPlaceTextSearchJson,
} from '@/lib/services/googlePlaces'
import {
  isGooglePrediction,
  isGoogleTextSearchPlace,
} from '@/lib/services/googlePlacesGuards'
import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'
import { recordPlaceProviderCache } from './places/cache'
import type { FullPlaceDetail } from './places/google'

export {
  recordPlaceAlias,
  recordPlaceAuditEvent,
  recordPlaceMergeEvidence,
  recordPlaceObservation,
  reportDataRepair,
  submitCommunityVerification,
  submitDuplicatePlaceSuggestion,
  submitPlaceClaim,
  submitPlaceEditSuggestion,
} from './places/governance'
export type { PlaceSuggestionInput } from './places/governance'
export {
  fetchSavedPlacesForUser,
  fetchSavedPlaceIds,
  isSavedPlaceList,
  normalizeSavedPlaces,
} from './savedPlaces'
export type { FetchSavedPlacesOptions, SavedPlace, SavedPlaceWithPlace } from './savedPlaces'

// Google API wrappers
export {
  fetchPlaceDetails,
  fetchPlaceIdByTextSearch,
  fetchPlaceProviderDetail,
  getPlaceProviderPhotoUrl,
} from './places/google'
export type { PlaceDetail, FullPlaceDetail } from './places/google'

// Provider cache recording
export { recordPlaceProviderCache, recordPlaceSource } from './places/cache'
export { cachePlacePhotoRefs, getPlaceDisplayPhoto, getPlaceDisplayPhotos } from './places/photos'

// Ratings, save status, popularity
export { fetchIsPlaceSaved, fetchPlacePostRatings } from './places/analytics'
export type { PostRatingRow } from './places/analytics'

export type PredictionDistanceGroup = 'nearby' | 'city' | 'state' | 'country' | 'worldwide'

export type Prediction = {
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
  types?: string[]
  source?: 'rekkus' | 'google'
  score?: number
  distanceKm?: number
  distanceGroup?: PredictionDistanceGroup
  // Present when prediction came from our local DB — enables fast-path selection
  dbDetails?: {
    placeId: string
    lat: number
    lng: number
    address: string
    suburb?: string | null
    city?: string | null
    cuisineType?: string | null
    postCount?: number
    avgFoodRating?: number | null
  }
}

export type SelectedPlace = {
  googlePlaceId: string
  name: string
  address: string
  lat: number
  lng: number
  placeId?: string | undefined
}

export type ResolvedPlace = {
  googlePlaceId: string
  name: string
  address: string
  lat: number
  lng: number
}

export type UserPlaceInput = {
  name: string
  address?: string | null
  city?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  cuisineType?: string | null
}

export function distanceGroupForPrediction(distanceKm: number | undefined, source?: Prediction['source']): PredictionDistanceGroup {
  if (distanceKm === undefined) return source === 'rekkus' ? 'nearby' : 'worldwide'
  if (distanceKm <= 2) return 'nearby'
  if (distanceKm <= 50) return 'city'
  if (distanceKm <= 250) return 'state'
  if (distanceKm <= 4000) return 'country'
  return 'worldwide'
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type PlaceRpcRow = {
  id: string
  name: string
  google_place_id: string | null
  latitude: number | null
  longitude: number | null
  cuisine_type: string | null
  city: string | null
  address: string | null
  suburb?: string | null
  rank?: number | null
  distance_km?: number | null
}

export function mapPlaceRpcRowToPrediction(
  r: PlaceRpcRow,
  userLocation?: { lat: number; lng: number } | null
): Prediction {
  const lat = r.latitude ?? 0
  const lng = r.longitude ?? 0
  const distanceKm: number | undefined =
    r.distance_km != null
      ? r.distance_km
      : userLocation && lat && lng
        ? haversineKm(userLocation.lat, userLocation.lng, lat, lng)
        : undefined
  const secondaryParts = [r.cuisine_type, r.suburb ?? r.city, r.address].filter(Boolean).slice(0, 3)
  if (distanceKm !== undefined) {
    secondaryParts.push(distanceKm < 1 ? Math.round(distanceKm * 1000) + 'm' : distanceKm.toFixed(1) + 'km')
  }
  return {
    place_id: r.google_place_id ?? r.id,
    description: r.name,
    structured_formatting: { main_text: r.name, secondary_text: secondaryParts.join(' · ') },
    types: ['restaurant'],
    source: 'rekkus',
    score: Number(r.rank ?? 0) + 10,
    ...(distanceKm !== undefined ? { distanceKm } : {}),
    distanceGroup: distanceGroupForPrediction(distanceKm, 'rekkus'),
    dbDetails: {
      placeId: r.id,
      lat,
      lng,
      address: r.address ?? '',
      suburb: r.suburb ?? null,
      city: r.city ?? null,
      cuisineType: r.cuisine_type ?? null,
    },
  }
}

export async function fetchPredictions(
  input: string,
  userLocation?: { lat: number; lng: number } | null
): Promise<Prediction[]> {
  const json = await fetchPlaceAutocompleteJson(input, userLocation)
  const predictions = json.predictions ?? []
  const validPredictions = predictions.filter(isGooglePrediction)
  if (validPredictions.length !== predictions.length) {
    reportInvalidBoundary('google_prediction_item_invalid')
  }
  return validPredictions.map(prediction => ({
    ...prediction,
    source: 'google',
    score: 0,
    distanceGroup: distanceGroupForPrediction(undefined, 'google'),
  }))
}

export async function fetchFoodCategoryPredictions(
  query: string,
  location: { lat: number; lng: number }
): Promise<Prediction[]> {
  const json = await fetchPlaceTextSearchJson(query, isGoogleTextSearchPlace, location)
  const results = json?.results ?? []
  return results.slice(0, 8).map(r => {
    const distanceKm = haversineKm(location.lat, location.lng, r.geometry.location.lat, r.geometry.location.lng)
    return {
      place_id: r.place_id,
      description: r.name,
      structured_formatting: { main_text: r.name, secondary_text: r.formatted_address },
      types: r.types ?? ['restaurant'],
      source: 'google' as const,
      score: 0,
      distanceKm,
      distanceGroup: distanceGroupForPrediction(distanceKm, 'google'),
    }
  })
}

export async function searchPlacesByText(
  query: string,
  maxResults = 8,
  userLocation?: { lat: number; lng: number } | null
): Promise<Prediction[]> {
  const { data } = await supabase.rpc('search_text_fallback', {
    p_query: query,
    p_limit: maxResults,
    ...(userLocation ? { p_near_lat: userLocation.lat, p_near_lng: userLocation.lng } : {}),
  })
  type TextFallbackRow = { entity_type: string; entity_id: string; display_data: unknown }
  const placeRows: PlaceRpcRow[] = ((data as unknown) as TextFallbackRow[] | null ?? [])
    .filter(r => r.entity_type === 'place')
    .flatMap(r => {
      if (!r.display_data || typeof r.display_data !== 'object' || Array.isArray(r.display_data)) return []
      const d = r.display_data as Record<string, unknown>
      return [{
        id: r.entity_id,
        name: String(d['name'] ?? ''),
        google_place_id: typeof d['google_place_id'] === 'string' ? d['google_place_id'] : null,
        latitude: typeof d['latitude'] === 'number' ? d['latitude'] : null,
        longitude: typeof d['longitude'] === 'number' ? d['longitude'] : null,
        cuisine_type: typeof d['cuisine_type'] === 'string' ? d['cuisine_type'] : null,
        city: typeof d['city'] === 'string' ? d['city'] : null,
        address: typeof d['address'] === 'string' ? d['address'] : null,
        suburb: typeof d['suburb'] === 'string' ? d['suburb'] : null,
      }]
    })
  return placeRows.map((r) => mapPlaceRpcRowToPrediction(r, userLocation))
}

export async function fetchNearbyPlaces(
  location: { lat: number; lng: number },
  radiusKm = 2
): Promise<Prediction[]> {
  const { data } = await supabase.rpc('places_within_radius', {
    p_lat: location.lat,
    p_lng: location.lng,
    p_radius_metres: radiusKm * 1000,
    p_max_results: 8,
  })
  return ((data as PlaceRpcRow[] | null) ?? []).map((r) => mapPlaceRpcRowToPrediction(r, location))
}

export async function findPlaceByGooglePlaceId(googlePlaceId: string) {
  if (!googlePlaceId) return null
  const { data } = await supabase.from('places')
    .select('*')
    .eq('google_place_id', googlePlaceId)
    .maybeSingle()
  return data ?? null
}

export async function searchLocalPlaces(query: string, limit = 10) {
  const q = query.trim()
  if (!q) return []
  const { data } = await supabase.from('places')
    .select('*')
    .or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,cuisine_type.ilike.%${q}%`)
    .limit(limit)
  return data ?? []
}

export async function upsertPlace(
  detail: FullPlaceDetail,
  googlePlaceId: string,
  cuisine?: string
): Promise<string | undefined> {
  const now = new Date().toISOString()
  const { data } = await supabase.from('places')
    .upsert(
      {
        name: detail.name,
        address: detail.formatted_address,
        latitude: detail.geometry.location.lat,
        longitude: detail.geometry.location.lng,
        google_place_id: googlePlaceId,
        cuisine_type: cuisine ?? null,
        canonical_source: 'google_places',
        google_photo_refs: (detail.photos?.map(p => p.photo_reference).filter((r): r is string => r != null) ?? null),
        google_rating: detail.rating ?? null,
        google_review_count: detail.user_ratings_total ?? null,
        updated_at: now,
      },
      { onConflict: 'google_place_id' }
    )
    .select('id')
    .single()

  const placeId = (data as { id: string } | null)?.id
  if (!placeId) return undefined

  await recordPlaceProviderCache(placeId, 'google_places', googlePlaceId, detail).catch(() => null)

  return placeId
}

// B-587: migration 20260615000001 creates restaurant_place_stubs.
// Restore body after `npm run check:supabase-types` regenerates types/database.ts.
export async function upsertPlaceStubs(_predictions: Prediction[]): Promise<void> {
  // stub — run supabase gen types after deploying 20260615000001_restaurant_place_stubs.sql
}

export async function upsertResolvedPlace(place: ResolvedPlace): Promise<string | null> {
  const { data, error } = await supabase.from('places')
    .upsert(
      {
        name: place.name,
        address: place.address,
        latitude: place.lat,
        longitude: place.lng,
        google_place_id: place.googlePlaceId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'google_place_id' }
    )
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string } | null)?.id ?? null
}

export async function savePlace(userId: string, placeId: string): Promise<void> {
  const { error } = await supabase.from('saved_places').insert({
    user_id: userId,
    place_id: placeId,
  })
  if (error) throw error
}

export async function unsavePlace(userId: string, placeId: string): Promise<void> {
  const { error } = await supabase.from('saved_places')
    .delete()
    .eq('user_id', userId)
    .eq('place_id', placeId)
  if (error) throw error
}

export async function createUserPlace(input: UserPlaceInput): Promise<string | null> {
  const { data, error } = await supabase.rpc('create_user_place', {
    p_name: input.name,
    ...(input.address ? { p_address: input.address } : {}),
    ...(input.city ? { p_city: input.city } : {}),
    ...(input.country ? { p_country: input.country } : {}),
    ...(input.latitude != null ? { p_latitude: input.latitude } : {}),
    ...(input.longitude != null ? { p_longitude: input.longitude } : {}),
    ...(input.cuisineType ? { p_cuisine_type: input.cuisineType } : {}),
  })
  if (error) return null
  return data ?? null
}

type PlaceRow = {
  id: string
  google_place_id: string | null
  google_photo_refs: string[]
  primary_photo_source: string
  place_status: string
  closure_signal_source: string | null
  closure_signal_metadata: Record<string, unknown> | null
  closure_signal_at: string | null
}

function parsePlaceRow(value: unknown): PlaceRow | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  return {
    id: value.id,
    google_place_id: typeof value.google_place_id === 'string' ? value.google_place_id : null,
    google_photo_refs: Array.isArray(value.google_photo_refs)
      ? value.google_photo_refs.filter((ref): ref is string => typeof ref === 'string')
      : [],
    primary_photo_source: typeof value.primary_photo_source === 'string' ? value.primary_photo_source : 'rekkus_post',
    place_status: typeof value.place_status === 'string' ? value.place_status : 'active',
    closure_signal_source: typeof value.closure_signal_source === 'string' ? value.closure_signal_source : null,
    closure_signal_metadata: isRecord(value.closure_signal_metadata) ? value.closure_signal_metadata : null,
    closure_signal_at: typeof value.closure_signal_at === 'string' ? value.closure_signal_at : null,
  }
}

const PLACE_ROW_SELECT = 'id, google_place_id, google_photo_refs, primary_photo_source, place_status, closure_signal_source, closure_signal_metadata, closure_signal_at'

export async function fetchPlaceRow(id: string): Promise<PlaceRow | null> {
  const { data } = await supabase.from('places')
    .select(PLACE_ROW_SELECT)
    .eq('id', id)
    .maybeSingle()
  return parsePlaceRow(data)
}

export type OsmPlaceDetail = {
  phone?: string
  website?: string
  hoursText?: string
}

export async function fetchOsmPlaceDetail(placeId: string): Promise<OsmPlaceDetail> {
  const [contactRes, hoursRes] = await Promise.all([
    supabase.from('place_contact').select('phone, website').eq('place_id', placeId).maybeSingle(),
    supabase.from('place_opening_hours')
      .select('hours_text')
      .eq('place_id', placeId)
      .eq('is_current', true)
      .eq('source', 'osm')
      .maybeSingle(),
  ])
  const result: OsmPlaceDetail = {}
  if (contactRes.data?.phone) result.phone = contactRes.data.phone
  if (contactRes.data?.website) result.website = contactRes.data.website
  if (hoursRes.data?.hours_text) result.hoursText = hoursRes.data.hours_text
  return result
}

export async function fetchPlaceRowByGooglePlaceId(googlePlaceId: string): Promise<PlaceRow | null> {
  const { data } = await supabase.from('places')
    .select(PLACE_ROW_SELECT)
    .eq('google_place_id', googlePlaceId)
    .maybeSingle()
  return parsePlaceRow(data)
}

/**
 * Records a provider closure signal for a venue.
 * NOT called from page view — use from a scheduled sync or admin action.
 * For Google OPERATIONAL: call supabase.rpc('reopen_place', { p_place_id, p_source: 'google_operational' })
 */
export async function applyProviderClosureSignal(
  placeId: string,
  provider: string,
  providerStatus: string,
  normalizedStatus: 'permanently_closed' | 'temporarily_closed',
): Promise<void> {
  const { data: place } = await supabase
    .from('places')
    .select('status_locked')
    .eq('id', placeId)
    .maybeSingle()
  if (!place || place.status_locked) return

  const confidence = normalizedStatus === 'permanently_closed' ? 0.95 : 0.80

  const { error } = await supabase.from('place_closure_signals').insert({
    place_id: placeId,
    signal_type: 'provider_status',
    signal_value: 'closed',
    confidence,
    metadata: { provider, business_status: providerStatus, normalized_status: normalizedStatus },
    expires_at: null,
  })
  // Unique constraint violation (23505) means an identical active signal already exists — ignore.
  if (error && (error as { code: string }).code !== '23505') throw error
}

export function cachePlaceGoogleData(
  placeId: string,
  data: {
    google_rating?: number | null
    google_review_count?: number | null
    open_now?: boolean | null
    open_now_checked_at?: string | null
  }
): void {
  void supabase.from('places').update(data).eq('id', placeId)
}

export async function insertGooglePlace(input: {
  name: string
  address: string
  latitude: number
  longitude: number
  google_place_id: string
}): Promise<string | null> {
  const { data } = await supabase.from('places')
    .insert({
      name: input.name,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      google_place_id: input.google_place_id,
      canonical_source: 'google_places',
    })
    .select('id')
    .single()
  return (data as { id: string } | null)?.id ?? null
}

const PHOTO_PROMOTION_THRESHOLD = 3

// Promotes primary_photo_source to 'rekkus_post' once the place has ≥3 user post photos.
// Called after a post is published or deleted. No-op if already promoted.
export async function maybePromotePlacePhotoSource(placeId: string): Promise<void> {
  const { data: place } = await supabase
    .from('places')
    .select('id, primary_photo_source')
    .eq('id', placeId)
    .single()

  if (!place || place.primary_photo_source === 'rekkus_post') return

  const { count } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('place_id', placeId)
    .is('deleted_at', null)

  if ((count ?? 0) >= PHOTO_PROMOTION_THRESHOLD) {
    await supabase
      .from('places')
      .update({ primary_photo_source: 'rekkus_post' })
      .eq('id', placeId)
  }
}
