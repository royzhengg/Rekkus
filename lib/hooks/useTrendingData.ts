import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

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

    Promise.all([
      (supabase as any)
        .from('trending_searches')
        .select('query')
        .order('score', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(6),
      (supabase.from('analytics_events') as any)
        .select('entity_id')
        .eq('event_type', 'place_click')
        .gte('created_at', since)
        .limit(200),
      (supabase.from('analytics_events') as any)
        .select('event_type, entity_id')
        .eq('entity_type', 'post')
        .in('event_type', ['post_view', 'post_like', 'post_save', 'post_dwell'])
        .gte('created_at', since)
        .limit(500),
    ]).then(([trendingSearchRes, placeRes, postRes]) => {
      const queries: string[] = []
      const seenQueries = new Set<string>()
      for (const row of trendingSearchRes.data ?? []) {
        const query = typeof row.query === 'string' ? row.query.trim() : ''
        const key = query.toLowerCase()
        if (query.length > 1 && !seenQueries.has(key)) {
          seenQueries.add(key)
          queries.push(query)
        }
      }
      setTrendingSearches(queries)

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

      const postCounts = new Map<string, number>()
      const weights: Record<string, number> = {
        post_view: 1,
        post_like: 2,
        post_save: 5,
        post_dwell: 1.5,
      }
      for (const row of postRes.data ?? []) {
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
    })
  }, [])

  return { trendingSearches, trendingPlaceIds, trendingPostIds }
}
