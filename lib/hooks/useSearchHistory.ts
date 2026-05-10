import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { CUISINE_SYNONYMS } from '../utils/cuisineSynonyms'

export type CuisineAffinities = Record<string, number>

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

export function useSearchHistory(): { cuisineAffinities: CuisineAffinities } {
  const { user } = useAuth()
  const [cuisineAffinities, setCuisineAffinities] = useState<CuisineAffinities>({})

  useEffect(() => {
    if (!user) return
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    // TODO: swap for aggregated view once event volume grows
    ;(supabase.from('analytics_events') as any)
      .select('metadata')
      .eq('user_id', user.id)
      .eq('event_type', 'search_query')
      .gte('created_at', since)
      .limit(200)
      .then(({ data }: { data: { metadata: { query?: string } }[] | null }) => {
        const queries = (data ?? [])
          .map(row => row.metadata?.query)
          .filter((q): q is string => typeof q === 'string' && q.length > 1)
        setCuisineAffinities(buildAffinities(queries))
      })
  }, [user])

  return { cuisineAffinities }
}
