import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Coords = { lat: number; lng: number }
type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'manual' | 'error'

type UserLocationValue = {
  coords: Coords | null
  label: string | null
  status: LocationStatus
  error: string | null
  loading: boolean
  requestLocation: () => Promise<Coords | null>
  setManualLocation: (area: string) => Promise<Coords | null>
  setManualCoords?: ((coords: Coords) => void) | undefined
  clearLocation: () => void
}

const STORAGE_KEY = 'rekkus:user-location:v1'

const UserLocationContext = createContext<UserLocationValue>({
  coords: null,
  label: null,
  status: 'idle',
  error: null,
  loading: false,
  requestLocation: async () => null,
  setManualLocation: async () => null,
  setManualCoords: () => undefined,
  clearLocation: () => undefined,
})

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [status, setStatus] = useState<LocationStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw)
          if (
            parsed !== null && typeof parsed === 'object' &&
            'coords' in parsed && 'label' in parsed
          ) {
            const p = parsed as { coords: Coords; label: string }
            setCoords(p.coords)
            setLabel(p.label)
            setStatus('granted')
            return
          }
        } catch {
          // stale or malformed — fall through to OS check
        }
      }

      // No stored location — check OS permission so callers see 'denied' or
      // silently acquire coords if already granted from a prior session.
      try {
        const perm = await Location.getForegroundPermissionsAsync()
        if (perm.status === 'denied') {
          setStatus('denied')
        } else if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoords(next)
          setLabel('Current location')
          setStatus('granted')
          persist(next, 'Current location')
        }
        // undetermined → stay 'idle' (first-time user)
      } catch {
        // ignore — degraded state, stay 'idle'
      }
    })()
  }, [])

  function persist(nextCoords: Coords, nextLabel: string) {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ coords: nextCoords, label: nextLabel }))
  }

  const requestLocation = useCallback(async (): Promise<Coords | null> => {
    setStatus('requesting')
    setError(null)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        setStatus('denied')
        setError('Location permission was not granted.')
        return null
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setCoords(next)
      setLabel('Current location')
      setStatus('granted')
      persist(next, 'Current location')
      return next
    } catch {
      setStatus('error')
      setError('Could not get your location right now.')
      return null
    }
  }, [])

  const setManualLocation = useCallback(async (area: string): Promise<Coords | null> => {
    const trimmed = area.trim()
    if (trimmed.length < 2) {
      setError('Enter a suburb or postcode.')
      return null
    }
    setStatus('requesting')
    setError(null)
    try {
      const matches = await Location.geocodeAsync(trimmed)
      const first = matches[0]
      if (!first) {
        setStatus('error')
        setError('Could not find that area.')
        return null
      }
      const next = { lat: first.latitude, lng: first.longitude }
      setCoords(next)
      setLabel(trimmed)
      setStatus('manual')
      persist(next, trimmed)
      return next
    } catch {
      setStatus('error')
      setError('Could not use that area right now.')
      return null
    }
  }, [])

  const setManualCoords = useCallback((next: Coords) => {
    setCoords(next)
    setLabel('Photo location')
    setStatus('granted')
    persist(next, 'Photo location')
  }, [])

  const clearLocation = useCallback(() => {
    setCoords(null)
    setLabel(null)
    setStatus('idle')
    setError(null)
    void AsyncStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <UserLocationContext.Provider value={{
      coords,
      label,
      status,
      error,
      loading: status === 'requesting',
      requestLocation,
      setManualLocation,
      setManualCoords,
      clearLocation,
    }}>
      {children}
    </UserLocationContext.Provider>
  )
}

export function useUserLocationContext(): UserLocationValue {
  return useContext(UserLocationContext)
}
