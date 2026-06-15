import { useMemo } from 'react'
import { haversineKm } from '@/lib/utils/geo'
import type { SavedPlace } from './useSavedPlaces'

// Radius within which we prompt for a review
const VISIT_RADIUS_KM = 0.2
type Coords = { lat: number; lng: number } | null

export function usePostVisitPrompt(
  savedPlaces: SavedPlace[],
  gps: Coords
): SavedPlace | null {
  return useMemo(() => {
    if (!gps || savedPlaces.length === 0) return null

    let closest: SavedPlace | null = null
    let closestDist = Infinity

    for (const loc of savedPlaces) {
      const r = loc.places
      if (!r?.latitude || !r?.longitude) continue
      const dist = haversineKm(gps.lat, gps.lng, r.latitude, r.longitude)
      if (dist <= VISIT_RADIUS_KM && dist < closestDist) {
        closest = loc
        closestDist = dist
      }
    }

    return closest
  }, [gps, savedPlaces])
}
