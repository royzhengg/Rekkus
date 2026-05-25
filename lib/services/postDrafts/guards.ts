import type {
  DishTag,
  PostMedia,
  RekkusOccasionTag,
  RekkusTasteVerdict,
  RekkusValueVerdict,
} from '@/types/domain'
import { isRecord } from '../../utils/safeJson'
import type { CreatePostDraft, CreatePostDraftStatus, CreatePostDraftSyncStatus } from './types'

type SelectedPlaceShape = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  restaurantId?: string | undefined
}

export type RemoteDraftMediaRow = {
  id?: string
  local_id: string
  media_type: 'image' | 'video'
  storage_path: string | null
  thumbnail_url: string | null
  public_preview_url: string | null
  mime_type: string | null
  size_bytes: number | null
  duration_ms: number | null
  width: number | null
  height: number | null
  processing_status: string | null
  processing_error: string | null
  order_index: number | null
  is_cover: boolean | null
}

export type RemoteDraftRow = {
  id: string
  user_id: string
  status: CreatePostDraftStatus
  title: string | null
  body: string | null
  selected_place: SelectedPlaceShape | null
  dish_tags: DishTag[] | null
  food_rating: number | null
  vibe_rating: number | null
  cost_rating: number | null
  taste_verdict: RekkusTasteVerdict | null
  value_verdict: RekkusValueVerdict | null
  occasion_tags: RekkusOccasionTag[] | null
  best_dish: string | null
  cuisine_type: string | null
  hashtags: string[] | null
  hashtag_input: string | null
  created_at: string
  updated_at: string
  last_saved_at: string | null
  post_draft_media?: RemoteDraftMediaRow[] | null
}

export type RemoteDraftSummaryRow = {
  id: string
  title: string | null
  body: string | null
  selected_place: SelectedPlaceShape | null
  updated_at: string
  last_saved_at: string | null
  post_draft_media: Array<{ storage_path: string | null; thumbnail_url: string | null; order_index: number | null }>
}

export type RemoteDraftTitleRow = { title: string | null; body: string | null }

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

function isDraftStatus(value: unknown): value is CreatePostDraftStatus {
  return value === 'autosave' || value === 'saved' || value === 'discarded' || value === 'published'
}

function isSyncStatus(value: unknown): value is CreatePostDraftSyncStatus {
  return value === 'local' || value === 'syncing' || value === 'synced' || value === 'failed'
}

function isTaste(value: unknown): value is RekkusTasteVerdict {
  return value === 'not_for_me' || value === 'good' || value === 'craveable' || value === 'must_order' || value === 'worth_a_trip'
}

function isValue(value: unknown): value is RekkusValueVerdict {
  return value === 'not_worth_it' || value === 'fair' || value === 'great_value' || value === 'worth_the_splurge'
}

function isOccasion(value: unknown): value is RekkusOccasionTag {
  return value === 'quick_bite' || value === 'solo' || value === 'casual' || value === 'date_night' || value === 'group' || value === 'special'
}

function isDishTag(value: unknown): value is DishTag {
  return (
    isRecord(value) &&
    typeof value.photoIndex === 'number' &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.name === 'string'
  )
}

function isSelectedPlace(value: unknown): value is SelectedPlaceShape {
  return (
    isRecord(value) &&
    typeof value.placeId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.address === 'string' &&
    typeof value.lat === 'number' &&
    typeof value.lng === 'number'
  )
}

function isMedia(value: unknown): value is PostMedia {
  return (
    isRecord(value) &&
    typeof value.localId === 'string' &&
    typeof value.uri === 'string' &&
    (value.type === 'image' || value.type === 'video')
  )
}

