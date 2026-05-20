import { supabase } from '@/lib/supabase'
import type { DishTag, Post, PostMediaAsset, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'
import { avatarPalette } from '@/lib/utils/format'
import { notify } from '@/lib/services/notifications'
import { analytics } from '@/lib/analytics'

export type SavedPostRow = {
  id: string
  user_id: string
  caption: string | null
  food_rating: number | null
  vibe_rating: number | null
  cost_rating: number | null
  cuisine_type: string | null
  best_dish: string | null
  dish_tags: { photoIndex: number; x: number; y: number; name: string }[] | null
  restaurant_id: string | null
  photo_url: string | null
  media: Array<{
    id?: string
    url: string
    deleted_at?: string | null
    media_type?: 'image' | 'video' | null
    processed_url?: string | null
    thumbnail_url?: string | null
    mime_type?: string | null
    duration_ms?: number | null
    width?: number | null
    height?: number | null
    size_bytes?: number | null
    processing_status?: string | null
    processing_error?: string | null
    order_index?: number | null
  }>
  taste_verdict?: any
  value_verdict?: any
  occasion_tags?: any
  username: string
  full_name: string | null
  avatar_url: string | null
  restaurant_name: string | null
  restaurant_address: string | null
  restaurant_lat: number | null
  restaurant_lng: number | null
  restaurant_place_id: string | null
  created_at?: string | null
  last_edited_at?: string | null
  edit_count?: number | null
}

export type PostEditEventType =
  | 'edit_started'
  | 'edit_saved'
  | 'edit_discarded'
  | 'edit_conflict'
  | 'media_replaced'

export type PostCommentRow = {
  id: string
  content: string
  created_at: string
  parent_id: string | null
  users: { username: string; full_name: string | null } | null
}

export type PostReactionType = 'helpful' | 'love' | 'thanks' | 'oh_no'

export type PostSocialState = {
  likeCount: number
  comments: PostCommentRow[]
  reactionCounts: Record<string, number>
  myReactions: PostReactionType[]
  liked: boolean
  saved: boolean
  locationSaved: boolean
}

export type UpdatePostPayload = {
  caption?: string | null
  restaurantId?: string | null
  foodRating?: number | null
  vibeRating?: number | null
  costRating?: number | null
  tasteVerdict?: RekkusTasteVerdict | null
  valueVerdict?: RekkusValueVerdict | null
  occasionTags?: RekkusOccasionTag[]
  cuisineType?: string | null
  bestDish?: string | null
  dishTags?: DishTag[]
  media?: PostMediaAsset[]
  userId: string
  expectedEditCount?: number | null
}

export function mapRowToPost(row: SavedPostRow, index: number): Post {
  const palette = avatarPalette(row.username)
  const name = row.full_name ?? row.username
  return {
    id: index + 1,
    dbId: row.id,
    userId: row.user_id,
    title: row.caption ?? '',
    body: row.caption ?? '',
    creator: row.username,
    initials: name.slice(0, 2).toUpperCase(),
    avatarBg: palette.bg,
    avatarColor: palette.color,
    likes: '0',
    imgKey: 'warm',
    imageUrl: row.media.find(item => (item.media_type ?? 'image') === 'image')?.processed_url ?? row.photo_url ?? undefined,
    videoUrl: row.media.find(item => item.media_type === 'video')?.processed_url ?? row.media.find(item => item.media_type === 'video')?.url ?? undefined,
    mediaType: row.media[0]?.media_type ?? (row.photo_url ? 'image' : undefined),
    media: row.media.map(item => ({
      id: item.id,
      localId: item.id ?? item.url,
      uri: item.processed_url ?? item.url,
      type: item.media_type ?? 'image',
      mimeType: item.mime_type ?? null,
      processedUrl: item.processed_url ?? item.url,
      thumbnailUrl: item.thumbnail_url ?? null,
      durationMs: item.duration_ms ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      sizeBytes: item.size_bytes ?? null,
      processingStatus: (item.processing_status as any) ?? 'ready',
      processingError: item.processing_error ?? null,
    })),
    createdAt: row.created_at ?? undefined,
    lastEditedAt: row.last_edited_at ?? undefined,
    editCount: row.edit_count ?? undefined,
    tall: false,
    tags: [],
    location: row.restaurant_name ?? '',
    food: row.food_rating ?? 0,
    vibe: row.vibe_rating ?? 0,
    cost: row.cost_rating ?? 0,
    tasteVerdict: row.taste_verdict,
    valueVerdict: row.value_verdict,
    occasionTags: row.occasion_tags ?? [],
    cuisine_type: row.cuisine_type ?? undefined,
    best_dish: row.best_dish ?? undefined,
    dishTags: row.dish_tags ?? undefined,
    restaurantId: row.restaurant_id ?? undefined,
    placeId: row.restaurant_place_id ?? undefined,
    lat: row.restaurant_lat ?? undefined,
    lng: row.restaurant_lng ?? undefined,
    address: row.restaurant_address ?? undefined,
  }
}

export async function likePost(postId: string, userId: string): Promise<void> {
  await (supabase.from('likes') as any).upsert(
    { post_id: postId, user_id: userId },
    { onConflict: 'user_id,post_id' }
  )
  notify({ type: 'like', actorId: userId, postId })
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  await (supabase.from('likes') as any).delete().eq('post_id', postId).eq('user_id', userId)
}

export async function togglePostLike(
  postId: string,
  userId: string,
  nextLiked?: boolean
): Promise<boolean> {
  const targetState = nextLiked ?? !(await fetchUserLikes(userId)).includes(postId)
  if (targetState) {
    await likePost(postId, userId)
    analytics.likePost(userId, postId)
  } else {
    await unlikePost(postId, userId)
  }
  return targetState
}

export async function savePost(postId: string, userId: string): Promise<void> {
  await (supabase.from('saves') as any).upsert(
    { post_id: postId, user_id: userId },
    { onConflict: 'user_id,post_id' }
  )
}

export async function unsavePost(postId: string, userId: string): Promise<void> {
  await (supabase.from('saves') as any).delete().eq('post_id', postId).eq('user_id', userId)
}

export async function togglePostSave(
  postId: string,
  userId: string,
  nextSaved?: boolean
): Promise<boolean> {
  const targetState = nextSaved ?? !(await fetchUserSaves(userId)).includes(postId)
  if (targetState) {
    await savePost(postId, userId)
    analytics.savePost(userId, postId)
  } else {
    await unsavePost(postId, userId)
  }
  return targetState
}

export async function addPostReaction(
  postId: string,
  userId: string,
  reactionType: PostReactionType
): Promise<void> {
  const { error } = await (supabase.from('post_reactions') as any).insert({
    post_id: postId,
    user_id: userId,
    reaction_type: reactionType,
  })
  if (error) throw error
}

export async function removePostReaction(
  postId: string,
  userId: string,
  reactionType: PostReactionType
): Promise<void> {
  const { error } = await (supabase.from('post_reactions') as any)
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)
    .eq('reaction_type', reactionType)
  if (error) throw error
}

