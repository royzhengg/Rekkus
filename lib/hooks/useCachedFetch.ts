import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'

type Options<T> = {
  fetch: () => Promise<T extends Set<infer U> ? U[] : T>
  initial: T
  returnSet?: boolean
}

type Result<T> = {
  data: T
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useCachedFetch<T>({ fetch, initial, returnSet }: Options<T>): Result<T> {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const raw = await fetch()
      setData(returnSet ? (new Set(raw as unknown[]) as T) : (raw as T))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }, [fetch, returnSet])

  useFocusEffect(useCallback(() => { void refresh() }, [refresh]))

  return { data, loading, error, refresh }
}
