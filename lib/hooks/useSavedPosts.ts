import { useState, useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import { fetchSavedPostsPage, mapRowToPost } from '../services/posts'
import { readOfflineCache, writeOfflineCache } from '../services/offlineCache'
import type { Post } from '@/types/domain'

const firstPageCacheKey = (userId: string) => `saved-posts:${userId}:first-page`

export function useSavedPosts(userId: string | undefined) {
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cursorRef = useRef<string | null>(null)

  const fetchFirst = useCallback(async () => {
    if (!userId) {
      setSavedPosts([])
      setHasMore(false)
      return
    }
    setLoading(true)
    setError(null)
    const cached = await readOfflineCache<Post[]>(firstPageCacheKey(userId))
    if (cached) setSavedPosts(cached)
    try {
      const { rows, nextCursor } = await fetchSavedPostsPage(userId, null)
      const mapped = rows.map((r, i) => mapRowToPost(r, i))
      setSavedPosts(mapped)
      writeOfflineCache(firstPageCacheKey(userId), mapped)
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load saved posts')
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
    } catch {}
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
      writeOfflineCache(firstPageCacheKey(userId), mapped)
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch {}
    setRefreshing(false)
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      fetchFirst()
    }, [fetchFirst])
  )

  return { savedPosts, loading, loadingMore, hasMore, loadMore, refresh, refreshing, error }
}
