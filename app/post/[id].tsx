import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  useWindowDimensions,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/ThemeContext'
import { usePosts } from '@/lib/PostsContext'
import { useAuthGate } from '@/lib/AuthGateContext'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { imgColors } from '@/constants/Colors'
import {
  ChevronLeft,
  DotsIcon,
  HeartIcon,
  CommentIcon,
  BookmarkIcon,
  ShareIcon,
  PinIcon,
  SendIcon,
  ImagePlaceholder,
} from '@/components/icons'
import { Stars, Dollars } from '@/components/RatingDisplay'
import { Avatar } from '@/components/Avatar'
import { GOOGLE_PLACES_KEY as PLACES_KEY } from '@/lib/config'
import { avatarPalette } from '@/lib/utils/format'

type CommentRow = {
  id: string
  content: string
  created_at: string
  users: { username: string; full_name: string | null } | null
}

type ResolvedPlace = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
}

async function geocodeLocation(query: string): Promise<ResolvedPlace | null> {
  if (!PLACES_KEY || !query) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${PLACES_KEY}`
    const res = await fetch(url)
    const json = await res.json()
    const place = json.results?.[0]
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
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { posts } = usePosts()
  const { requireAuth } = useAuthGate()
  const { user } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { width: screenWidth } = useWindowDimensions()
  const post = posts.find(p => p.id === Number(id))

  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveSheet, setSaveSheet] = useState(false)
  const [locationSaved, setLocationSaved] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [following, setFollowing] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const commentInputRef = useRef<TextInput>(null)
  const scrollRef = useRef<any>(null)
  const photoScrollRef = useRef<any>(null)

  const images = useMemo(() => (post?.imageUrl ? [post.imageUrl] : []), [post?.imageUrl])

  const loadSocialState = useCallback(async () => {
    if (!post?.dbId) return
    const dbId = post.dbId

    const [countRes, commentsRes] = await Promise.all([
      (supabase.from('likes') as any)
        .select('id', { count: 'exact', head: true })
        .eq('post_id', dbId),
      (supabase.from('comments') as any)
        .select('id, content, created_at, users(username, full_name)')
        .eq('post_id', dbId)
        .order('created_at', { ascending: true }),
    ])

    if (countRes.count != null) setLikeCount(countRes.count)
    if (commentsRes.data) setComments(commentsRes.data)

    if (user) {
      const queries: Promise<any>[] = [
        (supabase.from('likes') as any)
          .select('id')
          .eq('post_id', dbId)
          .eq('user_id', user.id)
          .maybeSingle(),
        (supabase.from('saves') as any)
          .select('id')
          .eq('post_id', dbId)
          .eq('user_id', user.id)
          .maybeSingle(),
      ]
      if (post.restaurantId) {
        queries.push(
          (supabase.from('saved_locations') as any)
            .select('id')
            .eq('restaurant_id', post.restaurantId)
            .eq('user_id', user.id)
            .maybeSingle()
        )
      }
      const [likeRes, saveRes, locRes] = await Promise.all(queries)
      setLiked(!!likeRes.data)
      setSaved(!!saveRes.data)
      if (locRes) setLocationSaved(!!locRes.data)
    } else {
      setLiked(false)
      setSaved(false)
      setLocationSaved(false)
    }
  }, [post?.dbId, post?.restaurantId, user?.id])

  useEffect(() => {
    loadSocialState()
  }, [loadSocialState])

  async function toggleLike() {
    if (!post?.dbId || !user) return
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount(c => (wasLiked ? c - 1 : c + 1))
    if (wasLiked) {
      const { error } = await (supabase.from('likes') as any)
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', post.dbId)
      if (error) {
        setLiked(wasLiked)
        setLikeCount(c => (wasLiked ? c + 1 : c - 1))
      }
    } else {
      const { error } = await (supabase.from('likes') as any).insert({
        user_id: user.id,
        post_id: post.dbId,
      })
      if (error) {
        setLiked(wasLiked)
        setLikeCount(c => (wasLiked ? c + 1 : c - 1))
      }
    }
  }

  async function toggleSave() {
    if (!post?.dbId || !user) return
    const wasSaved = saved
    setSaved(!wasSaved)
    if (wasSaved) {
      const { error } = await (supabase.from('saves') as any)
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', post.dbId)
      if (error) setSaved(wasSaved)
    } else {
      const { error } = await (supabase.from('saves') as any).insert({
        user_id: user.id,
        post_id: post.dbId,
      })
      if (error) setSaved(wasSaved)
      else setSaveSheet(true)
    }
  }

  async function resolveAndSaveLocation(restaurantId?: string): Promise<string | null> {
    if (restaurantId) return restaurantId
    if (!post?.location) return null
    const resolved = await geocodeLocation(post.location)
    if (!resolved) return null
    const { data } = await (supabase.from('restaurants') as any)
      .upsert(
        {
          name: resolved.name,
          address: resolved.address,
          latitude: resolved.lat,
          longitude: resolved.lng,
          google_place_id: resolved.placeId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'google_place_id' }
      )
      .select('id')
      .single()
    return data?.id ?? null
  }

  async function toggleLocationSave() {
    if (!user) return
    const wasLocationSaved = locationSaved
    setLocationSaved(!wasLocationSaved)
    const restaurantId = await resolveAndSaveLocation(post?.restaurantId)
    if (!restaurantId) {
      setLocationSaved(wasLocationSaved)
      return
    }
    if (wasLocationSaved) {
      const { error } = await (supabase.from('saved_locations') as any)
        .delete()
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
      if (error) setLocationSaved(wasLocationSaved)
    } else {
      const { error } = await (supabase.from('saved_locations') as any).insert({
        user_id: user.id,
        restaurant_id: restaurantId,
      })
      if (error) setLocationSaved(wasLocationSaved)
    }
  }

  async function handleLocationTap() {
    if (!post) return
    if (post.lat && post.lng) {
      router.push({
        pathname: '/location/[placeId]',
        params: {
          placeId: post.placeId ?? 'none',
          name: post.location,
          address: post.address ?? post.location,
          lat: String(post.lat),
          lng: String(post.lng),
        },
      })
      return
    }
    setLocationLoading(true)
    const resolved = await geocodeLocation(post.location)
    setLocationLoading(false)
    if (!resolved) return
    router.push({
      pathname: '/location/[placeId]',
      params: {
        placeId: resolved.placeId,
        name: resolved.name,
        address: resolved.address,
        lat: String(resolved.lat),
        lng: String(resolved.lng),
      },
    })
  }

  async function submitComment() {
    if (!comment.trim() || !post?.dbId || !user || submitting) return
    setSubmitting(true)
    const text = comment.trim()
    setComment('')
    const { error } = await (supabase.from('comments') as any).insert({
      user_id: user.id,
      post_id: post.dbId,
      content: text,
    })
    if (!error) await loadSocialState()
    else setComment(text)
    setSubmitting(false)
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity style={styles.backBar} onPress={() => router.back()}>
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.text3 }}>Post not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.backBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <DotsIcon />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
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
        {/* Photo carousel */}
        <View style={[styles.photo, { backgroundColor: imgColors[post.imgKey] }]}>
          {images.length > 0 ? (
            <>
              <ScrollView
                ref={photoScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth)
                  setPhotoIndex(idx)
                }}
                style={{ width: screenWidth, height: '100%' }}
              >
                {images.map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    style={{ width: screenWidth, height: '100%' }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {photoIndex > 0 && (
                <TouchableOpacity
                  style={styles.photoArrowLeft}
                  onPress={() => {
                    const next = photoIndex - 1
                    photoScrollRef.current?.scrollTo({ x: next * screenWidth, animated: true })
                    setPhotoIndex(next)
                  }}
                >
                  <Text style={styles.photoArrowText}>‹</Text>
                </TouchableOpacity>
              )}
              {photoIndex < images.length - 1 && (
                <TouchableOpacity
                  style={styles.photoArrowRight}
                  onPress={() => {
                    const next = photoIndex + 1
                    photoScrollRef.current?.scrollTo({ x: next * screenWidth, animated: true })
                    setPhotoIndex(next)
                  }}
                >
                  <Text style={styles.photoArrowText}>›</Text>
                </TouchableOpacity>
              )}
              {images.length > 1 && (
                <View style={styles.photoDots}>
                  {images.map((_, i) => (
                    <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <ImagePlaceholder size={48} />
          )}
        </View>

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
            <TouchableOpacity style={styles.actionBtn}>
              <ShareIcon />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.followPill, following && styles.followPillActive]}
            onPress={() => requireAuth(() => setFollowing(v => !v))}
          >
            <Text style={[styles.followText, following && styles.followTextActive]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.creatorRow}
            onPress={() =>
              router.push({ pathname: '/user/[username]', params: { username: post.creator } })
            }
            activeOpacity={0.7}
          >
            <Avatar
              initials={post.initials}
              bg={post.avatarBg}
              color={post.avatarColor}
              size={32}
            />
            <View>
              <Text style={styles.handle}>@{post.creator}</Text>
              <Text style={styles.timestamp}>2 days ago</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postBody}>{post.body}</Text>

          <View style={styles.ratingsRow}>
            <View style={styles.ratingChip}>
              <Text style={styles.ratingLabel}>Food</Text>
              <Stars count={post.food} />
            </View>
            <View style={styles.ratingChip}>
              <Text style={styles.ratingLabel}>Vibe</Text>
              <Stars count={post.vibe} />
            </View>
            <View style={styles.ratingChip}>
              <Text style={styles.ratingLabel}>Cost</Text>
              <Dollars count={post.cost} />
            </View>
          </View>

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
              <Text style={styles.locationText}>{post.location}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.locationSaveBtn}
              onPress={() => requireAuth(toggleLocationSave)}
            >
              <BookmarkIcon size={14} filled={locationSaved} inactiveColor={colors.text3} />
            </TouchableOpacity>
          </View>

          <View style={styles.hashtags}>
            {post.tags.map(tag => (
              <Text key={tag} style={styles.hashtag}>
                #{tag}
              </Text>
            ))}
          </View>
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsHeading}>
            {comments.length > 0 ? `Comments (${comments.length})` : 'Comments'}
          </Text>
          {comments.map(c => {
            const username = c.users?.username ?? 'user'
            const palette = avatarPalette(username)
            return (
              <View key={c.id} style={styles.comment}>
                <Avatar
                  initials={username.slice(0, 2).toUpperCase()}
                  bg={palette.bg}
                  color={palette.color}
                  size={24}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentHandle}>@{username}</Text>
                  <Text style={styles.commentText}>{c.content}</Text>
                </View>
              </View>
            )
          })}
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
              router.push('/(tabs)/profile')
            }}
          >
            <Text style={styles.sheetBtnPrimaryText}>View saved posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetBtnSecondary} onPress={() => setSaveSheet(false)}>
            <Text style={styles.sheetBtnSecondaryText}>Stay here</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Comment input */}
      <View style={styles.commentInputBar}>
        <Avatar
          initials={user ? (user.email?.slice(0, 2).toUpperCase() ?? 'ME') : 'ME'}
          bg="#FAEEDA"
          color="#854F0B"
          size={28}
        />
        <TextInput
          ref={commentInputRef}
          style={styles.commentField}
          placeholder="Add a comment…"
          placeholderTextColor={colors.text3}
          value={comment}
          onChangeText={setComment}
          onFocus={() => requireAuth()}
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
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, marginLeft: -6 },
    backText: { fontSize: 14, color: c.text2 },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photo: {
      width: '100%',
      aspectRatio: 4 / 3,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    photoArrowLeft: {
      position: 'absolute',
      left: 12,
      top: '50%',
      marginTop: -18,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoArrowRight: {
      position: 'absolute',
      right: 12,
      top: '50%',
      marginTop: -18,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoArrowText: {
      color: '#fff',
      fontSize: 24,
      lineHeight: 28,
      fontWeight: '300',
      marginTop: -1,
    },
    photoDots: { position: 'absolute', bottom: 10, flexDirection: 'row', gap: 4 },
    dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.5)' },
    dotActive: { width: 14, borderRadius: 3, backgroundColor: '#fff' },
    actionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    actionsLeft: { flexDirection: 'row', gap: 16, alignItems: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
    actionCount: { fontSize: 11, color: c.text3 },
    followPill: {
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border2,
    },
    followPillActive: { backgroundColor: c.surface, borderColor: c.border },
    followText: { fontSize: 12, fontWeight: '500', color: c.text },
    followTextActive: { color: c.text2 },
    content: { padding: 14, paddingHorizontal: 16, paddingBottom: 0 },
    creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 11 },
    handle: { fontSize: 12, fontWeight: '500', color: c.text },
    timestamp: { fontSize: 10, color: c.text3, marginTop: 1 },
    postTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: c.text,
      lineHeight: 22,
      marginBottom: 9,
      letterSpacing: -0.1,
    },
    postBody: { fontSize: 13, color: c.text2, lineHeight: 21, marginBottom: 13 },
    ratingsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    ratingChip: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 8,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 7,
      paddingHorizontal: 10,
      gap: 4,
    },
    ratingLabel: { fontSize: 9, color: c.text3, textTransform: 'uppercase', letterSpacing: 0.6 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      backgroundColor: c.surface,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    locationText: { fontSize: 12, color: c.text2 },
    locationSaveBtn: { padding: 5 },
    hashtags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingBottom: 14 },
    hashtag: { fontSize: 12, color: c.info },
    commentsSection: {
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      padding: 12,
      paddingHorizontal: 16,
    },
    commentsHeading: { fontSize: 12, fontWeight: '500', color: c.text, marginBottom: 10 },
    noComments: { fontSize: 12, color: c.text3, textAlign: 'center', paddingVertical: 12 },
    comment: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    commentHandle: { fontSize: 11, fontWeight: '500', color: c.text },
    commentText: { fontSize: 12, color: c.text2, lineHeight: 18 },
    commentInputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
    commentField: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 13,
      color: c.text,
    },
    sendBtn: { padding: 4 },
    sheetBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 36,
      paddingTop: 12,
      alignItems: 'center',
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border2,
      marginBottom: 20,
    },
    sheetIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    sheetTitle: { fontSize: 16, fontWeight: '600', color: c.text, marginBottom: 6 },
    sheetBody: {
      fontSize: 13,
      color: c.text2,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 19,
    },
    sheetBtnPrimary: {
      width: '100%',
      backgroundColor: c.text,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 10,
    },
    sheetBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: c.bg },
    sheetBtnSecondary: {
      width: '100%',
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: c.border,
    },
    sheetBtnSecondaryText: { fontSize: 14, fontWeight: '500', color: c.text2 },
  })
}
