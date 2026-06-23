import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Json } from '@/types/database'
import { supabase } from '../supabase'
import { reportInvalidBoundary } from './boundaryTelemetry'
import { parseSearchSuggestions } from './searchGuards'
import { isRecord, parseJsonWithGuard } from '../utils/safeJson'
import type { DishResult, PlaceResult, SearchSuggestion, SearchUserResult, UserLocation } from '../hooks/searchTypes'
import type { SemanticResultRow } from '../search/types'

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

export function normalizeSavedSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

function normalizeSavedSearchKey(query: string): string {
  return normalizeSavedSearchQuery(query).toLowerCase()
}

function requireSavedSearchQuery(query: string): { query: string; normalizedQuery: string } {
  const cleaned = normalizeSavedSearchQuery(query)
  if (cleaned.length <= 1) throw new Error('saved_search_query_too_short')
  return { query: cleaned, normalizedQuery: cleaned.toLowerCase() }
}

// ---------------------------------------------------------------------------
// Semantic search
// ---------------------------------------------------------------------------

function isSemanticRow(value: unknown): value is SemanticResultRow {
  return (
    isRecord(value) &&
    (value.entity_type === 'post' || value.entity_type === 'place' || value.entity_type === 'dish') &&
    typeof value.entity_id === 'string' &&
    typeof value.semantic_similarity === 'number' &&
    typeof value.final_score === 'number' &&
    isRecord(value.display_data)
  )
}

export async function searchSemantic(
  queryEmbedding: number[],
  userId: string | null | undefined,
  limit = 50,
  nearLat?: number | null,
  nearLng?: number | null,
): Promise<SemanticResultRow[]> {
  const { data, error } = await supabase.rpc('search_semantic', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    p_limit: limit,
    ...(userId != null ? { p_user_id: userId } : {}),
    ...(nearLat != null ? { p_near_lat: nearLat } : {}),
    ...(nearLng != null ? { p_near_lng: nearLng } : {}),
  })
  if (error) {
    reportInvalidBoundary('search_semantic_rpc_error')
    return []
  }
  // Cast to unknown[] so the type-predicate filter works regardless of generated types
  const rows = (data as unknown[] | null ?? []).filter(isSemanticRow)
  if (data != null && (data as unknown[]).length !== rows.length) {
    reportInvalidBoundary('search_semantic_row_invalid')
  }
  return rows
}

export async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const result = await supabase.functions.invoke('embed-content', {
      body: { type: 'embed', text: text.trim() },
    })
    if (result.error) return null
    const payload = result.data as Record<string, unknown> | null
    if (!payload || !Array.isArray(payload['embedding'])) return null
    return payload['embedding'] as number[]
  } catch {
    return null
  }
}

export async function searchTextFallback(
  query: string,
  limit = 20,
  nearLat?: number | null,
  nearLng?: number | null,
): Promise<SemanticResultRow[]> {
  const { data, error } = await supabase.rpc('search_text_fallback', {
    p_query: query.trim(),
    p_limit: limit,
    ...(nearLat != null ? { p_near_lat: nearLat } : {}),
    ...(nearLng != null ? { p_near_lng: nearLng } : {}),
  })
  if (error) return []
  return (data as unknown[] | null ?? []).filter(isSemanticRow)
}

// ---------------------------------------------------------------------------
// Autocomplete (typeahead — stays prefix-based)
// ---------------------------------------------------------------------------

export async function fetchSearchAutocomplete(
  query: string,
  userLocation: UserLocation
): Promise<SearchSuggestion[]> {
  if (!query || query.length < 2) return []
  const { data } = await supabase.rpc('suggest_searches', {
    prefix_query: query,
    ...(userLocation ? { near_lat: userLocation.lat, near_lng: userLocation.lng } : {}),
    limit_per_type: 3,
  })
  const rpcSuggestions = parseSearchSuggestions(data).map(s =>
    s.suggestion_type === 'hashtag' ? { ...s, suggestion_type: 'tag' as const } : s
  )
  reportInvalidBoundary
  return dedupeSearchSuggestions(rpcSuggestions).slice(0, 15)
}

