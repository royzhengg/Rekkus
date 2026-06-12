import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Json } from '@/types/database'
import { supabase } from '../supabase'
import { reportInvalidBoundary } from './boundaryTelemetry'
import { isRecord, parseJsonWithGuard } from '../utils/safeJson'

export type PersonalizedSuggestion = {
  query: string
  score: number
  source: string
}

export type SearchPersonalizationSignals = {
  recentQueries: string[]
  recentCuisines: string[]
  recentAreas: string[]
  savedRestaurantIds: string[]
  savedDishIds: string[]
  savedPostIds: string[]
}

type CachedEngagementCuisines = {
  savedAt: string
  cuisines: string[]
}

const ENGAGEMENT_CUISINES_CACHE_KEY_PREFIX = 'rekkus:engagement-cuisines:v1'
const ENGAGEMENT_CUISINES_CACHE_TTL_MS = 60 * 60 * 1000
const ENGAGEMENT_CUISINES_LOOKBACK_DAYS = 90
const ENGAGEMENT_EVENT_WEIGHTS: Record<string, number> = {
  post_view: 1,
  place_view: 1,
  post_save: 3,
  place_save: 3,
}

function isCachedEngagementCuisines(value: unknown): value is CachedEngagementCuisines {
  return (
    isRecord(value) &&
    typeof value.savedAt === 'string' &&
    Array.isArray(value.cuisines) &&
    value.cuisines.every(cuisine => typeof cuisine === 'string')
  )
}

function isPersonalizedSuggestion(value: unknown): value is PersonalizedSuggestion {
  return (
    isRecord(value) &&
    typeof value.query === 'string' &&
    typeof value.score === 'number' &&
    typeof value.source === 'string'
  )
}

function parsePersonalizedSuggestions(value: unknown): PersonalizedSuggestion[] {
  return Array.isArray(value)
    ? value
        .filter(isPersonalizedSuggestion)
        .map(row => ({
          query: row.query.trim().replace(/\s+/g, ' '),
          score: row.score,
          source: row.source,
        }))
        .filter(row => row.query.length > 1)
    : []
}

function getJsonString(value: Json | undefined, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const field = value[key]
  return typeof field === 'string' ? field : null
}

function engagementCuisineCacheKey(userId: string): string {
  return `${ENGAGEMENT_CUISINES_CACHE_KEY_PREFIX}:${userId}`
}

async function readCachedEngagementCuisines(
  userId: string,
  now: number
): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(engagementCuisineCacheKey(userId))
    if (!raw) return null
    const cached = parseJsonWithGuard(raw, isCachedEngagementCuisines)
    if (!cached) return null
    const savedAt = Date.parse(cached.savedAt)
    if (!Number.isFinite(savedAt) || now - savedAt > ENGAGEMENT_CUISINES_CACHE_TTL_MS) return null
    return cached.cuisines
  } catch {
    return null
  }
}

async function writeCachedEngagementCuisines(userId: string, cuisines: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      engagementCuisineCacheKey(userId),
      JSON.stringify({ savedAt: new Date().toISOString(), cuisines })
    )
  } catch {
    // Engagement cuisine cache writes should not block no-results recovery.
  }
}

function normalizeCuisine(value: string | null): string | null {
  const cuisine = value?.trim().replace(/\s+/g, ' ').toLowerCase()
  return cuisine && cuisine.length > 1 ? cuisine : null
}

