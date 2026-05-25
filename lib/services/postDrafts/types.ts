import type { SelectedPlace } from '@/lib/services/restaurants'
import type {
  DishTag,
  PostMedia,
  PostMediaProcessingStatus,
  RekkusOccasionTag,
  RekkusTasteVerdict,
  RekkusValueVerdict,
} from '@/types/domain'

export type CreatePostDraftStatus = 'autosave' | 'saved' | 'discarded' | 'published'
export type CreatePostDraftSyncStatus = 'local' | 'syncing' | 'synced' | 'failed'

export type CreatePostDraftMedia = {
  id?: string | undefined
  localId: string
  uri: string
  type: 'image' | 'video'
  storagePath?: string | null | undefined
  thumbnailUrl?: string | null | undefined
  mimeType?: string | null | undefined
  sizeBytes?: number | null | undefined
  durationMs?: number | null | undefined
  width?: number | null | undefined
  height?: number | null | undefined
  processingStatus?: PostMediaProcessingStatus | undefined
  processingError?: string | null | undefined
  orderIndex?: number | undefined
  isCover?: boolean | undefined
}

export type CreatePostDraft = {
  id?: string | undefined
  remoteId?: string | undefined
  userId?: string | undefined
  status?: CreatePostDraftStatus | undefined
  syncStatus?: CreatePostDraftSyncStatus | undefined
  media: PostMedia[]
  title: string
  selectedPlace: SelectedPlace | null
  dishTags: DishTag[]
  foodRating: number
  vibeRating: number
  costRating: number
  tasteVerdict?: RekkusTasteVerdict | undefined
  valueVerdict?: RekkusValueVerdict | undefined
  occasionTags?: RekkusOccasionTag[] | undefined
  body: string
  bestDish: string
  cuisineType: string
  hashtags: string[]
  hashtagInput: string
  createdAt?: string | undefined
  updatedAt: string
  lastSavedAt?: string | null | undefined
}

export type CreatePostDraftSummary = {
  id: string
  title: string
  restaurantName?: string | undefined
  coverUri?: string | undefined
  mediaCount: number
  updatedAt: string
  lastSavedAt?: string | null | undefined
  syncStatus?: CreatePostDraftSyncStatus | undefined
}

export type SaveOptions = {
  visible: boolean
  userId?: string | null | undefined
}
