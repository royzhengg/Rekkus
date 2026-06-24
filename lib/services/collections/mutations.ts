import type { Collection, CollectionVisibility } from '@/lib/services/collections'
import { supabase } from '@/lib/supabase'
import type { CollectionId, UserId } from '@/lib/types/branded'
import type { CollectionTargetType } from '@/types/domain'

export async function createCollection(
  userId: UserId,
  name: string,
  visibility: CollectionVisibility = 'private'
): Promise<Collection> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Collection name is required.')
  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: userId, name: trimmed, visibility })
    .select('id, user_id, name, description, visibility, share_slug, is_staff_pick, curator_note')
    .single()
  if (error) throw error
  void supabase.rpc('record_collection_audit_event', {
    p_collection_id: data.id,
    p_event_type: 'created',
    p_context: { visibility },
  })
  return data as Collection
}

export async function addItem(
  collectionId: CollectionId,
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

export async function removeItem(
  collectionId: CollectionId,
  targetType: CollectionTargetType,
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from('collection_items')
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

export async function deleteCollection(collectionId: CollectionId): Promise<void> {
  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', collectionId)
  if (error) throw error
  void supabase.rpc('record_collection_audit_event', {
    p_collection_id: collectionId,
    p_event_type: 'deleted',
    p_context: null,
  })
}
