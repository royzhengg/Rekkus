import { useMemo } from 'react'
import { usePosts } from '../PostsContext'
import type { Post } from '../data'
import { parseLikes } from '../utils/format'

function computeFollowingScore(post: Post): number {
  return parseLikes(post.likes) + (post.food >= 4.5 ? 300 : 0)
}

export function useFollowingFeed(): Post[] {
  const { posts } = usePosts()
  // TODO: filter to followedUserIds once follows table is wired
  return useMemo(
    () => [...posts].sort((a, b) => computeFollowingScore(b) - computeFollowingScore(a)),
    [posts]
  )
}
