import { supabase } from '@/lib/supabase'
import type { PlaceId, UserId } from '@/lib/types/branded'

export async function savePlace(userId: UserId, placeId: PlaceId): Promise<void> {
  const { error } = await supabase.from('saved_places').insert({
    user_id: userId,
    place_id: placeId,
  })
  if (error) throw error
}

export async function unsavePlace(userId: UserId, placeId: PlaceId): Promise<void> {
  const { error } = await supabase.from('saved_places')
    .delete()
    .eq('user_id', userId)
    .eq('place_id', placeId)
  if (error) throw error
}

export {
  submitPlaceEditSuggestion,
  submitPlaceClaim,
  recordPlaceObservation,
} from './governance'
