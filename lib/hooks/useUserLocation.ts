import { useState, useEffect } from 'react'
import * as Location from 'expo-location'

type Coords = { lat: number; lng: number }

let cached: Coords | null = null

export function useUserLocation(): Coords | null {
  const [location, setLocation] = useState<Coords | null>(null)

  useEffect(() => {
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status !== 'granted') return null
        return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      })
      .then(pos => {
        if (!pos) return
        cached = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocation(cached)
      })
      .catch(() => {})
  }, [])

  return location
}
