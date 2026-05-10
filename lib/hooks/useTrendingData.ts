import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export type TrendingData = {
  trendingSearches: string[]
  trendingPlaceIds: string[]
}

export function useTrendingData(): TrendingData {
  const [trendingSearches, setTrendingSearches] = useState<string[]>([])
  const [trendingPlaceIds, setTrendingPlaceIds] = useState<string[]>([])

  useEffect(() => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    Promise.all([
      (supabase.from('analytics_events') as any)
        .select('metadata')
        .eq('event_type', 'search_query')
        .gte('created_at', since)
        .limit(200),
      (supabase.from('analytics_events') as any)
        .select('entity_id')
        .eq('event_type', 'place_click')
        .gte('created_at', since)
        .limit(200),
    ]).then(([searchRes, placeRes]) => {
      const queryCounts = new Map<string, number>()
      for (const row of searchRes.data ?? []) {
        const q = (row.metadata as any)?.query
        if (q && typeof q === 'string' && q.length > 1) {
          queryCounts.set(q, (queryCounts.get(q) ?? 0) + 1)
        }
      }
      setTrendingSearches(
        [...queryCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(e => e[0])
      )

      const placeCounts = new Map<string, number>()
      for (const row of placeRes.data ?? []) {
        if (row.entity_id) {
          placeCounts.set(row.entity_id, (placeCounts.get(row.entity_id) ?? 0) + 1)
        }
      }
      setTrendingPlaceIds(
        [...placeCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(e => e[0])
      )
    })
  }, [])

  return { trendingSearches, trendingPlaceIds }
}
