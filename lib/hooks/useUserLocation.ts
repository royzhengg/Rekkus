import { useCallback, useEffect, useState } from 'react'
import * as Location from 'expo-location'

type Coords = { lat: number; lng: number }
type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'manual' | 'error'

let cached: Coords | null = null
let cachedLabel: string | null = null

export function useUserLocation(options: { autoRequest?: boolean } = {}) {
  const [coords, setCoords] = useState<Coords | null>(cached)
  const [label, setLabel] = useState<string | null>(cachedLabel)
  const [status, setStatus] = useState<LocationStatus>(cached ? 'granted' : 'idle')
  const [error, setError] = useState<string | null>(null)

  const requestLocation = useCallback(async () => {
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
      cached = next
      cachedLabel = 'Current location'
      setCoords(next)
      setLabel(cachedLabel)
      setStatus('granted')
      return next
    } catch {
      setStatus('error')
      setError('Could not get your location right now.')
      return null
    }
  }, [])

  const setManualLocation = useCallback(async (area: string) => {
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
      cached = next
      cachedLabel = trimmed
      setCoords(next)
      setLabel(trimmed)
      setStatus('manual')
      return next
    } catch {
      setStatus('error')
      setError('Could not use that area right now.')
      return null
    }
  }, [])

  const clearLocation = useCallback(() => {
    cached = null
    cachedLabel = null
    setCoords(null)
    setLabel(null)
    setStatus('idle')
    setError(null)
  }, [])

  useEffect(() => {
    if (options.autoRequest && !coords) {
      requestLocation()
    }
  }, [coords, options.autoRequest, requestLocation])

  return {
    coords,
    label,
    status,
    error,
    loading: status === 'requesting',
    requestLocation,
    setManualLocation,
    clearLocation,
  }
}
