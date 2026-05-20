import { supabase } from '@/lib/supabase'
import {
  buildGooglePlacePhotoUrl,
  fetchPlaceAutocompleteJson,
  fetchPlaceDetailsJson,
  fetchPlaceTextSearchJson,
} from '@/lib/services/googlePlaces'

export type Prediction = {
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
  types?: string[]
  source?: 'rekkus' | 'google'
  score?: number
  // Present when prediction came from our local DB — enables fast-path selection
  dbDetails?: {
    restaurantId: string
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

export type PlaceDetail = {
  name: string
  formatted_address: string
  geometry: { location: { lat: number; lng: number } }
  business_status?: string
  formatted_phone_number?: string
  website?: string
  price_level?: number
  types?: string[]
  opening_hours?: unknown
  photos?: { photo_reference?: string }[]
  rating?: number
  user_ratings_total?: number
}

export type SelectedPlace = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  restaurantId?: string
}

export type ResolvedRestaurantPlace = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
}

export type UserRestaurantInput = {
  name: string
  address?: string | null
  city?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  cuisineType?: string | null
}

export type RestaurantSuggestionInput = {
  restaurantId: string
  field: 'name' | 'address' | 'city' | 'cuisine_type' | 'price_range' | 'phone' | 'website' | 'hours' | 'other'
  currentValue?: unknown
  suggestedValue?: unknown
  issueSummary: string
}

export async function fetchPredictions(
  input: string,
  userLocation?: { lat: number; lng: number } | null
): Promise<Prediction[]> {
  const json = await fetchPlaceAutocompleteJson(input, userLocation)
  return ((json.predictions ?? []) as Prediction[]).map(prediction => ({
    ...prediction,
    source: 'google',
    score: 0,
  }))
}

export async function searchRestaurantsByText(
  query: string,
  maxResults = 8
): Promise<Prediction[]> {
  const { data } = await (supabase as any).rpc('search_restaurants_full_text', {
    query_text: query,
    max_results: maxResults,
  })
  return (data ?? []).map((r: any) => ({
    place_id: r.google_place_id ?? r.id,
    description: r.name,
    structured_formatting: {
      main_text: r.name,
      secondary_text: [r.cuisine_type, r.suburb ?? r.city, r.address].filter(Boolean).slice(0, 3).join(' · '),
    },
    types: ['restaurant'],
    source: 'rekkus',
    score: Number(r.rank ?? 0) + 10,
    dbDetails: {
      restaurantId: r.id,
      lat: r.latitude ?? 0,
      lng: r.longitude ?? 0,
      address: r.address ?? '',
      suburb: r.suburb ?? null,
      city: r.city ?? null,
      cuisineType: r.cuisine_type ?? null,
    },
  }))
}

export async function fetchNearbyRestaurants(
  location: { lat: number; lng: number },
  radiusKm = 1
): Promise<Prediction[]> {
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((location.lat * Math.PI) / 180), 0.01))
  const { data } = await (supabase as any).rpc('restaurants_in_bounding_box', {
    min_lat: location.lat - latDelta,
    max_lat: location.lat + latDelta,
    min_lng: location.lng - lngDelta,
    max_lng: location.lng + lngDelta,
    max_results: 8,
  })
  return (data ?? []).map((r: any) => ({
    place_id: r.google_place_id ?? r.id,
    description: r.name,
    structured_formatting: {
      main_text: r.name,
      secondary_text: [r.cuisine_type, r.suburb ?? r.city, r.address].filter(Boolean).slice(0, 3).join(' · '),
    },
    types: ['restaurant'],
    source: 'rekkus',
    score: 10,
    dbDetails: {
      restaurantId: r.id,
      lat: r.latitude ?? 0,
      lng: r.longitude ?? 0,
      address: r.address ?? '',
      suburb: r.suburb ?? null,
      city: r.city ?? null,
      cuisineType: r.cuisine_type ?? null,
    },
  }))
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetail | null> {
  const json = await fetchPlaceDetailsJson<PlaceDetail>(
    placeId,
    'name,formatted_address,geometry,business_status,formatted_phone_number,website,price_level,types,opening_hours,photos,rating,user_ratings_total'
  )
  return json?.result ?? null
}

