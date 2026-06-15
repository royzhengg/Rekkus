import { useState, useEffect, useMemo } from 'react'
import type { Post } from '@/types/domain'
import { useAuth } from '../contexts/AuthContext'
import { usePosts } from '../contexts/PostsContext'
import { fetchFollowedUsernames } from '../services/users'
import { parseLikes } from '../utils/format'

function computeFollowingScore(post: Post): number {
  const likes = parseLikes(post.likes)
  const ageHours = post.createdAt
    ? Math.max(1, (Date.now() - new Date(post.createdAt).getTime()) / 36e5)
    : 24
  const recencyDecay = 1 / Math.sqrt(1 + ageHours / 24)
  const qualityBoost = (post.food ?? 0) >= 4.5 ? 300 : (post.food ?? 0) >= 4 ? 100 : 0
  const completenessBoost = (post.imageUrl ? 35 : 0) + (post.placeId ? 35 : 0) + (post.body ? 20 : 0)
  return (likes * 100 + qualityBoost + completenessBoost) * recencyDecay
}

export function useFollowingFeed(): { posts: Post[]; isLoaded: boolean } {
  const { posts } = usePosts()
  const { user } = useAuth()
  const [followedUsernames, setFollowedUsernames] = useState<string[] | null>(null)

  useEffect(() => {
    if (!user) {
      setFollowedUsernames([])
      return
    }
    void fetchFollowedUsernames(user.id).then(setFollowedUsernames)
  }, [user])

  const filtered = useMemo(() => {
    if (!followedUsernames) return []
    if (followedUsernames.length === 0) return []
    return [...posts.filter(p => followedUsernames.includes(p.creator))].sort(
      (a, b) => computeFollowingScore(b) - computeFollowingScore(a)
    )
  }, [posts, followedUsernames])

  return { posts: filtered, isLoaded: followedUsernames !== null }
}
