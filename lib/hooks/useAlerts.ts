import { useState, useCallback, useEffect } from 'react'
import {
  fetchAlertsPage,
  removeAlertSubscription,
  subscribeToAlertChanges,
  type AlertFilter,
  type AlertItem,
} from '../services/alerts'

export type { AlertItem } from '../services/alerts'

export function useAlerts(userId: string | null | undefined, filter: AlertFilter = 'activity') {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
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
        const page = await fetchAlertsPage(filter)
        setAlerts(page.items)
        setPendingRequestCount(page.pendingRequestCount)
        setUnreadCount(page.unreadCount)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load alerts')
      }
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    },
    [filter, userId]
  )

  useEffect(() => {
    void load(false)
  }, [load])

  useEffect(() => {
    if (!userId) return undefined
    const channel = subscribeToAlertChanges(userId, () => { void load(true) })
    return () => {
      removeAlertSubscription(channel)
    }
  }, [load, userId])

  return {
    alerts,
    pendingRequestCount,
    unreadCount,
    loading,
    refreshing,
    refresh: (isRefresh = true) => load(isRefresh),
    error,
  }
}
