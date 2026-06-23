import {
  fetchPlaceProviderDetail,
  fetchPlaceRow,
  fetchPlaceRowByGooglePlaceId,
  getPlaceDisplayPhoto,
  getPlaceProviderPhotoUrl,
  cachePlacePhotoRefs,
} from '@/lib/services/places'
import type { ProfilePlace } from './profileIdentity'

export function profilePlacePhotoKey(place: ProfilePlace): string {
  return place.placeId ?? place.id
}

export async function hydrateProfilePlacePhotos(
  places: ProfilePlace[]
): Promise<ProfilePlace[]> {
  return Promise.all(places.map(async place => {
    if (place.photoUrl) return place
    const directRow = await fetchPlaceRow(place.id).catch(() => null)
    const placeRow = !directRow && place.placeId
      ? await fetchPlaceRowByGooglePlaceId(place.placeId).catch(() => null)
      : null
    const row = directRow ?? placeRow
    const photoUrl = await getPlaceDisplayPhoto(
      row?.id ?? place.id,
      row?.google_photo_refs ?? []
    ).catch(() => null)
    if (photoUrl) return { ...place, photoUrl }

    const placeId = row?.google_place_id ?? place.placeId
    if (!placeId) return place
    const detail = await fetchPlaceProviderDetail(placeId, 'photos').catch(() => null)
    const freshRefs = (detail?.photos ?? [])
      .map(p => p.photo_reference)
      .filter((r): r is string => typeof r === 'string')
    const providerRefs = freshRefs.length > 0 ? freshRefs : (row?.google_photo_refs ?? [])
    const firstRef = providerRefs[0]
    const providerUrl = firstRef ? getPlaceProviderPhotoUrl(firstRef) : ''
    if (freshRefs.length > 0 && row?.id) {
      await cachePlacePhotoRefs(row.id, freshRefs).catch(() => null)
    }
    return providerUrl ? { ...place, photoUrl: providerUrl } : place
  }))
}
