import { useState, useEffect, useRef } from 'react'
import {
  coarseLocationCacheKey,
  createSearchMemoryCache,
  normalizedSearchCacheQuery,
} from '../search/cache'
import { buildSearchContext } from '../search/context'
import { fetchSearchAutocomplete } from '../services/search'
import type { SearchSuggestion, UserLocation } from './searchTypes'

const AUTOCOMPLETE_CACHE = createSearchMemoryCache<SearchSuggestion[]>({
  maxEntries: 50,
  ttlMs: 60_000,
})

export function __clearAutocompleteCacheForTest(): void {
  AUTOCOMPLETE_CACHE.clear()
}

export function useAutocomplete(query: string, userLocation: UserLocation): SearchSuggestion[] {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    if (!query || query.length < 2) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      const normalizedQuery = normalizedSearchCacheQuery(query)
      const cacheKey = `${normalizedQuery}:${coarseLocationCacheKey(userLocation)}`
      try {
        const cached = AUTOCOMPLETE_CACHE.get(cacheKey)
        if (cached) {
          const data = await cached
          if (requestId !== requestIdRef.current) return
          setSuggestions(data)
          return
        }
        const request = buildSearchContext({ query, userLocation }).then(fetchSearchAutocomplete)
        AUTOCOMPLETE_CACHE.set(cacheKey, request)
        const data = await request
        AUTOCOMPLETE_CACHE.set(cacheKey, data)
        if (requestId !== requestIdRef.current) return
        setSuggestions(data)
      } catch {
        if (requestId !== requestIdRef.current) return
        setSuggestions([])
      }
    }, 100)
    return () => {
      clearTimeout(timer)
      if (requestIdRef.current === requestId) requestIdRef.current += 1
    }
  }, [query, userLocation])

  return suggestions
}
