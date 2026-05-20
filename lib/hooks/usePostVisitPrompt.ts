import { useMemo } from 'react'
import { haversineKm } from '@/lib/utils/geo'
import type { SavedLocation } from './useSavedLocations'

// Radius within which we prompt for a review
const VISIT_RADIUS_KM = 0.2
type Coords = { lat: number; lng: number } | null

export function usePostVisitPrompt(
  savedLocations: SavedLocation[],
  gps: Coords
): SavedLocation | null {
  return useMemo(() => {
    if (!gps || savedLocations.length === 0) return null

    let closest: SavedLocation | null = null
    let closestDist = Infinity

    for (const loc of savedLocations) {
      const r = loc.restaurants
      if (!r?.latitude || !r?.longitude) continue
      const dist = haversineKm(gps.lat, gps.lng, r.latitude, r.longitude)
      if (dist <= VISIT_RADIUS_KM && dist < closestDist) {
        closest = loc
        closestDist = dist
      }
    }

    return closest
  }, [gps, savedLocations])
}
