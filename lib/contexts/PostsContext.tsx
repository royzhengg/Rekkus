import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ALLOW_MOCK_DATA, IS_LIVE_DATA } from '@/lib/config'
import {
  demoCurrentUser,
  demoImageKeys,
  demoPosts,
} from '@/lib/dataSources/demoData'
import { fetchFeedPostsPage, mapRowToPost } from '@/lib/services/posts'
import type { Post } from '@/types/domain'

interface PostsContextValue {
  posts: Post[]
  loading: boolean
  error: string | null
  addPost: (
    draft: Omit<Post, 'id' | 'dbId' | 'likes' | 'creator' | 'initials' | 'avatarBg' | 'avatarColor'>
  ) => void
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  hasMore: boolean
}

const PostsContext = createContext<PostsContextValue>({
  posts: demoPosts,
  loading: false,
  error: null,
  addPost: () => {},
  refresh: async () => {},
  loadMore: async () => {},
  hasMore: false,
})

export function PostsProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(demoPosts)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cursorRef = useRef<string | null>(null)

  function addPost(
    draft: Omit<Post, 'id' | 'dbId' | 'likes' | 'creator' | 'initials' | 'avatarBg' | 'avatarColor'>
  ) {
    const newPost: Post = {
      ...draft,
      id: Date.now(),
      dbId: '',
      likes: '0',
      creator: demoCurrentUser.username,
      initials: demoCurrentUser.initials,
      avatarBg: demoCurrentUser.avatarBg,
      avatarColor: demoCurrentUser.avatarColor,
      imgKey: demoImageKeys[Math.floor(Math.random() * demoImageKeys.length)] ?? 'a',
    }
    setPosts(prev => [newPost, ...prev])
  }

  const refresh = useCallback(async () => {
    if (!IS_LIVE_DATA && demoPosts.length > 0) {
      setPosts([...demoPosts])
      setHasMore(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { rows, nextCursor } = await fetchFeedPostsPage(null)
      const mapped = rows.map((row, index) => mapRowToPost(row, index))
      setPosts(mapped.length > 0 || !ALLOW_MOCK_DATA ? mapped : [...demoPosts])
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load feed posts')
      if (ALLOW_MOCK_DATA) setPosts([...demoPosts])
    }
    setLoading(false)
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMore || !cursorRef.current) return
    setLoadingMore(true)
    try {
      const { rows, nextCursor } = await fetchFeedPostsPage(cursorRef.current)
      setPosts(prev => [...prev, ...rows.map((row, index) => mapRowToPost(row, prev.length + index))])
      cursorRef.current = nextCursor
      setHasMore(nextCursor !== null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load more posts')
    }
    setLoadingMore(false)
  }, [loadingMore])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <PostsContext.Provider value={{ posts, loading, error, addPost, refresh, loadMore, hasMore }}>
      {children}
    </PostsContext.Provider>
  )
}

export function usePosts() {
  return useContext(PostsContext)
}