export async function fetchPostLikes(postId: string): Promise<number> {
  const { count } = await (supabase.from('likes') as any)
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)
  return count ?? 0
}

export async function fetchPostSocialState(
  postId: string,
  userId?: string,
  restaurantId?: string | null
): Promise<PostSocialState> {
  const [countRes, commentsRes, reactionsRes] = await Promise.all([
    (supabase.from('likes') as any)
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId),
    (supabase.from('comments') as any)
      .select('id, content, created_at, parent_id, users(username, full_name)')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    (supabase.from('post_reactions') as any)
      .select('reaction_type, user_id')
      .eq('post_id', postId),
  ])

  const reactionCounts: Record<string, number> = {}
  const myReactions: PostReactionType[] = []
  for (const reaction of reactionsRes.data ?? []) {
    reactionCounts[reaction.reaction_type] = (reactionCounts[reaction.reaction_type] ?? 0) + 1
    if (userId && reaction.user_id === userId) {
      myReactions.push(reaction.reaction_type as PostReactionType)
    }
  }

  let liked = false
  let saved = false
  let locationSaved = false
  if (userId) {
    const userQueries: Array<Promise<{ data: unknown }>> = [
      (supabase.from('likes') as any)
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle(),
      (supabase.from('saves') as any)
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]
    if (restaurantId) {
      userQueries.push(
        (supabase.from('saved_locations') as any)
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('user_id', userId)
          .maybeSingle()
      )
    }
    const [likeRes, saveRes, locRes] = await Promise.all(userQueries)
    liked = !!likeRes.data
    saved = !!saveRes.data
    locationSaved = !!locRes?.data
  }

  return {
    likeCount: countRes.count ?? 0,
    comments: commentsRes.data ?? [],
    reactionCounts,
    myReactions,
    liked,
    saved,
    locationSaved,
  }
}

export async function fetchUserLikes(userId: string): Promise<string[]> {
  const { data } = await (supabase.from('likes') as any)
    .select('post_id')
    .eq('user_id', userId)
    .limit(500)
  return data?.map((r: any) => r.post_id) ?? []
}

export async function fetchUserSaves(userId: string): Promise<string[]> {
  const { data } = await (supabase.from('saves') as any)
    .select('post_id')
    .eq('user_id', userId)
    .limit(500)
  return data?.map((r: any) => r.post_id) ?? []
}

