import { supabase } from '../supabase'
import { fetchTrendingDishes } from './search'
import { parsePlaceResults } from './searchGuards'
import type { PlaceResult } from '../hooks/searchTypes'

export type TrendingSearchRow = {
  query: string
  near_city?: string
  score?: number
  user_count?: number
  updated_at?: string
}
type TrendingPostEventType = 'post_view' | 'post_like' | 'post_save' | 'post_dwell'

export type PlaceClickRow = {
  entity_id: string | null
}

export type PostTrendEventRow = {
  event_type: TrendingPostEventType
  entity_id: string | null
}

export type TrendingEntitySignals = {
  placeScores: Map<string, number>
  postScores: Map<string, number>
  dishScores: Map<string, number>
}

const GLOBAL_TRENDING_CITY = 'global'
const MIN_CITY_TRENDING_RESULTS = 4
const MIN_TRENDING_USER_COUNT = 2

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

async function fetchTrendingSearchRows(
  limit: number,
  nearCity: string
): Promise<TrendingSearchRow[]> {
  const { data, error } = await supabase
    .from('trending_searches')
    .select('query, near_city, score, user_count, updated_at')
    .eq('near_city', nearCity)
    .gte('user_count', MIN_TRENDING_USER_COUNT)
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

export async function fetchTrendingEntitySignals(
  nearCity?: string | null
): Promise<TrendingEntitySignals> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [placeRows, postRows, dishRows] = await Promise.all([
    fetchTrendingPlaceClicks(since, nearCity),
    fetchTrendingPostEvents(since),
    fetchTrendingDishes(10),
  ])

  const placeScores = new Map<string, number>()
  for (const row of placeRows) {
    if (row.entity_id) placeScores.set(row.entity_id, (placeScores.get(row.entity_id) ?? 0) + 1)
  }

  const postScores = new Map<string, number>()
  const postWeights: Record<TrendingPostEventType, number> = {
    post_view: 1,
    post_like: 2,
    post_save: 5,
    post_dwell: 1.5,
  }
  for (const row of postRows) {
    if (row.entity_id) {
      postScores.set(row.entity_id, (postScores.get(row.entity_id) ?? 0) + postWeights[row.event_type])
    }
  }

  const dishScores = new Map<string, number>()
  for (const dish of dishRows) {
    dishScores.set(dish.id, dish.save_count * 3 + dish.post_count)
  }

  return { placeScores, postScores, dishScores }
}
