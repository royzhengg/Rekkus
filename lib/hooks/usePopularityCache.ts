import { useState, useRef, useEffect  } from 'react'
import { fetchPopularityCache } from '../services/restaurants'
import type { PopularityCacheRow } from '../services/restaurants'

export type { PopularityCacheRow }

export function usePopularityCache(): Map<string, PopularityCacheRow> {
  const [popularityCache, setPopularityCache] = useState<Map<string, PopularityCacheRow>>(new Map())
  const loadedAt = useRef<number | null>(null)

  useEffect(() => {
    const now = Date.now()
    if (loadedAt.current && now - loadedAt.current < 30 * 60 * 1000) return
    void fetchPopularityCache(2000).then(rows => {
      const map = new Map<string, PopularityCacheRow>()
      for (const row of rows) map.set(row.restaurant_id, row)
      setPopularityCache(map)
      loadedAt.current = Date.now()
    })
  }, [])

  return popularityCache
}
