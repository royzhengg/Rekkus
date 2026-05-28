import { useFocusEffect } from 'expo-router'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import type { Post } from '@/types/domain'
import { readOfflineCache, writeOfflineCache } from '../services/offlineCache'
import { fetchSavedPostsPage, mapRowToPost } from '../services/posts'
import { isCachedPostList } from '../services/posts/guards'

const firstPageCacheKey = (userId: string) => `saved-posts:${userId}:first-page`

export function useSavedPosts(userId: string | undefined) {
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cursorRef = useRef<string | null>(null)
  const { syncEpoch } = useConnectivity()

  const fetchFirst = useCallback(async () => {
    if (!userId) {
      setSavedPosts([])
      setHasMore(false)
      return
    }
    setLoading(true)
    setError(null)
    const cached = await readOfflineCache(firstPageCacheKey(userId), isCachedPostList)
    if (cached) setSavedPosts(cached)
    try {
      const { rows, nextCursor } = await fetchSavedPostsPage(userId, null)
      const mapped = rows.map((r, i) => mapRowToPost(r, i))
      setSavedPosts(mapped)
      void writeOfflineCache(firstPageCacheKey(userId), mapped)
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load saved posts')
    }
    setLoading(false)
  }, [userId])

  const loadMore = useCallback(async () => {
    if (!userId || !cursorRef.current || loadingMore) return
    setLoadingMore(true)
    try {
      const { rows, nextCursor } = await fetchSavedPostsPage(userId, cursorRef.current)
      setSavedPosts(prev => {
        const mapped = rows.map((r, i) => mapRowToPost(r, prev.length + i))
        return [...prev, ...mapped]
      })
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load more saved posts')
    }
    setLoadingMore(false)
  }, [userId, loadingMore])

  const refresh = useCallback(async () => {
    if (!userId) return
    setRefreshing(true)
    cursorRef.current = null
    try {
      const { rows, nextCursor } = await fetchSavedPostsPage(userId, null)
      const mapped = rows.map((r, i) => mapRowToPost(r, i))
      setSavedPosts(mapped)
      void writeOfflineCache(firstPageCacheKey(userId), mapped)
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to refresh saved posts')
    }
    setRefreshing(false)
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void fetchFirst()
    }, [fetchFirst])
  )

  // Re-fetch when replay completes so stale optimistic saves are reconciled
  useEffect(() => {
    if (syncEpoch > 0) void fetchFirst()
  }, [syncEpoch, fetchFirst])

  return { savedPosts, loading, loadingMore, hasMore, loadMore, refresh, refreshing, error }
}
