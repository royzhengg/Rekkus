import type { ProfilePlace } from '@/features/profile/profileIdentity'
import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'
import type { TopSpot } from '@/types/domain'
import {
  cachePlacePhotoRefs,
  fetchPlaceProviderDetail,
  getPlaceDisplayPhoto,
  getPlaceProviderPhotoUrl,
} from './places'

const GOOGLE_PHOTO_REF_TTL_MS = 30 * 24 * 60 * 60 * 1000

function isPlaceRow(value: unknown): value is {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  google_place_id: string | null
  google_photo_refs: string[] | null
  updated_at: string | null
} {
  return isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string'
}

function freshGooglePhotoRefs(googlePhotoRefs: string[], updatedAt: string | null): string[] {
  if (googlePhotoRefs.length === 0 || !updatedAt) return []
  const updatedTime = new Date(updatedAt).getTime()
  if (!Number.isFinite(updatedTime)) return []
  return Date.now() - updatedTime <= GOOGLE_PHOTO_REF_TTL_MS ? googlePhotoRefs : []
}

async function resolveTopSpotPhotoUrl(
  placeId: string,
  googlePlaceId: string | null,
  googlePhotoRefs: string[],
  updatedAt: string | null
): Promise<string | null> {
  const cachedPhotoRefs = freshGooglePhotoRefs(googlePhotoRefs, updatedAt)
  const displayPhoto = await getPlaceDisplayPhoto(placeId, cachedPhotoRefs).catch(() => null)
  if (displayPhoto) return displayPhoto

  if (!googlePlaceId) return null

  const detail = await fetchPlaceProviderDetail(googlePlaceId, 'photos').catch(() => null)
  const freshRefs = (detail?.photos ?? [])
    .map(photo => photo.photo_reference)
    .filter((ref): ref is string => typeof ref === 'string')
  const firstRef = freshRefs[0]
  const providerUrl = firstRef ? getPlaceProviderPhotoUrl(firstRef) : ''

  if (freshRefs.length > 0) {
    await cachePlacePhotoRefs(placeId, freshRefs).catch(() => null)
  }

  return providerUrl || null
}

export async function fetchTopSpotsWithDetails(userId: string): Promise<ProfilePlace[]> {
  try {
    const { data, error } = await supabase
      .from('user_top_spots')
      .select('position, place_id, places(id, name, address, latitude, longitude, google_place_id, google_photo_refs, updated_at)')
      .eq('user_id', userId)
      .order('position', { ascending: true })

    if (error || !data) return []

    const results: ProfilePlace[] = []
    for (const row of data) {
      const rawPlaces: unknown = row.places
      const r: unknown = Array.isArray(rawPlaces) ? rawPlaces[0] : rawPlaces
      if (!isPlaceRow(r)) continue
      const googlePhotoRefs = Array.isArray(r.google_photo_refs)
        ? r.google_photo_refs.filter((ref): ref is string => typeof ref === 'string')
        : []
      results.push({
        id: r.id,
        name: r.name,
        address: r.address,
        lat: r.latitude,
        lng: r.longitude,
        placeId: r.google_place_id,
        photoUrl: await resolveTopSpotPhotoUrl(r.id, r.google_place_id, googlePhotoRefs, r.updated_at),
        postCount: 0,
        avgFoodRating: null,
        lastPostedAt: null,
      })
    }
    return results
  } catch {
    return []
  }
}

export async function saveTopSpots(userId: string, spots: TopSpot[]): Promise<void> {
  if (spots.length > 3) throw new Error('Top spots limited to 3')

  const { error: deleteError } = await supabase
    .from('user_top_spots')
    .delete()
    .eq('user_id', userId)

  if (deleteError) throw deleteError

  if (spots.length === 0) return

  const { error: insertError } = await supabase
    .from('user_top_spots')
    .insert(spots.map(s => ({ user_id: userId, position: s.position, place_id: s.placeId })))

  if (insertError) throw insertError
}

export async function clearTopSpots(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_top_spots')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}
