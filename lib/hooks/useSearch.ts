import { useState, useMemo, useEffect, useRef } from 'react'
import { analytics } from '@/lib/analytics'
import type { Post } from '@/types/domain'
import { useAutocomplete } from './useAutocomplete'
import { usePopularityCache } from './usePopularityCache'
import { useSavedPlaceIds } from './useSavedPlaceIds'
import { useSearchResults } from './useSearchResults'
import { usePosts } from '../contexts/PostsContext'
import {
  coarseLocationCacheKey,
  createSearchMemoryCache,
} from '../search/cache'
import { buildSearchContext } from '../search/context'
import { runSearchPipeline } from '../search/pipeline'
import { fetchPostsByIds, mapRowToPost } from '../services/posts'
import { type SearchFallbackReason, type SearchIntentKind } from '../utils/searchIntent'
import { parseWords, scorePost } from '../utils/searchScoring'
import type {
  DishResult,
  PersonResult,
  PlaceResult,
  RankedPostCandidate,
  SearchCandidate,
  SearchFilters,
  SearchMode,
  SearchOptions,
  SearchProviderPrediction,
  SearchSortMode,
  SearchSuggestion,
  SearchUserResult,
  UserLocation,
} from './searchTypes'
import type { CuisineAffinities } from './useSearchHistory'

const SEARCH_PIPELINE_CACHE = createSearchMemoryCache<Awaited<ReturnType<typeof runSearchPipeline>>>({
  maxEntries: 50,
  ttlMs: 30_000,
})

// Cost reduction: provider calls use fetchPlaceAutocompleteJson gated by shouldUseProviderFallback (both in lib/search/pipeline via B-570)

// Re-export shared types so existing callers keep working
export type { DishResult, PlaceResult, SearchCandidate, SearchFilters, UserLocation, SearchOptions, PersonResult, SearchMode, SearchSortMode, SearchSuggestion }

