import { useState, useMemo, useEffect, useRef } from 'react'
import { analytics } from '@/lib/analytics'
import { fetchPlaceAutocompleteJson } from '@/lib/services/googlePlaces'
import type { Post } from '@/types/domain'
import { usePosts } from '../contexts/PostsContext'
import { isEnabled } from '../featureFlags'
import { useAutocomplete } from './useAutocomplete'
import { usePopularityCache } from './usePopularityCache'
import { useSavedRestaurants } from './useSavedRestaurants'
import { useSearchResults } from './useSearchResults'
import { fetchPostsByIds, mapRowToPost } from '../services/posts'
import { resolveSearchExpansion, searchDishes, searchDishPostIds, searchPlaces, searchPostIds, searchUsers } from '../services/search'
import { resolveFromAliasCache, resolveSuburbQuery, cacheResolvedSuburb } from '../utils/locationResolver'
import { parseSearchQuery, fallbackParsedQuery } from '../utils/queryParser'
import { isRecord } from '../utils/safeJson'
import { parseWords, scorePost, scorePlace, boundingBoxForRadius } from '../utils/searchScoring'
import type { DishResult, PlaceResult, SearchFilters, UserLocation, SearchOptions, PersonResult, SearchMode, SearchSortMode, SearchSuggestion } from './searchTypes'
import type { CuisineAffinities } from './useSearchHistory'


// Re-export shared types so existing callers keep working
export type { DishResult, PlaceResult, SearchFilters, UserLocation, SearchOptions, PersonResult, SearchMode, SearchSortMode, SearchSuggestion }

export type AutocompletePrediction = {
  place_id: string
  structured_formatting: { main_text: string; secondary_text: string }
  types: string[]
}

function isAutocompletePrediction(value: unknown): value is AutocompletePrediction {
  if (!isRecord(value) || !isRecord(value.structured_formatting)) return false
  return (
    typeof value.place_id === 'string' &&
    Array.isArray(value.types) &&
    value.types.every(type => typeof type === 'string') &&
    typeof value.structured_formatting.main_text === 'string' &&
    typeof value.structured_formatting.secondary_text === 'string'
  )
}

