import type { Post } from '@/types/domain'

export function contributorBadgeLabel(posts: Pick<Post, 'food'>[]): string | null {
  if (posts.length === 0) return null
  const avgFood = posts.reduce((sum, post) => sum + post.food, 0) / posts.length
  if (posts.length >= 10) return 'Local expert'
  if (posts.length >= 5) return 'Prolific reviewer'
  if (avgFood >= 4.5) return 'Quality hunter'
  return 'Explorer'
}
