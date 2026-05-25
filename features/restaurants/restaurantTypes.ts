export const PHOTO_HEIGHT = 220

export type PostSort = 'liked' | 'newest' | 'oldest'

export const SORT_LABELS: Record<PostSort, string> = {
  liked: 'Most liked',
  newest: 'Newest',
  oldest: 'Oldest',
}

export type PlaceDetail = {
  rating?: number
  user_ratings_total?: number
  formatted_phone_number?: string
  website?: string
  price_level?: number
  types?: string[]
  business_status?: string
  opening_hours?: {
    open_now?: boolean
    weekday_text?: string[]
  }
  photos?: { photo_reference?: string }[]
  geometry?: { location: { lat: number; lng: number } }
}

export function formatCategory(types: string[] | undefined): string {
  if (!types) return ''
  const skip = new Set(['establishment', 'food', 'point_of_interest', 'store', 'premise'])
  const found = types.find(t => !skip.has(t))
  if (!found) return ''
  return found.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatPriceLevel(level: number | undefined): string {
  if (level == null) return ''
  return '$'.repeat(Math.max(1, level))
}
