import { useMemo } from 'react'
import type { CuisineAffinities } from './useSearchHistory'

export type NoResultsSuggestionChip = {
  label: string
  query: string
  emoji?: string
}

export type UserTasteContext = {
  cuisineAffinities: CuisineAffinities
  recentSearches: string[]
  trendingSearches: string[]
  staticFallbacks: NoResultsSuggestionChip[]
}

const SUGGESTION_LIMIT = 3

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
    cuisineAffinities,
    recentSearches,
    trendingSearches,
    staticFallbacks,
  }: UserTasteContext
): NoResultsSuggestionChip[] {
  return useMemo(() => {
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

    recentSearches.forEach(addQuery)
    trendingSearches.forEach(addQuery)
    staticFallbacks.forEach(chip => addQuery(chip.query))

    return suggestions
  }, [cuisineAffinities, failedQuery, recentSearches, staticFallbacks, trendingSearches])
}
