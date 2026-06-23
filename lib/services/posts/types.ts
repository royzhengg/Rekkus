import { avatarPalette } from '@/lib/utils/format'
import type { DishTag, Post, PostMediaAsset, PostMediaProcessingStatus, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'

export type SavedPostRow = {
  id: string
  user_id: string
  caption: string | null
  food_rating: number | null
  vibe_rating: number | null
  cost_rating: number | null
  cuisine_type: string | null
  must_order: string | null
  dish_id: string | null
  dish_tags: { photoIndex: number; x: number; y: number; name: string }[] | null
  place_id: string | null
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
    processing_status?: PostMediaProcessingStatus | null
    processing_error?: string | null
    order_index?: number | null
  }>
  taste_verdict?: RekkusTasteVerdict | null
  value_verdict?: RekkusValueVerdict | null
  occasion_tags?: RekkusOccasionTag[]
  username: string
  full_name: string | null
  avatar_url: string | null
  place_name: string | null
  place_address: string | null
  place_lat: number | null
  place_lng: number | null
  place_google_id: string | null
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
  created_at: string | null
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
  placeId?: string | null
  tasteVerdict?: RekkusTasteVerdict | null
  valueVerdict?: RekkusValueVerdict | null
  occasionTags?: RekkusOccasionTag[]
  cuisineType?: string | null
  mustOrder?: string | null
  cashDiscount?: boolean | null
  googleReviewFreebie?: boolean | null
  dishId?: string | null
  dishTags?: DishTag[]
  media?: PostMediaAsset[]
  userId: string
  expectedEditCount?: number | null
}

export type RawPostPhoto = {
  id: string
  url: string
  deleted_at: string | null
  media_type: 'image' | 'video' | null
  processed_url: string | null
  thumbnail_url: string | null
  mime_type: string | null
  duration_ms: number | null
  width: number | null
  height: number | null
  size_bytes: number | null
  processing_status: PostMediaProcessingStatus | null
  processing_error: string | null
  order_index: number | null
}

export type RawPost = {
  id: string
  user_id: string
  deleted_at?: string | null
  caption: string | null
  food_rating: number | null
  vibe_rating: number | null
  cost_rating: number | null
  cuisine_type: string | null
  must_order: string | null
  dish_id: string | null
  dish_tags: { photoIndex: number; x: number; y: number; name: string }[] | null
  place_id: string | null
  taste_verdict: RekkusTasteVerdict | null
  value_verdict: RekkusValueVerdict | null
  occasion_tags: RekkusOccasionTag[] | null
  created_at: string | null
  last_edited_at: string | null
  edit_count: number | null
  users: { username: string; full_name: string | null; avatar_url: string | null } | null
  post_photos: RawPostPhoto[] | null
  places: { name: string; address: string | null; latitude: number | null; longitude: number | null; google_place_id: string | null } | null
}

export function mapRowToPost(row: SavedPostRow, index: number): Post {
  const palette = avatarPalette(row.username)
  const name = row.full_name ?? row.username
  const imageMedia = row.media.find(item => (item.media_type ?? 'image') === 'image')
  const videoMedia = row.media.find(item => item.media_type === 'video')
  const imageUrl =
    imageMedia?.processed_url ??
    imageMedia?.thumbnail_url ??
    imageMedia?.url ??
    videoMedia?.thumbnail_url ??
    row.photo_url ??
    undefined
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
    imageUrl,
    videoUrl: videoMedia?.processed_url ?? videoMedia?.url ?? undefined,
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
      processingStatus: item.processing_status ?? 'ready',
      processingError: item.processing_error ?? null,
    })),
    createdAt: row.created_at ?? undefined,
    lastEditedAt: row.last_edited_at ?? undefined,
    editCount: row.edit_count ?? undefined,
    tall: false,
    tags: [],
    location: row.place_name ?? '',
    food: row.food_rating ?? 0,
    vibe: row.vibe_rating ?? 0,
    cost: row.cost_rating ?? 0,
    tasteVerdict: row.taste_verdict ?? undefined,
    valueVerdict: row.value_verdict ?? undefined,
    occasionTags: row.occasion_tags ?? [],
    cuisine_type: row.cuisine_type ?? undefined,
    mustOrder: row.must_order ?? undefined,
    dishTags: row.dish_tags ?? undefined,
    dishId: row.dish_id ?? undefined,
    placeId: row.place_id ?? undefined,
    googlePlaceId: row.place_google_id ?? undefined,
    lat: row.place_lat ?? undefined,
    lng: row.place_lng ?? undefined,
    address: row.place_address ?? undefined,
  }
}
