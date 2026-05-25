import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { DishTag, PostMediaAsset, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'
import type { PostEditEventType, UpdatePostPayload } from './types'

export async function recordPostEditEvent(
  postId: string,
  userId: string,
  eventType: PostEditEventType,
  changedFields: string[] = []
): Promise<void> {
  const uniqueFields = Array.from(new Set(changedFields)).slice(0, 40)
  const { error } = await supabase.from('post_edit_events').insert({
    post_id: postId,
    user_id: userId,
    event_type: eventType,
    changed_fields: uniqueFields,
    changed_field_count: uniqueFields.length,
  })
  if (error) throw error
}

export async function updatePost(postId: string, payload: UpdatePostPayload): Promise<void> {
  const changedFields: string[] = []
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    last_edited_at: new Date().toISOString(),
  }

  if ('caption' in payload) {
    patch.caption = payload.caption
    changedFields.push('caption')
  }
  if ('restaurantId' in payload) {
    patch.restaurant_id = payload.restaurantId
    changedFields.push('restaurant_id')
  }
  if ('foodRating' in payload) {
    patch.food_rating = payload.foodRating
    changedFields.push('food_rating')
  }
  if ('vibeRating' in payload) {
    patch.vibe_rating = payload.vibeRating
    changedFields.push('vibe_rating')
  }
  if ('costRating' in payload) {
    patch.cost_rating = payload.costRating
    changedFields.push('cost_rating')
  }
  if ('tasteVerdict' in payload) {
    patch.taste_verdict = payload.tasteVerdict
    changedFields.push('taste_verdict')
  }
  if ('valueVerdict' in payload) {
    patch.value_verdict = payload.valueVerdict
    changedFields.push('value_verdict')
  }
  if ('occasionTags' in payload) {
    patch.occasion_tags = payload.occasionTags ?? []
    changedFields.push('occasion_tags')
  }
  if ('cuisineType' in payload) {
    patch.cuisine_type = payload.cuisineType
    changedFields.push('cuisine_type')
  }
  if ('bestDish' in payload) {
    patch.best_dish = payload.bestDish
    changedFields.push('best_dish')
  }
  if ('dishId' in payload) {
    patch.dish_id = payload.dishId
    changedFields.push('dish_id')
  }
  if ('dishTags' in payload) {
    patch.dish_tags = payload.dishTags ?? []
    changedFields.push('dish_tags')
  }

  type PostUpdate = Database['public']['Tables']['posts']['Update']
  const { data: existing, error: existingError } = await supabase.from('posts')
    .select('edit_count, deleted_at')
    .eq('id', postId)
    .eq('user_id', payload.userId)
    .maybeSingle()
  if (existingError) throw existingError
  if (!existing || existing.deleted_at) {
    throw new Error('post_unavailable')
  }
  if (
    payload.expectedEditCount != null &&
    ((existing.edit_count as number | null | undefined) ?? 0) !== payload.expectedEditCount
  ) {
    throw new Error('post_edit_conflict')
  }
  patch.edit_count = ((existing.edit_count as number | null | undefined) ?? 0) + 1

  const { error } = await supabase.from('posts')
    .update(patch as PostUpdate)
    .eq('id', postId)
    .eq('user_id', payload.userId)
  if (error) throw error

  if (payload.media) {
    changedFields.push('media')
    const deletedAt = new Date().toISOString()
    const { error: softDeleteError } = await supabase.from('post_photos')
      .update({ deleted_at: deletedAt })
      .eq('post_id', postId)
    if (softDeleteError) throw softDeleteError

    if (payload.media.length > 0) {
      const validDbStatuses = new Set([
        'local_ready', 'queued', 'uploading', 'uploaded', 'processing', 'ready', 'failed',
      ])
      const rows = payload.media.map((item, orderIndex) => ({
        post_id: postId,
        url: item.processedUrl ?? item.originalUrl ?? item.uri,
        original_url: item.originalUrl ?? item.uri,
        processed_url: item.processedUrl ?? item.uri,
        thumbnail_url: item.thumbnailUrl ?? null,
        media_type: item.type,
        mime_type: item.mimeType ?? null,
        size_bytes: item.sizeBytes ?? null,
        duration_ms: item.durationMs ?? null,
        width: item.width ?? null,
        height: item.height ?? null,
        processing_status: item.processingStatus && validDbStatuses.has(item.processingStatus) ? item.processingStatus : 'ready',
        processing_error: item.processingError ?? null,
        order_index: orderIndex,
      }))
      const { error: insertError } = await supabase.from('post_photos').insert(rows)
      if (insertError) throw insertError
    }
  }

  await recordPostEditEvent(postId, payload.userId, 'edit_saved', changedFields)
}

export async function createPost(params: {
  userId: string
  caption: string | null
  restaurantId: string | null
  foodRating: number | null
  vibeRating: number | null
  costRating: number | null
  tasteVerdict: RekkusTasteVerdict | null
  valueVerdict: RekkusValueVerdict | null
  occasionTags: RekkusOccasionTag[]
  cuisineType: string | null
  bestDish: string | null
  dishId?: string | null
  dishTags: DishTag[]
  media: PostMediaAsset[]
}): Promise<string> {
  const { data, error } = await supabase.from('posts')
    .insert({
      user_id: params.userId,
      caption: params.caption,
      restaurant_id: params.restaurantId,
      food_rating: params.foodRating,
      vibe_rating: params.vibeRating,
      cost_rating: params.costRating,
      taste_verdict: params.tasteVerdict,
      value_verdict: params.valueVerdict,
      occasion_tags: params.occasionTags,
      cuisine_type: params.cuisineType,
      best_dish: params.bestDish,
      dish_id: params.dishId ?? null,
      dish_tags: params.dishTags,
      edit_count: 0,
    })
    .select('id')
    .single()
  if (error) throw error

  const postId: string = data.id

  if (params.media.length > 0) {
    const validDbStatuses = new Set([
      'local_ready', 'queued', 'uploading', 'uploaded', 'processing', 'ready', 'failed',
    ])
    const rows = params.media.map((item, orderIndex) => ({
      post_id: postId,
      url: item.processedUrl ?? item.originalUrl ?? item.uri,
      original_url: item.originalUrl ?? item.uri,
      processed_url: item.processedUrl ?? item.uri,
      thumbnail_url: item.thumbnailUrl ?? null,
      media_type: item.type,
      mime_type: item.mimeType ?? null,
      size_bytes: item.sizeBytes ?? null,
      duration_ms: item.durationMs ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      processing_status: item.processingStatus && validDbStatuses.has(item.processingStatus) ? item.processingStatus : 'ready',
      processing_error: item.processingError ?? null,
      order_index: orderIndex,
    }))
    const { error: photoError } = await supabase.from('post_photos').insert(rows)
    if (photoError) throw photoError
  }

  void supabase.rpc('record_content_lifecycle_event', {
    p_entity_type: 'post',
    p_entity_id: postId,
    p_event_type: 'created',
    p_context: { source: 'user_action' },
  })

  return postId
}

export async function deletePost(postId: string): Promise<void> {
  await supabase.rpc('delete_post', { p_post_id: postId })
  void supabase.rpc('record_content_lifecycle_event', {
    p_entity_type: 'post',
    p_entity_id: postId,
    p_event_type: 'deleted',
    p_context: { source: 'user_action' },
  })
}
