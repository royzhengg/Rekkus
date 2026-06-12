import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPersonalizedSuggestions } from '@/lib/services/searchPersonalization'
import type { CuisineAffinities } from './useSearchHistory'

export type NoResultsSuggestionChip = {
  label: string
  query: string
  emoji?: string
}

export type UserTasteContext = {
  userId?: string | null
  cuisineAffinities: CuisineAffinities
  viewedCuisines?: string[]
  recentSearches: string[]
  trendingSearches: string[]
  staticFallbacks: NoResultsSuggestionChip[]
}

const SUGGESTION_LIMIT = 3
const SERVER_SUGGESTION_DEBOUNCE_MS = 200
const EMPTY_VIEWED_CUISINES: string[] = []

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

function labelFromQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function chipForQuery(
  query: string,
  fallbackByQuery: ReadonlyMap<string, NoResultsSuggestionChip>
): NoResultsSuggestionChip | null {
  const normalized = normalizeQuery(query)
  if (!normalized) return null
  const fallback = fallbackByQuery.get(normalized)
  if (fallback) return fallback
  return {
    label: labelFromQuery(query),
    query: query.trim().replace(/\s+/g, ' '),
  }
}

export function useNoResultsSuggestions(
  failedQuery: string,
  {
    userId,
    cuisineAffinities,
    viewedCuisines = EMPTY_VIEWED_CUISINES,
    recentSearches,
    trendingSearches,
    staticFallbacks,
  }: UserTasteContext
): NoResultsSuggestionChip[] {
  const localSuggestions = useMemo(() => {
    const fallbackByQuery = new Map<string, NoResultsSuggestionChip>()
    for (const fallback of staticFallbacks) {
      const key = normalizeQuery(fallback.query)
      if (key && !fallbackByQuery.has(key)) {
        fallbackByQuery.set(key, fallback)
      }
    }

    const failedKey = normalizeQuery(failedQuery)
    const seen = new Set<string>(failedKey ? [failedKey] : [])
    const suggestions: NoResultsSuggestionChip[] = []

    function addQuery(query: string) {
      if (suggestions.length >= SUGGESTION_LIMIT) return
      const key = normalizeQuery(query)
      if (!key || seen.has(key)) return
      const chip = chipForQuery(query, fallbackByQuery)
      if (!chip) return
      seen.add(key)
      suggestions.push(chip)
    }

    Object.entries(cuisineAffinities)
      .filter(([, score]) => score > 0)
      .sort(([leftCuisine, leftScore], [rightCuisine, rightScore]) => {
        if (rightScore !== leftScore) return rightScore - leftScore
        return leftCuisine.localeCompare(rightCuisine)
      })
      .forEach(([cuisine]) => addQuery(cuisine))

    viewedCuisines.forEach(addQuery)
    recentSearches.forEach(addQuery)
    trendingSearches.forEach(addQuery)
    staticFallbacks.forEach(chip => addQuery(chip.query))

    return suggestions
  }, [cuisineAffinities, failedQuery, recentSearches, staticFallbacks, trendingSearches, viewedCuisines])

  const localSuggestionsKey = useMemo(
    () => localSuggestions.map(chip => normalizeQuery(chip.query)).join('\0'),
    [localSuggestions]
  )
  const [serverSuggestions, setServerSuggestions] = useState<NoResultsSuggestionChip[] | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    setServerSuggestions(prev => (prev === null ? prev : null))

    const normalizedFailedQuery = normalizeQuery(failedQuery)
    if (!userId || !normalizedFailedQuery) return

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const serverSuggestions = await fetchPersonalizedSuggestions(
            userId,
            failedQuery,
            SUGGESTION_LIMIT
          )
          if (requestId !== requestIdRef.current) return
          if (serverSuggestions.length === 0) return
          const fallbackByQuery = new Map<string, NoResultsSuggestionChip>()
          for (const fallback of staticFallbacks) {
            fallbackByQuery.set(normalizeQuery(fallback.query), fallback)
          }
          const serverChips = serverSuggestions
            .map(suggestion => chipForQuery(suggestion.query, fallbackByQuery))
            .filter((chip): chip is NoResultsSuggestionChip => chip !== null)
            .slice(0, SUGGESTION_LIMIT)
          if (serverChips.length > 0) setServerSuggestions(serverChips)
        } catch {
          // Local suggestions remain the fallback when server personalization is unavailable.
        }
      })()
    }, SERVER_SUGGESTION_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      if (requestIdRef.current === requestId) requestIdRef.current += 1
    }
  }, [failedQuery, localSuggestionsKey, staticFallbacks, userId])

  return serverSuggestions ?? localSuggestions
}
