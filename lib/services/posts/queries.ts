import { supabase } from '@/lib/supabase'
import type { Post } from '@/types/domain'
import { reportInvalidBoundary } from '../boundaryTelemetry'
import { isPostMediaStatus, isRawPost } from './guards'
import { mapRowToPost, type RawPost, type SavedPostRow } from './types'

export function extractPostRow(p: RawPost | null | undefined): SavedPostRow | null {
  if (!p) return null
  if (p.deleted_at) return null
  const photos = p.post_photos ?? []
  const sortedPhotos = [...photos]
    .filter((ph) => !ph.deleted_at)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const photo = sortedPhotos.find((ph) => (ph.media_type ?? 'image') === 'image') ?? sortedPhotos[0]
  const r = p.places
  return {
    id: p.id,
    user_id: p.user_id,
    caption: p.caption,
    food_rating: p.food_rating,
    vibe_rating: p.vibe_rating,
    cost_rating: p.cost_rating,
    cuisine_type: p.cuisine_type,
    must_order: p.must_order,
    dish_id: p.dish_id,
    dish_tags: p.dish_tags ?? null,
    place_id: p.place_id,
    photo_url: photo?.url ?? null,
    media: sortedPhotos.map((ph) => ({
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
      processing_status: isPostMediaStatus(ph.processing_status) ? ph.processing_status : 'ready',
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
  id, user_id, caption, food_rating, vibe_rating, cost_rating, taste_verdict, value_verdict, occasion_tags, cuisine_type, must_order, dish_id, dish_tags, place_id, created_at, last_edited_at, edit_count,
  users ( username, full_name, avatar_url ),
  post_photos ( id, url, order_index, media_type, processed_url, thumbnail_url, mime_type, duration_ms, width, height, size_bytes, processing_status, processing_error, deleted_at ),
  places ( name, address, latitude, longitude, google_place_id )
`.trim()

export const PAGE_SIZE = 20

function parsePostRows(value: unknown[], boundary: string): RawPost[] {
  const posts = value.filter(isRawPost)
  if (posts.length !== value.length) {
    reportInvalidBoundary(boundary)
  }
  return posts
}

export async function fetchPostsByIds(ids: string[]): Promise<SavedPostRow[]> {
  if (ids.length === 0) return []
  const { data } = await supabase.from('posts')
    .select(POST_SELECT)
    .in('id', ids)
    .is('deleted_at', null)
    .overrideTypes<unknown[], { merge: false }>()
  if (!data) return []
  return parsePostRows(data, 'post_row_invalid').map((p) => extractPostRow(p)).filter((row): row is SavedPostRow => row !== null)
}

export async function fetchSavedPosts(userId: string): Promise<SavedPostRow[]> {
  const { data } = await supabase.from('saves')
    .select(`posts ( ${POST_SELECT} )`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
    .overrideTypes<Array<{ posts: unknown }>, { merge: false }>()
  if (!data) return []
  return data.map((s) => isRawPost(s.posts) ? extractPostRow(s.posts) : null).filter((row): row is SavedPostRow => row !== null)
}

type JunctionRow = { created_at: string | null; posts: unknown }

async function fetchJunctionPage(
  table: 'saves' | 'likes',
  userId: string,
  cursor: string | null,
  limit: number
): Promise<{ rows: SavedPostRow[]; nextCursor: string | null }> {
  let q = supabase.from(table)
    .select(`created_at, posts ( ${POST_SELECT} )`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) q = q.lt('created_at', cursor)

  const { data } = await q.overrideTypes<JunctionRow[], { merge: false }>()
  if (!data) return { rows: [], nextCursor: null }

  const hasMore = data.length > limit
  const page = hasMore ? data.slice(0, limit) : data
  const rows = page
    .map((s) => isRawPost(s.posts) ? extractPostRow(s.posts) : null)
    .filter((row): row is SavedPostRow => row !== null)

  return { rows, nextCursor: hasMore ? (page.at(-1)?.created_at ?? null) : null }
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
  const { data } = await supabase.from('likes')
    .select(`posts ( ${POST_SELECT} )`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
    .overrideTypes<Array<{ posts: unknown }>, { merge: false }>()
  if (!data) return []
  return data.map((s) => isRawPost(s.posts) ? extractPostRow(s.posts) : null).filter((row): row is SavedPostRow => row !== null)
}

export async function fetchFeedPostsPage(
  cursor: string | null,
  limit = PAGE_SIZE
): Promise<{ rows: SavedPostRow[]; nextCursor: string | null }> {
  let q = supabase.from('posts')
    .select(`${POST_SELECT}, created_at`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) q = q.lt('created_at', cursor)

  const { data } = await q.overrideTypes<unknown[], { merge: false }>()
  if (!data) return { rows: [], nextCursor: null }

  const hasMore = data.length > limit
  const page = hasMore ? data.slice(0, limit) : data
  const validPage = parsePostRows(page, 'feed_post_row_invalid')
  const rows = validPage.map((p) => extractPostRow(p)).filter((row): row is SavedPostRow => row !== null)

  return { rows, nextCursor: hasMore ? (validPage.at(-1)?.created_at ?? null) : null }
}

export async function fetchDishPostsPage(
  dishId: string,
  cursor: string | null,
  limit = PAGE_SIZE
): Promise<{ rows: SavedPostRow[]; nextCursor: string | null }> {
  let q = supabase.from('posts')
    .select(`${POST_SELECT}, created_at`)
    .eq('dish_id', dishId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) q = q.lt('created_at', cursor)

  const { data } = await q.overrideTypes<unknown[], { merge: false }>()
  if (!data) return { rows: [], nextCursor: null }

  const hasMore = data.length > limit
  const page = hasMore ? data.slice(0, limit) : data
  const validPage = parsePostRows(page, 'dish_post_row_invalid')
  const rows = validPage.map((post) => extractPostRow(post)).filter((row): row is SavedPostRow => row !== null)

  return { rows, nextCursor: hasMore ? (validPage.at(-1)?.created_at ?? null) : null }
}

export async function fetchPostById(postId: string): Promise<SavedPostRow | null> {
  const { data } = await supabase.from('posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .is('deleted_at', null)
    .single()
    .overrideTypes<unknown, { merge: false }>()
  if (!isRawPost(data)) {
    if (data !== null) reportInvalidBoundary('post_detail_row_invalid')
    return null
  }
  return extractPostRow(data)
}

export async function loadPostForEditing(postId: string): Promise<Post | null> {
  const row = await fetchPostById(postId)
  return row ? mapRowToPost(row, 0) : null
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
    .overrideTypes<unknown[], { merge: false }>()
  if (!data) return []
  return parsePostRows(data, 'cuisine_post_row_invalid').map((p) => extractPostRow(p)).filter((row): row is SavedPostRow => row !== null)
}
