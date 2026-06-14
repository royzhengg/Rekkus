import { useState, useEffect } from 'react'
import { fetchSavedPlaceIds } from '../services/places'

export function useSavedPlaceIds(userId: string | null | undefined): Set<string> {
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) {
      setSavedPlaceIds(new Set())
      return
    }
    void fetchSavedPlaceIds(userId)
      .then(ids => {
        setSavedPlaceIds(new Set(ids))
      })
      .catch(() => setSavedPlaceIds(new Set()))
  }, [userId])

  return savedPlaceIds
}
