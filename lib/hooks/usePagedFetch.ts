import { useFocusEffect } from 'expo-router'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'

type FetchPageResult<T> = { items: T[]; nextCursor: string | null }
type FetchPage<T> = (userId: string, cursor: string | null) => Promise<FetchPageResult<T>>

interface UsePagedFetchOptions<T> {
  preload?: (userId: string) => Promise<T[] | null>
  onFirstPage?: (items: T[], userId: string) => void
}

export function usePagedFetch<T>(
  userId: string | undefined,
  fetchPage: FetchPage<T>,
  options: UsePagedFetchOptions<T> = {}
) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cursorRef = useRef<string | null>(null)
  const { registerSyncListener } = useConnectivity()
  const fetchPageRef = useRef(fetchPage)
  fetchPageRef.current = fetchPage
  const optionsRef = useRef(options)
  optionsRef.current = options

  const fetchFirst = useCallback(async () => {
    if (!userId) {
      setItems([])
      setHasMore(false)
      return
    }
    setLoading(true)
    setError(null)
    const { preload, onFirstPage } = optionsRef.current
    if (preload) {
      const cached = await preload(userId)
      if (cached) setItems(cached)
    }
    try {
      const { items: fetched, nextCursor } = await fetchPageRef.current(userId, null)
      setItems(fetched)
      onFirstPage?.(fetched, userId)
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
    setLoading(false)
  }, [userId])

  const loadMore = useCallback(async () => {
    if (!userId || !cursorRef.current || loadingMore) return
    setLoadingMore(true)
    try {
      const { items: fetched, nextCursor } = await fetchPageRef.current(userId, cursorRef.current)
      setItems(prev => [...prev, ...fetched])
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load more')
    }
    setLoadingMore(false)
  }, [userId, loadingMore])

  const refresh = useCallback(async () => {
    if (!userId) return
    setRefreshing(true)
    cursorRef.current = null
    try {
      const { items: fetched, nextCursor } = await fetchPageRef.current(userId, null)
      setItems(fetched)
      optionsRef.current.onFirstPage?.(fetched, userId)
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to refresh')
    }
    setRefreshing(false)
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void fetchFirst()
    }, [fetchFirst])
  )

  useEffect(() => registerSyncListener(() => void fetchFirst()), [registerSyncListener, fetchFirst])

  return { items, loading, loadingMore, hasMore, loadMore, refresh, refreshing, error }
}
