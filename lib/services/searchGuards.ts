import type { PlaceResult, SearchSuggestion } from '@/lib/hooks/searchTypes'
import { isRecord } from '../utils/safeJson'

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

export function isPlaceResult(value: unknown): value is PlaceResult {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    nullableString(value.address) &&
    nullableString(value.city) &&
    nullableString(value.cuisine_type) &&
    nullableString(value.google_place_id) &&
    nullableNumber(value.latitude) &&
    nullableNumber(value.longitude) &&
    nullableNumber(value.google_rating) &&
    nullableNumber(value.google_review_count)
  )
}

export function parsePlaceResults(value: unknown): PlaceResult[] {
  return Array.isArray(value) ? value.filter(isPlaceResult) : []
}

export function isSearchSuggestion(value: unknown): value is SearchSuggestion {
  return (
    isRecord(value) &&
    (value.suggestion_type === 'restaurant' || value.suggestion_type === 'dish' || value.suggestion_type === 'hashtag') &&
    typeof value.display_text === 'string' &&
    typeof value.secondary_text === 'string' &&
    nullableString(value.entity_id) &&
    typeof value.score === 'number'
  )
}

export function parseSearchSuggestions(value: unknown): SearchSuggestion[] {
  return Array.isArray(value) ? value.filter(isSearchSuggestion) : []
}

export type RankedPostId = { id: string; rank: number }
export type DishPostId = RankedPostId & { match_source: string }

export function parseRankedPostIds(value: unknown): RankedPostId[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is RankedPostId =>
    isRecord(row) && typeof row.id === 'string' && typeof row.rank === 'number'
  )
}

export function parseDishPostIds(value: unknown): DishPostId[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is DishPostId =>
    isRecord(row) && typeof row.id === 'string' && typeof row.rank === 'number' && typeof row.match_source === 'string'
  )
}
