import { useState, useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import { fetchLikedPostsPage, mapRowToPost } from '../services/posts'
import type { Post } from '@/types/domain'

export function useLikedPosts(userId: string | undefined) {
  const [likedPosts, setLikedPosts] = useState<Post[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cursorRef = useRef<string | null>(null)

  const fetchFirst = useCallback(async () => {
    if (!userId) {
      setLikedPosts([])
      setHasMore(false)
      return
    }
    setError(null)
    try {
      const { rows, nextCursor } = await fetchLikedPostsPage(userId, null)
      setLikedPosts(rows.map((r, i) => mapRowToPost(r, i)))
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load liked posts')
    }
  }, [userId])

  const loadMore = useCallback(async () => {
    if (!userId || !cursorRef.current || loadingMore) return
    setLoadingMore(true)
    try {
      const { rows, nextCursor } = await fetchLikedPostsPage(userId, cursorRef.current)
      setLikedPosts(prev => {
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
      const { rows, nextCursor } = await fetchLikedPostsPage(userId, null)
      setLikedPosts(rows.map((r, i) => mapRowToPost(r, i)))
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

  return { likedPosts, loadingMore, hasMore, loadMore, refresh, refreshing, error }
}