export function useSearch(
  query: string,
  userLocation: UserLocation = null,
  options: SearchOptions = {},
  searchAffinities: CuisineAffinities = {}
) {
  const { posts } = usePosts()
  const [dbUsers, setDbUsers] = useState<
    Array<{ id: string; username: string; full_name: string | null }>
  >([])
  const [dbPlaces, setDbPlaces] = useState<PlaceResult[]>([])
  const [expandedDbPosts, setExpandedDbPosts] = useState<Post[]>([])
  const [expandedDbPlaces, setExpandedDbPlaces] = useState<PlaceResult[]>([])
  const [expansionCuisines, setExpansionCuisines] = useState<Array<{ cuisine_type: string; match_count: number }>>([])
  const [googlePredictions, setGooglePredictions] = useState<AutocompletePrediction[]>([])
  const [interactionCounts, setInteractionCounts] = useState<Map<string, number>>(new Map())
  const [ftsPostIds, setFtsPostIds] = useState<Array<{ id: string; rank: number }>>([])
  const [ftsDbPosts, setFtsDbPosts] = useState<Post[]>([])
  const [dishPostIds, setDishPostIds] = useState<Map<string, { rank: number; match_source: string }>>(new Map())
  const [dishEntityResults, setDishEntityResults] = useState<DishResult[]>([])
  const requestIdRef = useRef(0)

  const popularityCache = usePopularityCache()
  const savedRestaurantIds = useSavedRestaurants(options.userId)
  const suggestions = useAutocomplete(query, userLocation)

  const words = useMemo(() => parseWords(query), [query])
  const wordsKey = words.join(',')
  const mode = options.mode ?? 'search'
  const radiusKm = options.radiusKm ?? 10
  const isAroundMe = mode === 'aroundMe'
  const filters = options.filters
  const filtersKey = JSON.stringify(filters ?? {})

  useEffect(() => {
    const requestId = ++requestIdRef.current
    if (words.length === 0 && !isAroundMe) {
      setDbUsers([])
      setDbPlaces([])
      setExpandedDbPosts([])
      setExpandedDbPlaces([])
      setExpansionCuisines([])
      setGooglePredictions([])
      setInteractionCounts(new Map())
      setDishEntityResults([])
      return
    }
    if (isAroundMe && !userLocation) {
      setDbUsers([])
      setDbPlaces([])
      setExpandedDbPosts([])
      setExpandedDbPlaces([])
      setExpansionCuisines([])
      setGooglePredictions([])
      setInteractionCounts(new Map())
      setDishEntityResults([])
      return
    }
    const q = words.join(' ')
    const timer = setTimeout(async () => {
      // Phase 3c: Parse query intent
      let parsed = fallbackParsedQuery(q)
      try { parsed = parseSearchQuery(q) } catch { /* fallback already set */ }

      // Phase 3d: Suburb resolution — tier 1 sync (alias cache), tier 2 DB before paid fallback
      let suburbFilter: string | undefined
      if (parsed.locationTerms.length > 0) {
        const locationPhrase = parsed.locationTerms.join(' ')
        suburbFilter = resolveFromAliasCache(locationPhrase) ?? undefined
        if (!suburbFilter) {
          try {
            const resolved = await resolveSuburbQuery(locationPhrase)
            if (resolved) suburbFilter = resolved
          } catch {
            // Search still works without suburb enrichment; provider fallback remains explicit below.
          }
        }
      }

      const placeQuery = searchPlaces(
        parsed.searchWords.join(' ') || q,
        userLocation,
        isAroundMe && userLocation ? boundingBoxForRadius(userLocation, radiusKm) : undefined,
        suburbFilter
      )

      // Dish intent path (Phase 3d): fire search_posts_by_dish in parallel
      const dishIntentActive =
        !isAroundMe &&
        (parsed.intent === 'dish' || parsed.intent === 'mixed') &&
        parsed.dishTerms.length > 0
      const dishSearchPromise = dishIntentActive
        ? searchDishPostIds(parsed.dishTerms.join(' '), userLocation)
        : Promise.resolve([])
      // B-544: canonical dish entity results in parallel with post results
      const dishEntityPromise = dishIntentActive
        ? searchDishes(parsed.dishTerms.join(' '), userLocation)
        : Promise.resolve([])

      // Geocoding fallback — only when flag is on AND all DB tiers missed
      const geoPromise =
        isEnabled('locationGeocodeFallback') &&
        parsed.locationTerms.length > 0 && !suburbFilter && !userLocation
          ? fetchPlaceAutocompleteJson(parsed.locationTerms.join(' '), null).then(res => ({
              predictions: (res.predictions ?? []).filter(isAutocompletePrediction),
            }))
          : Promise.resolve({ predictions: [] })

      const [users, placesRes, postFtsRes, dishRes, _geoRes, dishEntityRes] = await Promise.all([
        searchUsers(q),
        placeQuery,
        isAroundMe ? Promise.resolve([]) : searchPostIds(parsed.searchWords.join(' ') || q, userLocation),
        dishSearchPromise,
        geoPromise,
        dishEntityPromise,
      ])

      // Feed geocoding result back into suburb_lookups (data flywheel)
      if (isEnabled('locationGeocodeFallback') && parsed.locationTerms.length > 0 && suburbFilter == null) {
        type GeoRow = { structured_formatting?: { main_text?: string } }
        const prediction: GeoRow | undefined = _geoRes.predictions?.[0]
        if (prediction?.structured_formatting?.main_text) {
          void cacheResolvedSuburb({ name: prediction.structured_formatting.main_text })
        }
      }
      const placesData = placesRes
      const strictPostCount = isAroundMe ? 0 : posts.filter(p => scorePost(p, words) > 0).length
      const strictPlaceCount = isAroundMe
        ? (placesData ?? []).length
        : (placesData ?? []).filter(p => scorePlace(p, words) > 0).length

      const { cuisines, expandedPosts, expandedPlaces } = await resolveSearchExpansion({
        isAroundMe,
        strictPostCount,
        strictPlaceCount,
        words,
        q,
      })
      const shouldUseProviderFallback =
        !isAroundMe &&
        strictPlaceCount === 0 &&
        expandedPlaces.filter(p => scorePlace(p, words) > 0).length === 0
      const googleRes = shouldUseProviderFallback
        ? await fetchPlaceAutocompleteJson(q, userLocation)
        : { predictions: [] }
      if (requestId !== requestIdRef.current) return
      setDbUsers(users)
      setDbPlaces(placesData)
      setExpandedDbPosts(expandedPosts)
      setExpandedDbPlaces(expandedPlaces)
      setExpansionCuisines(cuisines)
      setGooglePredictions((googleRes.predictions ?? []).filter(isAutocompletePrediction))

      // Dish search results map (Phase 3h scoring)
      if (dishRes.length > 0) {
        const dishMap = new Map<string, { rank: number; match_source: string }>()
        for (const r of dishRes) dishMap.set(r.id, { rank: r.rank, match_source: r.match_source })
        setDishPostIds(dishMap)
      } else {
        setDishPostIds(new Map())
      }

      // B-544: canonical dish entity results
      setDishEntityResults(dishEntityRes)

      setInteractionCounts(new Map())

      const ftsMeta = postFtsRes
      setFtsPostIds(ftsMeta)
      if (ftsMeta.length > 0) {
        const contextIds = new Set(posts.map(p => p.dbId).filter(Boolean))
        const missingIds = ftsMeta.map(r => r.id).filter(id => !contextIds.has(id))
        if (missingIds.length > 0) {
          const rows = await fetchPostsByIds(missingIds)
          if (requestId !== requestIdRef.current) return
          setFtsDbPosts(rows.map((row, i) => mapRowToPost(row, i)))
        } else {
          setFtsDbPosts([])
        }
      } else {
        setFtsDbPosts([])
      }

      // Log search to analytics_events for trending + history
      const resultCount =
        placesRes.length +
        posts.filter(p => scorePost(p, words) > 0).length +
        postFtsRes.length
      void analytics.search(options.userId ?? null, q, resultCount)
    }, 300)
    return () => {
      clearTimeout(timer)
      if (requestIdRef.current === requestId) requestIdRef.current += 1
    }
  // filters intentionally excluded: they only gate client-side scoring in useSearchResults,
  // never the RPC queries — adding filtersKey here would cause unnecessary refetches
  }, [wordsKey, words, userLocation, posts, isAroundMe, radiusKm, options.userId])

  const { postResults, peopleResults, placeResults, placeDistances, expansionLabel } = useSearchResults({
    posts,
    ftsDbPosts,
    ftsPostIds,
    expandedDbPosts,
    dishPostIds,
    dbUsers,
    words,
    userLocation,
    expansionCuisines,
    isAroundMe,
    filters,
    filtersKey,
    dbPlaces,
    expandedDbPlaces,
    googlePredictions,
    interactionCounts,
    popularityCache,
    savedRestaurantIds,
    radiusKm,
    searchAffinities,
    query,
  })

  return {
    postResults,
    peopleResults,
    placeResults,
    placeDistances,
    dishEntityResults,
    suggestions,
    hasQuery: words.length > 0 || isAroundMe,
    expansionLabel:
      expansionLabel && (postResults.length > 0 || placeResults.length > 0) ? expansionLabel : null,
  }
}
