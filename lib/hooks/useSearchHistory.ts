import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState, useEffect, useCallback } from 'react'
import { analytics } from '../analytics'
import { useAuth } from '../contexts/AuthContext'
import { fetchRecentSearchHistory, fetchRecentSearchHistoryFallback } from '../services/search'
import { getCuisineSynonyms } from '../utils/cuisineSynonyms'
import { isStringArray, parseJsonWithGuard } from '../utils/safeJson'
import type { SearchHistoryRow } from '../services/search'

export type CuisineAffinities = Record<string, number>


function buildAffinities(queries: string[]): CuisineAffinities {
  const counts: Record<string, number> = {}
  for (const query of queries) {
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 1)
    for (const word of words) {
      const cuisines = getCuisineSynonyms(word)
      for (const cuisine of cuisines) {
        counts[cuisine] = (counts[cuisine] ?? 0) + 1
      }
    }
  }
  const max = Math.max(1, ...Object.values(counts))
  const result: CuisineAffinities = {}
  for (const [cuisine, count] of Object.entries(counts)) {
    result[cuisine] = count / max
  }
  return result
}

const CACHE_KEY_PREFIX = 'recentSearches'

function cacheKey(userId: string | undefined): string | null {
  return userId ? `${CACHE_KEY_PREFIX}:${userId}` : null
}

export function useSearchHistory(): {
  cuisineAffinities: CuisineAffinities
  recentSearches: string[]
  dismissSearch: (query: string) => void
} {
  const { user } = useAuth()
  const [cuisineAffinities, setCuisineAffinities] = useState<CuisineAffinities>({})
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Load account-scoped local cache immediately (zero network latency)
  useEffect(() => {
    const key = cacheKey(user?.id)
    if (!key) {
      setRecentSearches([])
      setCuisineAffinities({})
      void AsyncStorage.removeItem(CACHE_KEY_PREFIX)
      return
    }
    void AsyncStorage.removeItem(CACHE_KEY_PREFIX)
    void AsyncStorage.getItem(key).then(raw => {
      if (raw) {
        const parsed = parseJsonWithGuard(raw, isStringArray)
        if (parsed) setRecentSearches(parsed)
      }
    })
  }, [user?.id])

  // Sync from server and update cache
  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false

    async function loadSearchHistory() {
      let rows: SearchHistoryRow[] = []
      let rpcFailed = false
      try {
        rows = await fetchRecentSearchHistory(30, 30)
      } catch {
        rpcFailed = true
      }

      let queries = rows
        .map(row => row.query)
        .filter((q): q is string => typeof q === 'string' && q.trim().length > 1)

      if (rpcFailed) {
        try {
          queries = await fetchRecentSearchHistoryFallback(userId, 30)
        } catch {
          queries = []
        }
      }

      if (!cancelled) {
        setCuisineAffinities(buildAffinities(queries))
        const seen = new Set<string>()
        const deduped: string[] = []
        for (const q of queries) {
          const key = q.toLowerCase()
          if (!seen.has(key)) { seen.add(key); deduped.push(q) }
          if (deduped.length >= 10) break
        }
        setRecentSearches(deduped)
        const key = cacheKey(userId)
        if (key) void AsyncStorage.setItem(key, JSON.stringify(deduped))
      }
    }

    void loadSearchHistory()
    return () => {
      cancelled = true
    }
  }, [user])

  // Persistent delete — removes from local state, local cache, and analytics history.
  const dismissSearch = useCallback((query: string) => {
    setRecentSearches(prev => {
      const next = prev.filter(q => q.toLowerCase() !== query.toLowerCase())
      const key = cacheKey(user?.id)
      if (key) void AsyncStorage.setItem(key, JSON.stringify(next))
      return next
    })
    if (user) {
      analytics.dismissSearchQuery(user.id, query)
    }
  }, [user])

  return { cuisineAffinities, recentSearches, dismissSearch }
}
