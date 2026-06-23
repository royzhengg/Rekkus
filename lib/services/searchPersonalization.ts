import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Json } from '@/types/database'
import { supabase } from '../supabase'
import { isRecord, parseJsonWithGuard } from '../utils/safeJson'

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
    value.cuisines.every(c => typeof c === 'string')
  )
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
    // Cache writes should not block the UI
  }
}

function normalizeCuisine(value: string | null): string | null {
  const cuisine = value?.trim().replace(/\s+/g, ' ').toLowerCase()
  return cuisine && cuisine.length > 1 ? cuisine : null
}

function getJsonString(value: Json | undefined, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const field = value[key]
  return typeof field === 'string' ? field : null
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
      .sort((l, r) => r.score !== l.score ? r.score - l.score : l.cuisine.localeCompare(r.cuisine))
      .map(row => row.cuisine)
      .slice(0, 10)

    await writeCachedEngagementCuisines(userId, cuisines)
    return cuisines
  } catch {
    return []
  }
}
