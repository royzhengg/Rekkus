import { useEffect, useRef } from 'react'
import { fetchProfile } from '@/lib/services/users'
import { useUserLocation } from './useUserLocation'

/**
 * Wraps useUserLocation with search-specific behaviour:
 * - When GPS is denied, silently geocodes the user's profile suburb/city and
 *   applies it as a manual location so search queries are never unanchored.
 */
export function useSearchLocation(userId: string | undefined) {
  const userLocation = useUserLocation()
  const { status, setManualLocation } = userLocation
  const appliedFallback = useRef(false)

  useEffect(() => {
    if (status !== 'denied') return
    if (appliedFallback.current) return
    if (!userId) return

    appliedFallback.current = true

    void fetchProfile(userId).then(profile => {
      const parts = [profile?.suburb, profile?.city].filter(Boolean)
      if (parts.length > 0) {
        void setManualLocation(parts.join(', '))
      }
    })
  }, [status, userId, setManualLocation])

  return userLocation
}
