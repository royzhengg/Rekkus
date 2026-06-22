import { useState, useEffect, useMemo } from 'react'
import { analytics } from '@/lib/analytics'
import type { SearchAttribution } from '@/lib/analytics'
import type { AuthUser } from '@/lib/services/auth'
import {
  fetchPlaceRowByGooglePlaceId,
  fetchPlaceRow,
  getPlaceDisplayPhotos,
  cachePlaceGoogleData,
  fetchPlacePostRatings,
  fetchIsPlaceSaved,
} from '@/lib/services/places'
import { NINETY_DAYS_MS, weightedAvg, textSearchPlace, fetchPlaceDetail } from './placeDetailUtils'
import type { DbRatings } from './placeDetailUtils'
import type { PlaceDetail } from './placeTypes'

type LoaderParams = {
  routePlaceId: string | undefined
  routeGooglePlaceId: string | null
  displayName: string
  displayAddress: string
  user: AuthUser | null
  contextPhotoUrls: string[]
  placeCuisineType: string | null
  searchAttribution: SearchAttribution | null
}

type LoaderResult = {
  loading: boolean
  refreshing: boolean
  refresh: () => void
  detail: PlaceDetail | null
  photoUrls: string[]
  placeId: string | null
  setPlaceId: (id: string) => void
  saved: boolean
  setSaved: (v: boolean) => void
  dbRatings: DbRatings
  hasRecentPosts: boolean
  topDishes: Array<{ name: string; dishId?: string }>
  resolvedGooglePlaceId: string | null
  setResolvedGooglePlaceId: (id: string | null) => void
}

type PlaceRow = { id: string; google_place_id: string | null; google_photo_refs: string[] }
type ResolvedIds = { googlePlaceId: string | null; preloadedRow: PlaceRow | null }

