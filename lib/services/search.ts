import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Json } from '@/types/database'
import type { Post } from '@/types/domain'
import { supabase } from '../supabase'
import { reportInvalidBoundary } from './boundaryTelemetry'
import { fetchPostsByCuisines, mapRowToPost } from './posts'
import {
  parseDishPostIds,
  parseDishResults,
  parsePlaceResults,
  parseRankedPostIds,
  parseSearchSuggestions,
  type DishPostId,
  type RankedPostId,
} from './searchGuards'
// CUISINE_SYNONYMS is the offline fallback constant; runtime synonym vocab is managed via cuisineSynonyms.ts (B-551)
import {
  fallbackSearchSynonymRows,
  applySearchSynonymRows,
  getCuisineSynonyms,
  type SearchSynonymRow,
  type SearchSynonymType,
} from '../utils/cuisineSynonyms'
import { isRecord, parseJsonWithGuard } from '../utils/safeJson'
import type { DishResult, PlaceResult, SearchSuggestion, UserLocation } from '../hooks/searchTypes'
import type { SearchContext, SearchGraphEvidence } from '../search/types'

export type SearchHistoryRow = {
  query: string
  last_searched_at: string
  search_count: number
}

export type SearchQualityMetricRow = {
  day: string
  result_type: string | null
  result_position: number | null
  search_sessions: number
  query_count: number
  click_count: number
  attributed_view_count: number
  attributed_save_count: number
  attributed_review_count: number
  zero_result_count: number
  reformulation_count: number
  success_count: number
  success_rate: number
  ctr: number
  zero_result_rate: number
  reformulation_rate: number
}

export function normalizeSavedSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

function normalizeSavedSearchKey(query: string): string {
  return normalizeSavedSearchQuery(query).toLowerCase()
}

function isSearchQualityMetricRow(value: unknown): value is SearchQualityMetricRow {
  return isRecord(value) &&
    typeof value.day === 'string' &&
    (value.result_type === null || typeof value.result_type === 'string') &&
    (value.result_position === null || typeof value.result_position === 'number') &&
    typeof value.search_sessions === 'number' &&
    typeof value.query_count === 'number' &&
    typeof value.click_count === 'number' &&
    typeof value.attributed_view_count === 'number' &&
    typeof value.attributed_save_count === 'number' &&
    typeof value.attributed_review_count === 'number' &&
    typeof value.zero_result_count === 'number' &&
    typeof value.reformulation_count === 'number' &&
    typeof value.success_count === 'number' &&
    typeof value.success_rate === 'number' &&
    typeof value.ctr === 'number' &&
    typeof value.zero_result_rate === 'number' &&
    typeof value.reformulation_rate === 'number'
}

function requireSavedSearchQuery(query: string): { query: string; normalizedQuery: string } {
  const cleaned = normalizeSavedSearchQuery(query)
  if (cleaned.length <= 1) {
    throw new Error('saved_search_query_too_short')
  }
  return { query: cleaned, normalizedQuery: cleaned.toLowerCase() }
}

export type SearchUserResult = {
  id: string
  username: string
  full_name: string | null
  follower_count: number
  post_count: number
}

type CachedSearchSynonyms = {
  savedAt: string
  rows: SearchSynonymRow[]
}

const SEARCH_SYNONYMS_CACHE_KEY = 'rekkus:search-synonyms:v1'
const SEARCH_SYNONYMS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function isSearchSynonymType(value: unknown): value is SearchSynonymType {
  return value === 'cuisine' || value === 'occasion' || value === 'dietary'
}

function isSearchSynonymRow(value: unknown): value is SearchSynonymRow {
  return (
    isRecord(value) &&
    typeof value.term === 'string' &&
    typeof value.canonical === 'string' &&
    isSearchSynonymType(value.type)
  )
}

function isSearchSynonymRows(value: unknown): value is SearchSynonymRow[] {
  return Array.isArray(value) && value.every(isSearchSynonymRow)
}

function isCachedSearchSynonyms(value: unknown): value is CachedSearchSynonyms {
  return (
    isRecord(value) &&
    typeof value.savedAt === 'string' &&
    isSearchSynonymRows(value.rows)
  )
}