export async function fetchRestaurantProviderDetail<T>(
  placeId: string,
  fields: string
): Promise<T | null> {
  try {
    const json = await fetchPlaceDetailsJson<T>(placeId, fields)
    return json?.result ?? null
  } catch {
    return null
  }
}

export async function fetchPlaceIdByTextSearch(query: string): Promise<string | null> {
  try {
    const json = await fetchPlaceTextSearchJson<{ place_id?: string }>(query)
    return json?.results?.[0]?.place_id ?? null
  } catch {
    return null
  }
}

export function getRestaurantProviderPhotoUrl(photoReference: string, maxWidth = 800): string {
  return buildGooglePlacePhotoUrl(photoReference, maxWidth)
}

export async function findRestaurantByGooglePlaceId(placeId: string) {
  if (!placeId) return null
  const { data } = await (supabase.from('restaurants') as any)
    .select('*')
    .eq('google_place_id', placeId)
    .maybeSingle()
  return data ?? null
}

export async function searchLocalRestaurants(query: string, limit = 10) {
  const q = query.trim()
  if (!q) return []
  const { data } = await (supabase.from('restaurants') as any)
    .select('*')
    .or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,cuisine_type.ilike.%${q}%`)
    .limit(limit)
  return data ?? []
}

export async function upsertRestaurant(
  detail: PlaceDetail,
  placeId: string,
  cuisine?: string
): Promise<string | undefined> {
  const now = new Date().toISOString()
  const { data } = await (supabase.from('restaurants') as any)
    .upsert(
      {
        name: detail.name,
        address: detail.formatted_address,
        latitude: detail.geometry.location.lat,
        longitude: detail.geometry.location.lng,
        google_place_id: placeId,
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
        google_opening_hours: detail.opening_hours ?? null,
        google_photo_refs: detail.photos?.map(photo => photo.photo_reference).filter(Boolean) ?? null,
        google_rating: detail.rating ?? null,
        google_review_count: detail.user_ratings_total ?? null,
        updated_at: now,
      },
      { onConflict: 'google_place_id' }
    )
    .select('id')
    .single()

  const restaurantId = data?.id
  if (!restaurantId) return undefined

  await recordRestaurantProviderCache(restaurantId, 'google_places', placeId, detail).catch(() => null)

  return restaurantId
}

export async function upsertResolvedRestaurant(place: ResolvedRestaurantPlace): Promise<string | null> {
  const { data, error } = await (supabase.from('restaurants') as any)
    .upsert(
      {
        name: place.name,
        address: place.address,
        latitude: place.lat,
        longitude: place.lng,
        google_place_id: place.placeId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'google_place_id' }
    )
    .select('id')
    .single()
  if (error) throw error
  return data?.id ?? null
}

export async function saveLocation(userId: string, restaurantId: string): Promise<void> {
  const { error } = await (supabase.from('saved_locations') as any).insert({
    user_id: userId,
    restaurant_id: restaurantId,
  })
  if (error) throw error
}

export async function unsaveLocation(userId: string, restaurantId: string): Promise<void> {
  const { error } = await (supabase.from('saved_locations') as any)
    .delete()
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
  if (error) throw error
}

export async function createUserRestaurant(input: UserRestaurantInput): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('create_user_restaurant', {
    p_name: input.name,
    p_address: input.address ?? null,
    p_city: input.city ?? null,
    p_country: input.country ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_cuisine_type: input.cuisineType ?? null,
  })
  if (error) return null
  return data ?? null
}

export async function getRestaurantDisplayPhotos(
  restaurantId?: string | null,
  providerPhotoRefs: string[] = [],
  maxPhotos = 6
): Promise<string[]> {
  const providerUrls = providerPhotoRefs
    .slice(0, maxPhotos)
    .map(ref => getRestaurantProviderPhotoUrl(ref))
    .filter(Boolean)

  if (!restaurantId) return providerUrls

  const { data } = await (supabase.from('posts') as any)
    .select('post_photos ( url, order_index )')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(24)

  const firstPartyUrls = ((data ?? []) as any[])
    .flatMap(row => row.post_photos ?? [])
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map(photo => photo.url)
    .filter((url, index, arr) => typeof url === 'string' && url && arr.indexOf(url) === index)
    .slice(0, maxPhotos)

  return firstPartyUrls.length > 0 ? firstPartyUrls : providerUrls
}

export async function getRestaurantDisplayPhoto(
  restaurantId?: string | null,
  providerPhotoRefs: string[] = []
): Promise<string | null> {
  const photos = await getRestaurantDisplayPhotos(restaurantId, providerPhotoRefs, 1)
  return photos[0] ?? null
}

export async function recordRestaurantSource(
  restaurantId: string,
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
  if (!restaurantId || !sourceId) return
  await (supabase.from('restaurant_sources') as any).upsert(
    {
      restaurant_id: restaurantId,
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
  restaurantId: string,
  sourceType: string,
  sourceId: string,
  detail: PlaceDetail
) {
  if (!restaurantId || !sourceId) return
  const now = new Date()
  const staleAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await (supabase as any).rpc('record_restaurant_provider_snapshot', {
    p_restaurant_id: restaurantId,
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
    p_attribution_text: sourceType === 'google_places' ? 'Google' : null,
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

export async function recordRestaurantObservation(input: {
  restaurantId?: string
  observationType: string
  observedValue: Record<string, unknown>
  sourceEntityType?: string
  sourceEntityId?: string
  confidence?: number
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  await (supabase.from('restaurant_observations') as any).insert({
    restaurant_id: input.restaurantId ?? null,
    user_id: userId,
    observation_type: input.observationType,
    observed_value: input.observedValue,
    source_type: 'first_party_user',
    source_entity_type: input.sourceEntityType ?? null,
    source_entity_id: input.sourceEntityId ?? null,
    confidence: input.confidence ?? 0.5,
  })
}

export async function submitRestaurantEditSuggestion(input: RestaurantSuggestionInput) {
  await recordRestaurantObservation({
    restaurantId: input.restaurantId,
    observationType: `metadata_correction:${input.field}`,
    observedValue: {
      field: input.field,
      current_value: input.currentValue ?? null,
      suggested_value: input.suggestedValue ?? null,
      issue_summary: input.issueSummary,
    },
    sourceEntityType: 'restaurant',
    sourceEntityId: input.restaurantId,
    confidence: 0.45,
  })

  await reportDataRepair({
    entityType: 'restaurant',
    entityId: input.restaurantId,
    restaurantId: input.restaurantId,
    repairType: `metadata_correction:${input.field}`,
    issueSummary: input.issueSummary,
    beforeSummary: { field: input.field, value: input.currentValue ?? null },
    afterSummary: { field: input.field, value: input.suggestedValue ?? null },
  })
}

export async function submitDuplicateRestaurantSuggestion(input: {
  restaurantId: string
  duplicateName?: string
  duplicateAddress?: string
  duplicateProvider?: string
  duplicateProviderPlaceId?: string
  reason?: string
}) {
  const reason = input.reason ?? 'possible_duplicate_reported_by_user'
  await recordRestaurantAlias({
    restaurantId: input.restaurantId,
    provider: input.duplicateProvider,
    providerPlaceId: input.duplicateProviderPlaceId,
    aliasName: input.duplicateName,
    aliasAddress: input.duplicateAddress,
    reason,
    confidence: 0.45,
  })
  await recordRestaurantMergeEvidence({
    canonicalRestaurantId: input.restaurantId,
    reason,
    confidence: 0.35,
    beforeSummary: {
      restaurant_id: input.restaurantId,
      duplicate_name: input.duplicateName ?? null,
      duplicate_address: input.duplicateAddress ?? null,
    },
    afterSummary: { status: 'reported_for_manual_review' },
    rollbackReference: 'no_merge_performed',
  })
}

export async function submitCommunityVerification(input: {
  restaurantId: string
  verificationType?: 'details_look_right' | 'visited_recently' | 'owner_content_seen'
  note?: string
}) {
  await recordRestaurantObservation({
    restaurantId: input.restaurantId,
    observationType: `community_verification:${input.verificationType ?? 'details_look_right'}`,
    observedValue: {
      verification_type: input.verificationType ?? 'details_look_right',
      note: input.note ?? null,
    },
    sourceEntityType: 'restaurant',
    sourceEntityId: input.restaurantId,
    confidence: 0.5,
  })
  await recordRestaurantAuditEvent({
    action: 'restaurant_community_verification_submitted',
    entityType: 'restaurant',
    entityId: input.restaurantId,
    restaurantId: input.restaurantId,
    sourceType: 'first_party_user',
    reason: input.verificationType ?? 'details_look_right',
    afterSummary: { status: 'pending_review' },
    complianceCategory: 'restaurant_data_independence',
  })
}

export async function recordRestaurantAuditEvent(input: {
  action: string
  entityType: string
  entityId?: string
  restaurantId?: string
  sourceType?: string
  reason?: string
  beforeSummary?: Record<string, unknown>
  afterSummary?: Record<string, unknown>
  complianceCategory?: string
}) {
  await (supabase.from('restaurant_audit_events') as any).insert({
    actor_type: 'client',
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    restaurant_id: input.restaurantId ?? null,
    source_type: input.sourceType ?? null,
    reason: input.reason ?? null,
    before_summary: input.beforeSummary ?? null,
    after_summary: input.afterSummary ?? null,
    compliance_category: input.complianceCategory ?? null,
  })
}

export async function submitRestaurantClaim(input: {
  restaurantId: string
  reason?: string
  evidenceSummary?: Record<string, unknown>
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return

  await (supabase.from('restaurant_ownership_events') as any).insert({
    restaurant_id: input.restaurantId,
    event_type: 'claim_submitted',
    actor_id: userId,
    new_owner_id: userId,
    source_type: 'owner_submitted',
    reason: input.reason ?? null,
    evidence_summary: input.evidenceSummary ?? {},
    status: 'pending',
  })
}

export async function recordRestaurantAlias(input: {
  restaurantId: string
  provider?: string
  providerPlaceId?: string
  aliasName?: string
  aliasAddress?: string
  reason: string
  confidence?: number
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return

  await (supabase.from('restaurant_aliases') as any).insert({
    restaurant_id: input.restaurantId,
    provider: input.provider ?? null,
    provider_place_id: input.providerPlaceId ?? null,
    alias_name: input.aliasName ?? null,
    alias_address: input.aliasAddress ?? null,
    reason: input.reason,
    confidence: input.confidence ?? 0.5,
    created_by: userId,
  })
}

export async function recordRestaurantMergeEvidence(input: {
  canonicalRestaurantId: string
  mergedRestaurantId?: string
  reason: string
  confidence?: number
  beforeSummary?: Record<string, unknown>
  afterSummary?: Record<string, unknown>
  rollbackReference?: string
}) {
  const { data: userData } = await supabase.auth.getUser()
  await (supabase.from('restaurant_merge_events') as any).insert({
    canonical_restaurant_id: input.canonicalRestaurantId,
    merged_restaurant_id: input.mergedRestaurantId ?? null,
    actor_id: userData.user?.id ?? null,
    reason: input.reason,
    confidence: input.confidence ?? 0.5,
    before_summary: input.beforeSummary ?? {},
    after_summary: input.afterSummary ?? {},
    rollback_reference: input.rollbackReference ?? null,
  })
}

export async function reportDataRepair(input: {
  entityType: 'restaurant' | 'post' | 'dish' | 'user'
  entityId?: string
  restaurantId?: string
  repairType: string
  issueSummary: string
  beforeSummary?: Record<string, unknown>
  afterSummary?: Record<string, unknown>
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return

  await (supabase.from('data_repair_events') as any).insert({
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    restaurant_id: input.restaurantId ?? null,
    actor_id: userId,
    repair_type: input.repairType,
    source_type: 'user_report',
    issue_summary: input.issueSummary,
    before_summary: input.beforeSummary ?? {},
    after_summary: input.afterSummary ?? {},
    status: 'reported',
  })
}
