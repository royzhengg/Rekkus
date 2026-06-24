import type {
  DiscoveryModule,
  SearchIntent,
  SearchLocationSource,
  SearchSort,
  SearchSuggestionType,
} from './filterContracts'

export const SEARCH_RANKING_VERSION = 'search_v1'

export const SEARCH_RADIUS_OPTIONS = [2, 5, 10, 25, 50] as const

export const DEFAULT_SEARCH_RADIUS_KM = 10

export const SEARCH_SORT_OPTIONS: readonly SearchSort[] = [
  'best_match',
  'nearby',
  'popular',
  'newest',
] as const

export const SEARCH_INTENT_OPTIONS: readonly SearchIntent[] = [
  'all',
  'dishes',
  'collections',
  'places',
  'posts',
  'people',
] as const

export const SEARCH_LOCATION_SOURCE_OPTIONS: readonly Exclude<SearchLocationSource, null>[] = [
  'current',
  'manual',
  'profile',
] as const

export const SEARCH_SUGGESTION_TYPE_PRIORITY: readonly SearchSuggestionType[] = [
  'food_category',
  'cuisine',
  'occasion',
  'collection',
  'place',
  'user',
] as const

export const DISCOVERY_MODULES: readonly DiscoveryModule[] = [
  'near_you',
  'quick_discovery',
  'personal_suggestions',
  'for_you',
  'trending',
  'popular_collections',
  'popular_dishes',
  'popular_places',
  'top_creators',
] as const

export const MAX_SAVED_SEARCHES = 50

export const MAX_SEARCH_SESSION_STEPS = 20
