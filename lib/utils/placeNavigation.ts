import type { SavedPlace } from '@/lib/hooks/useSavedPlaces'
import type { Router } from 'expo-router'

/** Used when navigating from a post — passes the Supabase UUID as placeId so
 *  PlaceDetailScreen can resolve the canonical google_place_id via FK lookup,
 *  rather than trusting the denormalised restaurant_place_id field on the post row. */
export interface PlaceNavTarget {
  placeId?: string | undefined        // Supabase UUID (preferred)
  googlePlaceId?: string | undefined  // Google Places ID (fallback / supplementary)
  name: string
  address?: string | undefined
  lat?: number | undefined
  lng?: number | undefined
}

export function buildPlaceNavParams(t: PlaceNavTarget) {
  if (__DEV__) {
    if (!t.placeId && !t.googlePlaceId) {
      console.warn('[Rekkus] buildPlaceNavParams: missing both placeId and googlePlaceId for', t.name)
    }
    if (t.placeId && t.placeId === t.googlePlaceId) {
      console.warn(
        '[Rekkus] buildPlaceNavParams: placeId === googlePlaceId — likely passing Google Place ID as placeId for',
        t.name,
      )
    }
  }
  return {
    placeId: t.placeId ?? 'none',
    googlePlaceId: t.googlePlaceId ?? 'none',
    name: t.name,
    address: t.address ?? t.name,
    lat: String(t.lat ?? ''),
    lng: String(t.lng ?? ''),
  }
}

export function navigateToPlaceFromPost(router: Router, target: PlaceNavTarget) {
  router.push({
    pathname: '/places/[placeId]',
    params: buildPlaceNavParams(target),
  })
}

export function navigateToPlace(router: Router, loc: SavedPlace): boolean {
  const r = loc.places
  const placeId = r?.google_place_id ?? loc.place_id
  if (!placeId) {
    if (__DEV__) console.warn('[navigateToPlace] missing placeId', loc.id)
    return false
  }
  router.push({
    pathname: '/places/[placeId]',
    params: {
      placeId,
      googlePlaceId: r?.google_place_id ?? placeId,
      name: r?.name ?? '',
      address: r?.address ?? '',
      ...(r?.latitude != null && r?.longitude != null
        ? { lat: String(r.latitude), lng: String(r.longitude) }
        : {}),
    },
  })
  return true
}