export function useSearch(
  query: string,
  userLocation: UserLocation = null,
  options: SearchOptions = {},
  searchAffinities: CuisineAffinities = {}
) {
  const { posts } = usePosts()
  const [dbUsers, setDbUsers] = useState<SearchUserResult[]>([])
  const [dbPlaces, setDbPlaces] = useState<PlaceResult[]>([])
  const [expandedDbPosts, setExpandedDbPosts] = useState<Post[]>([])
  const [expandedDbPlaces, setExpandedDbPlaces] = useState<PlaceResult[]>([])
  const [expansionCuisines, setExpansionCuisines] = useState<Array<{ cuisine_type: string; match_count: number }>>([])
  const [googlePredictions, setGooglePredictions] = useState<SearchProviderPrediction[]>([])
  const [interactionCounts, setInteractionCounts] = useState<Map<string, number>>(new Map())
  const [ftsPostIds, setFtsPostIds] = useState<RankedPostCandidate[]>([])
  const [ftsDbPosts, setFtsDbPosts] = useState<Post[]>([])
  const [dishPostIds, setDishPostIds] = useState<Map<string, { rank: number; match_source: string }>>(new Map())
  const [dishEntityResults, setDishEntityResults] = useState<DishResult[]>([])
  const [candidates, setCandidates] = useState<SearchCandidate[]>([])
  const [providerFallbackSuppressed, setProviderFallbackSuppressed] = useState(false)
  const [providerFallbackReason, setProviderFallbackReason] = useState<SearchFallbackReason | null>(null)
  const [queryIntent, setQueryIntent] = useState<SearchIntentKind>('general')
  const requestIdRef = useRef(0)

  const popularityCache = usePopularityCache()
  const savedRestaurantIds = useSavedPlaceIds(options.userId)
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
      setCandidates([])
      setProviderFallbackSuppressed(false)
      setProviderFallbackReason(null)
      setQueryIntent('general')
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
      setCandidates([])
      setProviderFallbackSuppressed(false)
      setProviderFallbackReason(null)
      setQueryIntent('general')
      return
    }
    const timer = setTimeout(async () => {
      const context = await buildSearchContext({
        query,
        userLocation,
        options: {
          mode,
          radiusKm,
          userId: options.userId,
          locationSource: options.locationSource,
        },
      })
      const pipelineCacheKey = [
        context.query,
        context.mode,
        context.radiusKm,
        coarseLocationCacheKey(context.userLocation),
        context.suburbFilter ?? 'none',
        posts.length,
      ].join(':')
      const cachedPipeline = SEARCH_PIPELINE_CACHE.get(pipelineCacheKey)
      const pipeline = cachedPipeline
        ? await cachedPipeline
        : await (() => {
            const request = runSearchPipeline(context, { posts })
            SEARCH_PIPELINE_CACHE.set(pipelineCacheKey, request)
            return request.then(result => {
              SEARCH_PIPELINE_CACHE.set(pipelineCacheKey, result)
              return result
            })
          })()
      if (requestId !== requestIdRef.current) return

      setDbUsers(pipeline.users)
      setDbPlaces(pipeline.places)
      setExpandedDbPosts(pipeline.expandedPosts)
      setExpandedDbPlaces(pipeline.expandedPlaces)
      setExpansionCuisines(pipeline.expansionCuisines)
      setGooglePredictions(pipeline.providerPredictions)
      setProviderFallbackSuppressed(pipeline.providerFallbackSuppressed)
      setProviderFallbackReason(pipeline.providerFallbackReason)
      setQueryIntent(context.intent)
      setCandidates(pipeline.candidates)
      if (pipeline.providerFallbackDecision.shouldUseGoogleFallback) {
        analytics.searchGoogleFallbackUsed(
          context.userId,
          context.query,
          context.intent,
          pipeline.providerFallbackDecision.reason,
          context.userLocation != null,
          context.locationSource,
          context.mode
        )
      } else if (pipeline.providerFallbackDecision.suppressed) {
        analytics.searchGoogleFallbackSuppressed(
          context.userId,
          context.query,
          context.intent,
          pipeline.providerFallbackDecision.reason,
          context.locationSource,
          context.mode
        )
      }

      // Dish search results map (Phase 3h scoring)
      if (pipeline.dishPosts.length > 0) {
        const dishMap = new Map<string, { rank: number; match_source: string }>()
        for (const r of pipeline.dishPosts) dishMap.set(r.id, { rank: r.rank, match_source: r.match_source })
        setDishPostIds(dishMap)
      } else {
        setDishPostIds(new Map())
      }

      // B-544: canonical dish entity results
      setDishEntityResults(pipeline.dishEntities)

      setInteractionCounts(new Map())

      const ftsMeta = pipeline.postFts
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
        pipeline.places.length +
        posts.filter(p => scorePost(p, words) > 0).length +
        pipeline.postFts.length
      if (resultCount === 0 && pipeline.providerFallbackDecision.suppressed) {
        analytics.searchNoResultsAfterSuppression(
          options.userId ?? null,
          context.query,
          context.intent,
          pipeline.providerFallbackDecision.reason,
          mode
        )
      }
      void analytics.search(options.userId ?? null, context.query, resultCount)
    }, 300)
    return () => {
      clearTimeout(timer)
      if (requestIdRef.current === requestId) requestIdRef.current += 1
    }
  // filters intentionally excluded: they only gate client-side scoring in useSearchResults,
  // never the RPC queries — adding filtersKey here would cause unnecessary refetches
  }, [query, wordsKey, words, userLocation, posts, isAroundMe, radiusKm, options.userId, options.locationSource, mode])

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
    candidates,
    suggestions,
    providerFallbackSuppressed,
    providerFallbackReason,
    queryIntent,
    hasQuery: words.length > 0 || isAroundMe,
    expansionLabel:
      expansionLabel && (postResults.length > 0 || placeResults.length > 0) ? expansionLabel : null,
  }
}
