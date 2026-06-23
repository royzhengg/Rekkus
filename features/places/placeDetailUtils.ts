import { fetchPlaceIdByTextSearch, fetchPlaceProviderDetail } from '@/lib/services/places'
import type { PlaceDetail } from './placeTypes'

export type PlaceAction = 'suggest_edit' | 'report_duplicate' | 'verify_info' | 'claim_place'
export type DbRatings = { food: number | null; vibe: number | null; cost: number | null }

export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export function weightedAvg(rows: Array<{ rating: number | null; created_at: string }>): number | null {
  let sum = 0
  let total = 0
  for (const { rating, created_at } of rows) {
    if (rating == null) continue
    const w = Date.now() - new Date(created_at).getTime() <= NINETY_DAYS_MS ? 2 : 1
    sum += rating * w
    total += w
  }
  return total > 0 ? sum / total : null
}

export async function textSearchPlace(query: string): Promise<string | null> {
  return fetchPlaceIdByTextSearch(query)
}

export async function fetchPlaceDetail(googlePlaceId: string): Promise<PlaceDetail | null> {
  const fields =
    'rating,user_ratings_total,formatted_phone_number,website,opening_hours,price_level,photos,types,business_status,geometry'
  return fetchPlaceProviderDetail(googlePlaceId, fields)
}