function dedupeSearchSuggestions(suggestions: SearchSuggestion[]): SearchSuggestion[] {
  const seen = new Set<string>()
  const rows: SearchSuggestion[] = []
  for (const s of suggestions) {
    const key = `${s.suggestion_type}:${s.display_text.trim().toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(s)
  }
  return rows
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function searchUsers(query: string): Promise<SearchUserResult[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, full_name, follower_count, post_count')
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(10)
  if (error) throw error
  return data ?? []
}

// ---------------------------------------------------------------------------
// Saved searches
// ---------------------------------------------------------------------------

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
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 1)
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

// ---------------------------------------------------------------------------
// Display data parsers — convert display_data JSONB from search_semantic
// ---------------------------------------------------------------------------

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' ? v : null
}

function bool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}

export function parsePlaceDisplayData(data: Record<string, unknown>): PlaceResult {
  return {
    id: str(data.id) ?? '',
    name: str(data.name) ?? '',
    address: str(data.address),
    city: str(data.city),
    suburb: str(data.suburb),
    cuisine_type: str(data.cuisine_type),
    google_place_id: str(data.google_place_id),
    latitude: num(data.latitude),
    longitude: num(data.longitude),
    google_rating: num(data.google_rating),
    google_review_count: num(data.google_review_count),
    open_now: bool(data.open_now),
  }
}

export function parseDishDisplayData(id: string, data: Record<string, unknown>): DishResult {
  return {
    id,
    name: str(data.name) ?? '',
    cuisine_type: str(data.cuisine_type),
    top_photo_url: str(data.top_photo_url),
    save_count: num(data.save_count) ?? 0,
    post_count: num(data.post_count) ?? 0,
  }
}

// ---------------------------------------------------------------------------
// History + analytics
// ---------------------------------------------------------------------------

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
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 1)
}

export async function fetchTrendingDishes(limit = 10): Promise<DishResult[]> {
  const { data, error } = await supabase.rpc('fetch_trending_dishes', { limit_count: limit })
  if (error) return []
  if (!Array.isArray(data)) return []
  return data
    .filter(isRecord)
    .map(row => parseDishDisplayData(str(row.id) ?? '', row as Record<string, unknown>))
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

export async function fetchDistinctCuisineTypes(): Promise<string[]> {
  const { data } = await supabase
    .from('places')
    .select('cuisine_type')
    .not('cuisine_type', 'is', null)
  return [...new Set((data ?? []).map(r => r.cuisine_type as string).filter(Boolean))]
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
  if (Array.isArray(data) && data.length !== rows.length) {
    reportInvalidBoundary('search_quality_metrics_row_invalid')
  }
  return rows
}

// ---------------------------------------------------------------------------
// Places (bounding box — used by aroundMe mode)
// ---------------------------------------------------------------------------

type SearchBounds = {
  min_lat: number
  max_lat: number
  min_lng: number
  max_lng: number
}

export async function searchPlacesByBounds(bounds: SearchBounds): Promise<PlaceResult[]> {
  const { data } = await supabase.rpc('places_in_bounding_box', { ...bounds, max_results: 50 })
  if (!Array.isArray(data)) return []
  return data.filter(isRecord).map(row => parsePlaceDisplayData(row as Record<string, unknown>))
}

// AsyncStorage cache helpers used by useSearchHistory — kept for backward compat
type CachedSearchSynonyms = { savedAt: string; rows: unknown[] }
function isCachedSearchSynonyms(value: unknown): value is CachedSearchSynonyms {
  return isRecord(value) && typeof value.savedAt === 'string' && Array.isArray(value.rows)
}

const SEARCH_SYNONYMS_CACHE_KEY = 'rekkus:search-synonyms:v1'

export async function fetchSearchSynonyms(): Promise<unknown[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_SYNONYMS_CACHE_KEY)
    if (!raw) return []
    const cached = parseJsonWithGuard(raw, isCachedSearchSynonyms)
    return cached?.rows ?? []
  } catch {
    return []
  }
}

export async function loadSearchSynonymCache(): Promise<void> {
  // No-op: synonym cache no longer used in search pipeline
}

export function logSearchQuery(params: {
  userId: string | null
  query: string
  resultsCount: number
  searchLat: number | null
  searchLng: number | null
  sessionId: string | null
}): void {
  // Fire-and-forget; never block the search result render on analytics
  void (supabase as unknown as { from: (t: string) => { insert: (r: unknown) => Promise<unknown> } })
    .from('search_analytics')
    .insert({
      user_id: params.userId,
      query: params.query,
      results_count: params.resultsCount,
      search_lat: params.searchLat,
      search_lng: params.searchLng,
      session_id: params.sessionId,
    })
}
