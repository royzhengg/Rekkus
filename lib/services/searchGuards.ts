import type { DishResult, PlaceResult, SearchSuggestion } from '@/lib/hooks/searchTypes'
import { isRecord } from '../utils/safeJson'

type RawPlaceResult = PlaceResult & {
  post_count?: number
  created_at?: string | null
  first_posted_at?: string | null
  latest_posted_at?: string | null
}

type RawDishResult = DishResult & {
  first_posted_at?: string | null
  latest_posted_at?: string | null
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

function optionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || nullableString(value)
}

function optionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === 'number'
}

export function isPlaceResult(value: unknown): value is RawPlaceResult {
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
    nullableNumber(value.google_review_count) &&
    optionalNumber(value.post_count) &&
    optionalNullableString(value.created_at) &&
    optionalNullableString(value.first_posted_at) &&
    optionalNullableString(value.latest_posted_at)
  )
}

export function parsePlaceResults(value: unknown): PlaceResult[] {
  if (!Array.isArray(value)) return []
  return value.filter(isPlaceResult).map(mapPlaceResult)
}

function mapPlaceResult(row: RawPlaceResult): PlaceResult {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    cuisine_type: row.cuisine_type,
    google_place_id: row.google_place_id,
    latitude: row.latitude,
    longitude: row.longitude,
    google_rating: row.google_rating,
    google_review_count: row.google_review_count,
    ...(row.suburb !== undefined ? { suburb: row.suburb } : {}),
    ...(row.open_now !== undefined ? { open_now: row.open_now } : {}),
    ...(row.hint !== undefined ? { hint: row.hint } : {}),
    ...(row.badges !== undefined ? { badges: row.badges } : {}),
    ...(row.top_dishes !== undefined ? { top_dishes: row.top_dishes } : {}),
    ...(row.fromGoogle !== undefined ? { fromGoogle: row.fromGoogle } : {}),
    ...(row.post_count !== undefined ? { postCount: row.post_count } : {}),
    ...(row.created_at !== undefined ? { createdAt: row.created_at } : {}),
    ...(row.first_posted_at !== undefined ? { firstPostedAt: row.first_posted_at } : {}),
    ...(row.latest_posted_at !== undefined ? { latestPostedAt: row.latest_posted_at } : {}),
  }
}

export function isSearchSuggestion(value: unknown): value is SearchSuggestion {
  return (
    isRecord(value) &&
    (
      value.suggestion_type === 'restaurant' ||
      value.suggestion_type === 'dish' ||
      value.suggestion_type === 'hashtag' ||
      value.suggestion_type === 'post' ||
      value.suggestion_type === 'area' ||
      value.suggestion_type === 'tag'
    ) &&
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

export function isDishResult(value: unknown): value is RawDishResult {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    nullableString(value.cuisine_type) &&
    nullableString(value.top_photo_url) &&
    typeof value.save_count === 'number' &&
    typeof value.post_count === 'number' &&
    optionalNullableString(value.first_posted_at) &&
    optionalNullableString(value.latest_posted_at)
  )
}

export function parseDishResults(value: unknown): DishResult[] {
  if (!Array.isArray(value)) return []
  return value.filter(isDishResult).map(row => ({
    id: row.id,
    name: row.name,
    cuisine_type: row.cuisine_type,
    top_photo_url: row.top_photo_url,
    save_count: row.save_count,
    post_count: row.post_count,
    ...(row.first_posted_at !== undefined ? { firstPostedAt: row.first_posted_at } : {}),
    ...(row.latest_posted_at !== undefined ? { latestPostedAt: row.latest_posted_at } : {}),
  }))
}
