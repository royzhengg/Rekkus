import { useCallback, useState } from 'react'
import type { CreatePostDraft, CreatePostDraftStatus } from '@/lib/services/postDrafts'
import type { SelectedPlace } from '@/lib/services/restaurants'
import type { DishTag, Post, PostMedia, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'

export function useCreatePostFormState(userId: string | undefined, initialDraftId: string | undefined) {
  const [media, setMedia] = useState<PostMedia[]>([])
  const [title, setTitle] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [dishTags, setDishTags] = useState<DishTag[]>([])
  const [foodRating, setFoodRating] = useState(0)
  const [vibeRating, setVibeRating] = useState(0)
  const [costRating, setCostRating] = useState(0)
  const [tasteVerdict, setTasteVerdict] = useState<RekkusTasteVerdict | undefined>(undefined)
  const [valueVerdict, setValueVerdict] = useState<RekkusValueVerdict | undefined>(undefined)
  const [occasionTags, setOccasionTags] = useState<RekkusOccasionTag[]>([])
  const [body, setBody] = useState('')
  const [mustOrder, setMustOrder] = useState('')
  const [cuisineType, setCuisineType] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState('')
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(initialDraftId)
  const [currentDraftStatus, setCurrentDraftStatus] = useState<CreatePostDraftStatus | undefined>(undefined)

  const hasDraftContent =
    media.length > 0 ||
    title.trim().length > 0 ||
    selectedPlace !== null ||
    dishTags.length > 0 ||
    foodRating > 0 ||
    vibeRating > 0 ||
    costRating > 0 ||
    !!tasteVerdict ||
    !!valueVerdict ||
    occasionTags.length > 0 ||
    body.trim().length > 0 ||
    mustOrder.trim().length > 0 ||
    cuisineType.trim().length > 0 ||
    hashtags.length > 0 ||
    hashtagInput.trim().length > 0

  const canAdvance = title.trim().length >= 3 && media.length > 0

  const applyDraftToForm = useCallback((draft: CreatePostDraft) => {
    setCurrentDraftId(draft.remoteId ?? draft.id)
    setCurrentDraftStatus(draft.status)
    setMedia(draft.media ?? [])
    setTitle(draft.title ?? '')
    setSelectedPlace(draft.selectedPlace ?? null)
    setDishTags(draft.dishTags ?? [])
    setFoodRating(draft.foodRating ?? 0)
    setVibeRating(draft.vibeRating ?? 0)
    setCostRating(draft.costRating ?? 0)
    setTasteVerdict(draft.tasteVerdict)
    setValueVerdict(draft.valueVerdict)
    setOccasionTags(draft.occasionTags ?? [])
    setBody(draft.body ?? '')
    setMustOrder(draft.mustOrder ?? '')
    setCuisineType(draft.cuisineType ?? '')
    setHashtags(draft.hashtags ?? [])
    setHashtagInput(draft.hashtagInput ?? '')
  }, [])

  const applyPostToForm = useCallback((post: Post) => {
    setMedia(post.media ?? [])
    setTitle(post.title ?? '')
    setSelectedPlace(post.restaurantId ? {
      placeId: post.placeId ?? post.restaurantId,
      restaurantId: post.restaurantId,
      name: post.location,
      address: post.address ?? '',
      lat: post.lat ?? 0,
      lng: post.lng ?? 0,
    } : null)
    setDishTags(post.dishTags ?? [])
    setFoodRating(post.food ?? 0)
    setVibeRating(post.vibe ?? 0)
    setCostRating(post.cost ?? 0)
    setTasteVerdict(post.tasteVerdict)
    setValueVerdict(post.valueVerdict)
    setOccasionTags(post.occasionTags ?? [])
    setBody(post.body ?? '')
    setMustOrder(post.mustOrder ?? '')
    setCuisineType(post.cuisine_type ?? '')
    setHashtags(post.tags ?? [])
    setHashtagInput('')
    setCurrentDraftId(undefined)
    setCurrentDraftStatus(undefined)
  }, [])

  const buildDraft = useCallback((): CreatePostDraft => ({
    media,
    id: currentDraftId,
    remoteId: currentDraftId,
    userId,
    status: currentDraftStatus,
    title,
    selectedPlace,
    dishTags,
    foodRating,
    vibeRating,
    costRating,
    tasteVerdict,
    valueVerdict,
    occasionTags,
    body,
    mustOrder,
    cuisineType,
    hashtags,
    hashtagInput,
    updatedAt: new Date().toISOString(),
  }), [media, currentDraftId, userId, currentDraftStatus, title, selectedPlace, dishTags, foodRating, vibeRating, costRating, tasteVerdict, valueVerdict, occasionTags, body, mustOrder, cuisineType, hashtags, hashtagInput])

  const clearFormFields = useCallback(() => {
    setMedia([])
    setTitle('')
    setSelectedPlace(null)
    setDishTags([])
    setFoodRating(0)
    setVibeRating(0)
    setCostRating(0)
    setTasteVerdict(undefined)
    setValueVerdict(undefined)
    setOccasionTags([])
    setBody('')
    setMustOrder('')
    setCuisineType('')
    setHashtags([])
    setHashtagInput('')
    setCurrentDraftId(undefined)
    setCurrentDraftStatus(undefined)
  }, [])

  return {
    media, setMedia,
    title, setTitle,
    selectedPlace, setSelectedPlace,
    dishTags, setDishTags,
    foodRating, setFoodRating,
    vibeRating, setVibeRating,
    costRating, setCostRating,
    tasteVerdict, setTasteVerdict,
    valueVerdict, setValueVerdict,
    occasionTags, setOccasionTags,
    body, setBody,
    mustOrder, setMustOrder,
    cuisineType, setCuisineType,
    hashtags, setHashtags,
    hashtagInput, setHashtagInput,
    currentDraftId, setCurrentDraftId,
    currentDraftStatus, setCurrentDraftStatus,
    hasDraftContent,
    canAdvance,
    applyDraftToForm,
    applyPostToForm,
    buildDraft,
    clearFormFields,
  }
}
