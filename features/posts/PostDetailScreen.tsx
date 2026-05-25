import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ChevronLeft,
  ChevronRight,
  DotsIcon,
} from '@/components/icons'
import { PostMediaCarousel } from '@/components/post/PostMediaCarousel'
import { PostPicksSummary } from '@/components/post/PostPicksSummary'
import { SavedTargetCollectionSheets } from '@/components/SavedTargetCollectionSheets'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { IconButton } from '@/components/ui/IconButton'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useCollectionPicker } from '@/lib/hooks/useCollectionPicker'
import { routes } from '@/lib/routes'
import { fetchTargetCollectionItems, unsaveTarget } from '@/lib/services/collections'
import { addPostComment } from '@/lib/services/comments'
import {
  addPostReaction,
  deletePost,
  fetchPostSocialState,
  removePostReaction,
  togglePostLike,
  togglePostSave,
  type PostCommentRow,
  type PostReactionType,
} from '@/lib/services/posts'
import { saveLocation, unsaveLocation, upsertResolvedRestaurant } from '@/lib/services/restaurants'
import { fetchIsFollowing, fetchUserIdByUsername, followUser, unfollowUser } from '@/lib/services/users'
import { navigateToRestaurantFromPost } from '@/lib/utils/restaurantNavigation'
import { PostActionsBar } from './PostActionsBar'
import { PostComments } from './PostComments'
import { PostDetailSheets } from './PostDetailSheets'
import { geocodeLocation, usePostNavigation, usePostSafetyActions, useResolvedPost } from './postDetailUtils'
import { PostReactionBar } from './PostReactionBar'
import { PostRestaurantCard } from './PostRestaurantCard'
import type { TextInput } from 'react-native'

