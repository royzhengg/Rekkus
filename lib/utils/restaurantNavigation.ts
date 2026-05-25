import type { SavedLocation } from '@/lib/hooks/useSavedLocations'
import type { Router } from 'expo-router'

/** Used when navigating from a post — passes the Supabase UUID as restaurantId so
 *  RestaurantDetailScreen can resolve the canonical google_place_id via FK lookup,
 *  rather than trusting the denormalised restaurant_place_id field on the post row. */
export interface RestaurantNavTarget {
  restaurantId?: string | undefined // Supabase UUID (preferred)
  placeId?: string | undefined      // Google Places ID (fallback / supplementary)
  name: string
  address?: string | undefined
  lat?: number | undefined
  lng?: number | undefined
}

export function buildRestaurantNavParams(t: RestaurantNavTarget) {
  if (__DEV__) {
    if (!t.restaurantId && !t.placeId) {
      console.warn('[Rekkus] buildRestaurantNavParams: missing both restaurantId and placeId for', t.name)
    }
    if (t.restaurantId && t.restaurantId === t.placeId) {
      console.warn(
        '[Rekkus] buildRestaurantNavParams: restaurantId === placeId — likely passing Google Place ID as restaurantId for',
        t.name,
      )
    }
  }
  return {
    restaurantId: t.restaurantId ?? 'none',
    placeId: t.placeId ?? 'none',
    name: t.name,
    address: t.address ?? t.name,
    lat: String(t.lat ?? ''),
    lng: String(t.lng ?? ''),
  }
}

export function navigateToRestaurantFromPost(router: Router, target: RestaurantNavTarget) {
  router.push({
    pathname: '/restaurants/[restaurantId]',
    params: buildRestaurantNavParams(target),
  })
}

export function navigateToRestaurant(router: Router, loc: SavedLocation): boolean {
  const r = loc.restaurants
  const restaurantId = r?.google_place_id ?? loc.restaurant_id
  if (!restaurantId) {
    if (__DEV__) console.warn('[navigateToRestaurant] missing restaurantId', loc.id)
    return false
  }
  router.push({
    pathname: '/restaurants/[restaurantId]',
    params: {
      restaurantId,
      placeId: r?.google_place_id ?? restaurantId,
      name: r?.name ?? '',
      address: r?.address ?? '',
      ...(r?.latitude != null && r?.longitude != null
        ? { lat: String(r.latitude), lng: String(r.longitude) }
        : {}),
    },
  })
  return true
}