function normalizeSynonymRow(row: SearchSynonymRow): SearchSynonymRow | null {
  const term = row.term.trim().toLowerCase()
  const canonical = row.canonical.trim().toLowerCase()
  if (!term || !canonical) return null
  return { term, canonical, type: row.type }
}

async function readCachedSearchSynonyms(now: number): Promise<SearchSynonymRow[] | null> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_SYNONYMS_CACHE_KEY)
    if (!raw) return null
    const cached = parseJsonWithGuard(raw, isCachedSearchSynonyms)
    if (!cached) return null
    const savedAt = Date.parse(cached.savedAt)
    if (!Number.isFinite(savedAt) || now - savedAt > SEARCH_SYNONYMS_CACHE_TTL_MS) return null
    return cached.rows
  } catch {
    return null
  }
}

async function writeCachedSearchSynonyms(rows: SearchSynonymRow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      SEARCH_SYNONYMS_CACHE_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), rows })
    )
  } catch {
    // Search synonym cache writes should not block search startup.
  }
}

export async function fetchSearchSynonyms(): Promise<SearchSynonymRow[]> {
  const cached = await readCachedSearchSynonyms(Date.now())
  if (cached) return cached

  try {
    const { data, error } = await supabase
      .from('search_synonyms')
      .select('term, canonical, type')
      .eq('enabled', true)
      .limit(1000)
    if (error) throw error
    const rows = (data ?? [])
      .filter(isSearchSynonymRow)
      .map(normalizeSynonymRow)
      .filter((row): row is SearchSynonymRow => row !== null)
    if (rows.length > 0) {
      await writeCachedSearchSynonyms(rows)
      return rows
    }
  } catch {
    // Local fallback keeps search usable offline or before migration rollout.
  }

  return fallbackSearchSynonymRows()
}

export async function loadSearchSynonymCache(): Promise<void> {
  applySearchSynonymRows(await fetchSearchSynonyms())
}

function reportFilteredRows(value: unknown, validLength: number, boundary: string): void {
  if (Array.isArray(value) && value.length !== validLength) {
    reportInvalidBoundary(boundary)
  }
}

export async function searchPlaces(
  query: string,
  userLocation: UserLocation,
  bounds?: { min_lat: number; max_lat: number; min_lng: number; max_lng: number },
  suburbFilter?: string
): Promise<PlaceResult[]> {
  const { data } = bounds
    ? await supabase.rpc('restaurants_in_bounding_box', { ...bounds, max_results: 50 })
    : await supabase.rpc('search_restaurants_full_text', {
        query_text: query,
        max_results: 40,
        ...(userLocation ? { near_lat: userLocation.lat, near_lng: userLocation.lng } : {}),
        ...(suburbFilter ? { suburb_filter: suburbFilter } : {}),
      })
  const places = parsePlaceResults(data)
  reportFilteredRows(data, places.length, 'search_places_row_invalid')
  return places
}

export async function searchPostIds(
  query: string,
  userLocation: UserLocation
): Promise<RankedPostId[]> {
  const { data } = await supabase.rpc('search_posts_full_text', {
    query_text: query,
    max_results: 20,
    ...(userLocation ? { near_lat: userLocation.lat, near_lng: userLocation.lng } : {}),
  })
  const posts = parseRankedPostIds(data)
  reportFilteredRows(data, posts.length, 'search_posts_row_invalid')
  return posts
}

export async function searchDishPostIds(
  query: string,
  userLocation: UserLocation
): Promise<DishPostId[]> {
  const { data } = await supabase.rpc('search_posts_by_dish', {
    dish_query: query,
    max_results: 20,
    ...(userLocation ? { near_lat: userLocation.lat, near_lng: userLocation.lng } : {}),
  })
  const posts = parseDishPostIds(data)
  reportFilteredRows(data, posts.length, 'search_dish_posts_row_invalid')
  return posts
}


export async function fetchSearchAutocomplete(context: SearchContext): Promise<SearchSuggestion[]> {
  if (!context.hasQuery || context.query.length < 2) return []
  const { data } = await supabase.rpc('suggest_searches', {
    prefix_query: context.query,
    ...(context.userLocation
      ? { near_lat: context.userLocation.lat, near_lng: context.userLocation.lng }
      : {}),
    limit_per_type: 3,
  })
  const rpcSuggestions = parseSearchSuggestions(data).map(normalizeAutocompleteSuggestion)
  reportFilteredRows(data, rpcSuggestions.length, 'search_autocomplete_row_invalid')
  return dedupeSearchSuggestions([
    ...areaAutocompleteSuggestions(context),
    ...rpcSuggestions,
  ]).slice(0, 15)
}

