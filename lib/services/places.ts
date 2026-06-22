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
export {
  fetchIsPlaceSaved,
  fetchPlacePopularityCache,
  fetchPlacePostRatings,
} from './places/analytics'
export type { PopularityCacheRow, PostRatingRow } from './places/analytics'

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
  const { data } = await supabase.rpc('search_places_full_text', {
    query_text: query,
    max_results: maxResults,
    ...(userLocation ? { near_lat: userLocation.lat, near_lng: userLocation.lng } : {}),
  })
  return (data ?? []).map((r) => mapPlaceRpcRowToPrediction(r, userLocation))
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

type PlaceRow = { id: string; google_place_id: string | null; google_photo_refs: string[] }

function parsePlaceRow(value: unknown): PlaceRow | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  return {
    id: value.id,
    google_place_id: typeof value.google_place_id === 'string' ? value.google_place_id : null,
    google_photo_refs: Array.isArray(value.google_photo_refs)
      ? value.google_photo_refs.filter((ref): ref is string => typeof ref === 'string')
      : [],
  }
}

export async function fetchPlaceRow(id: string): Promise<PlaceRow | null> {
  const { data } = await supabase.from('places')
    .select('id, google_place_id, google_photo_refs')
    .eq('id', id)
    .maybeSingle()
  return parsePlaceRow(data)
}

export async function fetchPlaceRowByGooglePlaceId(googlePlaceId: string): Promise<PlaceRow | null> {
  const { data } = await supabase.from('places')
    .select('id, google_place_id, google_photo_refs')
    .eq('google_place_id', googlePlaceId)
    .maybeSingle()
  return parsePlaceRow(data)
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