export default function PostDetailScreen() {
  const { postId, id } = useLocalSearchParams<{ postId?: string; id?: string }>()
  const resolvedPostId = postId ?? id ?? ''
  const router = useRouter()
  const { posts } = usePosts()
  const { requireAuth } = useAuthGate()
  const { user } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const { resolvedPost, fetchingPost } = useResolvedPost(posts, resolvedPostId)

  const { prevPost, nextPost } = usePostNavigation(posts, resolvedPostId)

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
  const [operationError, setOperationError] = useState<{ title: string; message: string } | null>(null)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [collectionPickerVisible, setCollectionPickerVisible] = useState(false)
  const [confirmCollectionUnsave, setConfirmCollectionUnsave] = useState(false)
  const [creatorUserId, setCreatorUserId] = useState<string | null>(null)
  const isOwner = !!user?.id && !!resolvedPost?.userId && user.id === resolvedPost.userId
  const collectionPicker = useCollectionPicker(user?.id, 'post', resolvedPost?.dbId)

  const { handleSafetyAction, reportComment } = usePostSafetyActions({
    user,
    requireAuth,
    resolvedPost,
    router,
    setDeleteConfirmVisible,
    setOperationError,
    setNoticeSheet,
  })

  const commentInputRef = useRef<TextInput>(null)
  const scrollRef = useRef<ScrollView>(null)
  const dwellStartedAt = useRef(Date.now())
  const trackedPostView = useRef<string | null>(null)

  const loadSocialState = useCallback(async () => {
    if (!resolvedPost?.dbId) return
    const dbId = resolvedPost.dbId

    const socialState = await fetchPostSocialState(dbId, user?.id, resolvedPost.restaurantId)
    setLikeCount(socialState.likeCount)
    setComments(socialState.comments)
    setReactionCounts(socialState.reactionCounts)
    setMyReactions(socialState.myReactions)
    setLiked(socialState.liked)
    setSaved(socialState.saved)
    setLocationSaved(socialState.locationSaved)
  }, [resolvedPost?.dbId, resolvedPost?.restaurantId, user?.id])

  useEffect(() => {
    void loadSocialState()
  }, [loadSocialState])

  useEffect(() => {
    if (!resolvedPost?.creator) return
    let cancelled = false
    void fetchUserIdByUsername(resolvedPost.creator).then(async id => {
      if (cancelled) return
      setCreatorUserId(id)
      if (!id || !user?.id || id === user.id) {
        setFollowing(false)
        return
      }
      setFollowing(await fetchIsFollowing(user.id, id))
    })
    return () => {
      cancelled = true
    }
  }, [resolvedPost?.creator, user?.id])

  useEffect(() => {
    if (!resolvedPost?.dbId) return
    if (trackedPostView.current !== resolvedPost.dbId) {
      trackedPostView.current = resolvedPost.dbId
      dwellStartedAt.current = Date.now()
      analytics.viewPost(user?.id ?? null, resolvedPost.dbId)
    }
    return () => {
      const duration = Date.now() - dwellStartedAt.current
      if (duration >= 3000) analytics.dwellPost(user?.id ?? null, resolvedPost.dbId, duration)
    }
  }, [resolvedPost?.dbId, user?.id])

  async function toggleLike() {
    if (!resolvedPost?.dbId || !user) return
    const wasLiked = liked
    setOperationError(null)
    setLiked(!wasLiked)
    setLikeCount(c => (wasLiked ? c - 1 : c + 1))
    try {
      await togglePostLike(resolvedPost.dbId, user.id, !wasLiked)
    } catch {
      setLiked(wasLiked)
      setLikeCount(c => (wasLiked ? c + 1 : c - 1))
      analytics.actionError(user.id, 'post_like', 'write_failed')
      setOperationError({
        title: 'Could not update like',
        message: 'Check your connection and try again.',
      })
    }
  }

  async function toggleSave() {
    if (!resolvedPost?.dbId || !user) return
    const wasSaved = saved
    setOperationError(null)
    try {
      if (wasSaved) {
        const memberships = await fetchTargetCollectionItems(user.id, 'post', resolvedPost.dbId)
        if (memberships.length > 0) {
          setConfirmCollectionUnsave(true)
          return
        }
        await unsaveTarget('post', resolvedPost.dbId, false)
        setSaved(false)
      } else {
        setSaved(true)
        await togglePostSave(resolvedPost.dbId, user.id, true)
        setSaveSheet(true)
      }
    } catch {
      setSaved(wasSaved)
      analytics.actionError(user.id, 'post_save', 'write_failed')
      setOperationError({
        title: 'Could not update saved post',
        message: 'Check your connection and try again.',
      })
    }
  }

  async function resolveAndSaveLocation(restaurantId?: string): Promise<string | null> {
    if (restaurantId) return restaurantId
    if (!resolvedPost?.location) return null
    const resolved = await geocodeLocation(resolvedPost.location)
    if (!resolved) return null
    return upsertResolvedRestaurant(resolved)
  }

  async function toggleLocationSave() {
    if (!user) return
    const wasLocationSaved = locationSaved
    setOperationError(null)
    setLocationSaved(!wasLocationSaved)
    const restaurantId = await resolveAndSaveLocation(resolvedPost?.restaurantId)
    if (!restaurantId) {
      setLocationSaved(wasLocationSaved)
      setOperationError({
        title: 'Could not save location',
        message: 'We could not find this place reliably right now.',
      })
      return
    }
    if (wasLocationSaved) {
      try {
        await unsaveLocation(user.id, restaurantId)
      } catch {
        setLocationSaved(wasLocationSaved)
        setOperationError({
          title: 'Could not update saved location',
          message: 'Check your connection and try again.',
        })
      }
    } else {
      try {
        await saveLocation(user.id, restaurantId)
      } catch {
        setLocationSaved(wasLocationSaved)
        setOperationError({
          title: 'Could not save location',
          message: 'Check your connection and try again.',
        })
        return
      }
      analytics.savePlace(user.id, restaurantId)
    }
  }

  async function toggleFollowCreator() {
    if (!user?.id || !creatorUserId || creatorUserId === user.id) return
    const wasFollowing = following
    setOperationError(null)
    setFollowing(!wasFollowing)
    try {
      if (wasFollowing) await unfollowUser(user.id, creatorUserId)
      else {
        await followUser(user.id, creatorUserId)
        analytics.follow(user.id, creatorUserId)
      }
    } catch {
      setFollowing(wasFollowing)
      setOperationError({
        title: 'Could not update follow',
        message: 'Check your connection and try again.',
      })
    }
  }

  async function handleLocationTap() {
    if (!resolvedPost) return
    if (resolvedPost.lat && resolvedPost.lng) {
      if (resolvedPost.restaurantId) {
        analytics.revisitPlace(user?.id ?? null, resolvedPost.restaurantId, 'post_location_tap')
      }
      navigateToRestaurantFromPost(router, {
        restaurantId: resolvedPost.restaurantId,
        placeId: resolvedPost.placeId,
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
      setOperationError({
        title: 'Could not open location',
        message: 'We could not find this place reliably right now.',
      })
      return
    }
    analytics.revisitPlace(user?.id ?? null, resolvedPost.restaurantId ?? resolved.placeId, 'post_location_tap')
    navigateToRestaurantFromPost(router, {
      placeId: resolved.placeId,
      name: resolved.name,
      address: resolved.address,
      lat: resolved.lat,
      lng: resolved.lng,
    })
  }

  async function toggleReaction(type: PostReactionType) {
    if (!resolvedPost?.dbId || !user) return
    const isOn = myReactions.includes(type)
    const previousReactions = myReactions
    const previousCounts = reactionCounts
    setOperationError(null)
    setMyReactions(prev => isOn ? prev.filter(r => r !== type) : [...prev, type])
    setReactionCounts(prev => ({ ...prev, [type]: Math.max(0, (prev[type] ?? 0) + (isOn ? -1 : 1)) }))
    try {
      if (isOn) {
        await removePostReaction(resolvedPost.dbId, user.id, type)
      } else {
        await addPostReaction(resolvedPost.dbId, user.id, type)
      }
    } catch {
      setMyReactions(previousReactions)
      setReactionCounts(previousCounts)
      analytics.actionError(user.id, 'post_reaction', 'write_failed')
      setOperationError({
        title: 'Could not update reaction',
        message: 'Check your connection and try again.',
      })
    }
  }

  async function submitComment() {
    if (!comment.trim() || !resolvedPost?.dbId || !user || submitting) return
    setSubmitting(true)
    setOperationError(null)
    const text = comment.trim()
    const parentId = replyTo?.commentId ?? null
    setComment('')
    setReplyTo(null)
    try {
      await addPostComment(resolvedPost.dbId, user.id, text, parentId)
      await loadSocialState()
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
    } catch {
      analytics.actionError(user.id, parentId ? 'comment_reply' : 'comment_add', 'write_failed')
      setComment(text)
      setReplyTo(replyTo)
      setOperationError({
        title: 'Could not post comment',
        message: 'Check your connection and try again.',
      })
    }
    setSubmitting(false)
  }

  if (!resolvedPost) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity style={styles.backBar} onPress={() => router.back()}>
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        {fetchingPost ? (
          <View style={styles.loadingPost}>
            <Skeleton width="100%" height={220} radius={0} />
            <View style={styles.loadingPostBody}><Skeleton width="70%" height={24} /><SkeletonText lines={3} /></View>
          </View>
        ) : (
          <EmptyState title="Post not found" subtitle="This post may have been removed or is no longer available." />
        )}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={styles.backBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.backBarRight}>
          {prevPost && (
            <IconButton accessibilityLabel="Previous post" onPress={() => router.replace(routes.postDetail(prevPost.dbId ?? prevPost.id))}>
              <ChevronLeft size={20} />
            </IconButton>
          )}
          {nextPost && (
            <IconButton accessibilityLabel="Next post" onPress={() => router.replace(routes.postDetail(nextPost.dbId ?? nextPost.id))}>
              <ChevronRight size={20} />
            </IconButton>
          )}
          <IconButton accessibilityLabel="Open post options" onPress={() => setSafetySheet(true)}>
            <DotsIcon />
          </IconButton>
        </View>
      </View>

      {operationError ? (
        <ErrorMessage title={operationError.title} message={operationError.message} style={{ marginHorizontal: spacing[4] }} />
      ) : null}

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true)
              await loadSocialState()
              setRefreshing(false)
            }}
            tintColor={colors.text}
          />
        }
      >
        <PostMediaCarousel post={resolvedPost} />

        <PostActionsBar
          liked={liked}
          saved={saved}
          following={following}
          isOwner={isOwner}
          likeCount={likeCount}
          commentCount={comments.length}
          onLike={() => requireAuth(toggleLike)}
          onComment={() => requireAuth(() => commentInputRef.current?.focus())}
          onSave={() => requireAuth(toggleSave)}
          onShare={() => setShareSheet(true)}
          onFollow={() => requireAuth(toggleFollowCreator)}
        />
        <View style={styles.picksWrap}>
          <PostPicksSummary post={resolvedPost} />
        </View>

        <PostRestaurantCard
          post={resolvedPost}
          locationSaved={locationSaved}
          locationLoading={locationLoading}
          onLocationPress={handleLocationTap}
          onSaveLocation={() => requireAuth(toggleLocationSave)}
          onHashtagPress={tag => router.push(routes.search(tag.replace(/^#/, ''), 'hashtag'))}
          onDishPress={resolvedPost.dishId ? () => router.push(routes.dishDetail(resolvedPost.dishId ?? '')) : undefined}
          onAddToCollection={() => requireAuth(() => setCollectionPickerVisible(true))}
        />

        <PostReactionBar
          myReactions={myReactions}
          reactionCounts={reactionCounts}
          onToggleReaction={type => requireAuth(() => toggleReaction(type))}
        />

        <PostComments
          comments={comments}
          comment={comment}
          submitting={submitting}
          replyTo={replyTo}
          userEmail={user?.email}
          inputRef={commentInputRef}
          onChangeComment={setComment}
          onFocusInput={() => {
            requireAuth()
            requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
          }}
          onSubmitComment={() => requireAuth(submitComment)}
          onReplyTo={target => requireAuth(() => {
            setReplyTo(target)
            commentInputRef.current?.focus()
          })}
          onClearReply={() => setReplyTo(null)}
          onReportComment={reportComment}
        />
      </ScrollView>

      <PostDetailSheets
        saveSheet={saveSheet}
        safetySheet={safetySheet}
        shareSheet={shareSheet}
        deleteConfirmVisible={deleteConfirmVisible}
        noticeSheet={noticeSheet}
        isOwner={isOwner}
        onDismissSave={() => setSaveSheet(false)}
        onViewSavedPosts={() => {
          setSaveSheet(false)
          router.push(routes.saved('posts'))
        }}
        onDismissSafety={() => setSafetySheet(false)}
        onSafetySelect={value => requireAuth(() => handleSafetyAction(value))}
        onDismissDeleteConfirm={() => setDeleteConfirmVisible(false)}
        onDeleteConfirm={async () => {
          if (!resolvedPost.dbId) return
          try {
            await deletePost(resolvedPost.dbId)
            router.replace('/(tabs)/feed')
          } catch {
            setOperationError({
              title: 'Could not delete post',
              message: 'Check your connection and try again.',
            })
          }
        }}
        onDismissNotice={() => setNoticeSheet(null)}
        onDismissShare={() => setShareSheet(false)}
        onShareMessage={() => {
          requireAuth(() => {
            if (resolvedPost.dbId) analytics.postShare(user?.id ?? null, resolvedPost.dbId, 'message')
            router.push(routes.messageShare({
              sharePostId: resolvedPost.dbId || String(resolvedPost.id),
              sharePostDbId: resolvedPost.dbId ?? '',
              shareCaption: resolvedPost.title ?? '',
              shareImageUrl: resolvedPost.imageUrl ?? '',
              shareAuthor: resolvedPost.creator ?? '',
              shareLocation: resolvedPost.location ?? '',
            }))
          })
        }}
      />

      <SavedTargetCollectionSheets
        pickerVisible={collectionPickerVisible}
        confirmUnsaveVisible={confirmCollectionUnsave}
        targetLabel="post"
        collections={collectionPicker.collections}
        loading={collectionPicker.loading}
        onDismissPicker={() => setCollectionPickerVisible(false)}
        onSelectCollection={collectionId => {
          void collectionPicker.add(collectionId).then(() => {
            analytics.collectionInteraction(user?.id ?? null, 'add_item', collectionId, { target_type: 'post' })
            setCollectionPickerVisible(false)
            setSaved(true)
          }).catch(() => setOperationError({
            title: 'Could not add to collection',
            message: 'Check your connection and try again.',
          }))
        }}
        onCreateCollection={name => {
          void collectionPicker.createAndAdd(name).then(collection => {
            if (!collection) return
            analytics.collectionInteraction(user?.id ?? null, 'create_and_add', collection.id, { target_type: 'post' })
            setCollectionPickerVisible(false)
            setSaved(true)
          }).catch(() => setOperationError({
            title: 'Could not create collection',
            message: 'Check your connection and try again.',
          }))
        }}
        onDismissConfirmUnsave={() => setConfirmCollectionUnsave(false)}
        onConfirmUnsave={() => {
          if (!resolvedPost.dbId) return
          void unsaveTarget('post', resolvedPost.dbId, true).then(() => {
            setSaved(false)
          }).catch(() => setOperationError({
            title: 'Could not remove saved post',
            message: 'Check your connection and try again.',
          }))
        }}
      />

      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    loadingPost: { flex: 1 },
    loadingPostBody: { padding: spacing[4], gap: spacing[3] },
    backBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], padding: spacing.px6, marginLeft: -spacing.px6 },
    backText: { fontSize: fontSize.md, color: c.text2, fontWeight: fontWeight.bold },
    picksWrap: { paddingHorizontal: spacing[4], paddingTop: spacing.px10 },
  })
}
