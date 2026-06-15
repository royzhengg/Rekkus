import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { geocodeLocation } from '@/features/posts/postDetailUtils'
import { analytics } from '@/lib/analytics'
import type { SearchAttribution } from '@/lib/analytics'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { haptic } from '@/lib/haptics'
import { fetchTargetCollectionItems } from '@/lib/services/collections'
import { addPostComment } from '@/lib/services/comments'
import { upsertResolvedPlace } from '@/lib/services/places'
import {
  addPostReaction,
  fetchPostSocialState,
  removePostReaction,
  type PostCommentRow,
  type PostReactionType,
} from '@/lib/services/posts'
import { fetchIsFollowing, fetchUserIdByUsername } from '@/lib/services/users'
import { navigateToPlaceFromPost } from '@/lib/utils/placeNavigation'
import type { Post } from '@/types/domain'

export type PostDetailOperationError = { title: string; message: string }

export interface UsePostDetailResult {
  // social state
  liked: boolean
  saved: boolean
  locationSaved: boolean
  locationLoading: boolean
  following: boolean
  likeCount: number
  comments: PostCommentRow[]
  reactionCounts: Record<string, number>
  myReactions: PostReactionType[]
  // comment form
  comment: string
  submitting: boolean
  replyTo: { commentId: string; username: string } | null
  // ui sheets
  saveSheet: boolean
  safetySheet: boolean
  shareSheet: boolean
  noticeSheet: { title: string; subtitle?: string } | null
  operationError: PostDetailOperationError | null
  deleteConfirmVisible: boolean
  collectionPickerVisible: boolean
  confirmCollectionUnsave: boolean
  // derived
  creatorUserId: string | null
  refreshing: boolean
  // actions
  loadSocialState: () => Promise<void>
  toggleLike: () => Promise<void>
  toggleSave: () => Promise<void>
  toggleLocationSave: () => Promise<void>
  toggleFollowCreator: () => Promise<void>
  toggleReaction: (type: PostReactionType) => Promise<void>
  submitComment: () => Promise<void>
  handleLocationTap: () => Promise<void>
  // setters
  setComment: (text: string) => void
  setSaved: (v: boolean) => void
  setReplyTo: (r: { commentId: string; username: string } | null) => void
  setSaveSheet: (v: boolean) => void
  setSafetySheet: (v: boolean) => void
  setShareSheet: (v: boolean) => void
  setNoticeSheet: (v: { title: string; subtitle?: string } | null) => void
  setOperationError: (e: PostDetailOperationError | null) => void
  setDeleteConfirmVisible: (v: boolean) => void
  setCollectionPickerVisible: (v: boolean) => void
  setConfirmCollectionUnsave: (v: boolean) => void
  setRefreshing: (v: boolean) => void
}

