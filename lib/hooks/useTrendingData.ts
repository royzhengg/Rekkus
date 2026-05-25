import { useState, useEffect } from 'react'
import { fetchTrendingPlaceClicks, fetchTrendingPostEvents, fetchTrendingSearches } from '../services/search'

export type TrendingData = {
  trendingSearches: string[]
  trendingPlaceIds: string[]
  trendingPostIds: string[]
}

export function useTrendingData(): TrendingData {
  const [trendingSearches, setTrendingSearches] = useState<string[]>([])
  const [trendingPlaceIds, setTrendingPlaceIds] = useState<string[]>([])
  const [trendingPostIds, setTrendingPostIds] = useState<string[]>([])

  useEffect(() => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    void Promise.all([
      fetchTrendingSearches(6),
      fetchTrendingPlaceClicks(since),
      fetchTrendingPostEvents(since),
    ]).then(([trendingSearchRows, placeRows, postRows]) => {
      const queries: string[] = []
      const seenQueries = new Set<string>()
      for (const row of trendingSearchRows) {
        const query = typeof row.query === 'string' ? row.query.trim() : ''
        const key = query.toLowerCase()
        if (query.length > 1 && !seenQueries.has(key)) {
          seenQueries.add(key)
          queries.push(query)
        }
      }
      setTrendingSearches(queries)

      const placeCounts = new Map<string, number>()
      for (const row of placeRows) {
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

      const postCounts = new Map<string, number>()
      const weights: Record<string, number> = {
        post_view: 1,
        post_like: 2,
        post_save: 5,
        post_dwell: 1.5,
      }
      for (const row of postRows) {
        if (row.entity_id) {
          postCounts.set(row.entity_id, (postCounts.get(row.entity_id) ?? 0) + (weights[row.event_type] ?? 1))
        }
      }
      setTrendingPostIds(
        [...postCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(e => e[0])
      )
    }).catch(() => {
      setTrendingSearches([])
      setTrendingPlaceIds([])
      setTrendingPostIds([])
    })
  }, [])

  return { trendingSearches, trendingPlaceIds, trendingPostIds }
}
