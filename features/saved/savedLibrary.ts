import type { Collection, CollectionVisibility } from '@/lib/services/collections'
import type { SavedPlace } from '@/lib/services/places'
import type { CollectionTargetType, Post, SavedDish } from '@/types/domain'

export type SavedLibraryItemType = 'dish' | 'place' | 'post' | 'collection'
export type SavedLibraryScope = 'all' | 'dishes' | 'places' | 'posts' | 'collections'

export type SavedLibraryItem = {
  id: string
  type: SavedLibraryItemType
  title: string
  subtitle: string
  savedAt: string
  imageUrl?: string | undefined
  status?: string | undefined
  targetType?: CollectionTargetType | undefined
  targetId?: string | undefined
  collectionVisibility?: CollectionVisibility | undefined
  routeId: string
}

export type SavedLibraryCounts = {
  dishes: number
  places: number
  posts: number
  collections: number
}

export type SavedLibraryInput = {
  dishes: SavedDish[]
  locations: SavedPlace[]
  posts: Post[]
  collections: Collection[]
}

export const SAVED_LIBRARY_SCOPES: Array<{ scope: SavedLibraryScope; label: string }> = [
  { scope: 'all', label: 'All' },
  { scope: 'dishes', label: 'Dishes' },
  { scope: 'places', label: 'Places' },
  { scope: 'posts', label: 'Posts' },
  { scope: 'collections', label: 'Collections' },
]

const COLLECTION_FALLBACK_DATE = '1970-01-01T00:00:00.000Z'

function compareSavedAtDesc(left: SavedLibraryItem, right: SavedLibraryItem): number {
  return Date.parse(right.savedAt) - Date.parse(left.savedAt)
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function collectionVisibilityLabel(visibility: CollectionVisibility): string {
  if (visibility === 'unlisted') return 'Link only'
  return visibility.charAt(0).toUpperCase() + visibility.slice(1)
}

function resolvePostCoverImageUrl(post: Post): string | undefined {
  if (post.imageUrl) return post.imageUrl

  const coverMedia = post.media?.find(item => item.isCover)
  if (coverMedia?.type === 'image') {
    return coverMedia.processedUrl ?? coverMedia.thumbnailUrl ?? coverMedia.uri
  }
  if (coverMedia?.type === 'video' && coverMedia.thumbnailUrl) return coverMedia.thumbnailUrl

  const imageMedia = post.media?.find(item => item.type === 'image')
  if (imageMedia) return imageMedia.processedUrl ?? imageMedia.thumbnailUrl ?? imageMedia.uri

  return post.media?.find(item => item.type === 'video' && item.thumbnailUrl)?.thumbnailUrl ?? undefined
}

export function savedLibraryItemKindLabel(item: SavedLibraryItem): string {
  if (item.type === 'place') return 'Place'
  if (item.type === 'collection') return 'List'
  return item.type.charAt(0).toUpperCase() + item.type.slice(1)
}

export function savedLibraryItemMetadata(item: SavedLibraryItem): string {
  const kind = savedLibraryItemKindLabel(item)
  const parts = [kind]
  if (item.status) parts.push(item.status)
  if (item.subtitle && item.subtitle !== item.status) parts.push(item.subtitle)
  return parts.join(' · ')
}

export function buildSavedLibraryItems(input: SavedLibraryInput): SavedLibraryItem[] {
  const dishItems: SavedLibraryItem[] = input.dishes.map(dish => ({
    id: `dish:${dish.id}`,
    type: 'dish',
    title: dish.name,
    subtitle: [dish.place?.name, dish.place?.address?.split(',')[0]].filter(Boolean).join(' · ') || 'Saved dish',
    savedAt: dish.savedAt,
    ...(dish.representativeImageUrl ? { imageUrl: dish.representativeImageUrl } : {}),
    targetType: 'dish',
    targetId: dish.id,
    routeId: dish.id,
  }))

  const placeItems: SavedLibraryItem[] = input.locations.map(location => ({
    id: `place:${location.place_id}`,
    type: 'place',
    title: location.places?.name ?? 'Saved place',
    subtitle: location.places?.address ?? 'Saved place',
    savedAt: location.created_at,
    ...(location.places?.photoUrl ? { imageUrl: location.places.photoUrl } : {}),
    targetType: 'place',
    targetId: location.place_id,
    routeId: location.place_id,
  }))

  const postItems: SavedLibraryItem[] = input.posts.map(post => {
    const imageUrl = resolvePostCoverImageUrl(post)
    return {
      id: `post:${post.dbId}`,
      type: 'post',
      title: post.mustOrder ?? post.title,
      subtitle: [post.location, `@${post.creator}`].filter(Boolean).join(' · '),
      savedAt: post.createdAt ?? COLLECTION_FALLBACK_DATE,
      ...(imageUrl ? { imageUrl } : {}),
      targetType: 'post',
      targetId: post.dbId,
      routeId: post.dbId,
    }
  })

  const collectionItems: SavedLibraryItem[] = input.collections.map(collection => ({
    id: `collection:${collection.id}`,
    type: 'collection',
    title: collection.name,
    subtitle: collection.description ?? collectionVisibilityLabel(collection.visibility),
    savedAt: COLLECTION_FALLBACK_DATE,
    status: collectionVisibilityLabel(collection.visibility),
    collectionVisibility: collection.visibility,
    routeId: collection.id,
  }))

  return [...dishItems, ...placeItems, ...postItems, ...collectionItems].sort(compareSavedAtDesc)
}

export function buildSavedLibraryCounts(input: SavedLibraryInput): SavedLibraryCounts {
  return {
    dishes: input.dishes.length,
    places: input.locations.length,
    posts: input.posts.length,
    collections: input.collections.length,
  }
}

export function scopeMatchesItem(scope: SavedLibraryScope, item: SavedLibraryItem): boolean {
  if (scope === 'all') return true
  if (scope === 'dishes') return item.type === 'dish'
  if (scope === 'places') return item.type === 'place'
  if (scope === 'posts') return item.type === 'post'
  return item.type === 'collection'
}

export function itemMatchesQuery(item: SavedLibraryItem, query: string): boolean {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return true
  return [
    item.title,
    item.subtitle,
    item.status ?? '',
    item.type,
  ].some(value => normalizeText(value).includes(normalizedQuery))
}

export function filterSavedLibraryItems(
  items: SavedLibraryItem[],
  scope: SavedLibraryScope,
  query: string
): SavedLibraryItem[] {
  return items.filter(item => scopeMatchesItem(scope, item) && itemMatchesQuery(item, query))
}

export function isSelectableSavedLibraryItem(item: SavedLibraryItem): boolean {
  return item.targetType !== undefined && item.targetId !== undefined
}
