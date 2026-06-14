import { reportInvalidBoundary } from '@/lib/services/boundaryTelemetry'
import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'

export type SavedLocation = {
  id: string
  restaurant_id: string
  created_at: string
  restaurants: {
    name: string
    address: string | null
    latitude: number | null
    longitude: number | null
    google_place_id: string | null
  } | null
}

export type SavedLocationWithRestaurant = SavedLocation

const SAVED_LOCATION_SELECT =
  'id, restaurant_id, created_at, restaurants(name, address, latitude, longitude, google_place_id)'

export async function fetchSavedLocationsForUser(userId: string): Promise<SavedLocation[]> {
  const { data, error } = await supabase
    .from('saved_locations')
    .select(SAVED_LOCATION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  const savedLocations = normalizeSavedLocations(data)
  if (Array.isArray(data) && savedLocations.length !== data.length) {
    reportInvalidBoundary('saved_location_row_invalid')
  }
  return savedLocations
}

export function normalizeSavedLocations(value: unknown): SavedLocation[] {
  if (!Array.isArray(value)) return []
  return value.map(parseSavedLocation).filter((row): row is SavedLocation => row !== null)
}

export function isSavedLocationList(value: unknown): value is SavedLocation[] {
  return Array.isArray(value) && value.every(row => parseSavedLocation(row) !== null)
}

function parseSavedLocation(value: unknown): SavedLocation | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.restaurant_id !== 'string' ||
    typeof value.created_at !== 'string'
  ) return null
  const restaurants = value.restaurants
  const joined: unknown = Array.isArray(restaurants) ? restaurants[0] : restaurants
  if (joined !== null && joined !== undefined && (!isRecord(joined) || typeof joined.name !== 'string')) return null
  return {
    id: value.id,
    restaurant_id: value.restaurant_id,
    created_at: value.created_at,
    restaurants: joined && isRecord(joined) && typeof joined.name === 'string' ? {
      name: joined.name,
      address: typeof joined.address === 'string' ? joined.address : null,
      latitude: typeof joined.latitude === 'number' ? joined.latitude : null,
      longitude: typeof joined.longitude === 'number' ? joined.longitude : null,
      google_place_id: typeof joined.google_place_id === 'string' ? joined.google_place_id : null,
    } : null,
  }
}

export async function fetchSavedRestaurantIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_locations')
    .select('restaurant_id')
    .eq('user_id', userId)
    .limit(200)
  if (error) throw error
  return (data ?? []).map(row => row.restaurant_id)
}
