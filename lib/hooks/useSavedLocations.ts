import { useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { readOfflineCache, writeOfflineCache } from '../services/offlineCache'
import {
  fetchSavedLocationsForUser,
  isSavedLocationList,
  type SavedLocation,
} from '../services/restaurants'

export type { SavedLocation } from '../services/restaurants'

export function useSavedLocations(userId: string | undefined) {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetch = useCallback(async () => {
    if (!userId) return
    setError(null)
    const cacheKey = `saved-locations:${userId}:first-page`
    const cached = await readOfflineCache(cacheKey, isSavedLocationList)
    if (cached) setSavedLocations(cached)
    try {
      const nextSavedLocations = await fetchSavedLocationsForUser(userId)
      setSavedLocations(nextSavedLocations)
      void writeOfflineCache(cacheKey, nextSavedLocations)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Could not load saved locations')
      return
    }
  }, [userId])

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

  return { savedLocations, error, refresh, refreshing }
}