export function usePlaceDetailLoader({
  routePlaceId,
  routeGooglePlaceId,
  displayName,
  user,
  contextPhotoUrls,
  placeCuisineType,
  searchAttribution,
}: LoaderParams): LoaderResult {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [detail, setDetail] = useState<PlaceDetail | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [dbRatings, setDbRatings] = useState<DbRatings>({ food: null, vibe: null, cost: null })
  const [hasRecentPosts, setHasRecentReviews] = useState(false)
  const [topDishes, setTopDishes] = useState<Array<{ name: string; dishId?: string }>>([])
  const [resolvedGooglePlaceId, setResolvedGooglePlaceId] = useState<string | null>(
    routeGooglePlaceId && routeGooglePlaceId !== 'none' ? routeGooglePlaceId : null
  )

  useEffect(() => {
    let cancelled = false

    // Phase 1: determine the effective Google Place ID, preferring the route param,
    // then DB lookup, then text search as last resort.
    async function resolveGoogleId(): Promise<ResolvedIds> {
      let googlePlaceId: string | null =
        routeGooglePlaceId && routeGooglePlaceId !== 'none' ? routeGooglePlaceId : null
      let preloadedRow: PlaceRow | null = null

      if (!googlePlaceId && routePlaceId && routePlaceId !== 'none') {
        preloadedRow = await fetchPlaceRow(routePlaceId)
        if (preloadedRow?.google_place_id) {
          googlePlaceId = preloadedRow.google_place_id
          if (!cancelled) setResolvedGooglePlaceId(googlePlaceId)
        }
      }

      if (!googlePlaceId && displayName) {
        googlePlaceId = await textSearchPlace(displayName)
        if (!cancelled && googlePlaceId) setResolvedGooglePlaceId(googlePlaceId)
      }

      return { googlePlaceId, preloadedRow }
    }

    // Phase 2: fetch place details + photos from Google and the DB, update caches.
    // Returns the resolved local place ID (pid), or null if the place isn't in the DB.
    async function loadPlaceData({ googlePlaceId, preloadedRow }: ResolvedIds): Promise<string | null> {
      const [placeResult, placeRowResult] = await Promise.all([
        googlePlaceId ? fetchPlaceDetail(googlePlaceId) : Promise.resolve(null),
        preloadedRow
          ? Promise.resolve(preloadedRow)
          : googlePlaceId
            ? fetchPlaceRowByGooglePlaceId(googlePlaceId)
            : Promise.resolve(null),
      ])

      if (cancelled) return null

      const refs = (placeResult?.photos ?? [])
        .slice(0, 6)
        .map(p => p.photo_reference)
        .filter((ref): ref is string => typeof ref === 'string')
      const cachedRefs = placeRowResult?.google_photo_refs ?? []
      const providerRefs = refs.length > 0 ? refs : cachedRefs

      if (placeResult) setDetail(placeResult)

      const pid: string | null = placeRowResult?.id ?? null
      if (pid) setPlaceId(pid)

      if (contextPhotoUrls.length > 0) {
        setPhotoUrls(contextPhotoUrls)
      } else {
        const displayPhotos = await getPlaceDisplayPhotos(pid, providerRefs, 6)
        if (!cancelled) setPhotoUrls(displayPhotos)
      }

      if (pid && (placeResult?.rating != null || placeResult?.opening_hours?.open_now != null)) {
        cachePlaceGoogleData(pid, {
          google_rating: placeResult.rating ?? null,
          google_review_count: placeResult.user_ratings_total ?? null,
          open_now: placeResult.opening_hours?.open_now ?? null,
          open_now_checked_at:
            placeResult.opening_hours?.open_now == null ? null : new Date().toISOString(),
        })
      }
      if (pid && user) {
        analytics.viewPlace(user.id, pid, undefined, placeCuisineType, searchAttribution)
      }

      return pid
    }

    // Phase 3: fetch post ratings + save status from the DB.
    async function loadRatingsAndSaveStatus(pid: string): Promise<void> {
      const [rows, placeSaved] = await Promise.all([
        fetchPlacePostRatings(pid),
        user ? fetchIsPlaceSaved(user.id, pid) : Promise.resolve(false),
      ])

      if (cancelled) return

      if (rows.length > 0) {
        setDbRatings({
          food: weightedAvg(rows.map(r => ({ rating: r.food_rating, created_at: r.created_at }))),
          vibe: weightedAvg(rows.map(r => ({ rating: r.vibe_rating, created_at: r.created_at }))),
          cost: weightedAvg(rows.map(r => ({ rating: r.cost_rating, created_at: r.created_at }))),
        })
        setHasRecentReviews(
          rows.some(r => Date.now() - new Date(r.created_at).getTime() <= NINETY_DAYS_MS)
        )
        const dishCounts: Record<string, { count: number; dishId?: string }> = {}
        for (const r of rows) {
          const d = r.must_order?.trim()
          if (d) {
            const key = d.toLowerCase()
            const existing = dishCounts[key]
            const nextDishId: string | undefined = existing?.dishId ?? r.dish_id ?? undefined
            dishCounts[key] = {
              count: (existing?.count ?? 0) + 1,
              ...(nextDishId != null ? { dishId: nextDishId } : {}),
            }
          }
        }
        setTopDishes(
          Object.entries(dishCounts)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 3)
            .map(([name, metadata]) => ({
              name: name.charAt(0).toUpperCase() + name.slice(1),
              ...(metadata.dishId ? { dishId: metadata.dishId } : {}),
            }))
        )
      }

      if (placeSaved) setSaved(true)
    }

    async function load() {
      if (refreshTrigger === 0) setLoading(true)
      else setRefreshing(true)

      const resolved = await resolveGoogleId()
      if (cancelled) return

      const pid = await loadPlaceData(resolved)
      if (cancelled) return

      if (pid) await loadRatingsAndSaveStatus(pid)

      if (!cancelled) {
        setLoading(false)
        setRefreshing(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [routeGooglePlaceId, routePlaceId, user, displayName, refreshTrigger, contextPhotoUrls, placeCuisineType, searchAttribution])

  return useMemo(() => ({
    loading,
    refreshing,
    refresh: () => setRefreshTrigger(t => t + 1),
    detail,
    photoUrls,
    placeId,
    setPlaceId,
    saved,
    setSaved,
    dbRatings,
    hasRecentPosts,
    topDishes,
    resolvedGooglePlaceId,
    setResolvedGooglePlaceId,
  }), [loading, refreshing, detail, photoUrls, placeId, saved, dbRatings, hasRecentPosts, topDishes, resolvedGooglePlaceId])
}
