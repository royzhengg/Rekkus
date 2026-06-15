import type { ParsedQuery } from '@/lib/utils/queryParser'
import type {
  SearchFallbackDecision,
  SearchFallbackReason,
  SearchIntentKind,
  SearchLocationSource,
} from '@/lib/utils/searchIntent'
import type { Post, RekkusOccasionTag, RekkusValueVerdict, PostMediaType } from '@/types/domain'

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
  google_place_id: string | null
  latitude: number | null
  longitude: number | null
  google_rating: number | null
  google_review_count: number | null
  open_now?: boolean | null
  hint?: string | null
  badges?: string[]
  top_dishes?: string[]
  postCount?: number
  createdAt?: string | null
  firstPostedAt?: string | null
  latestPostedAt?: string | null
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

export type UserLocation = { lat: number; lng: number } | null

export type SearchOptions = {
  mode?: SearchMode | undefined
  radiusKm?: number | undefined
  userId?: string | null | undefined
  filters?: SearchFilters | undefined
  locationSource?: SearchLocationSource | undefined
}

export type SearchBounds = {
  min_lat: number
  max_lat: number
  min_lng: number
  max_lng: number
}

export type SearchUserResult = {
  id: string
  username: string
  full_name: string | null
  follower_count: number
  post_count: number
}

export type SearchProviderPrediction = {
  place_id: string
  structured_formatting: { main_text: string; secondary_text: string }
  types: string[]
}

export type RankedPostCandidate = { id: string; rank: number }
export type DishPostCandidate = RankedPostCandidate & { match_source: string }
export type SearchExpansionCandidate = { cuisine_type: string; match_count: number }

export type SearchContext = {
  rawQuery: string
  query: string
  words: string[]
  parsed: ParsedQuery
  intent: SearchIntentKind
  mode: SearchMode
  radiusKm: number
  userId: string | null
  filters: SearchFilters | undefined
  userLocation: UserLocation
  locationSource: SearchLocationSource
  suburbFilter: string | undefined
  bounds: SearchBounds | undefined
  hasQuery: boolean
  isAroundMe: boolean
  dishIntentActive: boolean
  dishQuery: string
  placeQuery: string
}

export type SearchCandidateKind = 'post' | 'dish' | 'place' | 'person'

export type SearchRankingReason =
  | 'source_rank'
  | 'intent_entity_weight'
  | 'local_source'
  | 'expanded_source'
  | 'provider_source'
  | 'exact_match'
  | 'nearby_signal'
  | 'popular_nearby'
  | 'keyword_stuffing_penalty'
  | 'freshness_boost'
  | 'cold_start_exposure'
  | 'popularity_decay'
  | 'personalized_signal'
  | 'trending_signal'
  | 'diversity_prelude'

export type SearchDiversitySlot = 'top_dish' | 'top_post' | 'top_place'

export type SearchExplanationBadge =
  | 'Exact match'
  | 'Near you'
  | 'Popular nearby'
  | 'Trending'

export type SearchPersonalizationReason =
  | 'recent_search'
  | 'saved_place'
  | 'saved_dish'
  | 'saved_post'
  | 'recent_area'
  | 'recent_cuisine'

export type SearchGraphEvidence = {
  servingRestaurantIds: string[]
  servingRestaurantCount: number
  supportingPostIds: string[]
}

type SearchCandidateMetadata = {
  personalizationBoost?: number
  personalizationReasons?: SearchPersonalizationReason[]
  graphEvidence?: SearchGraphEvidence
  trendingScore?: number
}

export type SearchCandidatePayload =
  | ({
      kind: 'post'
      id: string
      source: 'post_fts' | 'dish_post'
      rank: number
      createdAt?: string | null
      matchSource?: string
    } & SearchCandidateMetadata)
  | ({
      kind: 'dish'
      id: string
      source: 'dish_fts'
      rank: number
      item: DishResult
    } & SearchCandidateMetadata)
  | ({
      kind: 'place'
      id: string
      source: 'local' | 'expanded' | 'provider'
      rank: number
      item: PlaceResult
    } & SearchCandidateMetadata)
  | ({
      kind: 'person'
      id: string
      source: 'user'
      rank: number
      item: SearchUserResult
    } & SearchCandidateMetadata)

export type SearchCandidate = SearchCandidatePayload & {
  rankingScore: number
  rankingReasons: SearchRankingReason[]
  explanationBadges: SearchExplanationBadge[]
  diversitySlot?: SearchDiversitySlot
}

export type SearchPipelineResult = {
  context: SearchContext
  users: SearchUserResult[]
  places: PlaceResult[]
  postFts: RankedPostCandidate[]
  dishPosts: DishPostCandidate[]
  dishEntities: DishResult[]
  expansionCuisines: SearchExpansionCandidate[]
  expandedPosts: Post[]
  expandedPlaces: PlaceResult[]
  providerPredictions: SearchProviderPrediction[]
  providerFallbackDecision: SearchFallbackDecision
  providerFallbackSuppressed: boolean
  providerFallbackReason: SearchFallbackReason
  candidates: SearchCandidate[]
}
