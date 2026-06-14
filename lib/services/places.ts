import { reportInvalidBoundary } from '@/lib/services/boundaryTelemetry'
import {
  buildGooglePlacePhotoUrl,
  fetchPlaceAutocompleteJson,
  fetchPlaceDetailsJson,
  fetchPlaceTextSearchJson,
} from '@/lib/services/googlePlaces'
import {
  isGooglePlaceDetail,
  isGooglePlaceIdResult,
  isGooglePlaceMetadata,
  isGooglePrediction,
  isGoogleTextSearchPlace,
  type GooglePlaceDetail,
  type GooglePlaceMetadata,
} from '@/lib/services/googlePlacesGuards'
import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'

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
export type { SavedPlace, SavedPlaceWithPlace } from './savedPlaces'

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

export type PlaceDetail = GooglePlaceMetadata
type FullPlaceDetail = GooglePlaceDetail

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
  // @ts-expect-error -- places_within_radius not yet in generated database types
  const { data } = await supabase.rpc('places_within_radius', {
    p_lat: location.lat,
    p_lng: location.lng,
    p_radius_metres: radiusKm * 1000,
    p_max_results: 8,
  })
  return ((data as PlaceRpcRow[] | null) ?? []).map((r) => mapPlaceRpcRowToPrediction(r, location))
}

export async function fetchPlaceDetails(googlePlaceId: string): Promise<FullPlaceDetail | null> {
  const json = await fetchPlaceDetailsJson(
    googlePlaceId,
    'name,formatted_address,geometry,business_status,formatted_phone_number,website,price_level,types,opening_hours,photos,rating,user_ratings_total',
    isGooglePlaceDetail
  )
  return json?.result ?? null
}

export async function fetchRestaurantProviderDetail(
  googlePlaceId: string,
  fields: string
): Promise<PlaceDetail | null> {
  try {
    const json = await fetchPlaceDetailsJson(googlePlaceId, fields, isGooglePlaceMetadata)
    return json?.result ?? null
  } catch {
    return null
  }
}

export async function fetchPlaceIdByTextSearch(query: string): Promise<string | null> {
  try {
    const json = await fetchPlaceTextSearchJson(query, isGooglePlaceIdResult)
    return json?.results?.[0]?.place_id ?? null
  } catch {
    return null
  }
}

export function getRestaurantProviderPhotoUrl(photoReference: string, maxWidth = 800): string {
  return buildGooglePlacePhotoUrl(photoReference, maxWidth)
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
        google_details_fetched_at: now,
        google_details_fields: [
          'name',
          'formatted_address',
          'geometry',
          'business_status',
          'formatted_phone_number',
          'website',
          'price_level',
          'types',
          'opening_hours',
          'photos',
          'rating',
          'user_ratings_total',
        ],
        google_business_status: detail.business_status ?? null,
        google_phone: detail.formatted_phone_number ?? null,
        google_website: detail.website ?? null,
        google_price_level: detail.price_level ?? null,
        google_types: detail.types ?? null,
        google_opening_hours: (detail.opening_hours ?? null) as never,
        google_photo_refs: (detail.photos?.map(p => p.photo_reference).filter((r): r is string => r != null) ?? null),
        google_rating: detail.rating ?? null,
        google_review_count: detail.user_ratings_total ?? null,
        updated_at: now,
      },
      { onConflict: 'google_place_id' }
    )
    .select('id')
    .single()

  const placeId = data?.id
  if (!placeId) return undefined

  await recordRestaurantProviderCache(placeId, 'google_places', googlePlaceId, detail).catch(() => null)

  return placeId
}

