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
import {
  fallbackSearchSynonymRows,
  applySearchSynonymRows,
  getCuisineSynonyms,
  type SearchSynonymRow,
  type SearchSynonymType,
} from '../utils/cuisineSynonyms'
import { isRecord, parseJsonWithGuard } from '../utils/safeJson'
import type { DishResult, PlaceResult, SearchSuggestion, UserLocation } from '../hooks/searchTypes'

export type TrendingSearchRow = {
  query: string
  near_city?: string
  score?: number
  updated_at?: string
}
export type TrendingPostEventType = 'post_view' | 'post_like' | 'post_save' | 'post_dwell'

export type SearchHistoryRow = {
  query: string
  last_searched_at: string
  search_count: number
}

export type PlaceClickRow = {
  entity_id: string | null
}

export type PostTrendEventRow = {
  event_type: TrendingPostEventType
  entity_id: string | null
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
const GLOBAL_TRENDING_CITY = 'global'
const MIN_CITY_TRENDING_RESULTS = 4

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

function normalizeTrendingCity(city: string | null | undefined): string | null {
  const trimmed = city?.trim()
  if (!trimmed || trimmed.toLowerCase() === GLOBAL_TRENDING_CITY) return null
  return trimmed
}

function mergeTrendingSearchRows(
  primary: TrendingSearchRow[],
  fallback: TrendingSearchRow[],
  limit: number
): TrendingSearchRow[] {
  const rows: TrendingSearchRow[] = []
  const seen = new Set<string>()
  for (const row of [...primary, ...fallback]) {
    const key = row.query.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push(row)
    if (rows.length >= limit) break
  }
  return rows
}

function mergePlaceClickRows(
  cityRows: PlaceClickRow[],
  globalRows: PlaceClickRow[],
  cityRestaurantIds: Set<string>
): PlaceClickRow[] {
  return [
    ...cityRows,
    ...globalRows.filter(row => row.entity_id == null || !cityRestaurantIds.has(row.entity_id)),
  ]
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

export async function fetchSearchSuggestions(
  query: string,
  userLocation: UserLocation
): Promise<SearchSuggestion[]> {
  const { data } = await supabase.rpc('suggest_searches', {
    prefix_query: query,
    ...(userLocation ? { near_lat: userLocation.lat, near_lng: userLocation.lng } : {}),
    limit_per_type: 3,
  })
  const suggestions = parseSearchSuggestions(data)
  reportFilteredRows(data, suggestions.length, 'search_suggestion_row_invalid')
  return suggestions
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

function getJsonString(value: Json | undefined, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const field = value[key]
  return typeof field === 'string' ? field : null
}

async function fetchTrendingSearchRows(
  limit: number,
  nearCity: string
): Promise<TrendingSearchRow[]> {
  const { data, error } = await supabase
    .from('trending_searches')
    .select('query, near_city, score, updated_at')
    .eq('near_city', nearCity)
    .order('score', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function fetchTrendingSearches(
  limit: number,
  nearCity?: string | null
): Promise<TrendingSearchRow[]> {
  const normalizedCity = normalizeTrendingCity(nearCity)
  const globalRows = () => fetchTrendingSearchRows(limit, GLOBAL_TRENDING_CITY)
  if (!normalizedCity) return globalRows()

  const cityRows = await fetchTrendingSearchRows(limit, normalizedCity)
  if (cityRows.length >= Math.min(MIN_CITY_TRENDING_RESULTS, limit)) return cityRows

  return mergeTrendingSearchRows(cityRows, await globalRows(), limit)
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

async function fetchPlaceClickRows(
  sinceIso: string,
  restaurantIds?: string[]
): Promise<PlaceClickRow[]> {
  let query = supabase.from('analytics_events')
    .select('entity_id')
    .eq('event_type', 'place_click')
    .gte('created_at', sinceIso)

  if (restaurantIds && restaurantIds.length > 0) {
    query = query.in('entity_id', restaurantIds)
  }

  const { data, error } = await query
    .limit(200)
  if (error) throw error
  return data ?? []
}

async function fetchRestaurantIdsByCity(city: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .ilike('city', city)
    .limit(500)
  if (error) throw error
  return (data ?? []).map(row => row.id)
}

export async function fetchTrendingPlaceClicks(
  sinceIso: string,
  nearCity?: string | null
): Promise<PlaceClickRow[]> {
  const normalizedCity = normalizeTrendingCity(nearCity)
  const globalRows = () => fetchPlaceClickRows(sinceIso)
  if (!normalizedCity) return globalRows()

  const cityRestaurantIds = await fetchRestaurantIdsByCity(normalizedCity)
  if (cityRestaurantIds.length === 0) return globalRows()

  const cityRows = await fetchPlaceClickRows(sinceIso, cityRestaurantIds)
  if (cityRows.length >= MIN_CITY_TRENDING_RESULTS) return cityRows

  return mergePlaceClickRows(cityRows, await globalRows(), new Set(cityRestaurantIds))
}

export async function fetchPopularPlacesByIds(placeIds: string[]): Promise<PlaceResult[]> {
  const uniqueIds = [...new Set(placeIds)].slice(0, 10)
  if (uniqueIds.length === 0) return []

  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'id, name, address, city, suburb, cuisine_type, google_place_id, latitude, longitude, google_rating, google_review_count, open_now'
    )
    .in('id', uniqueIds)
    .limit(uniqueIds.length)
  if (error) throw error

  const byId = new Map(parsePlaceResults(data).map(place => [place.id, place]))
  return uniqueIds.map(id => byId.get(id)).filter((place): place is PlaceResult => place !== undefined)
}

export async function resolveTrendingCityFromCoords(
  location: { lat: number; lng: number } | null
): Promise<string | null> {
  if (!location) return null
  const radiusKm = 25
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((location.lat * Math.PI) / 180), 0.01))
  const { data, error } = await supabase.rpc('restaurants_in_bounding_box', {
    min_lat: location.lat - latDelta,
    max_lat: location.lat + latDelta,
    min_lng: location.lng - lngDelta,
    max_lng: location.lng + lngDelta,
    max_results: 50,
  })
  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const city = row.city?.trim()
    if (city) counts.set(city, (counts.get(city) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

export async function fetchTrendingPostEvents(sinceIso: string): Promise<PostTrendEventRow[]> {
  const { data, error } = await supabase.from('analytics_events')
    .select('event_type, entity_id')
    .eq('entity_type', 'post')
    .in('event_type', ['post_view', 'post_like', 'post_save', 'post_dwell'])
    .gte('created_at', sinceIso)
    .limit(500)
  if (error) throw error
  return (data ?? []).filter((row): row is PostTrendEventRow =>
    row.event_type === 'post_view' ||
    row.event_type === 'post_like' ||
    row.event_type === 'post_save' ||
    row.event_type === 'post_dwell'
  )
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
