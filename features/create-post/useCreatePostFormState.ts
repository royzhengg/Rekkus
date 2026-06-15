import { useCallback, useState } from 'react'
import type { SelectedPlace } from '@/lib/services/places'
import type { CreatePostDraft, CreatePostDraftStatus } from '@/lib/services/postDrafts'
import type { DishTag, Post, PostMedia, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'

export function useCreatePostFormState(userId: string | undefined, initialDraftId: string | undefined) {
  const [media, setMedia] = useState<PostMedia[]>([])
  const [title, setTitle] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [dishTags, setDishTags] = useState<DishTag[]>([])
  const [tasteVerdict, setTasteVerdict] = useState<RekkusTasteVerdict | undefined>(undefined)
  const [valueVerdict, setValueVerdict] = useState<RekkusValueVerdict | undefined>(undefined)
  const [occasionTags, setOccasionTags] = useState<RekkusOccasionTag[]>([])
  const [body, setBody] = useState('')
  const [cashDiscount, setCashDiscount] = useState(false)
  const [googleReviewFreebie, setGoogleReviewFreebie] = useState(false)
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
    !!tasteVerdict ||
    !!valueVerdict ||
    occasionTags.length > 0 ||
    body.trim().length > 0 ||
    mustOrder.trim().length > 0 ||
    cuisineType.trim().length > 0 ||
    hashtags.length > 0 ||
    hashtagInput.trim().length > 0

  const canAdvance = title.trim().length >= 3 && media.length > 0
  const canAdvanceStep2 = body.trim().length > 0 && tasteVerdict != null && cuisineType.trim().length > 0

  const applyDraftToForm = useCallback((draft: CreatePostDraft) => {
    setCurrentDraftId(draft.remoteId ?? draft.id)
    setCurrentDraftStatus(draft.status)
    setMedia(draft.media ?? [])
    setTitle(draft.title ?? '')
    setSelectedPlace(draft.selectedPlace ?? null)
    setDishTags(draft.dishTags ?? [])
    setTasteVerdict(draft.tasteVerdict)
    setValueVerdict(draft.valueVerdict)
    setOccasionTags(draft.occasionTags ?? [])
    setBody(draft.body ?? '')
    setCashDiscount(draft.cashDiscount ?? false)
    setGoogleReviewFreebie(draft.googleReviewFreebie ?? false)
    setMustOrder(draft.mustOrder ?? '')
    setCuisineType(draft.cuisineType ?? '')
    setHashtags(draft.hashtags ?? [])
    setHashtagInput(draft.hashtagInput ?? '')
  }, [])

  const applyPostToForm = useCallback((post: Post) => {
    setMedia(post.media ?? [])
    setTitle(post.title ?? '')
    setSelectedPlace(post.placeId || post.googlePlaceId ? {
      googlePlaceId: post.googlePlaceId ?? post.placeId ?? '',
      placeId: post.placeId,
      name: post.location,
      address: post.address ?? '',
      lat: post.lat ?? 0,
      lng: post.lng ?? 0,
    } : null)
    setDishTags(post.dishTags ?? [])
    setTasteVerdict(post.tasteVerdict)
    setValueVerdict(post.valueVerdict)
    setOccasionTags(post.occasionTags ?? [])
    setBody(post.body ?? '')
    setCashDiscount(post.cashDiscount ?? false)
    setGoogleReviewFreebie(post.googleReviewFreebie ?? false)
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
    tasteVerdict,
    valueVerdict,
    occasionTags,
    body,
    cashDiscount,
    googleReviewFreebie,
    mustOrder,
    cuisineType,
    hashtags,
    hashtagInput,
    updatedAt: new Date().toISOString(),
  }), [media, currentDraftId, userId, currentDraftStatus, title, selectedPlace, dishTags, tasteVerdict, valueVerdict, occasionTags, body, cashDiscount, googleReviewFreebie, mustOrder, cuisineType, hashtags, hashtagInput])

  const clearFormFields = useCallback(() => {
    setMedia([])
    setTitle('')
    setSelectedPlace(null)
    setDishTags([])
    setTasteVerdict(undefined)
    setValueVerdict(undefined)
    setOccasionTags([])
    setBody('')
    setCashDiscount(false)
    setGoogleReviewFreebie(false)
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
    tasteVerdict, setTasteVerdict,
    valueVerdict, setValueVerdict,
    occasionTags, setOccasionTags,
    body, setBody,
    cashDiscount, setCashDiscount,
    googleReviewFreebie, setGoogleReviewFreebie,
    mustOrder, setMustOrder,
    cuisineType, setCuisineType,
    hashtags, setHashtags,
    hashtagInput, setHashtagInput,
    currentDraftId, setCurrentDraftId,
    currentDraftStatus, setCurrentDraftStatus,
    hasDraftContent,
    canAdvance,
    canAdvanceStep2,
    applyDraftToForm,
    applyPostToForm,
    buildDraft,
    clearFormFields,
  }
}
