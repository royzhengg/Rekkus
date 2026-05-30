export type Dish = {
  id: string
  name: string
  restaurantId?: string | undefined
  cuisineType?: string | undefined
}

export type DishDetail = Dish & {
  restaurant?: {
    id: string
    name: string
    address?: string | undefined
    placeId?: string | undefined
    lat?: number | undefined
    lng?: number | undefined
  } | undefined
}

export type SavedDish = DishDetail & {
  savedAt: string
  representativeImageUrl?: string | undefined
}

export type SavedLibrarySection = 'overview' | 'dishes' | 'places' | 'posts' | 'collections'
export type CollectionTargetType = 'dish' | 'restaurant' | 'post'

export type DishTag = {
  photoIndex: number
  x: number
  y: number
  name: string
  mediaLocalId?: string | undefined
  mediaId?: string | undefined
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
  id?: string | undefined
  localId: string
  uri: string
  type: PostMediaType
  mimeType?: string | null | undefined
  originalUrl?: string | null | undefined
  processedUrl?: string | null | undefined
  thumbnailUrl?: string | null | undefined
  durationMs?: number | null | undefined
  width?: number | null | undefined
  height?: number | null | undefined
  sizeBytes?: number | null | undefined
  processingStatus?: PostMediaProcessingStatus | undefined
  processingError?: string | null | undefined
  isCover?: boolean | undefined
  storagePath?: string | null | undefined
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
  aliases?: string[] | undefined
}

export interface Post {
  id: number
  dbId: string
  userId?: string | undefined
  title: string
  body: string
  creator: string
  initials: string
  avatarBg: string
  avatarColor: string
  likes: string
  imgKey: string
  imageUrl?: string | undefined
  videoUrl?: string | undefined
  mediaType?: PostMediaType | undefined
  media?: PostMediaAsset[] | undefined
  createdAt?: string | undefined
  lastEditedAt?: string | undefined
  editCount?: number | undefined
  tall: boolean
  tags: string[]
  location: string
  food: number
  vibe: number
  cost: number
  tasteVerdict?: RekkusTasteVerdict | undefined
  valueVerdict?: RekkusValueVerdict | undefined
  occasionTags?: RekkusOccasionTag[] | undefined
  cuisine_type?: string | undefined
  mustOrder?: string | undefined
  restaurantId?: string | undefined
  placeId?: string | undefined
  lat?: number | undefined
  lng?: number | undefined
  address?: string | undefined
  dishTags?: DishTag[] | undefined
  dishId?: string | undefined
}

export interface Restaurant {
  name: string
  suburb: string
  lat?: number | undefined
  lng?: number | undefined
  placeId?: string | undefined
  address?: string | undefined
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