export function usePostDetail(
  resolvedPost: Post | null,
  userId: string | undefined,
  opts: { searchAttribution?: SearchAttribution | null } = {}
): UsePostDetailResult {
  const router = useRouter()
  const { requireOnline, runDeferredMutation } = useConnectivity()
  const { showToast } = useToast()
  const { searchAttribution } = opts

  const dwellStartedAt = useRef(Date.now())
  const trackedPostView = useRef<string | null>(null)

  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveSheet, setSaveSheet] = useState(false)
  const [locationSaved, setLocationSaved] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [following, setFollowing] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [comments, setComments] = useState<PostCommentRow[]>([])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<{ commentId: string; username: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [myReactions, setMyReactions] = useState<PostReactionType[]>([])
  const [safetySheet, setSafetySheet] = useState(false)
  const [shareSheet, setShareSheet] = useState(false)
  const [noticeSheet, setNoticeSheet] = useState<{ title: string; subtitle?: string } | null>(null)
  const [operationError, setOperationError] = useState<PostDetailOperationError | null>(null)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [collectionPickerVisible, setCollectionPickerVisible] = useState(false)
  const [confirmCollectionUnsave, setConfirmCollectionUnsave] = useState(false)
  const [creatorUserId, setCreatorUserId] = useState<string | null>(null)

  const loadSocialState = useCallback(async () => {
    if (!resolvedPost?.dbId) return
    const dbId = resolvedPost.dbId
    const socialState = await fetchPostSocialState(dbId, userId, resolvedPost.placeId)
    setLikeCount(socialState.likeCount)
    setComments(socialState.comments)
    setReactionCounts(socialState.reactionCounts)
    setMyReactions(socialState.myReactions)
    setLiked(socialState.liked)
    setSaved(socialState.saved)
    setLocationSaved(socialState.locationSaved)
  }, [resolvedPost?.dbId, resolvedPost?.placeId, userId])

  useEffect(() => {
    void loadSocialState()
  }, [loadSocialState])

  useEffect(() => {
    if (!resolvedPost?.creator) return
    let cancelled = false
    void fetchUserIdByUsername(resolvedPost.creator).then(async id => {
      if (cancelled) return
      setCreatorUserId(id)
      if (!id || !userId || id === userId) {
        setFollowing(false)
        return
      }
      setFollowing(await fetchIsFollowing(userId, id))
    })
    return () => { cancelled = true }
  }, [resolvedPost?.creator, userId])

  useEffect(() => {
    if (!resolvedPost?.dbId) return
    if (trackedPostView.current !== resolvedPost.dbId) {
      trackedPostView.current = resolvedPost.dbId
      dwellStartedAt.current = Date.now()
      analytics.viewPost(userId ?? null, resolvedPost.dbId, resolvedPost.cuisine_type, searchAttribution ?? null)
    }
    return () => {
      const duration = Date.now() - dwellStartedAt.current
      if (duration >= 3000) analytics.dwellPost(userId ?? null, resolvedPost.dbId, duration)
    }
  }, [resolvedPost?.cuisine_type, resolvedPost?.dbId, searchAttribution, userId])

  const toggleLike = useCallback(async () => {
    if (!resolvedPost?.dbId || !userId) return
    const wasLiked = liked
    setOperationError(null)
    setLiked(!wasLiked)
    setLikeCount(c => (wasLiked ? c - 1 : c + 1))
    try {
      await runDeferredMutation({ kind: 'post_like', postId: resolvedPost.dbId, targetState: !wasLiked })
      void haptic.confirmLike()
    } catch {
      setLiked(wasLiked)
      setLikeCount(c => (wasLiked ? c + 1 : c - 1))
      analytics.actionError(userId, 'post_like', 'write_failed')
      setOperationError({ title: 'Could not update like', message: 'Check your connection and try again.' })
    }
  }, [liked, resolvedPost?.dbId, runDeferredMutation, userId])

  const toggleSave = useCallback(async () => {
    if (!resolvedPost?.dbId || !userId) return
    const wasSaved = saved
    setOperationError(null)
    try {
      if (wasSaved) {
        const memberships = await fetchTargetCollectionItems(userId, 'post', resolvedPost.dbId)
        if (memberships.length > 0) {
          setConfirmCollectionUnsave(true)
          return
        }
        await runDeferredMutation({ kind: 'post_save', postId: resolvedPost.dbId, targetState: false })
        setSaved(false)
      } else {
        setSaved(true)
        await runDeferredMutation({
          kind: 'post_save',
          postId: resolvedPost.dbId,
          targetState: true,
          cuisineType: resolvedPost.cuisine_type ?? null,
          searchAttribution: searchAttribution ?? null,
        })
        void haptic.confirmSave()
        showToast('Post saved')
        setSaveSheet(true)
      }
    } catch {
      setSaved(wasSaved)
      analytics.actionError(userId, 'post_save', 'write_failed')
      setOperationError({ title: 'Could not update saved post', message: 'Check your connection and try again.' })
    }
  }, [resolvedPost?.dbId, resolvedPost?.cuisine_type, runDeferredMutation, saved, searchAttribution, showToast, userId])

  const resolveAndSaveLocation = useCallback(async (placeId?: string): Promise<string | null> => {
    if (placeId) return placeId
    if (!resolvedPost?.location) return null
    if (!requireOnline()) return null
    const resolved = await geocodeLocation(resolvedPost.location)
    if (!resolved) return null
    return upsertResolvedPlace(resolved)
  }, [requireOnline, resolvedPost?.location])

  const toggleLocationSave = useCallback(async () => {
    if (!userId) return
    const wasLocationSaved = locationSaved
    setOperationError(null)
    setLocationSaved(!wasLocationSaved)
    const placeId = await resolveAndSaveLocation(resolvedPost?.placeId)
    if (!placeId) {
      setLocationSaved(wasLocationSaved)
      setOperationError({ title: 'Could not save location', message: 'We could not find this place reliably right now.' })
      return
    }
    if (wasLocationSaved) {
      try {
        await runDeferredMutation({ kind: 'place_save', placeId, targetState: false })
      } catch {
        setLocationSaved(wasLocationSaved)
        setOperationError({ title: 'Could not update saved location', message: 'Check your connection and try again.' })
      }
    } else {
      try {
        await runDeferredMutation({ kind: 'place_save', placeId, targetState: true })
        void haptic.confirmSave()
      } catch {
        setLocationSaved(wasLocationSaved)
        setOperationError({ title: 'Could not save location', message: 'Check your connection and try again.' })
        return
      }
      analytics.savePlace(userId, placeId, resolvedPost?.cuisine_type, searchAttribution ?? null)
    }
  }, [locationSaved, resolveAndSaveLocation, resolvedPost?.cuisine_type, resolvedPost?.placeId, runDeferredMutation, searchAttribution, userId])

  const toggleFollowCreator = useCallback(async () => {
    if (!userId || !creatorUserId || creatorUserId === userId) return
    const wasFollowing = following
    setOperationError(null)
    setFollowing(!wasFollowing)
    try {
      await runDeferredMutation({ kind: 'follow', targetUserId: creatorUserId, targetState: !wasFollowing })
      if (!wasFollowing) {
        showToast('Following')
        analytics.follow(userId, creatorUserId)
      }
    } catch {
      setFollowing(wasFollowing)
      setOperationError({ title: 'Could not update follow', message: 'Check your connection and try again.' })
    }
  }, [creatorUserId, following, runDeferredMutation, showToast, userId])

  const toggleReaction = useCallback(async (type: PostReactionType) => {
    if (!resolvedPost?.dbId || !userId) return
    const isOn = myReactions.includes(type)
    const previousReactions = myReactions
    const previousCounts = reactionCounts
    setOperationError(null)
    setMyReactions(prev => isOn ? prev.filter(r => r !== type) : [...prev, type])
    setReactionCounts(prev => ({ ...prev, [type]: Math.max(0, (prev[type] ?? 0) + (isOn ? -1 : 1)) }))
    try {
      if (!requireOnline()) throw new Error('offline')
      if (isOn) await removePostReaction(resolvedPost.dbId, userId, type)
      else await addPostReaction(resolvedPost.dbId, userId, type)
    } catch {
      setMyReactions(previousReactions)
      setReactionCounts(previousCounts)
      analytics.actionError(userId, 'post_reaction', 'write_failed')
      setOperationError({ title: 'Could not update reaction', message: 'Check your connection and try again.' })
    }
  }, [myReactions, reactionCounts, requireOnline, resolvedPost?.dbId, userId])

  const submitComment = useCallback(async () => {
    if (!comment.trim() || !resolvedPost?.dbId || !userId || submitting) return
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to post your comment. Your text is still here.' })
      return
    }
    setSubmitting(true)
    setOperationError(null)
    const text = comment.trim()
    const parentId = replyTo?.commentId ?? null
    setComment('')
    setReplyTo(null)
    try {
      await addPostComment(resolvedPost.dbId, userId, text, parentId)
      await loadSocialState()
    } catch {
      analytics.actionError(userId, parentId ? 'comment_reply' : 'comment_add', 'write_failed')
      setComment(text)
      setReplyTo(replyTo)
      setOperationError({ title: 'Could not post comment', message: 'Check your connection and try again.' })
    }
    setSubmitting(false)
  }, [comment, loadSocialState, replyTo, requireOnline, resolvedPost?.dbId, submitting, userId])

  const handleLocationTap = useCallback(async () => {
    if (!resolvedPost) return
    if (resolvedPost.lat && resolvedPost.lng) {
      if (resolvedPost.placeId) {
        analytics.revisitPlace(userId ?? null, resolvedPost.placeId, 'post_location_tap')
      }
      navigateToPlaceFromPost(router, {
        placeId: resolvedPost.placeId,
        googlePlaceId: resolvedPost.googlePlaceId,
        name: resolvedPost.location,
        address: resolvedPost.address ?? resolvedPost.location,
        lat: resolvedPost.lat,
        lng: resolvedPost.lng,
      })
      return
    }
    setLocationLoading(true)
    const resolved = await geocodeLocation(resolvedPost.location)
    setLocationLoading(false)
    if (!resolved) {
      setOperationError({ title: 'Could not open location', message: 'We could not find this place reliably right now.' })
      return
    }
    analytics.revisitPlace(userId ?? null, resolvedPost.placeId ?? resolved.placeId ?? '', 'post_location_tap')
    navigateToPlaceFromPost(router, {
      placeId: resolved.placeId,
      name: resolved.name,
      address: resolved.address,
      lat: resolved.lat,
      lng: resolved.lng,
    })
  }, [resolvedPost, router, userId])

  return {
    liked, saved, locationSaved, locationLoading, following,
    likeCount, comments, reactionCounts, myReactions,
    comment, submitting, replyTo,
    saveSheet, safetySheet, shareSheet, noticeSheet, operationError,
    deleteConfirmVisible, collectionPickerVisible, confirmCollectionUnsave,
    creatorUserId, refreshing,
    loadSocialState,
    toggleLike, toggleSave, toggleLocationSave, toggleFollowCreator,
    toggleReaction, submitComment,
    handleLocationTap,
    setComment, setSaved, setReplyTo,
    setSaveSheet, setSafetySheet, setShareSheet, setNoticeSheet,
    setOperationError, setDeleteConfirmVisible, setCollectionPickerVisible,
    setConfirmCollectionUnsave, setRefreshing,
  }
}
