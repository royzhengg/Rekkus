import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { updateLastSeen } from '@/lib/services/users'

const HEARTBEAT_INTERVAL_MS = 60_000
const HEARTBEAT_THROTTLE_MS = 45_000

export function useActivityHeartbeat(userId: string | null | undefined, enabled = true): void {
  const lastWriteAtRef = useRef(0)

  useEffect(() => {
    if (!userId || !enabled) return
    const uid = userId

    function record(force = false) {
      const now = Date.now()
      if (!force && now - lastWriteAtRef.current < HEARTBEAT_THROTTLE_MS) return
      lastWriteAtRef.current = now
      void updateLastSeen(uid).catch(() => {
        // Presence is best-effort; stale status is safer than noisy UI errors.
      })
    }

    function handleAppStateChange(state: AppStateStatus) {
      if (state === 'active') record()
    }

    record(true)
    const subscription = AppState.addEventListener('change', handleAppStateChange)
    const interval = setInterval(() => record(), HEARTBEAT_INTERVAL_MS)

    return () => {
      subscription.remove()
      clearInterval(interval)
    }
  }, [enabled, userId])
}