export async function fetchUserEngagementCuisines(userId: string): Promise<string[]> {
  const cached = await readCachedEngagementCuisines(userId, Date.now())
  if (cached) return cached

  try {
    const since = new Date(
      Date.now() - ENGAGEMENT_CUISINES_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()
    const { data, error } = await supabase.from('analytics_events')
      .select('event_type, metadata, created_at')
      .eq('user_id', userId)
      .in('event_type', Object.keys(ENGAGEMENT_EVENT_WEIGHTS))
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw error

    const scores = new Map<string, number>()
    for (const row of data ?? []) {
      const weight = ENGAGEMENT_EVENT_WEIGHTS[row.event_type] ?? 0
      if (weight <= 0) continue
      const cuisine = normalizeCuisine(getJsonString(row.metadata ?? undefined, 'cuisine_type'))
      if (!cuisine) continue
      scores.set(cuisine, (scores.get(cuisine) ?? 0) + weight)
    }

    const maxScore = Math.max(1, ...scores.values())
    const cuisines = [...scores.entries()]
      .map(([cuisine, score]) => ({ cuisine, score: score / maxScore }))
      .filter(row => row.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score
        return left.cuisine.localeCompare(right.cuisine)
      })
      .map(row => row.cuisine)
      .slice(0, 10)

    await writeCachedEngagementCuisines(userId, cuisines)
    return cuisines
  } catch {
    return []
  }
}

export async function fetchPersonalizedSuggestions(
  userId: string,
  query: string,
  limit = 3
): Promise<PersonalizedSuggestion[]> {
  const failedQuery = query.trim().replace(/\s+/g, ' ')
  if (!userId || failedQuery.length < 2) return []
  const cappedLimit = Math.max(1, Math.min(Math.floor(limit), 10))
  const { data, error } = await supabase.rpc('get_personalized_suggestions', {
    p_user_id: userId,
    p_failed_query: failedQuery,
    p_limit: cappedLimit,
  })
  if (error) return []
  const suggestions = parsePersonalizedSuggestions(data)
  if (Array.isArray(data) && data.length !== suggestions.length) {
    reportInvalidBoundary('personalized_suggestion_row_invalid')
  }
  return suggestions.slice(0, cappedLimit)
}

export async function fetchSearchPersonalizationSignals(
  userId: string | null
): Promise<SearchPersonalizationSignals> {
  const empty: SearchPersonalizationSignals = {
    recentQueries: [],
    recentCuisines: [],
    recentAreas: [],
    savedRestaurantIds: [],
    savedDishIds: [],
    savedPostIds: [],
  }
  if (!userId) return empty

  const [recentCuisines, savedRestaurantIds, savedDishIds, savedPostIds, recentQueries] =
    await Promise.all([
      fetchUserEngagementCuisines(userId),
      fetchSavedRestaurantIdsForSearch(userId),
      fetchSavedDishIdsForSearch(userId),
      fetchSavedPostIdsForSearch(userId),
      fetchRecentQueriesForSearch(userId),
    ])

  return {
    recentQueries,
    recentCuisines,
    recentAreas: recentQueries.flatMap(extractAreaTerms).slice(0, 10),
    savedRestaurantIds,
    savedDishIds,
    savedPostIds,
  }
}

async function fetchSavedRestaurantIdsForSearch(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('saved_locations')
      .select('restaurant_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return (data ?? [])
      .map(row => row.restaurant_id)
      .filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

async function fetchSavedDishIdsForSearch(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('saved_dishes')
      .select('dish_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return (data ?? [])
      .map(row => row.dish_id)
      .filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

async function fetchSavedPostIdsForSearch(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('saves')
      .select('post_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return (data ?? [])
      .map(row => row.post_id)
      .filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

async function fetchRecentQueriesForSearch(userId: string): Promise<string[]> {
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('analytics_events')
      .select('metadata, created_at')
      .eq('user_id', userId)
      .eq('event_type', 'search_query')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return (data ?? [])
      .map(row => getJsonString(row.metadata ?? undefined, 'query'))
      .filter((query): query is string => typeof query === 'string' && query.trim().length > 1)
      .map(query => query.trim().replace(/\s+/g, ' ').toLowerCase())
  } catch {
    return []
  }
}

function extractAreaTerms(query: string): string[] {
  const match = query.match(/\b(?:near|in|around|at)\s+(.+)$/i)
  const area = match?.[1]?.trim().replace(/\s+/g, ' ').toLowerCase()
  return area && area.length > 1 ? [area] : []
}