function normalizeAutocompleteSuggestion(suggestion: SearchSuggestion): SearchSuggestion {
  if (suggestion.suggestion_type !== 'hashtag') return suggestion
  return { ...suggestion, suggestion_type: 'tag' }
}

function areaAutocompleteSuggestions(context: SearchContext): SearchSuggestion[] {
  const resolved = context.parsed.resolvedSuburb
  if (resolved) {
    return [{
      suggestion_type: 'area',
      display_text: resolved,
      secondary_text: 'Area',
      entity_id: resolved,
      score: 100,
    }]
  }
  const text = context.parsed.locationTerms.join(' ').trim()
  if (text.length < 2) return []
  return [{
    suggestion_type: 'area',
    display_text: text,
    secondary_text: 'Area',
    entity_id: text,
    score: 50,
  }]
}

function dedupeSearchSuggestions(suggestions: SearchSuggestion[]): SearchSuggestion[] {
  const seen = new Set<string>()
  const rows: SearchSuggestion[] = []
  for (const suggestion of suggestions) {
    const key = `${suggestion.suggestion_type}:${suggestion.display_text.trim().toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(suggestion)
  }
  return rows
}

export async function searchUsers(query: string): Promise<SearchUserResult[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, full_name, follower_count, post_count')
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(10)
  if (error) throw error
  return data ?? []
}

export async function fetchSavedSearches(userId: string | undefined, limit: number): Promise<string[]> {
  if (!userId) return []
  const cappedLimit = Math.max(1, Math.min(Math.floor(limit), 100))
  const { data, error } = await supabase
    .from('saved_searches')
    .select('query')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(cappedLimit)
  if (error) throw error
  return (data ?? [])
    .map(row => row.query)
    .filter((query): query is string => typeof query === 'string' && query.trim().length > 1)
}

export async function saveSearch(query: string): Promise<string> {
  const saved = requireSavedSearchQuery(query)
  const { data, error } = await supabase
    .from('saved_searches')
    .upsert(
      {
        query: saved.query,
        normalized_query: saved.normalizedQuery,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,normalized_query' }
    )
    .select('query')
    .single()
  if (error) throw error
  return typeof data?.query === 'string' ? data.query : saved.query
}

export async function unsaveSearch(query: string): Promise<void> {
  const normalizedQuery = normalizeSavedSearchKey(query)
  if (normalizedQuery.length <= 1) return
  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('normalized_query', normalizedQuery)
  if (error) throw error
}

function getJsonString(value: Json | undefined, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const field = value[key]
  return typeof field === 'string' ? field : null
}

export async function fetchRecentSearchHistoryFallback(
  userId: string,
  lookbackDays: number
): Promise<string[]> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase.from('analytics_events')
    .select('metadata, created_at')
    .eq('user_id', userId)
    .eq('event_type', 'search_query')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? [])
    .map(row => getJsonString(row.metadata ?? undefined, 'query'))
    .filter((query): query is string => typeof query === 'string' && query.trim().length > 1)
}

type CuisineMatch = { cuisine_type: string; match_count: number }

export async function resolveSearchExpansion({
  isAroundMe,
  strictPostCount,
  strictPlaceCount,
  words,
  q,
}: {
  isAroundMe: boolean
  strictPostCount: number
  strictPlaceCount: number
  words: string[]
  q: string
}): Promise<{ cuisines: CuisineMatch[]; expandedPosts: Post[]; expandedPlaces: PlaceResult[] }> {
  let cuisines: CuisineMatch[] = []
  let expandedPosts: Post[] = []
  let expandedPlaces: PlaceResult[] = []

  if (!isAroundMe && (strictPostCount === 0 || strictPlaceCount === 0)) {
    // Client-side fast-path: resolve cuisine from synonym map before hitting DB
    const synonymCuisines: CuisineMatch[] = [
      ...new Set(words.flatMap(getCuisineSynonyms)),
    ].map(c => ({ cuisine_type: c, match_count: 1 }))
    if (synonymCuisines.length > 0) {
      cuisines = synonymCuisines
    } else {
      const { data } = await supabase.rpc('expand_search_cuisines', {
        query_text: q,
        max_cuisines: 3,
      })
      cuisines = data ?? []
    }
  }

  if (strictPostCount === 0 && cuisines.length > 0) {
    const rows = await fetchPostsByCuisines(
      cuisines.map(c => c.cuisine_type),
      20
    )
    expandedPosts = rows.map(mapRowToPost)
  }

  if (strictPlaceCount === 0 && cuisines.length > 0) {
    const cuisineFilter = cuisines
      .map(c => `cuisine_type.ilike.%${String(c.cuisine_type).replace(/,/g, '')}%`)
      .join(',')
    const { data } = await supabase
      .from('restaurants')
      .select(
        'id, name, address, city, cuisine_type, google_place_id, latitude, longitude, google_rating, google_review_count, open_now'
      )
      .or(cuisineFilter)
      .limit(20)
    expandedPlaces = parsePlaceResults(data)
  }

  return { cuisines, expandedPosts, expandedPlaces }
}

export async function searchDishes(
  query: string,
  userLocation: UserLocation,
  maxResults = 5
): Promise<DishResult[]> {
  const { data, error } = await supabase.rpc('search_dishes_full_text', {
    query,
    ...(userLocation ? { near_lat: userLocation.lat, near_lng: userLocation.lng } : {}),
    max_results: maxResults,
  })
  if (error) return []
  const results = parseDishResults(data)
  reportFilteredRows(data, results.length, 'search_dishes_full_text')
  return results
}

export async function fetchDishGraphEvidence(
  dishIds: string[]
): Promise<Map<string, SearchGraphEvidence>> {
  const uniqueDishIds = [...new Set(dishIds)].filter(id => id.length > 0).slice(0, 20)
  if (uniqueDishIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('posts')
    .select('id, dish_id, restaurant_id')
    .in('dish_id', uniqueDishIds)
    .is('deleted_at', null)
    .limit(200)
  if (error) return new Map()

  const byDish = new Map<string, { restaurants: Set<string>; posts: string[] }>()
  for (const row of data ?? []) {
    if (typeof row.dish_id !== 'string' || typeof row.id !== 'string') continue
    const current = byDish.get(row.dish_id) ?? { restaurants: new Set<string>(), posts: [] }
    if (typeof row.restaurant_id === 'string') current.restaurants.add(row.restaurant_id)
    if (current.posts.length < 5) current.posts.push(row.id)
    byDish.set(row.dish_id, current)
  }

  const evidence = new Map<string, SearchGraphEvidence>()
  for (const [dishId, value] of byDish) {
    const servingRestaurantIds = [...value.restaurants].slice(0, 5)
    evidence.set(dishId, {
      servingRestaurantIds,
      servingRestaurantCount: value.restaurants.size,
      supportingPostIds: value.posts,
    })
  }
  return evidence
}

export async function fetchTrendingDishes(limit = 10): Promise<DishResult[]> {
  const { data, error } = await supabase.rpc('fetch_trending_dishes', { limit_count: limit })
  if (error) return []
  const results = parseDishResults(data)
  reportFilteredRows(data, results.length, 'fetch_trending_dishes')
  return results
}

export async function fetchRecentSearchHistory(
  maxResults: number,
  lookbackDays: number
): Promise<SearchHistoryRow[]> {
  const { data, error } = await supabase.rpc('get_recent_search_history', {
    max_results: maxResults,
    lookback_days: lookbackDays,
  })
  if (error) throw error
  return data ?? []
}

export async function fetchSearchQualityMetrics(
  lookbackDays = 30
): Promise<SearchQualityMetricRow[]> {
  const boundedLookbackDays = Math.max(1, Math.min(Math.floor(lookbackDays), 90))
  const { data, error } = await supabase.rpc('get_search_quality_metrics', {
    lookback_days: boundedLookbackDays,
  })
  if (error) throw error
  const rows = Array.isArray(data) ? data.filter(isSearchQualityMetricRow) : []
  reportFilteredRows(data, rows.length, 'search_quality_metrics_row_invalid')
  return rows
}
