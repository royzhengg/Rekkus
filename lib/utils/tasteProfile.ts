import type { Post } from '../../types/domain'
import type { CuisineAffinities } from '../hooks/useSearchHistory'

/**
 * Builds a normalised cuisine affinity map from liked posts, saved posts,
 * and existing search-history affinities. Saves are weighted 3x, likes 1.5x,
 * and search history 1x.
 */
export function buildTasteProfile(
  likedPosts: Post[],
  savedPosts: Post[],
  searchAffinities: CuisineAffinities
): CuisineAffinities {
  const counts: Record<string, number> = {}

  for (const post of likedPosts) {
    const c = post.cuisine_type?.toLowerCase()
    if (c) counts[c] = (counts[c] ?? 0) + 1.5
  }
  for (const post of savedPosts) {
    const c = post.cuisine_type?.toLowerCase()
    if (c) counts[c] = (counts[c] ?? 0) + 3
  }
  for (const [cuisine, score] of Object.entries(searchAffinities)) {
    counts[cuisine] = (counts[cuisine] ?? 0) + score
  }

  const max = Math.max(1, ...Object.values(counts))
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / max]))
}
