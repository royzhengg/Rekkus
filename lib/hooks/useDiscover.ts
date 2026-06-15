import { useMemo } from 'react'
import type { Post } from '@/types/domain'
import { useSearchHistory } from './useSearchHistory'
import { useTopicFollows } from './useTopicFollows'
import { useTrendingData } from './useTrendingData'
import { useUserLocation } from './useUserLocation'
import { useAuth } from '../contexts/AuthContext'
import { usePosts } from '../contexts/PostsContext'
import { parseLikes } from '../utils/format'
import { distanceBoost, haversineKm } from '../utils/geo'
import type { CuisineAffinities } from './useSearchHistory'

function cityFromLocation(location: string): string {
  return location.toLowerCase().includes('melbourne') ? 'Melbourne' : 'Sydney'
}

function computeDiscoverScore(
  post: Post,
  userCity: string | null,
  cuisineAffinities: CuisineAffinities,
  dismissedCuisines: CuisineAffinities,
  topics: string[],
  trendingPostIds: string[],
  coords: { lat: number; lng: number } | null
): number {
  const likes = parseLikes(post.likes)
  const isLocal = userCity !== null && cityFromLocation(post.location) === userCity
  const trendingLocal = isLocal ? likes * 0.35 : 0
  const nearby =
    coords && post.lat != null && post.lng != null
      ? distanceBoost(haversineKm(coords.lat, coords.lng, post.lat, post.lng)) * 0.6
      : isLocal
        ? (post.food ?? 0) * 0.3
        : 0
  const quality = (post.food ?? 0) >= 4.0 ? (post.food ?? 0) * 0.25 : 0
  const global = likes * 0.1
  const cuisine = (post.cuisine_type ?? '').toLowerCase()
  const personalised = (cuisineAffinities[cuisine] ?? 0) * 1.5
  const topicBoost = topics.some(t => cuisine.includes(t) || post.title.toLowerCase().includes(t))
    ? 2
    : 0
  const trendingBoost = post.dbId && trendingPostIds.includes(post.dbId) ? 4 : 0
  const completeness = (post.imageUrl ? 0.5 : 0) + (post.placeId ? 0.5 : 0) + (post.body ? 0.5 : 0)
  const score = trendingLocal + nearby + quality + global + personalised + topicBoost + trendingBoost + completeness
  const dismissalMultiplier = dismissedCuisines[cuisine] != null ? 0.5 : 1
  return score * dismissalMultiplier
}

function applyCuisineDiversity(posts: Post[]): Post[] {
  const result: Post[] = []
  const deferred: Post[] = []

  for (const post of posts) {
      const last2 = result.slice(-2)
      const first = last2[0]
      const second = last2[1]
      const sameStreak =
        last2.length === 2 &&
        post.cuisine_type &&
        first?.cuisine_type === post.cuisine_type &&
        second?.cuisine_type === post.cuisine_type

    if (sameStreak) {
      deferred.push(post)
    } else {
      result.push(post)
      // inject a deferred post of a different cuisine to break any future streak
      const injectIdx = deferred.findIndex(d => d.cuisine_type !== post.cuisine_type)
      const injected = injectIdx !== -1 ? deferred.splice(injectIdx, 1)[0] : undefined
      if (injected) result.push(injected)
    }
  }

  result.push(...deferred)
  return result
}

export function useDiscover(excludeIds: Set<number> = new Set()): Post[] {
  const { posts } = usePosts()
  const { user } = useAuth()
  const { cuisineAffinities, dismissedCuisines } = useSearchHistory()
  const topics = useTopicFollows(user?.id)
  const { trendingPostIds } = useTrendingData()
  const userLocation = useUserLocation()
  // Use city from manual location label; GPS users ('Current location') rely on
  // the coords-based nearby boost in computeDiscoverScore instead.
  const userCity =
    userLocation.label && userLocation.label !== 'Current location'
      ? cityFromLocation(userLocation.label)
      : null

  return useMemo(() => {
    const candidates = posts.filter(p => !excludeIds.has(p.id))
    const scored = candidates
      .map(p => ({
        post: p,
        score: computeDiscoverScore(
          p,
          userCity,
          cuisineAffinities,
          dismissedCuisines,
          topics,
          trendingPostIds,
          userLocation.coords
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .map(s => s.post)
    return applyCuisineDiversity(scored)
  }, [posts, cuisineAffinities, dismissedCuisines, excludeIds, topics, trendingPostIds, userLocation.coords, userCity])
}
