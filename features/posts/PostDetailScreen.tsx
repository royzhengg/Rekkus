import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import {
  addPostReaction,
  deletePost,
  fetchPostById,
  fetchPostSocialState,
  mapRowToPost,
  removePostReaction,
  togglePostLike,
  togglePostSave,
  type PostCommentRow,
  type PostReactionType,
} from '@/lib/services/posts'
import { navigateToRestaurantFromPost } from '@/lib/utils/restaurantNavigation'
import type { Post } from '@/types/domain'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import {
  ChevronLeft,
  DotsIcon,
  HeartIcon,
  CommentIcon,
  BookmarkIcon,
  ShareIcon,
  PinIcon,
  SendIcon,
} from '@/components/icons'
import { Avatar } from '@/components/Avatar'
import { fetchPlaceTextSearchJson } from '@/lib/services/googlePlaces'
import { avatarPalette } from '@/lib/utils/format'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { IconButton } from '@/components/ui/IconButton'
import { blockUser, submitContentReport } from '@/lib/services/moderation'
import { fetchIsFollowing, fetchUserIdByUsername, followUser, unfollowUser } from '@/lib/services/users'
import { analytics } from '@/lib/analytics'
import { PostMediaCarousel } from '@/components/post/PostMediaCarousel'
import { PostPicksSummary } from '@/components/post/PostPicksSummary'
import { addPostComment, reportComment as reportCommentService } from '@/lib/services/comments'
import { saveLocation, unsaveLocation, upsertResolvedRestaurant } from '@/lib/services/restaurants'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

const REACTIONS: { type: PostReactionType; emoji: string; label: string }[] = [
  { type: 'helpful', emoji: '👍', label: 'Helpful' },
  { type: 'love', emoji: '❤️', label: 'Love This' },
  { type: 'thanks', emoji: '🙏', label: 'Thanks' },
  { type: 'oh_no', emoji: '😬', label: 'Oh No' },
]

type ResolvedPlace = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
}

