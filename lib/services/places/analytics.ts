import { supabase } from '@/lib/supabase'

export type PostRatingRow = {
  food_rating: number | null
  vibe_rating: number | null
  cost_rating: number | null
  created_at: string
  must_order: string | null
  dish_id: string | null
}

export async function fetchPlacePostRatings(placeId: string): Promise<PostRatingRow[]> {
  const { data } = await supabase.from('posts')
    .select('food_rating, vibe_rating, cost_rating, created_at, must_order, dish_id')
    .eq('place_id', placeId)
    .limit(100)
  return (data ?? []).filter((row): row is PostRatingRow =>
    typeof row.created_at === 'string' &&
    (row.food_rating === null || typeof row.food_rating === 'number') &&
    (row.vibe_rating === null || typeof row.vibe_rating === 'number') &&
    (row.cost_rating === null || typeof row.cost_rating === 'number') &&
    (row.must_order === null || typeof row.must_order === 'string') &&
    (row.dish_id === null || typeof row.dish_id === 'string')
  )
}

export async function fetchIsPlaceSaved(userId: string, placeId: string): Promise<boolean> {
  const { data } = await supabase.from('saved_places')
    .select('id')
    .eq('user_id', userId)
    .eq('place_id', placeId)
    .maybeSingle()
  return !!data
}