export function extractPostRow(p: any): SavedPostRow | null {
  if (!p) return null
  if (p.deleted_at) return null
  const photos: any[] = p.post_photos ?? []
  const sortedPhotos = [...photos]
    .filter((ph: any) => !ph.deleted_at)
    .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const photo = sortedPhotos.find((ph: any) => (ph.media_type ?? 'image') === 'image') ?? sortedPhotos[0]
  const r = p.restaurants
  return {
    id: p.id,
    user_id: p.user_id,
    caption: p.caption,
    food_rating: p.food_rating,
    vibe_rating: p.vibe_rating,
    cost_rating: p.cost_rating,
    cuisine_type: p.cuisine_type,
    best_dish: p.best_dish,
    dish_tags: p.dish_tags ?? null,
    restaurant_id: p.restaurant_id,
    photo_url: photo?.url ?? null,
    media: sortedPhotos.map((ph: any) => ({
      id: ph.id,
      url: ph.url,
      deleted_at: ph.deleted_at ?? null,
      media_type: ph.media_type ?? 'image',
      processed_url: ph.processed_url ?? ph.url,
      thumbnail_url: ph.thumbnail_url ?? null,
      mime_type: ph.mime_type ?? null,
      duration_ms: ph.duration_ms ?? null,
      width: ph.width ?? null,
      height: ph.height ?? null,
      size_bytes: ph.size_bytes ?? null,
      processing_status: ph.processing_status ?? 'ready',
      processing_error: ph.processing_error ?? null,
      order_index: ph.order_index ?? 0,
    })),
    taste_verdict: p.taste_verdict ?? null,
    value_verdict: p.value_verdict ?? null,
    occasion_tags: p.occasion_tags ?? [],
    username: p.users?.username ?? 'user',
    full_name: p.users?.full_name ?? null,
    avatar_url: p.users?.avatar_url ?? null,
    restaurant_name: r?.name ?? null,
    restaurant_address: r?.address ?? null,
    restaurant_lat: r?.latitude ?? null,
    restaurant_lng: r?.longitude ?? null,
    restaurant_place_id: r?.google_place_id ?? null,
    created_at: p.created_at ?? null,
    last_edited_at: p.last_edited_at ?? null,
    edit_count: p.edit_count ?? null,
  }
}

const POST_SELECT = `
  id, user_id, caption, food_rating, vibe_rating, cost_rating, taste_verdict, value_verdict, occasion_tags, cuisine_type, best_dish, dish_tags, restaurant_id, created_at, last_edited_at, edit_count,
  users ( username, full_name, avatar_url ),
  post_photos ( id, url, order_index, media_type, processed_url, thumbnail_url, mime_type, duration_ms, width, height, size_bytes, processing_status, processing_error, deleted_at ),
  restaurants ( name, address, latitude, longitude, google_place_id )
`.trim()

export const PAGE_SIZE = 20

export async function fetchPostsByIds(ids: string[]): Promise<SavedPostRow[]> {
  if (ids.length === 0) return []
  const { data } = await (supabase.from('posts') as any)
    .select(POST_SELECT)
    .in('id', ids)
    .is('deleted_at', null)
  if (!data) return []
  return (data as any[]).map(extractPostRow).filter(Boolean) as SavedPostRow[]
}

