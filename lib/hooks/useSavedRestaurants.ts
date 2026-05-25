import { useState, useEffect } from 'react'
import { fetchSavedRestaurantIds } from '../services/restaurants'

export function useSavedRestaurants(userId: string | null | undefined): Set<string> {
  const [savedRestaurantIds, setSavedRestaurantIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) {
      setSavedRestaurantIds(new Set())
      return
    }
    void fetchSavedRestaurantIds(userId)
      .then(ids => {
        setSavedRestaurantIds(new Set(ids))
      })
      .catch(() => setSavedRestaurantIds(new Set()))
  }, [userId])

  return savedRestaurantIds
}
