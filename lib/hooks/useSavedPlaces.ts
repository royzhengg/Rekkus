import { useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { readOfflineCache, writeOfflineCache } from '../services/offlineCache'
import {
  type FetchSavedPlacesOptions,
  fetchSavedPlacesForUser,
  isSavedPlaceList,
  type SavedPlace,
} from '../services/places'

export type { SavedPlace } from '../services/places'

export function useSavedPlaces(userId: string | undefined, options: FetchSavedPlacesOptions = {}) {
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const providerPhotoFallbackLimit = options.providerPhotoFallbackLimit ?? 0

  const fetch = useCallback(async () => {
    if (!userId) return
    setError(null)
    const cacheKey = `saved-places:${userId}:first-page`
    const cached = await readOfflineCache(cacheKey, isSavedPlaceList)
    if (cached) setSavedPlaces(cached)
    try {
      const nextSavedPlaces = await fetchSavedPlacesForUser(userId, { providerPhotoFallbackLimit })
      setSavedPlaces(nextSavedPlaces)
      void writeOfflineCache(cacheKey, nextSavedPlaces)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Could not load saved places')
      return
    }
  }, [providerPhotoFallbackLimit, userId])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await fetch()
    setRefreshing(false)
  }, [fetch])

  useFocusEffect(
    useCallback(() => {
      void fetch()
    }, [fetch])
  )

  return { savedPlaces, error, refresh, refreshing }
}
