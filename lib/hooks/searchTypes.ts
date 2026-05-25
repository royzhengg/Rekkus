import type { RekkusOccasionTag, RekkusValueVerdict, PostMediaType } from '@/types/domain'

export type PersonResult = {
  username: string
  displayName: string
  initials: string
  avatarBg: string
  avatarColor: string
  followers: string
}

export type PlaceResult = {
  id: string
  name: string
  address: string | null
  city: string | null
  suburb?: string | null
  cuisine_type: string | null
  google_place_id: string | null
  latitude: number | null
  longitude: number | null
  google_rating: number | null
  google_review_count: number | null
  open_now?: boolean | null
  hint?: string | null
  badges?: string[]
  fromGoogle?: boolean
}

export type SearchMode = 'search' | 'aroundMe'

export type SearchSortMode =
  | 'best_match'
  | 'nearby'
  | 'newest'
  | 'most_saved'
  | 'highest_rekkus_picks'

export type SearchFilters = {
  cuisine?: string | null
  occasions?: RekkusOccasionTag[]
  values?: RekkusValueVerdict[]
  mediaTypes?: Array<PostMediaType | 'mixed'>
  openNow?: boolean
  sort?: SearchSortMode
}

export type SearchSuggestion = {
  suggestion_type: 'restaurant' | 'dish' | 'hashtag'
  display_text: string
  secondary_text: string
  entity_id: string | null
  score: number
}

export type UserLocation = { lat: number; lng: number } | null

export type SearchOptions = {
  mode?: SearchMode | undefined
  radiusKm?: number | undefined
  userId?: string | null | undefined
  filters?: SearchFilters | undefined
}
