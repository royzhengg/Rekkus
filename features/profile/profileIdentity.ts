import { normalizeCuisine } from '@/lib/dataSources/cuisines'
import type { Collection, CollectionVisibility } from '@/lib/services/collections'
import type { SavedLocation } from '@/lib/services/restaurants'
import type { Post } from '@/types/domain'

export type ProfileInterest = {
  category: 'food'
  subcategory: string
  label: string
  emoji: string
}

export type ProfileRestaurant = {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  placeId: string | null
  photoUrl?: string | null
  reviewCount: number
  avgFoodRating: number | null
  lastReviewedAt: string | null
}

type ProfilePost = Pick<
  Post,
  'restaurantId' | 'placeId' | 'location' | 'address' | 'lat' | 'lng' | 'food' | 'createdAt' | 'cuisine_type' | 'imageUrl'
>

const CUISINE_EMOJI: Record<string, string> = {
  american: '🍔',
  chinese: '🥟',
  french: '🥐',
  greek: '🥙',
  indian: '🍛',
  italian: '🍝',
  japanese: '🍜',
  korean: '🥩',
  lebanese: '🧆',
  mediterranean: '🫒',
  mexican: '🌮',
  spanish: '🥘',
  steak: '🥩',
  thai: '🍲',
  vietnamese: '🍲',
}

function keyForRestaurant(post: ProfilePost): string | null {
  const id = post.restaurantId?.trim() || post.placeId?.trim()
  if (id) return id.toLowerCase()
  const name = post.location.trim().toLowerCase()
  if (!name) return null
  return `${name}:${post.address?.trim().toLowerCase() ?? ''}`
}

function restaurantRouteId(restaurant: ProfileRestaurant): string {
  return restaurant.placeId ?? restaurant.id
}

function isNewer(a: string | null, b: string | null): boolean {
  if (!a) return false
  if (!b) return true
  return new Date(a).getTime() > new Date(b).getTime()
}

export function formatProfileCount(count: number): string {
  if (count >= 1000000) return `${Number((count / 1000000).toFixed(1))}m`
  if (count >= 1000) return `${Number((count / 1000).toFixed(1))}k`
  return `${count}`
}

export function normalizeProfileTabParam(value: string | undefined): 'reviews' | 'collections' | 'saved-legacy' | null {
  if (value === 'collections' || value === 'lists') return 'collections'
  if (value === 'reviews' || value === 'restaurants' || value === 'liked') return 'reviews'
  if (value === 'saved') return 'saved-legacy'
  return null
}

export function deriveProfileInterests(posts: ProfilePost[], limit = 4): ProfileInterest[] {
  const byCuisine = new Map<string, { label: string; count: number; totalFood: number }>()
  for (const post of posts) {
    const label = normalizeCuisine(post.cuisine_type)
    if (!label) continue
    const key = label.toLowerCase()
    const current = byCuisine.get(key) ?? { label, count: 0, totalFood: 0 }
    current.count += 1
    current.totalFood += post.food > 0 ? post.food : 0
    byCuisine.set(key, current)
  }

  return [...byCuisine.entries()]
    .map(([key, value]) => ({
      category: 'food' as const,
      subcategory: key,
      label: value.label,
      emoji: CUISINE_EMOJI[key] ?? '🍽️',
      count: value.count,
      avgFood: value.count > 0 ? value.totalFood / value.count : 0,
    }))
    .sort((a, b) => b.count - a.count || b.avgFood - a.avgFood || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ category, subcategory, label, emoji }) => ({ category, subcategory, label, emoji }))
}

export function deriveReviewedRestaurants(posts: ProfilePost[]): ProfileRestaurant[] {
  const byRestaurant = new Map<string, ProfileRestaurant & { totalFood: number }>()

  for (const post of posts) {
    const key = keyForRestaurant(post)
    if (!key) continue
    const existing = byRestaurant.get(key)
    if (existing) {
      existing.reviewCount += 1
      existing.totalFood += post.food > 0 ? post.food : 0
      if (isNewer(post.createdAt ?? null, existing.lastReviewedAt)) {
        existing.lastReviewedAt = post.createdAt ?? null
      }
      if (!existing.address && post.address) existing.address = post.address
      if (existing.lat == null && post.lat != null) existing.lat = post.lat
      if (existing.lng == null && post.lng != null) existing.lng = post.lng
      if (!existing.photoUrl && post.imageUrl) existing.photoUrl = post.imageUrl
      continue
    }

    byRestaurant.set(key, {
      id: post.restaurantId ?? post.placeId ?? key,
      name: post.location,
      address: post.address ?? null,
      lat: post.lat ?? null,
      lng: post.lng ?? null,
      placeId: post.placeId ?? null,
      photoUrl: post.imageUrl ?? null,
      reviewCount: 1,
      avgFoodRating: null,
      lastReviewedAt: post.createdAt ?? null,
      totalFood: post.food > 0 ? post.food : 0,
    })
  }

  return [...byRestaurant.values()]
    .map(({ totalFood, ...restaurant }) => ({
      ...restaurant,
      avgFoodRating: restaurant.reviewCount > 0 && totalFood > 0 ? totalFood / restaurant.reviewCount : null,
    }))
    .sort((a, b) => {
      const aTime = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0
      const bTime = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0
      return bTime - aTime || a.name.localeCompare(b.name)
    })
}

export function deriveTopRestaurants(
  reviewedRestaurants: ProfileRestaurant[],
  savedLocations: SavedLocation[],
  limit = 3
): ProfileRestaurant[] {
  const reviewed = [...reviewedRestaurants].sort((a, b) =>
    b.reviewCount - a.reviewCount ||
    (b.avgFoodRating ?? 0) - (a.avgFoodRating ?? 0) ||
    ((b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0) -
      (a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0))
  )
  const selected = reviewed.slice(0, limit)
  const seen = new Set(selected.map(restaurantRouteId))

  for (const saved of savedLocations) {
    if (selected.length >= limit) break
    const savedRestaurant = saved.restaurants
    if (!savedRestaurant) continue
    const id = savedRestaurant.google_place_id ?? saved.restaurant_id
    if (seen.has(id)) continue
    selected.push({
      id: saved.restaurant_id,
      name: savedRestaurant.name,
      address: savedRestaurant.address,
      lat: savedRestaurant.latitude,
      lng: savedRestaurant.longitude,
      placeId: savedRestaurant.google_place_id,
      photoUrl: null,
      reviewCount: 0,
      avgFoodRating: null,
      lastReviewedAt: null,
    })
    seen.add(id)
  }

  return selected
}

export function profileCollectionIsVisible(
  collection: Pick<Collection, 'visibility'>,
  viewerIsOwner: boolean
): boolean {
  return viewerIsOwner || collection.visibility === 'public' || collection.visibility === 'unlisted'
}

export function profileCollectionVisibilityFilter(viewerIsOwner: boolean): CollectionVisibility[] {
  return viewerIsOwner ? ['private', 'unlisted', 'public'] : ['unlisted', 'public']
}
