import type { RekkusOccasionTag } from '@/types/domain'
import {
  DEFAULT_SEARCH_RADIUS_KM,
  MAX_SEARCH_SESSION_STEPS,
  SEARCH_RADIUS_OPTIONS,
  SEARCH_RANKING_VERSION,
} from './searchConstants'

export type SearchEntityType =
  | 'dish'
  | 'place'
  | 'collection'
  | 'post'
  | 'person'

export type SearchIntent =
  | 'all'
  | 'dishes'
  | 'places'
  | 'collections'
  | 'posts'
  | 'people'

export type SearchResultType = SearchEntityType

export type SearchSort =
  | 'best_match'
  | 'nearby'
  | 'popular'
  | 'newest'

export type SearchSuggestionType =
  | 'food_category'
  | 'cuisine'
  | 'occasion'
  | 'collection'
  | 'place'
  | 'user'

export type SearchViewState =
  | 'discovery'
  | 'suggestions'
  | 'results'
  | 'empty'

export type SearchLocationSource =
  | 'current'
  | 'manual'
  | 'profile'
  | null

export type DiscoveryModule =
  | 'near_you'
  | 'quick_discovery'
  | 'personal_suggestions'
  | 'for_you'
  | 'trending'
  | 'popular_collections'
  | 'popular_dishes'
  | 'popular_places'
  | 'top_creators'

export type SearchRankingReason =
  | 'popular_nearby'
  | 'saved_by_many'
  | 'matches_taxonomy'
  | 'trending_this_week'
  | 'recent_activity'
  | 'matches_place'
  | 'matches_collection'
  | 'matches_occasion'

export type SearchFilters = {
  sort: SearchSort
  intent: SearchIntent
  radiusKm: (typeof SEARCH_RADIUS_OPTIONS)[number]
  locationSource: SearchLocationSource
  taxonomies: {
    cuisine: string[]
    foodCategory: string[]
    venueType: string[]
    dietary: string[]
  }
  traits: {
    openNow: boolean
    takeaway: boolean
    delivery: boolean
    outdoorSeating: boolean
    wheelchair: 'yes' | 'limited' | null
  }
  occasions: RekkusOccasionTag[]
}

export type SearchSuggestion = {
  type: SearchSuggestionType
  id: string
  slug: string
  label: string
  detail?: string
}

export type SearchResult = {
  type: SearchResultType
  id: string
  rankingReasons?: SearchRankingReason[]
}

export type SearchResponse = {
  rankingVersion: string
  results: SearchResult[]
  suggestions?: SearchSuggestion[]
  totalCount?: number
  nextCursor?: string | null
}

export type SearchSessionStep = {
  query?: string
  intent?: SearchIntent
  filterHash?: string
}

export type SearchSession = {
  id: string
  startedAt: number
  steps: SearchSessionStep[]
}

export type SearchQueryClassification =
  | 'discovery'
  | 'food'
  | 'place'
  | 'collection'
  | 'occasion'
  | 'creator'
  | 'general'

type UnknownRecord = Record<string, unknown>

