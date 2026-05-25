import type { Json } from '@/types/database'
import type { Post } from '@/types/domain'
import { supabase } from '../supabase'
import { reportInvalidBoundary } from './boundaryTelemetry'
import { fetchPostsByCuisines, mapRowToPost } from './posts'
import {
  parseDishPostIds,
  parsePlaceResults,
  parseRankedPostIds,
  parseSearchSuggestions,
  type DishPostId,
  type RankedPostId,
} from './searchGuards'
import { CUISINE_SYNONYMS } from '../utils/cuisineSynonyms'
import type { PlaceResult, SearchSuggestion, UserLocation } from '../hooks/searchTypes'

export type TrendingSearchRow = { query: string; score?: number; updated_at?: string }
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
    .select('id, username, full_name')
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

export async function fetchTrendingSearches(limit: number): Promise<TrendingSearchRow[]> {
  const { data, error } = await supabase
    .from('trending_searches')
    .select('query')
    .order('score', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
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

export async function fetchTrendingPlaceClicks(sinceIso: string): Promise<PlaceClickRow[]> {
  const { data, error } = await supabase.from('analytics_events')
    .select('entity_id')
    .eq('event_type', 'place_click')
    .gte('created_at', sinceIso)
    .limit(200)
  if (error) throw error
  return data ?? []
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
      ...new Set(words.flatMap(w => CUISINE_SYNONYMS[w] ?? [])),
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
