import type { ProfileRestaurant } from '@/features/profile/profileIdentity'
import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'
import type { TopSpot } from '@/types/domain'

function isRestaurantRow(value: unknown): value is {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  google_place_id: string | null
  google_photo_refs: string[] | null
} {
  return isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string'
}

export async function fetchTopSpotsWithDetails(userId: string): Promise<ProfileRestaurant[]> {
  try {
    const { data, error } = await supabase
      .from('user_top_spots')
      .select('position, restaurant_id, restaurants(id, name, address, latitude, longitude, google_place_id, google_photo_refs)')
      .eq('user_id', userId)
      .order('position', { ascending: true })

    if (error || !data) return []

    const results: ProfileRestaurant[] = []
    for (const row of data) {
      const rawRestaurants: unknown = row.restaurants
      const r: unknown = Array.isArray(rawRestaurants) ? rawRestaurants[0] : rawRestaurants
      if (!isRestaurantRow(r)) continue
      results.push({
        id: r.id,
        name: r.name,
        address: r.address,
        lat: r.latitude,
        lng: r.longitude,
        placeId: r.google_place_id,
        photoUrl: r.google_photo_refs?.[0] ?? null,
        reviewCount: 0,
        avgFoodRating: null,
        lastReviewedAt: null,
      })
    }
    return results
  } catch {
    return []
  }
}

export async function saveTopSpots(userId: string, spots: TopSpot[]): Promise<void> {
  if (spots.length > 3) throw new Error('Top spots limited to 3')

  const { error: deleteError } = await supabase
    .from('user_top_spots')
    .delete()
    .eq('user_id', userId)

  if (deleteError) throw deleteError

  if (spots.length === 0) return

  const { error: insertError } = await supabase
    .from('user_top_spots')
    .insert(spots.map(s => ({ user_id: userId, position: s.position, restaurant_id: s.restaurantId })))

  if (insertError) throw insertError
}

export async function clearTopSpots(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_top_spots')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}
