import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { fetchTargetCollectionItems, type CollectionItem } from '@/lib/services/collections'
import { fetchDishDetail, fetchIsDishSaved } from '@/lib/services/dishes'
import { fetchDishPostsPage, mapRowToPost } from '@/lib/services/posts'
import type { DishDetail, Post } from '@/types/domain'

export function useDishDetail(dishId: string, userId: string | undefined) {
  const { runDeferredMutation } = useConnectivity()
  const [dish, setDish] = useState<DishDetail | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [saved, setSaved] = useState(false)
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cursorRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!dishId) {
      setDish(null)
      setPosts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [nextDish, postPage, isSaved, memberships] = await Promise.all([
        fetchDishDetail(dishId),
        fetchDishPostsPage(dishId, null),
        userId ? fetchIsDishSaved(userId, dishId) : Promise.resolve(false),
        userId ? fetchTargetCollectionItems(userId, 'dish', dishId) : Promise.resolve([]),
      ])
      setDish(nextDish)
      setPosts(postPage.rows.map((row, index) => mapRowToPost(row, index)))
      setSaved(isSaved)
      setCollectionItems(memberships)
      cursorRef.current = postPage.nextCursor
      setHasMore(postPage.nextCursor !== null)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to load this dish.')
    }
    setLoading(false)
  }, [dishId, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadMore = useCallback(async () => {
    if (!cursorRef.current || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchDishPostsPage(dishId, cursorRef.current)
      setPosts(previous => [
        ...previous,
        ...page.rows.map((row, index) => mapRowToPost(row, previous.length + index)),
      ])
      cursorRef.current = page.nextCursor
      setHasMore(page.nextCursor !== null)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to load more posts.')
    }
    setLoadingMore(false)
  }, [dishId, loadingMore])

  const toggleSaved = useCallback(async (removeCollectionMemberships = false) => {
    if (!userId) return
    if (saved) {
      await runDeferredMutation({ kind: 'dish_save', dishId, targetState: false, removeCollectionMemberships })
      setSaved(false)
      if (removeCollectionMemberships) setCollectionItems([])
      return
    }
    await runDeferredMutation({ kind: 'dish_save', dishId, targetState: true })
    setSaved(true)
  }, [dishId, runDeferredMutation, saved, userId])

  return {
    dish,
    posts,
    saved,
    collectionItems,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    toggleSaved,
  }
}
