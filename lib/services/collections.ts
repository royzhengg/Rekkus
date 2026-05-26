import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'
import type { CollectionTargetType } from '@/types/domain'

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
  id?: string
  collection_id: string
  target_type: CollectionTargetType
  target_id: string
  created_at?: string
}

export type CollectionRestaurant = {
  id: string
  name: string
  address: string | null
  googlePlaceId: string | null
  latitude: number | null
  longitude: number | null
}

function isCollectionVisibility(value: unknown): value is CollectionVisibility {
  return value === 'private' || value === 'unlisted' || value === 'public'
}

export async function fetchCollections(userId: string): Promise<Collection[]> {
  const { data } = await supabase.from('collections')
    .select('id, user_id, name, description, visibility, share_slug, is_staff_pick, curator_note')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50)

  return (data ?? []).flatMap(row =>
    isCollectionVisibility(row.visibility) ? [{ ...row, visibility: row.visibility }] : []
  )
}

export async function fetchCollectionById(collectionId: string): Promise<Collection | null> {
  const { data, error } = await supabase.from('collections')
    .select('id, user_id, name, description, visibility, share_slug, is_staff_pick, curator_note')
    .eq('id', collectionId)
    .maybeSingle()
  if (error) throw error
  if (!data || !isCollectionVisibility(data.visibility)) return null
  return { ...data, visibility: data.visibility }
}

export async function createPrivateCollection(userId: string, name: string): Promise<Collection> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Collection name is required.')
  const { data, error } = await supabase.from('collections')
    .insert({ user_id: userId, name: trimmedName, visibility: 'private' })
    .select('id, user_id, name, description, visibility, share_slug, is_staff_pick, curator_note')
    .single()
  if (error) throw error
  if (!isCollectionVisibility(data.visibility)) throw new Error('Invalid collection visibility.')
  void supabase.rpc('record_collection_audit_event', {
    p_collection_id: data.id,
    p_event_type: 'created',
    p_context: { visibility: 'private' },
  })
  return { ...data, visibility: data.visibility }
}

export async function renameCollection(collectionId: string, newName: string): Promise<void> {
  const trimmed = newName.trim()
  if (!trimmed) throw new Error('Collection name is required.')
  const { error } = await supabase.from('collections')
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', collectionId)
  if (error) throw error
  void supabase.rpc('record_collection_audit_event', {
    p_collection_id: collectionId,
    p_event_type: 'renamed',
    p_context: { changed_fields: ['name'] },
  })
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const { error } = await supabase.from('collections')
    .delete()
    .eq('id', collectionId)
  if (error) throw error
  void supabase.rpc('record_collection_audit_event', {
    p_collection_id: collectionId,
    p_event_type: 'deleted',
    p_context: null,
  })
}

function isCollectionTargetType(value: unknown): value is CollectionTargetType {
  return value === 'dish' || value === 'restaurant' || value === 'post'
}

function parseCollectionItem(value: unknown): CollectionItem | null {
  if (!isRecord(value) ||
      typeof value.collection_id !== 'string' ||
      typeof value.target_id !== 'string' ||
      !isCollectionTargetType(value.target_type)) return null
  return {
    ...(typeof value.id === 'string' ? { id: value.id } : {}),
    collection_id: value.collection_id,
    target_type: value.target_type,
    target_id: value.target_id,
    ...(typeof value.created_at === 'string' ? { created_at: value.created_at } : {}),
  }
}

export async function fetchStaffPickCollections(): Promise<Collection[]> {
  const { data } = await supabase.from('collections')
    .select('id, user_id, name, description, visibility, share_slug, is_staff_pick, curator_note')
    .eq('is_staff_pick', true)
    .in('visibility', ['unlisted', 'public'])
    .order('display_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(10)

  return (data ?? []).flatMap(row =>
    isCollectionVisibility(row.visibility) ? [{ ...row, visibility: row.visibility }] : []
  )
}

export async function fetchRestaurantCollectionItems(
  userId: string,
  restaurantIds: string[]
): Promise<CollectionItem[]> {
  if (restaurantIds.length === 0) return []
  const collections = await fetchCollections(userId)
  const collectionIds = collections.map(c => c.id)
  if (collectionIds.length === 0) return []

  const { data } = await supabase.from('collection_items')
    .select('collection_id, target_type, target_id')
    .in('collection_id', collectionIds)
    .eq('target_type', 'restaurant')
    .in('target_id', restaurantIds)
    .limit(500)

  return (data ?? []).flatMap(row => {
    const parsed = parseCollectionItem(row)
    return parsed ? [parsed] : []
  })
}

export async function fetchCollectionItems(
  collectionId: string,
  cursor: string | null = null,
  limit = 30
): Promise<{ rows: CollectionItem[]; nextCursor: string | null }> {
  let query = supabase.from('collection_items')
    .select('id, collection_id, target_type, target_id, created_at')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: true })
    .limit(limit + 1)
  if (cursor) query = query.lt('created_at', cursor)
  const { data, error } = await query.overrideTypes<unknown[], { merge: false }>()
  if (error) throw error
  const parsed = (data ?? []).flatMap(value => {
    const item = parseCollectionItem(value)
    return item ? [item] : []
  })
  const hasMore = parsed.length > limit
  const rows = hasMore ? parsed.slice(0, limit) : parsed
  return { rows, nextCursor: hasMore ? rows.at(-1)?.created_at ?? null : null }
}

