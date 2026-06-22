import { useState, useMemo, useEffect, useRef } from 'react'
import { analytics } from '@/lib/analytics'
import type { Post } from '@/types/domain'
import { useAutocomplete } from './useAutocomplete'
import { useSearchResults } from './useSearchResults'
import { usePosts } from '../contexts/PostsContext'
import {
  coarseLocationCacheKey,
  createSearchMemoryCache,
} from '../search/cache'
import { buildSearchContext } from '../search/context'
import { runSearchPipeline } from '../search/pipeline'
import { type SearchFallbackReason, type SearchIntentKind } from '../utils/searchIntent'
import { parseWords } from '../utils/searchScoring'
import type {
  DishResult,
  PersonResult,
  PlaceResult,
  SearchCandidate,
  SearchFilters,
  SearchMode,
  SearchOptions,
  SearchSortMode,
  SearchSuggestion,
  TopFeedItem,
  UserLocation,
} from './searchTypes'
import type { CuisineAffinities } from './useSearchHistory'

const SEARCH_PIPELINE_CACHE = createSearchMemoryCache<Awaited<ReturnType<typeof runSearchPipeline>>>({
  maxEntries: 50,
  ttlMs: 30_000,
})

// Cost reduction: provider calls use fetchPlaceAutocompleteJson gated by shouldUseProviderFallback (both in lib/search/pipeline via B-570)

// Re-export shared types so existing callers keep working
export type { DishResult, PlaceResult, SearchCandidate, SearchFilters, TopFeedItem, UserLocation, SearchOptions, PersonResult, SearchMode, SearchSortMode, SearchSuggestion }

export function useSearch(
  query: string,
  userLocation: UserLocation = null,
  options: SearchOptions = {},
  searchAffinities: CuisineAffinities = {}
) {
  const { posts } = usePosts()
  const [expansionCuisines, setExpansionCuisines] = useState<Array<{ cuisine_type: string; match_count: number }>>([])
  const [dishEntityResults, setDishEntityResults] = useState<DishResult[]>([])
  const [candidates, setCandidates] = useState<SearchCandidate[]>([])
  const [hydratedPosts, setHydratedPosts] = useState<Post[]>([])
  const [providerFallbackSuppressed, setProviderFallbackSuppressed] = useState(false)
  const [providerFallbackReason, setProviderFallbackReason] = useState<SearchFallbackReason | null>(null)
  const [queryIntent, setQueryIntent] = useState<SearchIntentKind>('general')
  const requestIdRef = useRef(0)

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
      setExpansionCuisines([])
      setDishEntityResults([])
      setCandidates([])
      setHydratedPosts([])
      setProviderFallbackSuppressed(false)
      setProviderFallbackReason(null)
      setQueryIntent('general')
      return
    }
    if (isAroundMe && !userLocation) {
      setExpansionCuisines([])
      setDishEntityResults([])
      setCandidates([])
      setHydratedPosts([])
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
        context.userId ?? 'anon',
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

      setExpansionCuisines(pipeline.expansionCuisines)
      setProviderFallbackSuppressed(pipeline.providerFallbackSuppressed)
      setProviderFallbackReason(pipeline.providerFallbackReason)
      setQueryIntent(context.intent)
      setCandidates(pipeline.candidates)
      setHydratedPosts(pipeline.hydratedPosts)

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

      setDishEntityResults(pipeline.dishEntities)

      // Log search to analytics_events for trending + history
      const resultCount = pipeline.candidates.length
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

  const { postResults, peopleResults, placeResults, placeDistances, expansionLabel, topFeed } = useSearchResults({
    candidates,
    hydratedPosts,
    posts,
    words,
    userLocation,
    expansionCuisines,
    isAroundMe,
    filters,
    filtersKey,
    query,
    searchAffinities,
  })

  return {
    postResults,
    peopleResults,
    placeResults,
    placeDistances,
    dishEntityResults,
    topFeed,
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
