import {
  fetchRestaurantProviderDetail,
  fetchPlaceRow,
  fetchPlaceRowByGooglePlaceId,
  getPlaceDisplayPhoto,
  getRestaurantProviderPhotoUrl,
} from '@/lib/services/places'
import type { ProfileRestaurant } from './profileIdentity'

export function profileRestaurantPhotoKey(restaurant: ProfileRestaurant): string {
  return restaurant.placeId ?? restaurant.id
}

export async function hydrateProfileRestaurantPhotos(
  restaurants: ProfileRestaurant[]
): Promise<ProfileRestaurant[]> {
  return Promise.all(restaurants.map(async restaurant => {
    if (restaurant.photoUrl) return restaurant
    const directRow = await fetchPlaceRow(restaurant.id).catch(() => null)
    const placeRow = !directRow && restaurant.placeId
      ? await fetchPlaceRowByGooglePlaceId(restaurant.placeId).catch(() => null)
      : null
    const row = directRow ?? placeRow
    const photoUrl = await getPlaceDisplayPhoto(
      row?.id ?? restaurant.id,
      row?.google_photo_refs ?? []
    ).catch(() => null)
    if (photoUrl) return { ...restaurant, photoUrl }

    const placeId = row?.google_place_id ?? restaurant.placeId
    if (!placeId) return restaurant
    const detail = await fetchRestaurantProviderDetail(placeId, 'photos').catch(() => null)
    const freshRefs = (detail?.photos ?? [])
      .map(p => p.photo_reference)
      .filter((r): r is string => typeof r === 'string')
    const providerRefs = freshRefs.length > 0 ? freshRefs : (row?.google_photo_refs ?? [])
    const firstRef = providerRefs[0]
    const providerUrl = firstRef ? getRestaurantProviderPhotoUrl(firstRef) : ''
    return providerUrl ? { ...restaurant, photoUrl: providerUrl } : restaurant
  }))
}