export const defaultSearchFilters: SearchFilters = {
  sort: 'best_match',
  intent: 'all',
  radiusKm: DEFAULT_SEARCH_RADIUS_KM,
  locationSource: null,
  taxonomies: {
    cuisine: [],
    foodCategory: [],
    venueType: [],
    dietary: [],
  },
  traits: {
    openNow: false,
    takeaway: false,
    delivery: false,
    outdoorSeating: false,
    wheelchair: null,
  },
  occasions: [],
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

function occasionArray(value: unknown): RekkusOccasionTag[] {
  return stringArray(value) as RekkusOccasionTag[]
}

function normalizeSort(value: unknown): SearchSort {
  if (value === 'nearby' || value === 'newest') return value
  if (value === 'popular' || value === 'most_saved' || value === 'highest_rekkus_picks') return 'popular'
  return 'best_match'
}

function normalizeIntent(value: unknown): SearchIntent {
  if (
    value === 'all' ||
    value === 'dishes' ||
    value === 'places' ||
    value === 'collections' ||
    value === 'posts' ||
    value === 'people'
  ) return value
  return 'all'
}

function normalizeRadius(value: unknown): SearchFilters['radiusKm'] {
  if (typeof value !== 'number') return DEFAULT_SEARCH_RADIUS_KM
  return SEARCH_RADIUS_OPTIONS.includes(value as SearchFilters['radiusKm'])
    ? value as SearchFilters['radiusKm']
    : DEFAULT_SEARCH_RADIUS_KM
}

function normalizeLocationSource(value: unknown): SearchLocationSource {
  if (value === 'current' || value === 'manual' || value === 'profile') return value
  return null
}

function normalizeWheelchair(value: unknown): SearchFilters['traits']['wheelchair'] {
  return value === 'yes' || value === 'limited' ? value : null
}

export function normalizeSearchFilters(value: unknown): SearchFilters {
  if (!isRecord(value)) return defaultSearchFilters

  const taxonomies = isRecord(value.taxonomies) ? value.taxonomies : {}
  const traits = isRecord(value.traits) ? value.traits : {}

  const legacyCuisine = typeof value.cuisine === 'string' && value.cuisine.trim()
    ? [value.cuisine.trim()]
    : []
  const legacyDietary = typeof value.dietary_flag === 'string' && value.dietary_flag.trim()
    ? [value.dietary_flag.trim()]
    : []

  return {
    sort: normalizeSort(value.sort),
    intent: normalizeIntent(value.intent),
    radiusKm: normalizeRadius(value.radiusKm),
    locationSource: normalizeLocationSource(value.locationSource),
    taxonomies: {
      cuisine: [...legacyCuisine, ...stringArray(taxonomies.cuisine)],
      foodCategory: stringArray(taxonomies.foodCategory),
      venueType: stringArray(taxonomies.venueType),
      dietary: [...legacyDietary, ...stringArray(taxonomies.dietary)],
    },
    traits: {
      openNow: traits.openNow === true || value.open_now === true,
      takeaway: traits.takeaway === true || value.takeaway === true,
      delivery: traits.delivery === true || value.delivery === true,
      outdoorSeating: traits.outdoorSeating === true || value.outdoor_seating === true,
      wheelchair: normalizeWheelchair(traits.wheelchair ?? value.wheelchair),
    },
    occasions: occasionArray(value.occasions),
  }
}

export function serializeSearchFilters(filters: SearchFilters): string {
  return JSON.stringify(normalizeSearchFilters(filters))
}

export function deserializeSearchFilters(raw: string | null | undefined): SearchFilters {
  if (!raw) return defaultSearchFilters
  try {
    return normalizeSearchFilters(JSON.parse(raw))
  } catch {
    return defaultSearchFilters
  }
}

export function searchFilterHash(filters: SearchFilters): string {
  return serializeSearchFilters(filters)
}

export function activeFilterTokens(filters: SearchFilters): string[] {
  const normalized = normalizeSearchFilters(filters)
  const tokens: string[] = []
  tokens.push(...normalized.taxonomies.cuisine)
  tokens.push(...normalized.taxonomies.foodCategory)
  tokens.push(...normalized.taxonomies.venueType)
  tokens.push(...normalized.taxonomies.dietary)
  tokens.push(...normalized.occasions)
  if (normalized.traits.openNow) tokens.push('Open now')
  if (normalized.traits.takeaway) tokens.push('Takeaway')
  if (normalized.traits.delivery) tokens.push('Delivery')
  if (normalized.traits.outdoorSeating) tokens.push('Outdoor seating')
  if (normalized.traits.wheelchair) tokens.push('Wheelchair')
  if (normalized.locationSource != null) tokens.push(`${normalized.radiusKm} km`)
  if (normalized.sort !== 'best_match') tokens.push(normalized.sort)
  if (normalized.intent !== 'all') tokens.push(normalized.intent)
  return tokens
}

export function classifySearchQuery(query: string): SearchQueryClassification {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!normalized) return 'discovery'
  if (normalized.startsWith('@')) return 'creator'
  if (/\b(best|hidden|guide|collection|list)\b/.test(normalized)) return 'collection'
  if (/\b(date night|comfort food|coffee run|brunch|solo|group|special)\b/.test(normalized)) return 'occasion'
  if (/\b(gumshara|restaurant|cafe|bakery|bar|pub|market)\b/.test(normalized)) return 'place'
  if (/\b(ramen|tonkotsu|pizza|burger|sushi|matcha|dumpling|dumplings|bbq|barbecue)\b/.test(normalized)) return 'food'
  return 'general'
}

export function normalizeQueryWithTaxonomyAliases(
  query: string,
  aliases: Readonly<Record<string, string>>
): string {
  const compact = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!compact) return ''
  const exact = aliases[compact]
  if (exact) return exact

  return compact
    .split(' ')
    .map(term => aliases[term] ?? term)
    .join(' ')
}

export function createSearchResponse(
  results: SearchResult[],
  options: {
    suggestions?: SearchSuggestion[]
    totalCount?: number
    nextCursor?: string | null
    rankingVersion?: string
  } = {}
): SearchResponse {
  return {
    rankingVersion: options.rankingVersion ?? SEARCH_RANKING_VERSION,
    results,
    ...(options.suggestions ? { suggestions: options.suggestions } : {}),
    ...(options.totalCount != null ? { totalCount: options.totalCount } : {}),
    ...(options.nextCursor !== undefined ? { nextCursor: options.nextCursor } : {}),
  }
}

export function appendSearchSessionStep(
  session: SearchSession,
  step: SearchSessionStep
): SearchSession {
  const cleanStep: SearchSessionStep = {}
  if (step.query != null && step.query.trim()) cleanStep.query = step.query.trim()
  if (step.intent != null) cleanStep.intent = normalizeIntent(step.intent)
  if (step.filterHash != null && step.filterHash.trim()) cleanStep.filterHash = step.filterHash.trim()
  if (Object.keys(cleanStep).length === 0) return session

  return {
    ...session,
    steps: [...session.steps, cleanStep].slice(-MAX_SEARCH_SESSION_STEPS),
  }
}
