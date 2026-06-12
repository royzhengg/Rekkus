import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { analytics } from '../analytics'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchRecentSearchHistory,
  fetchRecentSearchHistoryFallback,
  fetchSavedSearches,
  normalizeSavedSearchQuery,
  saveSearch as persistSavedSearch,
  unsaveSearch as deleteSavedSearch,
} from '../services/search'
import { getCuisineSynonyms } from '../utils/cuisineSynonyms'
import { isRecord, isStringArray, parseJsonWithGuard } from '../utils/safeJson'
import type { SearchFilters } from './searchTypes'
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
const SEARCH_STATE_KEY_PREFIX = 'savedSearchState'

type PersistedSearchState = {
  filters: SearchFilters
  radiusKm: number
}

function isPersistedSearchState(v: unknown): v is PersistedSearchState {
  if (!isRecord(v)) return false
  if (typeof v.radiusKm !== 'number') return false
  if (!isRecord(v.filters)) return false
  return true
}

export async function loadPersistedSearchState(
  userId: string | undefined
): Promise<PersistedSearchState | null> {
  if (!userId) return null
  try {
    const raw = await AsyncStorage.getItem(`${SEARCH_STATE_KEY_PREFIX}:${userId}`)
    if (!raw) return null
    return parseJsonWithGuard(raw, isPersistedSearchState)
  } catch {
    return null
  }
}

export function persistSearchState(
  state: PersistedSearchState,
  userId: string | undefined
): void {
  if (!userId) return
  void AsyncStorage.setItem(`${SEARCH_STATE_KEY_PREFIX}:${userId}`, JSON.stringify(state))
}

function cacheKey(userId: string | undefined): string | null {
  return userId ? `${CACHE_KEY_PREFIX}:${userId}` : null
}

function savedSearchKey(query: string): string {
  return normalizeSavedSearchQuery(query).toLowerCase()
}

function promoteSavedSearch(prev: string[], query: string): string[] {
  const cleaned = normalizeSavedSearchQuery(query)
  if (cleaned.length <= 1) return prev
  const key = cleaned.toLowerCase()
  return [cleaned, ...prev.filter(item => savedSearchKey(item) !== key)]
}

export function useSearchHistory(): {
  cuisineAffinities: CuisineAffinities
  dismissedCuisines: CuisineAffinities
  recentSearches: string[]
  savedSearches: string[]
  dismissSearch: (query: string) => void
  saveSearch: (query: string) => void
  unsaveSearch: (query: string) => void
} {
  const { user } = useAuth()
  const [cuisineAffinities, setCuisineAffinities] = useState<CuisineAffinities>({})
  const [dismissedQueries, setDismissedQueries] = useState<string[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [savedSearches, setSavedSearches] = useState<string[]>([])
  const dismissedCuisines = useMemo(() => buildAffinities(dismissedQueries), [dismissedQueries])

  // Load account-scoped local cache immediately (zero network latency)
  useEffect(() => {
    const key = cacheKey(user?.id)
    if (!key) {
      setRecentSearches([])
      setCuisineAffinities({})
      setDismissedQueries([])
      void AsyncStorage.removeItem(CACHE_KEY_PREFIX)
      return
    }
    setDismissedQueries([])
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

  useEffect(() => {
    if (!user?.id) {
      setSavedSearches([])
      return
    }
    let cancelled = false
    void fetchSavedSearches(user.id, 50)
      .then(searches => {
        if (!cancelled) setSavedSearches(searches)
      })
      .catch(() => {
        if (!cancelled) setSavedSearches([])
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Persistent delete — removes from local state, local cache, and analytics history.
  const dismissSearch = useCallback((query: string) => {
    const dismissedQuery = normalizeSavedSearchQuery(query)
    setRecentSearches(prev => {
      const next = prev.filter(q => q.toLowerCase() !== dismissedQuery.toLowerCase())
      const key = cacheKey(user?.id)
      if (key) void AsyncStorage.setItem(key, JSON.stringify(next))
      return next
    })
    if (dismissedQuery.length > 1) {
      setDismissedQueries(prev => {
        const next = [dismissedQuery, ...prev.filter(q => q.toLowerCase() !== dismissedQuery.toLowerCase())]
        return next.slice(0, 30)
      })
    }
    if (user) {
      analytics.dismissSearchQuery(user.id, query)
    }
  }, [user])

  const saveSearch = useCallback((query: string) => {
    if (!user) return
    const cleaned = normalizeSavedSearchQuery(query)
    if (cleaned.length <= 1) return
    let previousSavedSearches: string[] = []
    setSavedSearches(prev => {
      previousSavedSearches = prev
      return promoteSavedSearch(prev, cleaned)
    })
    void persistSavedSearch(cleaned)
      .then(savedQuery => {
        setSavedSearches(prev => promoteSavedSearch(prev, savedQuery))
        analytics.saveSearch(user.id, savedQuery)
      })
      .catch(() => {
        setSavedSearches(previousSavedSearches)
      })
  }, [user])

  const unsaveSearch = useCallback((query: string) => {
    if (!user) return
    const key = savedSearchKey(query)
    if (key.length <= 1) return
    let previousSavedSearches: string[] = []
    setSavedSearches(prev => {
      previousSavedSearches = prev
      return prev.filter(item => savedSearchKey(item) !== key)
    })
    void deleteSavedSearch(query)
      .then(() => {
        analytics.unsaveSearch(user.id, query)
      })
      .catch(() => {
        setSavedSearches(previousSavedSearches)
      })
  }, [user])

  return {
    cuisineAffinities,
    dismissedCuisines,
    recentSearches,
    savedSearches,
    dismissSearch,
    saveSearch,
    unsaveSearch,
  }
}