export async function fetchSavedPosts(userId: string): Promise<SavedPostRow[]> {
  const { data } = await (supabase.from('saves') as any)
    .select(`posts ( ${POST_SELECT} )`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (!data) return []
  return data.map((s: any) => extractPostRow(s.posts)).filter(Boolean) as SavedPostRow[]
}

async function fetchJunctionPage(
  table: 'saves' | 'likes',
  userId: string,
  cursor: string | null,
  limit: number
): Promise<{ rows: SavedPostRow[]; nextCursor: string | null }> {
  let q = (supabase.from(table) as any)
    .select(`created_at, posts ( ${POST_SELECT} )`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) q = q.lt('created_at', cursor)

  const { data } = await q
  if (!data) return { rows: [], nextCursor: null }

  const hasMore = data.length > limit
  const page = hasMore ? data.slice(0, limit) : data
  const rows = page
    .map((s: any) => extractPostRow(s.posts))
    .filter(Boolean) as SavedPostRow[]

  return { rows, nextCursor: hasMore ? page[page.length - 1].created_at : null }
}

export async function fetchSavedPostsPage(
  userId: string,
  cursor: string | null,
  limit = PAGE_SIZE
): Promise<{ rows: SavedPostRow[]; nextCursor: string | null }> {
  return fetchJunctionPage('saves', userId, cursor, limit)
}

export async function fetchLikedPostsPage(
  userId: string,
  cursor: string | null,
  limit = PAGE_SIZE
): Promise<{ rows: SavedPostRow[]; nextCursor: string | null }> {
  return fetchJunctionPage('likes', userId, cursor, limit)
}

export async function fetchLikedPosts(userId: string): Promise<SavedPostRow[]> {
  const { data } = await (supabase.from('likes') as any)
    .select(`posts ( ${POST_SELECT} )`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (!data) return []
  return data.map((s: any) => extractPostRow(s.posts)).filter(Boolean) as SavedPostRow[]
}

export async function fetchFeedPostsPage(
  cursor: string | null,
  limit = PAGE_SIZE
): Promise<{ rows: SavedPostRow[]; nextCursor: string | null }> {
  let q = (supabase.from('posts') as any)
    .select(`${POST_SELECT}, created_at`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) q = q.lt('created_at', cursor)

  const { data } = await q
  if (!data) return { rows: [], nextCursor: null }

  const hasMore = data.length > limit
  const page = hasMore ? data.slice(0, limit) : data
  const rows = page.map((p: unknown) => extractPostRow(p)).filter(Boolean) as SavedPostRow[]

  return { rows, nextCursor: hasMore ? page[page.length - 1].created_at : null }
}

export async function fetchPostById(postId: string): Promise<SavedPostRow | null> {
  const { data } = await (supabase.from('posts') as any)
    .select(POST_SELECT)
    .eq('id', postId)
    .is('deleted_at', null)
    .single()
  return extractPostRow(data)
}

export async function loadPostForEditing(postId: string): Promise<Post | null> {
  const row = await fetchPostById(postId)
  return row ? mapRowToPost(row, 0) : null
}

export async function recordPostEditEvent(
  postId: string,
  userId: string,
  eventType: PostEditEventType,
  changedFields: string[] = []
): Promise<void> {
  const uniqueFields = Array.from(new Set(changedFields)).slice(0, 40)
  const { error } = await (supabase.from('post_edit_events') as any).insert({
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
  if ('dishTags' in payload) {
    patch.dish_tags = payload.dishTags ?? []
    changedFields.push('dish_tags')
  }

  const { data: existing, error: existingError } = await (supabase.from('posts') as any)
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
  patch.edit_count = ((existing?.edit_count as number | null | undefined) ?? 0) + 1

  const { error } = await (supabase.from('posts') as any)
    .update(patch)
    .eq('id', postId)
    .eq('user_id', payload.userId)
  if (error) throw error

  if (payload.media) {
    changedFields.push('media')
    const deletedAt = new Date().toISOString()
    const { error: softDeleteError } = await (supabase.from('post_photos') as any)
      .update({ deleted_at: deletedAt })
      .eq('post_id', postId)
    if (softDeleteError) throw softDeleteError

    if (payload.media.length > 0) {
      const VALID_DB_STATUSES = new Set([
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
        processing_status: VALID_DB_STATUSES.has(item.processingStatus ?? '') ? item.processingStatus : 'ready',
        processing_error: item.processingError ?? null,
        order_index: orderIndex,
      }))
      const { error: insertError } = await (supabase.from('post_photos') as any).insert(rows)
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
  dishTags: DishTag[]
  media: PostMediaAsset[]
}): Promise<string> {
  const { data, error } = await (supabase.from('posts') as any)
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
      dish_tags: params.dishTags,
      edit_count: 0,
    })
    .select('id')
    .single()
  if (error) throw error

  const postId: string = data.id

  if (params.media.length > 0) {
    // DB check constraint only allows these values for processing_status
    const VALID_DB_STATUSES = new Set([
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
      processing_status: VALID_DB_STATUSES.has(item.processingStatus ?? '') ? item.processingStatus : 'ready',
      processing_error: item.processingError ?? null,
      order_index: orderIndex,
    }))
    const { error: photoError } = await (supabase.from('post_photos') as any).insert(rows)
    if (photoError) throw photoError
  }

  return postId
}

export async function deletePost(postId: string): Promise<void> {
  await supabase.rpc('delete_post', { p_post_id: postId })
}

export async function fetchPostsByCuisines(
  cuisines: string[],
  limit = 20
): Promise<SavedPostRow[]> {
  if (cuisines.length === 0) return []
  const cuisineFilter = cuisines
    .map(c => `cuisine_type.ilike.%${String(c).replace(/,/g, '')}%`)
    .join(',')
  const { data } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .is('deleted_at', null)
    .or(cuisineFilter)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data) return []
  return data.map((p: unknown) => extractPostRow(p)).filter(Boolean) as SavedPostRow[]
}
