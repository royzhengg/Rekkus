import type { Post, RekkusOccasionTag } from '@/types/domain'

export type PersonResult = {
  username: string
  displayName: string
  initials: string
  avatarBg: string
  avatarColor: string
  followers: string
  followerCount?: number
}

export type PlaceResult = {
  id: string
  name: string
  address: string | null
  city: string | null
  suburb?: string | null
  cuisine_type: string | null
  cuisine_slug?: string | null
  google_place_id: string | null
  osm_id?: string | null
  slug?: string | null
  latitude: number | null
  longitude: number | null
  google_rating: number | null
  google_review_count: number | null
  open_now?: boolean | null
  verification_level?: string | null
  primary_photo_source?: string | null
  hint?: string | null
  badges?: string[]
  top_dishes?: string[]
  postCount?: number
  createdAt?: string | null
  firstPostedAt?: string | null
  latestPostedAt?: string | null
  fromGoogle?: boolean
  occasion_tags?: string[]
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
  sort?: SearchSortMode
  // OSM feature filters
  dietary_flag?: string | null    // e.g. 'halal' | 'vegan' | 'vegetarian'
  wheelchair?: string | null      // 'yes' | 'limited'
  takeaway?: boolean | null
  delivery?: boolean | null
  outdoor_seating?: boolean | null
}

export type SearchSuggestionType = 'place' | 'dish' | 'hashtag' | 'post' | 'area' | 'tag'

export type SearchSuggestion = {
  suggestion_type: SearchSuggestionType
  display_text: string
  secondary_text: string
  entity_id: string | null
  score: number
}

export type DishResult = {
  id: string
  name: string
  cuisine_type: string | null
  top_photo_url: string | null
  save_count: number
  post_count: number
  firstPostedAt?: string | null
  latestPostedAt?: string | null
}

export type TopFeedItem =
  | { kind: 'post'; data: Post }
  | { kind: 'place'; data: PlaceResult; distanceKm?: number }
  | { kind: 'person'; data: PersonResult }
  | { kind: 'dish'; data: DishResult }

export type UserLocation = { lat: number; lng: number } | null

export type SearchOptions = {
  mode?: SearchMode | undefined
  radiusKm?: number | undefined
  userId?: string | null | undefined
  filters?: SearchFilters | undefined
  sessionId?: string | null | undefined
}

export type SearchUserResult = {
  id: string
  username: string
  full_name: string | null
  follower_count: number
  post_count: number
}

// Raw row returned by search_semantic RPC
export type SemanticResultRow = {
  entity_type: 'post' | 'place' | 'dish'
  entity_id: string
  semantic_similarity: number
  final_score: number
  display_data: Record<string, unknown>
}
