import { supabase } from '@/lib/supabase'
import type { PlaceId } from '@/lib/types/branded'
import type { Place, PlaceStats } from '@/lib/types/place'

export async function getPlace(id: PlaceId): Promise<Place | null> {
  const { data } = await supabase.from('places').select('*').eq('id', id).maybeSingle()
  return data ?? null
}

export async function getPlaceWithStats(
  id: PlaceId
): Promise<{ place: Place; stats: PlaceStats | null } | null> {
  const [placeRes, statsRes] = await Promise.all([
    supabase.from('places').select('*').eq('id', id).maybeSingle(),
    supabase.from('place_stats').select('*').eq('place_id', id).maybeSingle(),
  ])
  if (!placeRes.data) return null
  return {
    place: placeRes.data as Place,
    stats: (statsRes.data as PlaceStats | null) ?? null,
  }
}

export async function listNearbyPlaces(
  lat: number,
  lng: number,
  radiusMetres = 2000
): Promise<Place[]> {
  const { data } = await supabase.rpc('places_within_radius', {
    p_lat: lat,
    p_lng: lng,
    p_radius_metres: radiusMetres,
    p_max_results: 20,
  })
  if (!data) return []
  const ids = (data as { id: string }[]).map(r => r.id)
  if (ids.length === 0) return []
  const { data: places } = await supabase.from('places').select('*').in('id', ids)
  return (places ?? []) as Place[]
}
