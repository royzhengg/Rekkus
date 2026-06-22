import { useMemo } from 'react'
import { useCollections } from '@/lib/hooks/useCollections'
import { useSavedDishes } from '@/lib/hooks/useSavedDishes'
import { useSavedPlaces } from '@/lib/hooks/useSavedPlaces'
import { useSavedPosts } from '@/lib/hooks/useSavedPosts'
import {
  buildSavedLibraryCounts,
  buildSavedLibraryItems,
  filterSavedLibraryItems,
  type SavedLibraryScope,
} from './savedLibrary'

const SAVED_LIBRARY_PLACE_IDS: string[] = []
const SAVED_LIBRARY_PROVIDER_PHOTO_FALLBACK_LIMIT = 12

export function useSavedLibrary(userId: string | undefined, scope: SavedLibraryScope, query: string) {
  const dishes = useSavedDishes(userId)
  const posts = useSavedPosts(userId)
  const locations = useSavedPlaces(userId, { providerPhotoFallbackLimit: SAVED_LIBRARY_PROVIDER_PHOTO_FALLBACK_LIMIT })
  const collections = useCollections(userId, SAVED_LIBRARY_PLACE_IDS)

  const input = useMemo(() => ({
    dishes: dishes.savedDishes,
    locations: locations.savedPlaces,
    posts: posts.savedPosts,
    collections: collections.collections,
  }), [collections.collections, dishes.savedDishes, locations.savedPlaces, posts.savedPosts])

  const items = useMemo(() => buildSavedLibraryItems(input), [input])
  const results = useMemo(() => filterSavedLibraryItems(items, scope, query), [items, query, scope])
  const counts = useMemo(() => buildSavedLibraryCounts(input), [input])

  const refresh = async () => {
    await Promise.all([
      dishes.refresh(),
      posts.refresh(),
      locations.refresh(),
      collections.refresh(),
    ])
  }

  return {
    collections: collections.collections,
    counts,
    error: dishes.error ?? posts.error ?? locations.error,
    items,
    loading: dishes.loading || posts.loading || collections.loading,
    results,
    refresh,
    raw: { collections, dishes, locations, posts },
  }
}

export type SavedLibraryModel = ReturnType<typeof useSavedLibrary>
