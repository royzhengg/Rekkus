import { reportInvalidBoundary } from '@/lib/services/boundaryTelemetry'
import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'

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
  } | null
}

export type SavedPlaceWithPlace = SavedPlace

const SAVED_PLACE_SELECT =
  'id, place_id, created_at, places(name, address, latitude, longitude, google_place_id)'

export async function fetchSavedPlacesForUser(userId: string): Promise<SavedPlace[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select(SAVED_PLACE_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  const savedPlaces = normalizeSavedPlaces(data)
  if (Array.isArray(data) && savedPlaces.length !== data.length) {
    reportInvalidBoundary('saved_place_row_invalid')
  }
  return savedPlaces
}

export function normalizeSavedPlaces(value: unknown): SavedPlace[] {
  if (!Array.isArray(value)) return []
  return value.map(parseSavedPlace).filter((row): row is SavedPlace => row !== null)
}

export function isSavedPlaceList(value: unknown): value is SavedPlace[] {
  return Array.isArray(value) && value.every(row => parseSavedPlace(row) !== null)
}

function parseSavedPlace(value: unknown): SavedPlace | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.place_id !== 'string' ||
    typeof value.created_at !== 'string'
  ) return null
  const places = value.places
  const joined: unknown = Array.isArray(places) ? places[0] : places
  if (joined !== null && joined !== undefined && (!isRecord(joined) || typeof joined.name !== 'string')) return null
  return {
    id: value.id,
    place_id: value.place_id,
    created_at: value.created_at,
    places: joined && isRecord(joined) && typeof joined.name === 'string' ? {
      name: joined.name,
      address: typeof joined.address === 'string' ? joined.address : null,
      latitude: typeof joined.latitude === 'number' ? joined.latitude : null,
      longitude: typeof joined.longitude === 'number' ? joined.longitude : null,
      google_place_id: typeof joined.google_place_id === 'string' ? joined.google_place_id : null,
    } : null,
  }
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