export async function fetchTargetCollectionItems(
  userId: string,
  targetType: CollectionTargetType,
  targetId: string
): Promise<CollectionItem[]> {
  const collections = await fetchCollections(userId)
  const collectionIds = collections.map(collection => collection.id)
  if (collectionIds.length === 0) return []
  const { data, error } = await supabase.from('collection_items')
    .select('id, collection_id, target_type, target_id, created_at')
    .in('collection_id', collectionIds)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .limit(50)
    .overrideTypes<unknown[], { merge: false }>()
  if (error) throw error
  return (data ?? []).flatMap(value => {
    const item = parseCollectionItem(value)
    return item ? [item] : []
  })
}

export async function fetchCollectionRestaurantsByIds(ids: string[]): Promise<CollectionRestaurant[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('restaurants')
    .select('id, name, address, google_place_id, latitude, longitude')
    .in('id', ids)
    .limit(Math.min(ids.length, 100))
    .overrideTypes<unknown[], { merge: false }>()
  if (error) throw error
  return (data ?? []).flatMap(value => {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return []
    return [{
      id: value.id,
      name: value.name,
      address: typeof value.address === 'string' ? value.address : null,
      googlePlaceId: typeof value.google_place_id === 'string' ? value.google_place_id : null,
      latitude: typeof value.latitude === 'number' ? value.latitude : null,
      longitude: typeof value.longitude === 'number' ? value.longitude : null,
    }]
  })
}

export async function addTargetToCollection(
  collectionId: string,
  targetType: CollectionTargetType,
  targetId: string
): Promise<void> {
  const { error } = await supabase.rpc('add_saved_target_to_collection', {
    p_collection_id: collectionId,
    p_target_type: targetType,
    p_target_id: targetId,
  })
  if (error) throw error
  void supabase.rpc('record_collection_audit_event', {
    p_collection_id: collectionId,
    p_event_type: 'item_added',
    p_context: { target_type: targetType, target_id: targetId },
  })
}

export async function removeTargetFromCollection(
  collectionId: string,
  targetType: CollectionTargetType,
  targetId: string
): Promise<void> {
  const { error } = await supabase.from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
  if (error) throw error
  void supabase.rpc('record_collection_audit_event', {
    p_collection_id: collectionId,
    p_event_type: 'item_removed',
    p_context: { target_type: targetType, target_id: targetId },
  })
}

export async function unsaveTarget(
  targetType: CollectionTargetType,
  targetId: string,
  removeCollectionMemberships: boolean
): Promise<void> {
  const { error } = await supabase.rpc('unsave_target', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_remove_collection_memberships: removeCollectionMemberships,
  })
  if (error) throw error
}

export async function makeCollectionShareable(collectionId: string): Promise<string | null> {
  const shareSlug = `${collectionId.slice(0, 8)}-${Date.now().toString(36)}`
  const { error } = await supabase.from('collections')
    .update({
      visibility: 'unlisted',
      share_slug: shareSlug,
      updated_at: new Date().toISOString(),
    })
    .eq('id', collectionId)
  if (!error) {
    void supabase.rpc('record_collection_audit_event', {
      p_collection_id: collectionId,
      p_event_type: 'visibility_changed',
      p_context: { visibility: 'unlisted' },
    })
  }
  return error ? null : shareSlug
}

export async function updateSavedLocationStatus(
  savedLocationId: string,
  status: 'want_to_try' | 'been_here'
): Promise<string | null> {
  const { error } = await supabase.from('saved_locations')
    .update({ save_status: status, updated_at: new Date().toISOString() })
    .eq('id', savedLocationId)

  return error?.message ?? null
}
