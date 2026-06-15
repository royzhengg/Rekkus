import {
  buildGooglePlacePhotoUrl,
  fetchPlaceDetailsJson,
  fetchPlaceTextSearchJson,
} from '@/lib/services/googlePlaces'
import {
  isGooglePlaceDetail,
  isGooglePlaceIdResult,
  isGooglePlaceMetadata,
  type GooglePlaceDetail,
  type GooglePlaceMetadata,
} from '@/lib/services/googlePlacesGuards'

export type PlaceDetail = GooglePlaceMetadata
export type FullPlaceDetail = GooglePlaceDetail

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
