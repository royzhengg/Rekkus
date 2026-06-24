import type { Collection, CollectionItem, CollectionVisibility } from '@/lib/services/collections'
import { supabase } from '@/lib/supabase'
import type { CollectionId, UserId } from '@/lib/types/branded'
import { isRecord } from '@/lib/utils/safeJson'
import type { CollectionTargetType } from '@/types/domain'

function isCollectionVisibility(v: unknown): v is CollectionVisibility {
  return v === 'private' || v === 'unlisted' || v === 'public'
}

function isCollectionTargetType(v: unknown): v is CollectionTargetType {
  return v === 'dish' || v === 'place' || v === 'post'
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

export async function getCollection(id: CollectionId): Promise<Collection | null> {
  const { data, error } = await supabase
    .from('collections')
    .select('id, user_id, name, description, visibility, share_slug, is_staff_pick, curator_note')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data || !isCollectionVisibility(data.visibility)) return null
  return { ...data, visibility: data.visibility }
}

export async function listUserCollections(userId: UserId): Promise<Collection[]> {
  const { data } = await supabase
    .from('collections')
    .select('id, user_id, name, description, visibility, share_slug, is_staff_pick, curator_note')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50)
  return (data ?? []).flatMap(row =>
    isCollectionVisibility(row.visibility) ? [{ ...row, visibility: row.visibility }] : []
  )
}

export async function listCollectionItems(
  collectionId: CollectionId,
  cursor: string | null = null,
  limit = 30
): Promise<{ rows: CollectionItem[]; nextCursor: string | null }> {
  let query = supabase
    .from('collection_items')
    .select('id, collection_id, target_type, target_id, created_at')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: true })
    .limit(limit + 1)
  if (cursor) query = query.lt('created_at', cursor)
  const { data, error } = await query.overrideTypes<unknown[], { merge: false }>()
  if (error) throw error
  const parsed = (data ?? []).flatMap(v => {
    const item = parseCollectionItem(v)
    return item ? [item] : []
  })
  const hasMore = parsed.length > limit
  const rows = hasMore ? parsed.slice(0, limit) : parsed
  return { rows, nextCursor: hasMore ? rows.at(-1)?.created_at ?? null : null }
}