// B-587: restore full upsert body once restaurant_place_stubs migration is deployed
export async function upsertPlaceStubs(_predictions: Prediction[]): Promise<void> {
  // stub — table pending migration (B-587)
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
  return data?.id ?? null
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

export async function getPlaceDisplayPhotos(
  placeId?: string | null,
  providerPhotoRefs: string[] = [],
  maxPhotos = 6
): Promise<string[]> {
  const providerUrls = providerPhotoRefs
    .slice(0, maxPhotos)
    .map(ref => getRestaurantProviderPhotoUrl(ref))
    .filter(Boolean)

  if (!placeId) return providerUrls

  const { data } = await supabase.from('posts')
    .select('post_photos ( url, order_index )')
    .eq('place_id', placeId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(24)

  const firstPartyUrls = (data ?? [])
    .flatMap((row) => row.post_photos ?? [])
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map(photo => photo.url)
    .filter((url, index, arr): url is string => typeof url === 'string' && !!url && arr.indexOf(url) === index)
    .slice(0, maxPhotos)

  return firstPartyUrls.length > 0 ? firstPartyUrls : providerUrls
}

export async function getPlaceDisplayPhoto(
  placeId?: string | null,
  providerPhotoRefs: string[] = []
): Promise<string | null> {
  const photos = await getPlaceDisplayPhotos(placeId, providerPhotoRefs, 1)
  return photos[0] ?? null
}

export async function recordRestaurantSource(
  placeId: string,
  sourceType: string,
  sourceId: string,
  options: {
    source_rights?: string
    attribution_required?: boolean
    cacheability?: string
    retention_policy?: string
    confidence?: number
  } = {}
) {
  if (!placeId || !sourceId) return
  await supabase.from('restaurant_sources').upsert(
    {
      restaurant_id: placeId,
      source_type: sourceType,
      source_id: sourceId,
      source_rights: options.source_rights ?? 'first_party',
      attribution_required: options.attribution_required ?? false,
      cacheability: options.cacheability ?? 'permanent_identifier',
      retention_policy: options.retention_policy ?? 'retain_until_unlinked_or_restaurant_deleted',
      confidence: options.confidence ?? 0.5,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'source_type,source_id' }
  )
}

export async function recordRestaurantProviderCache(
  placeId: string,
  sourceType: string,
  sourceId: string,
  detail: FullPlaceDetail
) {
  if (!placeId || !sourceId) return
  const now = new Date()
  const staleAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await supabase.rpc('record_restaurant_provider_snapshot', {
    p_restaurant_id: placeId,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_field_mask: [
        'name',
        'formatted_address',
        'geometry',
        'business_status',
        'formatted_phone_number',
        'website',
        'price_level',
        'types',
        'opening_hours',
        'photos',
        'rating',
        'user_ratings_total',
      ],
    p_normalized_payload: {
        name: detail.name,
        formatted_address: detail.formatted_address,
        lat: detail.geometry.location.lat,
        lng: detail.geometry.location.lng,
        business_status: detail.business_status ?? null,
        phone: detail.formatted_phone_number ?? null,
        website: detail.website ?? null,
        price_level: detail.price_level ?? null,
        types: detail.types ?? [],
        rating: detail.rating ?? null,
        user_ratings_total: detail.user_ratings_total ?? null,
      },
    p_attribution_required: sourceType === 'google_places',
    p_attribution_text: sourceType === 'google_places' ? 'Google' : '',
    p_cacheability:
        sourceType === 'google_places'
          ? 'place_id_permanent_content_restricted'
          : 'source_terms_defined',
    p_retention_policy:
        sourceType === 'google_places'
          ? 'retain_place_id_refresh_content_by_terms'
          : 'retain_until_source_or_restaurant_deleted',
    p_stale_at: staleAt,
  })
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

type PostRatingRow = {
  food_rating: number | null
  vibe_rating: number | null
  cost_rating: number | null
  created_at: string
  must_order: string | null
  dish_id: string | null
}

export async function fetchPlacePostRatings(placeId: string): Promise<PostRatingRow[]> {
  const { data } = await supabase.from('posts')
    .select('food_rating, vibe_rating, cost_rating, created_at, must_order, dish_id')
    .eq('place_id', placeId)
    .limit(100)
  return (data ?? []).filter((row): row is PostRatingRow =>
    typeof row.created_at === 'string' &&
    (row.food_rating === null || typeof row.food_rating === 'number') &&
    (row.vibe_rating === null || typeof row.vibe_rating === 'number') &&
    (row.cost_rating === null || typeof row.cost_rating === 'number') &&
    (row.must_order === null || typeof row.must_order === 'string') &&
    (row.dish_id === null || typeof row.dish_id === 'string')
  )
}

export async function fetchIsPlaceSaved(userId: string, placeId: string): Promise<boolean> {
  const { data } = await supabase.from('saved_places')
    .select('id')
    .eq('user_id', userId)
    .eq('place_id', placeId)
    .maybeSingle()
  return !!data
}

export type PopularityCacheRow = {
  place_id: string
  post_count: number
  interaction_count_30d: number
  avg_food_rating: number | null
  food_rating_count: number
}

export async function fetchPlacePopularityCache(limit = 2000): Promise<PopularityCacheRow[]> {
  const { data, error } = await supabase
    .from('place_popularity_cache')
    .select('place_id, post_count, interaction_count_30d, avg_food_rating, food_rating_count')
    .limit(limit)
  if (error) throw error
  return data ?? []
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
  return data?.id ?? null
}
