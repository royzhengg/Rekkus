import { useState, useCallback, useEffect } from 'react'
import { fetchAlerts, type AlertItem } from '../services/alerts'

export type { AlertItem } from '../services/alerts'

export function useAlerts(userId: string | null | undefined) {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!userId) {
        setLoading(false)
        return
      }
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const items: AlertItem[] = await fetchAlerts(userId)
        setAlerts(items)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load alerts')
      }
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    },
    [userId]
  )

  useEffect(() => {
    void load(false)
  }, [load])

  return { alerts, loading, refreshing, refresh: (isRefresh = true) => load(isRefresh), error }
}
