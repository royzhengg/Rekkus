import { supabase } from '@/lib/supabase'

export type CollectionVisibility = 'private' | 'unlisted' | 'public'

export type Collection = {
  id: string
  user_id: string
  name: string
  description: string | null
  visibility: CollectionVisibility
  share_slug: string | null
  is_staff_pick?: boolean
  curator_note?: string | null
}

export type CollectionItem = {
  collection_id: string
  target_type: 'restaurant' | 'post'
  target_id: string
}

export async function fetchCollections(userId: string): Promise<Collection[]> {
  const { data } = await (supabase.from('collections') as any)
    .select('id, user_id, name, description, visibility, share_slug, is_staff_pick, curator_note')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50)

  return data ?? []
}

export async function fetchStaffPickCollections(): Promise<Collection[]> {
  const { data } = await (supabase.from('collections') as any)
    .select('id, user_id, name, description, visibility, share_slug, is_staff_pick, curator_note')
    .eq('is_staff_pick', true)
    .in('visibility', ['unlisted', 'public'])
    .order('display_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(10)

  return data ?? []
}

export async function fetchRestaurantCollectionItems(
  userId: string,
  restaurantIds: string[]
): Promise<CollectionItem[]> {
  if (restaurantIds.length === 0) return []
  const collections = await fetchCollections(userId)
  const collectionIds = collections.map(c => c.id)
  if (collectionIds.length === 0) return []

  const { data } = await (supabase.from('collection_items') as any)
    .select('collection_id, target_type, target_id')
    .in('collection_id', collectionIds)
    .eq('target_type', 'restaurant')
    .in('target_id', restaurantIds)
    .limit(500)

  return data ?? []
}

export async function makeCollectionShareable(collectionId: string): Promise<string | null> {
  const shareSlug = `${collectionId.slice(0, 8)}-${Date.now().toString(36)}`
  const { error } = await (supabase.from('collections') as any)
    .update({
      visibility: 'unlisted',
      share_slug: shareSlug,
      updated_at: new Date().toISOString(),
    })
    .eq('id', collectionId)

  return error ? null : shareSlug
}

export async function updateSavedLocationStatus(
  savedLocationId: string,
  status: 'want_to_try' | 'been_here'
): Promise<string | null> {
  const { error } = await (supabase.from('saved_locations') as any)
    .update({ save_status: status, updated_at: new Date().toISOString() })
    .eq('id', savedLocationId)

  return error?.message ?? null
}
