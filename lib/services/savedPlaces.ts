import { reportInvalidBoundary } from '@/lib/services/boundaryTelemetry'
import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'
import { fetchPlaceProviderDetail, getPlaceProviderPhotoUrl } from './places/google'
import { getPlaceDisplayPhoto } from './places/photos'

export type SavedPlace = {
  id: string
  place_id: string
  created_at: string
  places: {
    name: string
    address: string | null
    latitude: number | null
    longitude: number | null
    google_place_id: string | null
    photoUrl: string | null
  } | null
}

export type SavedPlaceWithPlace = SavedPlace

export type FetchSavedPlacesOptions = {
  providerPhotoFallbackLimit?: number
}

const SAVED_PLACE_SELECT =
  'id, place_id, created_at, places(name, address, latitude, longitude, google_place_id, google_photo_refs)'

export async function fetchSavedPlacesForUser(
  userId: string,
  options: FetchSavedPlacesOptions = {}
): Promise<SavedPlace[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select(SAVED_PLACE_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  const parsedRows = parseSavedPlaceRows(data)
  if (Array.isArray(data) && parsedRows.length !== data.length) {
    reportInvalidBoundary('saved_place_row_invalid')
  }
  return hydrateSavedPlaceThumbnails(parsedRows, options.providerPhotoFallbackLimit ?? 0)
}

export function normalizeSavedPlaces(value: unknown): SavedPlace[] {
  if (!Array.isArray(value)) return []
  return parseSavedPlaceRows(value).map(row => row.savedPlace)
}

export function isSavedPlaceList(value: unknown): value is SavedPlace[] {
  return Array.isArray(value) && value.every(row => parseSavedPlace(row) !== null)
}

type ParsedSavedPlace = {
  googlePhotoRefs: string[]
  savedPlace: SavedPlace
}

function parseSavedPlaceRows(value: unknown): ParsedSavedPlace[] {
  if (!Array.isArray(value)) return []
  return value.map(parseSavedPlaceRow).filter((row): row is ParsedSavedPlace => row !== null)
}

function parseSavedPlace(value: unknown): SavedPlace | null {
  return parseSavedPlaceRow(value)?.savedPlace ?? null
}

function parseSavedPlaceRow(value: unknown): ParsedSavedPlace | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.place_id !== 'string' ||
    typeof value.created_at !== 'string'
  ) return null
  const places = value.places
  const joined: unknown = Array.isArray(places) ? places[0] : places
  if (joined !== null && joined !== undefined && (!isRecord(joined) || typeof joined.name !== 'string')) return null
  const googlePhotoRefs = joined && isRecord(joined) && Array.isArray(joined.google_photo_refs)
    ? joined.google_photo_refs.filter((ref): ref is string => typeof ref === 'string')
    : []
  return {
    googlePhotoRefs,
    savedPlace: {
      id: value.id,
      place_id: value.place_id,
      created_at: value.created_at,
      places: joined && isRecord(joined) && typeof joined.name === 'string' ? {
        name: joined.name,
        address: typeof joined.address === 'string' ? joined.address : null,
        latitude: typeof joined.latitude === 'number' ? joined.latitude : null,
        longitude: typeof joined.longitude === 'number' ? joined.longitude : null,
        google_place_id: typeof joined.google_place_id === 'string' ? joined.google_place_id : null,
        photoUrl: googlePhotoRefs[0]
          ? getPlaceProviderPhotoUrl(googlePhotoRefs[0]) || null
          : null,
      } : null,
    },
  }
}

async function hydrateSavedPlaceThumbnails(
  rows: ParsedSavedPlace[],
  providerPhotoFallbackLimit: number
): Promise<SavedPlace[]> {
  return Promise.all(rows.map(async (row, index) => {
    const place = row.savedPlace.places
    if (!place) return row.savedPlace

    const displayPhoto = await getPlaceDisplayPhoto(row.savedPlace.place_id, row.googlePhotoRefs).catch(() => null)
    if (displayPhoto) return savedPlaceWithPhoto(row.savedPlace, displayPhoto)

    if (index >= providerPhotoFallbackLimit || !place.google_place_id) return row.savedPlace

    const detail = await fetchPlaceProviderDetail(place.google_place_id, 'photos').catch(() => null)
    const freshRefs = (detail?.photos ?? [])
      .map(photo => photo.photo_reference)
      .filter((ref): ref is string => typeof ref === 'string')
    const firstRef = freshRefs[0]
    const providerUrl = firstRef ? getPlaceProviderPhotoUrl(firstRef) : ''
    if (freshRefs.length > 0) {
      await cacheSavedPlacePhotoRefs(row.savedPlace.place_id, freshRefs).catch(() => null)
    }
    return providerUrl ? savedPlaceWithPhoto(row.savedPlace, providerUrl) : row.savedPlace
  }))
}

function savedPlaceWithPhoto(savedPlace: SavedPlace, photoUrl: string): SavedPlace {
  if (!savedPlace.places) return savedPlace
  return {
    ...savedPlace,
    places: {
      ...savedPlace.places,
      photoUrl,
    },
  }
}

async function cacheSavedPlacePhotoRefs(placeId: string, googlePhotoRefs: string[]): Promise<void> {
  await supabase.from('places')
    .update({ google_photo_refs: googlePhotoRefs })
    .eq('id', placeId)
}

export async function fetchSavedPlaceIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('place_id')
    .eq('user_id', userId)
    .limit(200)
  if (error) throw error
  return ((data ?? []) as Array<{ place_id: string }>).map(row => row.place_id)
}
