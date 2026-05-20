import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../supabase'
import { readOfflineCache, writeOfflineCache } from '../services/offlineCache'

export type SavedLocation = {
  id: string
  restaurant_id: string
  created_at: string
  save_status: 'want_to_try' | 'been_here'
  restaurants: {
    name: string
    address: string | null
    latitude: number | null
    longitude: number | null
    google_place_id: string | null
  } | null
}

const SAVED_LOCATION_SELECT =
  'id, restaurant_id, created_at, save_status, restaurants(name, address, latitude, longitude, google_place_id)'

const LEGACY_SAVED_LOCATION_SELECT =
  'id, restaurant_id, created_at, restaurants(name, address, latitude, longitude, google_place_id)'

function withDefaultSaveStatus(rows: unknown): SavedLocation[] {
  if (!Array.isArray(rows)) return []
  return rows.map(row => ({
    ...(row as Omit<SavedLocation, 'save_status'>),
    save_status: (row as Partial<SavedLocation>).save_status ?? 'want_to_try',
  }))
}

export function useSavedLocations(userId: string | undefined) {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetch = useCallback(async () => {
    if (!userId) return
    setError(null)
    const cacheKey = `saved-locations:${userId}:first-page`
    const cached = await readOfflineCache<SavedLocation[]>(cacheKey)
    if (cached) setSavedLocations(cached)
    const query = (select: string) =>
      (supabase.from('saved_locations') as any)
        .select(select)
        .eq('user_id', userId)
        .limit(100)

    let { data, error: fetchError } = await query(SAVED_LOCATION_SELECT)
    if (fetchError?.message?.includes('save_status')) {
      const legacy = await query(LEGACY_SAVED_LOCATION_SELECT)
      data = withDefaultSaveStatus(legacy.data)
      fetchError = legacy.error
    }
    if (fetchError) {
      setError(fetchError.message)
      return
    }
    if (data) {
      const normalized = withDefaultSaveStatus(data)
      setSavedLocations(normalized)
      writeOfflineCache(cacheKey, normalized)
    }
  }, [userId])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await fetch()
    setRefreshing(false)
  }, [fetch])

  useFocusEffect(
    useCallback(() => {
      fetch()
    }, [fetch])
  )

  return { savedLocations, error, refresh, refreshing }
}
