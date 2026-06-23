import { normalizeCuisine } from '@/lib/dataSources/cuisines'
import type { Collection } from '@/lib/services/collections'
import type { SavedPlace } from '@/lib/services/places'
import type { Post } from '@/types/domain'

export type ProfileInterest = {
  category: 'food'
  subcategory: string
  label: string
  emoji: string
}

export type ProfilePlace = {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  placeId: string | null
  photoUrl?: string | null
  postCount: number
  avgFoodRating: number | null
  lastPostedAt: string | null
}

type ProfilePost = Pick<
  Post,
  'placeId' | 'googlePlaceId' | 'location' | 'address' | 'lat' | 'lng' | 'food' | 'createdAt' | 'cuisine_type' | 'imageUrl'
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

function keyForPlace(post: ProfilePost): string | null {
  const id = post.placeId?.trim() || post.googlePlaceId?.trim()
  if (id) return id.toLowerCase()
  const name = post.location.trim().toLowerCase()
  if (!name) return null
  return `${name}:${post.address?.trim().toLowerCase() ?? ''}`
}

function placeRouteId(place: ProfilePlace): string {
  return place.placeId ?? place.id
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

export function normalizeProfileTabParam(value: string | undefined): 'posts' | 'collections' | 'saved-legacy' | null {
  if (value === 'collections' || value === 'lists') return 'collections'
  if (value === 'posts' || value === 'reviews' || value === 'restaurants' || value === 'liked') return 'posts'
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
    current.totalFood += (post.food ?? 0) > 0 ? (post.food ?? 0) : 0
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

export function derivePlacesWithPosts(posts: ProfilePost[]): ProfilePlace[] {
  const byPlace = new Map<string, ProfilePlace & { totalFood: number }>()

  for (const post of posts) {
    const key = keyForPlace(post)
    if (!key) continue
    const existing = byPlace.get(key)
    if (existing) {
      existing.postCount += 1
      existing.totalFood += (post.food ?? 0) > 0 ? (post.food ?? 0) : 0
      if (isNewer(post.createdAt ?? null, existing.lastPostedAt)) {
        existing.lastPostedAt = post.createdAt ?? null
      }
      if (!existing.address && post.address) existing.address = post.address
      if (existing.lat == null && post.lat != null) existing.lat = post.lat
      if (existing.lng == null && post.lng != null) existing.lng = post.lng
      if (!existing.photoUrl && post.imageUrl) existing.photoUrl = post.imageUrl
      continue
    }

    byPlace.set(key, {
      id: post.placeId ?? post.googlePlaceId ?? key,
      name: post.location,
      address: post.address ?? null,
      lat: post.lat ?? null,
      lng: post.lng ?? null,
      placeId: post.googlePlaceId ?? null,
      photoUrl: post.imageUrl ?? null,
      postCount: 1,
      avgFoodRating: null,
      lastPostedAt: post.createdAt ?? null,
      totalFood: (post.food ?? 0) > 0 ? (post.food ?? 0) : 0,
    })
  }

  return [...byPlace.values()]
    .map(({ totalFood, ...place }) => ({
      ...place,
      avgFoodRating: place.postCount > 0 && totalFood > 0 ? totalFood / place.postCount : null,
    }))
    .sort((a, b) => {
      const aTime = a.lastPostedAt ? new Date(a.lastPostedAt).getTime() : 0
      const bTime = b.lastPostedAt ? new Date(b.lastPostedAt).getTime() : 0
      return bTime - aTime || a.name.localeCompare(b.name)
    })
}

export function deriveTopPlaces(
  placesWithPosts: ProfilePlace[],
  savedPlaces: SavedPlace[],
  limit = 3
): ProfilePlace[] {
  const reviewed = [...placesWithPosts].sort((a, b) =>
    b.postCount - a.postCount ||
    (b.avgFoodRating ?? 0) - (a.avgFoodRating ?? 0) ||
    ((b.lastPostedAt ? new Date(b.lastPostedAt).getTime() : 0) -
      (a.lastPostedAt ? new Date(a.lastPostedAt).getTime() : 0))
  )
  const selected = reviewed.slice(0, limit)
  const seen = new Set(selected.map(placeRouteId))

  for (const saved of savedPlaces) {
    if (selected.length >= limit) break
    const savedPlace = saved.places
    if (!savedPlace) continue
    const id = savedPlace.google_place_id ?? saved.place_id
    if (seen.has(id)) continue
    selected.push({
      id: saved.place_id,
      name: savedPlace.name,
      address: savedPlace.address,
      lat: savedPlace.latitude,
      lng: savedPlace.longitude,
      placeId: savedPlace.google_place_id,
      photoUrl: null,
      postCount: 0,
      avgFoodRating: null,
      lastPostedAt: null,
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

