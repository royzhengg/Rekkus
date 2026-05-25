import { useCallback, useEffect, useMemo, useState } from 'react'
import { routes } from '@/lib/routes'
import { reportComment as reportCommentService } from '@/lib/services/comments'
import { fetchPlaceTextSearchJson } from '@/lib/services/googlePlaces'
import { isGoogleTextSearchPlace } from '@/lib/services/googlePlacesGuards'
import { blockUser, submitContentReport } from '@/lib/services/moderation'
import { fetchPostById, mapRowToPost } from '@/lib/services/posts'
import { fetchUserIdByUsername } from '@/lib/services/users'
import type { Post } from '@/types/domain'
import type { useRouter } from 'expo-router'

type OperationError = { title: string; message: string }
type NoticeSheet = { title: string; subtitle?: string }

interface SafetyActionsOptions {
  user: { id: string } | null
  requireAuth: (fn?: () => void) => void
  resolvedPost: Post | null
  router: ReturnType<typeof useRouter>
  setDeleteConfirmVisible: (v: boolean) => void
  setOperationError: (v: OperationError | null) => void
  setNoticeSheet: (v: NoticeSheet | null) => void
}

export function usePostSafetyActions({
  user,
  requireAuth,
  resolvedPost,
  router,
  setDeleteConfirmVisible,
  setOperationError,
  setNoticeSheet,
}: SafetyActionsOptions) {
  const handleSafetyAction = useCallback(async (value: string) => {
    if (!user || !resolvedPost) {
      requireAuth()
      return
    }
    if (value === 'edit_post' && resolvedPost.dbId) {
      router.push(routes.createPost({ intent: 'edit', postId: resolvedPost.dbId, nonce: String(Date.now()) }))
      return
    }
    if (value === 'delete_post') {
      setDeleteConfirmVisible(true)
      return
    }
    if (value === 'report_post') {
      if (!resolvedPost.dbId) {
        setOperationError({ title: 'Not available', message: 'Demo posts cannot be reported.' })
        return
      }
      const err = await submitContentReport({
        reporterId: user.id,
        targetType: 'post',
        targetId: resolvedPost.dbId,
        reason: 'inappropriate_or_spam',
        sourceSurface: 'post_detail',
      })
      if (err) setOperationError({ title: 'Report failed', message: err })
      else setNoticeSheet({ title: 'Report received', subtitle: 'Thanks. We will review this post.' })
      return
    }
    const creatorId = await fetchUserIdByUsername(resolvedPost.creator)
    if (!creatorId) {
      setOperationError({ title: 'Not available', message: 'We could not find this user right now.' })
      return
    }
    if (value === 'report_user') {
      const err = await submitContentReport({
        reporterId: user.id,
        targetType: 'user',
        targetId: creatorId,
        reason: 'profile_or_behavior_issue',
        sourceSurface: 'post_detail',
      })
      if (err) setOperationError({ title: 'Report failed', message: err })
      else setNoticeSheet({ title: 'Report received', subtitle: 'Thanks. We will review this profile.' })
      return
    }
    if (value === 'block_user') {
      const err = await blockUser(user.id, creatorId)
      if (err) setOperationError({ title: 'Block failed', message: err })
      else setNoticeSheet({ title: 'User blocked', subtitle: 'You will have a record of this block for moderation review.' })
    }
  }, [user, requireAuth, resolvedPost, router, setDeleteConfirmVisible, setOperationError, setNoticeSheet])

  const reportComment = useCallback(async (commentId: string) => {
    if (!user) {
      requireAuth()
      return
    }
    const err = await reportCommentService(commentId, user.id)
    if (err) setOperationError({ title: 'Report failed', message: err })
    else setNoticeSheet({ title: 'Report received', subtitle: 'Thanks. We will review this comment.' })
  }, [user, requireAuth, setOperationError, setNoticeSheet])

  return { handleSafetyAction, reportComment }
}

export type ResolvedPlace = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
}

export async function geocodeLocation(query: string): Promise<ResolvedPlace | null> {
  try {
    const json = await fetchPlaceTextSearchJson(query, isGoogleTextSearchPlace)
    const place = json?.results?.[0]
    if (!place) return null
    return {
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    }
  } catch {
    return null
  }
}

export function useResolvedPost(posts: Post[], resolvedPostId: string) {
  const isUuid = resolvedPostId.includes('-')
  const contextPost = isUuid
    ? posts.find(post => post.dbId === resolvedPostId)
    : posts.find(post => post.id === Number(resolvedPostId))
  const [resolvedPost, setResolvedPost] = useState<Post | null>(contextPost ?? null)
  const [fetchingPost, setFetchingPost] = useState(false)

  useEffect(() => {
    if (contextPost) {
      setResolvedPost(contextPost)
      return
    }
    if (!isUuid || !resolvedPostId) return
    let cancelled = false
    setFetchingPost(true)
    void fetchPostById(resolvedPostId).then(row => {
      if (!cancelled) {
        if (row) setResolvedPost(mapRowToPost(row, 0))
        setFetchingPost(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [contextPost, isUuid, resolvedPostId])

  return { resolvedPost, fetchingPost }
}

export function usePostNavigation(posts: Post[], resolvedPostId: string) {
  return useMemo(() => {
    const idx = posts.findIndex(p => (p.dbId ?? p.id) === resolvedPostId)
    return {
      prevPost: idx > 0 ? posts[idx - 1] : null,
      nextPost: idx >= 0 && idx < posts.length - 1 ? posts[idx + 1] : null,
    }
  }, [posts, resolvedPostId])
}
