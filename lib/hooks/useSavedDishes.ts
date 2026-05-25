import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { fetchSavedDishes } from '@/lib/services/dishes'
import type { SavedDish } from '@/types/domain'

export function useSavedDishes(userId: string | undefined) {
  const [savedDishes, setSavedDishes] = useState<SavedDish[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setSavedDishes([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      setSavedDishes(await fetchSavedDishes(userId))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to load saved dishes.')
    }
    setLoading(false)
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh])
  )

  return { savedDishes, loading, error, refresh }
}
