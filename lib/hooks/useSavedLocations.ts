import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../supabase'

export type SavedLocation = {
  id: string
  restaurant_id: string
  created_at: string
  restaurants: {
    name: string
    address: string | null
    latitude: number | null
    longitude: number | null
    google_place_id: string | null
  } | null
}

export function useSavedLocations(userId: string | undefined) {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetch = useCallback(async () => {
    if (!userId) return
    setError(null)
    const { data, error: fetchError } = await (supabase.from('saved_locations') as any)
      .select(
        'id, restaurant_id, created_at, restaurants(name, address, latitude, longitude, google_place_id)'
      )
      .eq('user_id', userId)
      .limit(100)
    if (fetchError) {
      setError(fetchError.message)
      return
    }
    if (data) setSavedLocations(data)
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
