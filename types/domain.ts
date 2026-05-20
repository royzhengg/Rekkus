export type DishTag = {
  photoIndex: number
  x: number
  y: number
  name: string
  mediaLocalId?: string
  mediaId?: string
}
export type PostMediaType = 'image' | 'video'
export type PostMediaProcessingStatus =
  | 'local_ready'
  | 'queued'
  | 'preparing'
  | 'ready'
  | 'failed'
  | 'uploading'
  | 'uploaded'
  | 'processing'

export type PostMediaAsset = {
  id?: string
  localId: string
  uri: string
  type: PostMediaType
  mimeType?: string | null
  originalUrl?: string | null
  processedUrl?: string | null
  thumbnailUrl?: string | null
  durationMs?: number | null
  width?: number | null
  height?: number | null
  sizeBytes?: number | null
  processingStatus?: PostMediaProcessingStatus
  processingError?: string | null
  isCover?: boolean
  storagePath?: string | null
}
export type PostMedia = PostMediaAsset

export type RekkusTasteVerdict =
  | 'not_for_me'
  | 'good'
  | 'craveable'
  | 'must_order'
  | 'worth_a_trip'
export type RekkusValueVerdict =
  | 'not_worth_it'
  | 'fair'
  | 'great_value'
  | 'worth_the_splurge'
export type RekkusOccasionTag =
  | 'quick_bite'
  | 'solo'
  | 'casual'
  | 'date_night'
  | 'group'
  | 'special'

export type CuisineOption = {
  label: string
  value: string
  aliases?: string[]
}

export interface Post {
  id: number
  dbId: string
  userId?: string
  title: string
  body: string
  creator: string
  initials: string
  avatarBg: string
  avatarColor: string
  likes: string
  imgKey: string
  imageUrl?: string
  videoUrl?: string
  mediaType?: PostMediaType
  media?: PostMediaAsset[]
  createdAt?: string
  lastEditedAt?: string
  editCount?: number
  tall: boolean
  tags: string[]
  location: string
  food: number
  vibe: number
  cost: number
  tasteVerdict?: RekkusTasteVerdict
  valueVerdict?: RekkusValueVerdict
  occasionTags?: RekkusOccasionTag[]
  cuisine_type?: string
  best_dish?: string
  restaurantId?: string
  placeId?: string
  lat?: number
  lng?: number
  address?: string
  dishTags?: DishTag[]
}

export interface Restaurant {
  name: string
  suburb: string
  lat?: number
  lng?: number
  placeId?: string
  address?: string
}

export interface MockUser {
  displayName: string
  initials: string
  avatarBg: string
  avatarColor: string
  bio: string
  suburb: string
  city: string
  followers: string
  following: number
}
