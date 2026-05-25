import { useState, useEffect, useRef } from 'react'
import { isEnabled } from '../featureFlags'
import { fetchSearchSuggestions } from '../services/search'
import type { SearchSuggestion, UserLocation } from './searchTypes'

export function useAutocomplete(query: string, userLocation: UserLocation): SearchSuggestion[] {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    if (!isEnabled('searchAutocomplete')) return
    if (!query || query.length < 2) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      const data = await fetchSearchSuggestions(query, userLocation)
      if (requestId !== requestIdRef.current) return
      setSuggestions(data)
    }, 100)
    return () => {
      clearTimeout(timer)
      if (requestIdRef.current === requestId) requestIdRef.current += 1
    }
  }, [query, userLocation])

  return suggestions
}
