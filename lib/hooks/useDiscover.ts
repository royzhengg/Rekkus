import { useMemo } from 'react'
import { usePosts } from '../PostsContext'
import { useSearchHistory } from './useSearchHistory'
import type { Post } from '../data'
import type { CuisineAffinities } from './useSearchHistory'
import { parseLikes } from '../utils/format'

function cityFromLocation(location: string): string {
  return location.toLowerCase().includes('melbourne') ? 'Melbourne' : 'Sydney'
}

function computeDiscoverScore(
  post: Post,
  userCity: string,
  cuisineAffinities: CuisineAffinities
): number {
  const likes = parseLikes(post.likes)
  const isLocal = cityFromLocation(post.location) === userCity
  const trendingLocal = isLocal ? likes * 0.35 : 0
  const nearby = isLocal ? post.food * 0.3 : 0
  const quality = post.food >= 4.0 ? post.food * 0.25 : 0
  const global = likes * 0.1
  const cuisine = (post.cuisine_type ?? '').toLowerCase()
  const personalised = (cuisineAffinities[cuisine] ?? 0) * 1.5
  return trendingLocal + nearby + quality + global + personalised
}

function applyCuisineDiversity(posts: Post[]): Post[] {
  const result: Post[] = []
  const deferred: Post[] = []

  for (const post of posts) {
    const last2 = result.slice(-2)
    const sameStreak =
      last2.length === 2 &&
      post.cuisine_type &&
      last2[0].cuisine_type === post.cuisine_type &&
      last2[1].cuisine_type === post.cuisine_type

    if (sameStreak) {
      deferred.push(post)
    } else {
      result.push(post)
      // inject a deferred post of a different cuisine to break any future streak
      const injectIdx = deferred.findIndex(d => d.cuisine_type !== post.cuisine_type)
      if (injectIdx !== -1) result.push(deferred.splice(injectIdx, 1)[0])
    }
  }

  result.push(...deferred)
  return result
}

export function useDiscover(excludeIds: Set<number> = new Set()): Post[] {
  const { posts } = usePosts()
  const { cuisineAffinities } = useSearchHistory()
  // TODO: replace 'Sydney' with useUserLocation().city once GPS is wired
  const userCity = 'Sydney'

  return useMemo(() => {
    const candidates = posts.filter(p => !excludeIds.has(p.id))
    const scored = candidates
      .map(p => ({ post: p, score: computeDiscoverScore(p, userCity, cuisineAffinities) }))
      .sort((a, b) => b.score - a.score)
      .map(s => s.post)
    return applyCuisineDiversity(scored)
  }, [posts, cuisineAffinities, excludeIds])
}
