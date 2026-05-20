import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { CUISINE_SYNONYMS } from '../utils/cuisineSynonyms'
import { analytics } from '../analytics'

export type CuisineAffinities = Record<string, number>

type SearchHistoryRow = {
  query: string
  last_searched_at: string
  search_count: number
}

function buildAffinities(queries: string[]): CuisineAffinities {
  const counts: Record<string, number> = {}
  for (const query of queries) {
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 1)
    for (const word of words) {
      const cuisines = CUISINE_SYNONYMS[word] ?? []
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

const CACHE_KEY = 'recentSearches'

export function useSearchHistory(): {
  cuisineAffinities: CuisineAffinities
  recentSearches: string[]
  dismissSearch: (query: string) => void
} {
  const { user } = useAuth()
  const [cuisineAffinities, setCuisineAffinities] = useState<CuisineAffinities>({})
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Load from local cache immediately (zero network latency)
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(raw => {
      if (raw) {
        try { setRecentSearches(JSON.parse(raw)) } catch {}
      }
    })
  }, [])

  // Sync from server and update cache
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function loadSearchHistory() {
      const { data, error } = await (supabase.rpc as any)('get_recent_search_history', {
        max_results: 30,
        lookback_days: 30,
      })

      let queries = ((data ?? []) as SearchHistoryRow[])
        .map(row => row.query)
        .filter((q): q is string => typeof q === 'string' && q.trim().length > 1)

      if (error) {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const fallback = await (supabase.from('analytics_events') as any)
          .select('metadata, created_at')
          .eq('user_id', user!.id)
          .eq('event_type', 'search_query')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(200)
        queries = (fallback.data ?? [])
          .map((row: { metadata?: { query?: string } }) => row.metadata?.query)
          .filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 1)
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
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(deduped))
      }
    }

    loadSearchHistory()
    return () => {
      cancelled = true
    }
  }, [user])

  // Persistent delete — removes from local state, local cache, and analytics history.
  const dismissSearch = useCallback((query: string) => {
    setRecentSearches(prev => {
      const next = prev.filter(q => q.toLowerCase() !== query.toLowerCase())
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next))
      return next
    })
    if (user) {
      analytics.dismissSearchQuery(user.id, query)
    }
  }, [user])

  return { cuisineAffinities, recentSearches, dismissSearch }
}