export function isLocalDraft(value: unknown): value is CreatePostDraft {
  return (
    isRecord(value) &&
    Array.isArray(value.media) && value.media.every(isMedia) &&
    typeof value.title === 'string' &&
    (value.selectedPlace === null || isSelectedPlace(value.selectedPlace)) &&
    Array.isArray(value.dishTags) && value.dishTags.every(isDishTag) &&
    typeof value.foodRating === 'number' &&
    typeof value.vibeRating === 'number' &&
    typeof value.costRating === 'number' &&
    typeof value.body === 'string' &&
    typeof value.bestDish === 'string' &&
    typeof value.cuisineType === 'string' &&
    Array.isArray(value.hashtags) && value.hashtags.every(tag => typeof tag === 'string') &&
    typeof value.hashtagInput === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.status === undefined || isDraftStatus(value.status)) &&
    (value.syncStatus === undefined || isSyncStatus(value.syncStatus)) &&
    (value.tasteVerdict === undefined || isTaste(value.tasteVerdict)) &&
    (value.valueVerdict === undefined || isValue(value.valueVerdict)) &&
    (value.occasionTags === undefined || (Array.isArray(value.occasionTags) && value.occasionTags.every(isOccasion)))
  )
}

export function isLocalDraftList(value: unknown): value is CreatePostDraft[] {
  return Array.isArray(value) && value.every(isLocalDraft)
}

function isRemoteMedia(value: unknown): value is RemoteDraftMediaRow {
  return (
    isRecord(value) &&
    typeof value.local_id === 'string' &&
    (value.media_type === 'image' || value.media_type === 'video') &&
    nullableString(value.storage_path) &&
    nullableString(value.thumbnail_url) &&
    nullableString(value.public_preview_url) &&
    nullableString(value.mime_type) &&
    nullableNumber(value.size_bytes) &&
    nullableNumber(value.duration_ms) &&
    nullableNumber(value.width) &&
    nullableNumber(value.height) &&
    nullableString(value.processing_status) &&
    nullableString(value.processing_error) &&
    nullableNumber(value.order_index) &&
    (value.is_cover === null || typeof value.is_cover === 'boolean')
  )
}

export function isRemoteDraftRow(value: unknown): value is RemoteDraftRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    isDraftStatus(value.status) &&
    nullableString(value.title) &&
    nullableString(value.body) &&
    (value.selected_place === null || isSelectedPlace(value.selected_place)) &&
    (value.dish_tags === null || (Array.isArray(value.dish_tags) && value.dish_tags.every(isDishTag))) &&
    nullableNumber(value.food_rating) &&
    nullableNumber(value.vibe_rating) &&
    nullableNumber(value.cost_rating) &&
    (value.taste_verdict === null || isTaste(value.taste_verdict)) &&
    (value.value_verdict === null || isValue(value.value_verdict)) &&
    (value.occasion_tags === null || (Array.isArray(value.occasion_tags) && value.occasion_tags.every(isOccasion))) &&
    nullableString(value.best_dish) &&
    nullableString(value.cuisine_type) &&
    (value.hashtags === null || (Array.isArray(value.hashtags) && value.hashtags.every(tag => typeof tag === 'string'))) &&
    nullableString(value.hashtag_input) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    nullableString(value.last_saved_at) &&
    (value.post_draft_media === undefined || value.post_draft_media === null || (
      Array.isArray(value.post_draft_media) && value.post_draft_media.every(isRemoteMedia)
    ))
  )
}

export function isRemoteDraftSummaryRow(value: unknown): value is RemoteDraftSummaryRow {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !nullableString(value.title) ||
    !nullableString(value.body) ||
    (value.selected_place !== null && !isSelectedPlace(value.selected_place)) ||
    typeof value.updated_at !== 'string' ||
    !nullableString(value.last_saved_at) ||
    !Array.isArray(value.post_draft_media)
  ) return false
  return value.post_draft_media.every(media =>
    isRecord(media) &&
    nullableString(media.storage_path) &&
    nullableString(media.thumbnail_url) &&
    nullableNumber(media.order_index)
  )
}

export function isRemoteDraftTitleRow(value: unknown): value is RemoteDraftTitleRow {
  return isRecord(value) && nullableString(value.title) && nullableString(value.body)
}