async function geocodeLocation(query: string): Promise<ResolvedPlace | null> {
  try {
    const json = await fetchPlaceTextSearchJson<{
      place_id: string
      name: string
      formatted_address: string
      geometry: { location: { lat: number; lng: number } }
    }>(query)
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

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

export default function PostDetailScreen() {
  const { postId, id } = useLocalSearchParams<{ postId?: string; id?: string }>()
  const resolvedPostId = postId ?? id ?? ''
  const router = useRouter()
  const { posts } = usePosts()
  const { requireAuth } = useAuthGate()
  const { user } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const isUuid = resolvedPostId.includes('-')
  const contextPost = isUuid
    ? posts.find(p => p.dbId === resolvedPostId)
    : posts.find(p => p.id === Number(resolvedPostId))
  const [resolvedPost, setResolvedPost] = useState<Post | null>(contextPost ?? null)
  const [fetchingPost, setFetchingPost] = useState(false)

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
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [creatorUserId, setCreatorUserId] = useState<string | null>(null)
  const isOwner = !!user?.id && !!resolvedPost?.userId && user.id === resolvedPost.userId

  const commentInputRef = useRef<TextInput>(null)
  const scrollRef = useRef<any>(null)
  const dwellStartedAt = useRef(Date.now())
  const trackedPostView = useRef<string | null>(null)

  useEffect(() => {
    if (contextPost) {
      setResolvedPost(contextPost)
      return
    }
    if (!isUuid || !resolvedPostId) return
    let cancelled = false
    setFetchingPost(true)
    fetchPostById(resolvedPostId).then(row => {
      if (!cancelled) {
        if (row) setResolvedPost(mapRowToPost(row, 0))
        setFetchingPost(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [resolvedPostId])

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
    loadSocialState()
  }, [loadSocialState])

  useEffect(() => {
    if (!resolvedPost?.creator) return
    let cancelled = false
    fetchUserIdByUsername(resolvedPost.creator).then(async id => {
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
    setLiked(!wasLiked)
    setLikeCount(c => (wasLiked ? c - 1 : c + 1))
    try {
      await togglePostLike(resolvedPost.dbId, user.id, !wasLiked)
    } catch {
      setLiked(wasLiked)
      setLikeCount(c => (wasLiked ? c + 1 : c - 1))
      analytics.actionError(user.id, 'post_like', 'write_failed')
      setNoticeSheet({
        title: 'Could not update like',
        subtitle: 'Check your connection and try again.',
      })
    }
  }

  async function toggleSave() {
    if (!resolvedPost?.dbId || !user) return
    const wasSaved = saved
    setSaved(!wasSaved)
    try {
      await togglePostSave(resolvedPost.dbId, user.id, !wasSaved)
      if (!wasSaved) setSaveSheet(true)
    } catch {
      setSaved(wasSaved)
      analytics.actionError(user.id, 'post_save', 'write_failed')
      setNoticeSheet({
        title: 'Could not update saved post',
        subtitle: 'Check your connection and try again.',
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
    setLocationSaved(!wasLocationSaved)
    const restaurantId = await resolveAndSaveLocation(resolvedPost?.restaurantId)
    if (!restaurantId) {
      setLocationSaved(wasLocationSaved)
      setNoticeSheet({
        title: 'Could not save location',
        subtitle: 'We could not find this place reliably right now.',
      })
      return
    }
    if (wasLocationSaved) {
      try {
        await unsaveLocation(user.id, restaurantId)
      } catch {
        setLocationSaved(wasLocationSaved)
        setNoticeSheet({
          title: 'Could not update saved location',
          subtitle: 'Check your connection and try again.',
        })
      }
    } else {
      try {
        await saveLocation(user.id, restaurantId)
      } catch {
        setLocationSaved(wasLocationSaved)
        setNoticeSheet({
          title: 'Could not save location',
          subtitle: 'Check your connection and try again.',
        })
        return
      }
      analytics.savePlace(user.id, restaurantId)
    }
  }

  async function toggleFollowCreator() {
    if (!user?.id || !creatorUserId || creatorUserId === user.id) return
    const wasFollowing = following
    setFollowing(!wasFollowing)
    try {
      if (wasFollowing) await unfollowUser(user.id, creatorUserId)
      else {
        await followUser(user.id, creatorUserId)
        analytics.follow(user.id, creatorUserId)
      }
    } catch {
      setFollowing(wasFollowing)
      setNoticeSheet({
        title: 'Could not update follow',
        subtitle: 'Check your connection and try again.',
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
      setNoticeSheet({
        title: 'Could not open location',
        subtitle: 'We could not find this place reliably right now.',
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
      setNoticeSheet({
        title: 'Could not update reaction',
        subtitle: 'Check your connection and try again.',
      })
    }
  }

  function handleHashtagPress(tag: string) {
    router.push({
      pathname: '/(tabs)/search',
      params: { query: tag.replace(/^#/, ''), source: 'hashtag' },
    } as any)
  }

  async function handleSafetyAction(value: string) {
    if (!user || !resolvedPost) {
      requireAuth()
      return
    }

    if (value === 'edit_post' && resolvedPost.dbId) {
      router.push({
        pathname: '/(tabs)/create',
        params: { intent: 'edit', postId: resolvedPost.dbId, nonce: String(Date.now()) },
      } as any)
      return
    }

    if (value === 'delete_post') {
      setDeleteConfirmVisible(true)
      return
    }

    if (value === 'report_post') {
      if (!resolvedPost.dbId) {
        setNoticeSheet({ title: 'Not available', subtitle: 'Demo posts cannot be reported.' })
        return
      }
      const err = await submitContentReport({
        reporterId: user.id,
        targetType: 'post',
        targetId: resolvedPost.dbId,
        reason: 'inappropriate_or_spam',
        sourceSurface: 'post_detail',
      })
      setNoticeSheet({
        title: err ? 'Report failed' : 'Report received',
        subtitle: err ?? 'Thanks. We will review this post.',
      })
      return
    }

    const creatorId = await fetchUserIdByUsername(resolvedPost.creator)
    if (!creatorId) {
      setNoticeSheet({ title: 'Not available', subtitle: 'We could not find this user right now.' })
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
      setNoticeSheet({
        title: err ? 'Report failed' : 'Report received',
        subtitle: err ?? 'Thanks. We will review this profile.',
      })
      return
    }

    if (value === 'block_user') {
      const err = await blockUser(user.id, creatorId)
      setNoticeSheet({
        title: err ? 'Block failed' : 'User blocked',
        subtitle: err ?? 'You will have a record of this block for moderation review.',
      })
    }
  }

  async function reportComment(commentId: string) {
    if (!user) {
      requireAuth()
      return
    }
    const err = await reportCommentService(commentId, user.id)
    setNoticeSheet({
      title: err ? 'Report failed' : 'Report received',
      subtitle: err ?? 'Thanks. We will review this comment.',
    })
  }

  async function submitComment() {
    if (!comment.trim() || !resolvedPost?.dbId || !user || submitting) return
    setSubmitting(true)
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
      setNoticeSheet({
        title: 'Could not post comment',
        subtitle: 'Check your connection and try again.',
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {fetchingPost ? (
            <ActivityIndicator color={colors.text3} />
          ) : (
            <Text style={{ color: colors.text3 }}>Post not found</Text>
          )}
        </View>
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
        <IconButton accessibilityLabel="Open post options" onPress={() => setSafetySheet(true)}>
          <DotsIcon />
        </IconButton>
      </View>

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

        {/* Actions bar */}
        <View style={styles.actionsBar}>
          <View style={styles.actionsLeft}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => requireAuth(toggleLike)}>
              <HeartIcon filled={liked} />
              <Text style={styles.actionCount}>{formatCount(likeCount)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => requireAuth(() => commentInputRef.current?.focus())}
            >
              <CommentIcon />
              <Text style={styles.actionCount}>{comments.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => requireAuth(toggleSave)}>
              <BookmarkIcon filled={saved} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShareSheet(true)}>
              <ShareIcon />
            </TouchableOpacity>
          </View>
          {!isOwner && (
            <TouchableOpacity
              style={[styles.followPill, following && styles.followPillActive]}
              onPress={() => requireAuth(toggleFollowCreator)}
            >
              <Text style={[styles.followText, following && styles.followTextActive]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.picksWrap}>
          <PostPicksSummary post={resolvedPost} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.creatorRow}
            onPress={() =>
              router.push({
                pathname: '/user/[username]',
                params: { username: resolvedPost.creator },
              })
            }
            activeOpacity={0.7}
          >
            <Avatar
              initials={resolvedPost.initials}
              bg={resolvedPost.avatarBg}
              color={resolvedPost.avatarColor}
              size={32}
            />
            <View>
              <Text style={styles.handle}>@{resolvedPost.creator}</Text>
              <Text style={styles.timestamp}>2 days ago</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.postTitle}>{resolvedPost.title}</Text>
          <Text style={styles.postBody}>{resolvedPost.body}</Text>

          <View style={styles.locationRow}>
            <TouchableOpacity style={styles.locationPill} onPress={handleLocationTap}>
              {locationLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.text3}
                  style={{ width: 11, height: 11 }}
                />
              ) : (
                <PinIcon size={11} />
              )}
              <Text style={styles.locationText}>{resolvedPost.location}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.locationSaveBtn}
              onPress={() => requireAuth(toggleLocationSave)}
            >
              <BookmarkIcon size={14} filled={locationSaved} inactiveColor={colors.text3} />
            </TouchableOpacity>
          </View>

          <View style={styles.hashtags}>
            {resolvedPost.tags.map(tag => (
              <TouchableOpacity key={tag} style={styles.hashtagPill} onPress={() => handleHashtagPress(tag)}>
                <Text style={styles.hashtag}>#{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reactions */}
        <View style={styles.reactionsBar}>
          {REACTIONS.map(({ type, emoji, label }) => {
            const active = myReactions.includes(type)
            const count = reactionCounts[type] ?? 0
            return (
              <TouchableOpacity
                key={type}
                style={[styles.reactionBtn, active && styles.reactionBtnActive]}
                onPress={() => requireAuth(() => toggleReaction(type))}
                activeOpacity={0.75}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={[styles.reactionLabel, active && styles.reactionLabelActive]}>
                  {label}
                </Text>
                {count > 0 && (
                  <Text style={[styles.reactionCount, active && styles.reactionLabelActive]}>
                    {count}
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsHeading}>
            {comments.length > 0 ? `Comments (${comments.length})` : 'Comments'}
          </Text>
          {(() => {
            const topLevel = comments.filter(c => !c.parent_id)
            const repliesMap = new Map<string, PostCommentRow[]>()
            for (const c of comments) {
              if (c.parent_id) {
                const bucket = repliesMap.get(c.parent_id) ?? []
                bucket.push(c)
                repliesMap.set(c.parent_id, bucket)
              }
            }
            return topLevel.map(c => {
              const username = c.users?.username ?? 'user'
              const palette = avatarPalette(username)
              const replies = repliesMap.get(c.id) ?? []
              return (
                <View key={c.id}>
                  <View style={styles.comment}>
                    <Avatar
                      initials={username.slice(0, 2).toUpperCase()}
                      bg={palette.bg}
                      color={palette.color}
                      size={24}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentHandle}>@{username}</Text>
                      <Text style={styles.commentText}>{c.content}</Text>
                      <View style={styles.commentActions}>
                        <TouchableOpacity
                          onPress={() => requireAuth(() => {
                            setReplyTo({ commentId: c.id, username })
                            commentInputRef.current?.focus()
                          })}
                          style={styles.replyBtn}
                        >
                          <Text style={styles.replyBtnText}>Reply</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => reportComment(c.id)}
                          style={styles.replyBtn}
                        >
                          <Text style={styles.replyBtnText}>Report</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  {replies.map(r => {
                    const ru = r.users?.username ?? 'user'
                    const rp = avatarPalette(ru)
                    return (
                      <View key={r.id} style={styles.replyRow}>
                        <Avatar
                          initials={ru.slice(0, 2).toUpperCase()}
                          bg={rp.bg}
                          color={rp.color}
                          size={20}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.commentHandle}>@{ru}</Text>
                          <Text style={styles.commentText}>{r.content}</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )
            })
          })()}
          {comments.length === 0 && (
            <Text style={styles.noComments}>No comments yet. Be the first!</Text>
          )}
        </View>
      </ScrollView>

      {/* Save sheet modal */}
      <Modal
        visible={saveSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setSaveSheet(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetIcon}>
            <BookmarkIcon size={22} filled />
          </View>
          <Text style={styles.sheetTitle}>Post saved!</Text>
          <Text style={styles.sheetBody}>Added to your saved posts.</Text>
          <TouchableOpacity
            style={styles.sheetBtnPrimary}
            onPress={() => {
              setSaveSheet(false)
              router.push('/(tabs)/profile?tab=saved')
            }}
          >
            <Text style={styles.sheetBtnPrimaryText}>View saved posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetBtnSecondary} onPress={() => setSaveSheet(false)}>
            <Text style={styles.sheetBtnSecondaryText}>Stay here</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <RekkusActionSheet
        visible={safetySheet}
        title={isOwner ? 'Post options' : 'Post safety'}
        subtitle={isOwner ? 'Edit or manage this post.' : 'Report content or block the creator.'}
        options={[
          ...(isOwner ? [
            { label: 'Edit post', value: 'edit_post', accentColor: colors.accent },
            { label: 'Delete post', value: 'delete_post', destructive: true },
          ] : [
            { label: 'Report post', value: 'report_post' },
            { label: 'Report creator', value: 'report_user' },
            { label: 'Block creator', value: 'block_user' },
          ]),
        ]}
        onSelect={value => requireAuth(() => handleSafetyAction(value))}
        onDismiss={() => setSafetySheet(false)}
      />

      <RekkusActionSheet
        visible={deleteConfirmVisible}
        title="Delete post?"
        subtitle="This removes the post from public surfaces. This cannot be undone here."
        options={[
          { label: 'Keep post', value: 'keep' },
          { label: 'Delete post', value: 'delete', destructive: true },
        ]}
        onSelect={async value => {
          if (value !== 'delete' || !resolvedPost.dbId) return
          try {
            await deletePost(resolvedPost.dbId)
            router.replace('/(tabs)/feed')
          } catch {
            setNoticeSheet({
              title: 'Could not delete post',
              subtitle: 'Check your connection and try again.',
            })
          }
        }}
        onDismiss={() => setDeleteConfirmVisible(false)}
      />

      <RekkusActionSheet
        visible={noticeSheet != null}
        title={noticeSheet?.title}
        subtitle={noticeSheet?.subtitle}
        options={[{ label: 'Done', value: 'done' }]}
        onSelect={() => setNoticeSheet(null)}
        onDismiss={() => setNoticeSheet(null)}
      />

      <RekkusActionSheet
        visible={shareSheet}
        title="Share post"
        options={[
          { label: 'Send via message', value: 'send_dm' },
        ]}
        onSelect={value => {
          setShareSheet(false)
          if (value === 'send_dm' && resolvedPost) {
            requireAuth(() => {
              if (resolvedPost.dbId) analytics.postShare(user?.id ?? null, resolvedPost.dbId, 'message')
              router.push({
                pathname: '/messages/new',
                params: {
                  sharePostId: resolvedPost.dbId || String(resolvedPost.id),
                  sharePostDbId: resolvedPost.dbId ?? '',
                  shareCaption: resolvedPost.title ?? '',
                  shareImageUrl: resolvedPost.imageUrl ?? '',
                  shareAuthor: resolvedPost.creator ?? '',
                  shareLocation: resolvedPost.location ?? '',
                },
              } as any)
            })
          }
        }}
        onDismiss={() => setShareSheet(false)}
      />

      {/* Comment input */}
      <View style={styles.commentInputWrap}>
        {replyTo && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText}>Replying to @{replyTo.username}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.replyBannerDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.commentInputBar}>
          <Avatar
            initials={user ? (user.email?.slice(0, 2).toUpperCase() ?? 'ME') : 'ME'}
            bg={colors.ratingBg}
            color={colors.ratingText}
            size={28}
          />
          <TextInput
            ref={commentInputRef}
            style={styles.commentField}
            placeholder={replyTo ? `Reply to @${replyTo.username}…` : 'Add a comment…'}
            placeholderTextColor={colors.text3}
            value={comment}
            onChangeText={setComment}
            onFocus={() => { requireAuth(); requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true })) }}
            onSubmitEditing={submitComment}
            returnKeyType="send"
            editable={!submitting}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() => requireAuth(submitComment)}
            disabled={submitting || !comment.trim()}
          >
            <SendIcon active={!!comment.trim()} />
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    backBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], padding: spacing.px6, marginLeft: -spacing.px6 },
    backText: { fontSize: fontSize.md, color: c.text2, fontWeight: fontWeight.bold },
    photo: {
      width: '100%',
      aspectRatio: 4 / 3,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    videoFallback: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
      backgroundColor: c.surface2,
    },
    videoFallbackText: { fontSize: fontSize.base, color: c.text3 },
    picksWrap: { paddingHorizontal: spacing[4], paddingTop: spacing.px10 },
    photoArrowLeft: {
      position: 'absolute',
      left: 12,
      top: '50%',
      marginTop: -spacing.px18,
      width: 36,
      height: 36,
      borderRadius: radius.xl,
      backgroundColor: c.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoArrowRight: {
      position: 'absolute',
      right: 12,
      top: '50%',
      marginTop: -spacing.px18,
      width: 36,
      height: 36,
      borderRadius: radius.xl,
      backgroundColor: c.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoArrowText: {
      color: c.white,
      fontSize: fontSize['4xl'],
      lineHeight: lineHeight.hero,
      fontWeight: fontWeight.light,
      marginTop: -spacing.px1,
    },
    photoDots: { position: 'absolute', bottom: 10, flexDirection: 'row', gap: spacing[1] },
    dot: { width: 5, height: 5, borderRadius: radius.dot, backgroundColor: 'rgba(255,255,255,0.5)' }, // check:tokens-ignore
    dotActive: { width: 14, borderRadius: radius.tiny, backgroundColor: c.white },
    actionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px9,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    actionsLeft: { flexDirection: 'row', gap: spacing.px10, alignItems: 'center' },
    actionBtn: {
      minHeight: 34,
      minWidth: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[1],
      borderRadius: radius.lg3,
      paddingHorizontal: spacing.px7,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    actionCount: { fontSize: fontSize.sm, color: c.text3, fontWeight: fontWeight.extrabold },
    followPill: {
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border2,
    },
    followPillActive: { backgroundColor: `${c.accent}12`, borderColor: `${c.accent}33` },
    followText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.extrabold, color: c.text },
    followTextActive: { color: c.text2 },
    content: { padding: spacing.px14, paddingHorizontal: spacing[4], paddingBottom: spacing[0] },
    creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.px9, marginBottom: spacing.px11 },
    handle: { fontSize: fontSize.bodySm, fontWeight: fontWeight.extrabold, color: c.text },
    timestamp: { fontSize: fontSize.xs, color: c.text3, marginTop: spacing.px1 },
    postTitle: {
      fontSize: fontSize.title,
      fontWeight: fontWeight.bold,
      color: c.text,
      lineHeight: lineHeight.relaxed,
      marginBottom: spacing.px9,
      letterSpacing: -0.2,
    },
    postBody: { fontSize: fontSize.base, color: c.text2, lineHeight: lineHeight.loose, marginBottom: spacing.px13 },
    ratingCard: {
      flexDirection: 'row',
      marginBottom: spacing.px14,
    },
    ratingSection: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.px6,
      gap: spacing[1],
    },
    ratingDivider: {
      width: 0.5,
      backgroundColor: c.border2,
      marginVertical: spacing[1],
    },
    ratingLabel: {
      fontSize: fontSize['2xs'],
      color: c.text3,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontWeight: fontWeight.semibold,
    },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6, marginBottom: spacing.px10 },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      alignSelf: 'flex-start',
      backgroundColor: `${c.accent}08`,
      borderRadius: radius.pill,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px5,
      borderWidth: 0.5,
      borderColor: `${c.accent}22`,
    },
    locationText: { fontSize: fontSize.bodySm, color: c.text2 },
    locationSaveBtn: {
      width: 30,
      height: 30,
      borderRadius: radius.lg1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    hashtags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px5, paddingBottom: spacing.px14 },
    hashtagPill: {
      borderRadius: radius.lg,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: spacing.px9,
      paddingVertical: spacing.px5,
    },
    hashtag: { fontSize: fontSize.bodySm, color: c.info, fontWeight: fontWeight.extrabold },
    reactionsBar: {
      flexDirection: 'row',
      gap: spacing.px6,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px10,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      flexWrap: 'nowrap',
    },
    reactionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px6,
      borderRadius: radius.pill,
      borderWidth: 0.5,
      borderColor: c.border2,
      backgroundColor: c.surface,
    },
    reactionBtnActive: {
      borderColor: `${c.accent}44`,
      backgroundColor: `${c.accent}10`,
    },
    reactionEmoji: { fontSize: fontSize.base },
    reactionLabel: { fontSize: fontSize.sm, color: c.text2, fontWeight: fontWeight.bold },
    reactionLabelActive: { color: c.accent, fontWeight: fontWeight.black },
    reactionCount: { fontSize: fontSize.sm, color: c.text3 },
    commentsSection: {
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      padding: spacing[3],
      paddingHorizontal: spacing[4],
    },
    commentsHeading: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.black,
      color: c.text,
      marginBottom: spacing.px10,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    noComments: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center', paddingVertical: spacing[3] },
    comment: { flexDirection: 'row', gap: spacing.px9, marginBottom: spacing[3] },
    commentHandle: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold, color: c.text },
    commentText: { fontSize: fontSize.bodySm, color: c.text2, lineHeight: lineHeight.small },
    commentActions: { flexDirection: 'row', gap: spacing.px14, marginTop: spacing.px5 },
    replyBtn: { alignSelf: 'flex-start' },
    replyBtnText: { fontSize: fontSize.sm, color: c.text3, fontWeight: fontWeight.extrabold },
    replyRow: {
      flexDirection: 'row',
      gap: spacing[2],
      marginBottom: spacing[2],
      marginLeft: spacing[8],
      paddingLeft: spacing[3],
      borderLeftWidth: 1.5,
      borderLeftColor: `${c.accent}24`,
    },
    commentInputWrap: {
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingTop: spacing[2],
      paddingBottom: spacing[1],
    },
    replyBannerText: { fontSize: fontSize.sm, color: c.text3 },
    replyBannerDismiss: { fontSize: fontSize.bodySm, color: c.text3, paddingLeft: spacing[2] },
    commentInputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px9,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[2],
      paddingBottom: spacing[4],
      backgroundColor: c.bg,
    },
    commentField: {
      flex: 1,
      backgroundColor: c.bg,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[2],
      fontSize: fontSize.base,
      color: c.text,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    sendBtn: { padding: spacing[1] },
    sheetBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.overlay,
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.bg,
      borderTopLeftRadius: radius.pill,
      borderTopRightRadius: radius.pill,
      paddingHorizontal: spacing[5],
      paddingBottom: spacing.px36,
      paddingTop: spacing[3],
      alignItems: 'center',
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: radius.xxs,
      backgroundColor: c.border2,
      marginBottom: spacing[5],
    },
    sheetIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.pill3,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing[3],
    },
    sheetTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text, marginBottom: spacing.px6 },
    sheetBody: {
      fontSize: fontSize.base,
      color: c.text2,
      textAlign: 'center',
      marginBottom: spacing[6],
      lineHeight: lineHeight.body,
    },
    sheetBtnPrimary: {
      width: '100%',
      backgroundColor: c.text,
      borderRadius: radius.lg,
      paddingVertical: spacing.px14,
      alignItems: 'center',
      marginBottom: spacing.px10,
    },
    sheetBtnPrimaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.bg },
    sheetBtnSecondary: {
      width: '100%',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      paddingVertical: spacing.px14,
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: c.border,
    },
    sheetBtnSecondaryText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text2 },
  })
}
