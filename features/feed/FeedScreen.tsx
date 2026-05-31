import AsyncStorage from '@react-native-async-storage/async-storage'
import { useIsFocused, useScrollToTop } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BellIcon, BookmarkIcon, HeartIcon, MessageIcon, ShareIcon } from '@/components/icons'
import { PostCard as RekkusPostCard } from '@/components/post/PostCard'
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton'
import { PostUploadProgress } from '@/components/post/PostUploadProgress'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { IconButton } from '@/components/ui/IconButton'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { SPRING_SNAPPY } from '@/lib/animations'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { demoUsers, demoCurrentUser } from '@/lib/dataSources/demoData'
import { haptic } from '@/lib/haptics'
import { useDiscover } from '@/lib/hooks/useDiscover'
import { useFollowingFeed } from '@/lib/hooks/useFollowingFeed'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { routes } from '@/lib/routes'
import type { Post } from '@/types/domain'

const FEED_PAGE_SIZE = 20
const FIRST_FEED_VISIT_KEY = 'rekkus:first-feed-visit:v1'

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<'Following' | 'Discover'>('Following')
  const { refresh, loadMore, hasMore } = usePosts()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const { runDeferredMutation } = useConnectivity()
  const [longPressPost, setLongPressPost] = useState<Post | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showNewUserNudge, setShowNewUserNudge] = useState(false)
  const [newPostCount, setNewPostCount] = useState(0)
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE)
  const [operationError, setOperationError] = useState<string | null>(null)
  const lastTopPostId = useRef<string | null>(null)
  const { posts: followingPosts, isLoaded: followingLoaded } = useFollowingFeed()
  const discoverPosts = useDiscover()
  const activePosts = activeTab === 'Discover' ? discoverPosts : followingPosts
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const isFocused = useIsFocused()
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null)
  const cardLayouts = useRef<Record<string, { y: number; height: number }>>({})

  // B-410: scroll-to-top when feed tab is re-tapped
  const scrollRef = useRef<ScrollView>(null)
  useScrollToTop(scrollRef)

  // B-406: animated sliding tab indicator
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({})
  const indicatorLeft = useSharedValue(0)
  const indicatorWidth = useSharedValue(0)
  const indicatorStyle = useAnimatedStyle(() => ({
    left: indicatorLeft.value,
    width: indicatorWidth.value,
  }))

  function handleTabLayout(tab: string, e: LayoutChangeEvent) {
    const { x, width } = e.nativeEvent.layout
    tabLayouts.current[tab] = { x, width }
    if (tab === activeTab) {
      indicatorLeft.value = x
      indicatorWidth.value = width
    }
  }

  function handleTabPress(tab: 'Following' | 'Discover') {
    setActiveTab(tab)
    const layout = tabLayouts.current[tab]
    if (layout) {
      indicatorLeft.value = reduceMotion ? layout.x : withSpring(layout.x, SPRING_SNAPPY)
      indicatorWidth.value = reduceMotion ? layout.width : withSpring(layout.width, SPRING_SNAPPY)
    }
  }

  useEffect(() => {
    setVisibleCount(FEED_PAGE_SIZE)
    cardLayouts.current = {}
    setVisiblePostId(null)
  }, [activeTab])

  const visiblePosts = useMemo(
    () => activePosts.slice(0, visibleCount),
    [activePosts, visibleCount]
  )
  const hasMoreFeed = visibleCount < activePosts.length

  useEffect(() => {
    analytics.feedDiagnostic(
      user?.id ?? null,
      'view',
      activeTab,
      visiblePosts.length,
      activePosts.length
    )
  }, [activeTab, activePosts.length, user?.id, visiblePosts.length])

  useEffect(() => {
    const topId = activePosts[0] ? activePosts[0].dbId || String(activePosts[0].id) : null
    if (lastTopPostId.current && topId && topId !== lastTopPostId.current) {
      setNewPostCount(1)
    }
    lastTopPostId.current = topId
  }, [activePosts])

  // Fire once on mount: check if this is the user's first feed visit after onboarding
  useEffect(() => {
    void AsyncStorage.getItem(FIRST_FEED_VISIT_KEY).then(val => {
      if (val) {
        setShowNewUserNudge(true)
        void AsyncStorage.removeItem(FIRST_FEED_VISIT_KEY)
      }
    })
  }, [])

  useEffect(() => {
    if (showNewUserNudge) {
      analytics.onboardingStep(user?.id ?? null, 'first_feed_nudge', 'shown')
    }
  }, [showNewUserNudge, user?.id])

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
    const viewportCenter = contentOffset.y + layoutMeasurement.height / 2
    const visibleCard = visiblePosts.find(post => {
      const layout = cardLayouts.current[String(post.dbId || post.id)]
      return layout && viewportCenter >= layout.y && viewportCenter < layout.y + layout.height
    })
    if (visibleCard) setVisiblePostId(String(visibleCard.dbId || visibleCard.id))
    if (
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 200 &&
      visibleCount < activePosts.length
    ) {
      setVisibleCount(c => c + FEED_PAGE_SIZE)
      if (hasMore) void loadMore()
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refresh()
    analytics.feedDiagnostic(user?.id ?? null, 'refresh', activeTab, visibleCount, activePosts.length)
    setRefreshing(false)
  }

  function dismissNewUserNudge(action: 'post' | 'explore' | 'dismiss') {
    setShowNewUserNudge(false)
    analytics.onboardingStep(user?.id ?? null, 'first_feed_nudge', action === 'post' ? 'tapped_post' : action === 'explore' ? 'tapped_explore' : 'dismissed')
  }

  function handleLongPressAction(value: string) {
    const post = longPressPost
    setLongPressPost(null)
    if (!post) return
    if (value === 'like') {
      requireAuth(() => {
        if (!post.dbId || !user?.id) return
        void runDeferredMutation({ kind: 'post_like', postId: post.dbId, targetState: true })
          .then(() => { void haptic.confirmLike() })
          .catch(() => setOperationError('Could not update like. Check your connection and try again.'))
      })
      return
    }
    if (value === 'save') {
      requireAuth(() => {
        if (!post.dbId || !user?.id) return
        void runDeferredMutation({
          kind: 'post_save',
          postId: post.dbId,
          targetState: true,
          cuisineType: post.cuisine_type ?? null,
        })
          .then(() => { void haptic.confirmSave() })
          .catch(() => setOperationError('Could not save this post. Check your connection and try again.'))
      })
      return
    }
    if (value === 'creator') {
      router.push(routes.userProfile(post.creator))
      return
    }
    if (value === 'open') {
      router.push(routes.postDetail(String(post.dbId || post.id)))
    }
  }

  const suggestedPeople = Object.entries(demoUsers).filter(
    ([username]) => username !== demoCurrentUser.username
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          rekkus<Text style={styles.wordmarkDot}>.</Text>
        </Text>
        <View style={styles.topActions}>
          <IconButton accessibilityLabel="Open messages" onPress={() => router.push('/messages')}>
            <MessageIcon size={18} />
          </IconButton>
          <IconButton accessibilityLabel="Open alerts" onPress={() => router.push('/(tabs)/alerts')}>
            <BellIcon />
          </IconButton>
        </View>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['Following', 'Discover'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={styles.tab}
            onPress={() => handleTabPress(tab)}
            onLayout={e => handleTabLayout(tab, e)}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: activeTab === tab }}
            hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{tab}</Text>
          </TouchableOpacity>
        ))}
        <Animated.View
          style={[styles.tabSlider, indicatorStyle]}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
      </View>

      {showNewUserNudge && (
        <View style={styles.nudgeBanner}>
          <View style={styles.nudgeText}>
            <Text style={styles.nudgeTitle} maxFontSizeMultiplier={1.3}>Welcome to Rekkus.</Text>
            <Text style={styles.nudgeSubtitle} maxFontSizeMultiplier={1.5}>Post a dish or explore what's nearby.</Text>
          </View>
          <View style={styles.nudgeActions}>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => { dismissNewUserNudge('post'); router.push(routes.createPost()) }}
              accessibilityRole="button"
              accessibilityLabel="Post a dish review"
            >
              <Text style={styles.nudgeBtnText}>Post a dish</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nudgeBtn, styles.nudgeBtnSecondary]}
              onPress={() => { dismissNewUserNudge('explore'); setActiveTab('Discover') }}
              accessibilityRole="button"
              accessibilityLabel="Explore nearby dishes"
            >
              <Text style={[styles.nudgeBtnText, styles.nudgeBtnTextSecondary]}>Explore nearby</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.nudgeDismiss}
            onPress={() => dismissNewUserNudge('dismiss')}
            accessibilityRole="button"
            accessibilityLabel="Dismiss welcome message"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.nudgeDismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={400}
        onScroll={handleScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text}
          />
        }
      >
        {newPostCount > 0 && (
          <Chip
            label={newPostCount === 1 ? '1 new post' : `${newPostCount} new posts`}
            selected
            variant="active"
            onPress={() => setNewPostCount(0)}
            style={styles.newPostsChip}
          />
        )}
        <PostUploadProgress onGoToDraft={() => router.push(routes.createPost())} />
        {operationError ? <ErrorMessage message={operationError} style={styles.actionError} /> : null}
        {activeTab === 'Following' && !followingLoaded ? (
          <View style={styles.feedList}>
            {Array.from({ length: 4 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </View>
        ) : activeTab === 'Following' && followingLoaded && followingPosts.length === 0 ? (
          <View>
            <EmptyState
              title="Start with food worth saving"
              subtitle="Follow people with useful taste, or jump into Discover for dishes nearby."
            />
            <View style={styles.suggestedWrap}>
              {suggestedPeople.slice(0, 5).map(([username, profile]) => (
                <TouchableOpacity
                  key={username}
                  style={styles.suggestedRow}
                  onPress={() => router.push(routes.userProfile(username))}
                  accessibilityRole="button"
                  accessibilityLabel={`View @${username}'s profile`}
                  hitSlop={{ top: 3, bottom: 3, left: 0, right: 0 }}
                >
                  <Text style={styles.suggestedName}>@{username}</Text>
                  <Text style={styles.suggestedMeta}>{profile.followers} followers</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.discoverCta}
                onPress={() => setActiveTab('Discover')}
                accessibilityRole="button"
                accessibilityLabel="Find dishes in Discover"
                hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
              >
                <Text style={styles.discoverCtaText}>Find dishes in Discover</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.feedList}>
              {visiblePosts.map(post => (
                <View
                  key={post.dbId || post.id}
                  onLayout={event => {
                    const key = String(post.dbId || post.id)
                    cardLayouts.current[key] = event.nativeEvent.layout
                    if (visiblePostId === null && post === visiblePosts[0]) setVisiblePostId(key)
                  }}
                >
                  <RekkusPostCard
                    post={post}
                    autoplayActive={isFocused && visiblePostId === String(post.dbId || post.id)}
                    onPressPost={item => router.push(routes.postDetail(String(item.dbId || item.id)))}
                    onPressCreator={username => router.push(routes.userProfile(username))}
                    onPressTag={tag => router.push(routes.search(tag))}
                    onDoubleTapLike={() =>
                      requireAuth(() => {
                        if (!post.dbId || !user?.id) return
                        void runDeferredMutation({ kind: 'post_like', postId: post.dbId, targetState: true })
                          .then(() => { void haptic.confirmLike() })
                          .catch(() => setOperationError('Could not update like. Check your connection and try again.'))
                      })
                    }
                    onLongPressPost={() => setLongPressPost(post)}
                  />
                </View>
              ))}
            </View>
            {hasMoreFeed && (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color={colors.text3} />
              </View>
            )}
          </>
        )}
      </ScrollView>
      <RekkusActionSheet
        visible={!!longPressPost}
        title={longPressPost?.mustOrder ?? longPressPost?.title ?? 'Post'}
        subtitle={longPressPost ? `by @${longPressPost.creator}` : undefined}
        options={[
          { label: 'Open post', value: 'open' },
          { label: 'Like', value: 'like', icon: <HeartIcon size={18} /> },
          { label: 'Save', value: 'save', icon: <BookmarkIcon size={18} /> },
          { label: longPressPost ? `Go to @${longPressPost.creator}` : 'Go to creator', value: 'creator', icon: <ShareIcon size={18} /> },
        ]}
        onSelect={handleLongPressAction}
        onDismiss={() => setLongPressPost(null)}
      />
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    wordmark: {
      fontFamily: 'DMSerifDisplay-Regular',
      fontSize: fontSize['3xl'],
      color: c.text,
      letterSpacing: -0.5,
    },
    wordmarkDot: { color: c.accent },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: spacing[4],
      gap: spacing[6],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    tab: { paddingVertical: spacing.px10, position: 'relative' },
    tabText: { fontSize: fontSize.base, color: c.text3 },
    tabTextActive: { color: c.text, fontWeight: fontWeight.medium },
    tabSlider: {
      position: 'absolute',
      bottom: -0.5,
      height: 2,
      backgroundColor: c.text,
      borderRadius: radius.micro,
    },
    scroll: { flex: 1 },
    actionError: { marginHorizontal: spacing[4], marginTop: spacing[3] },
    newPostsChip: {
      alignSelf: 'center',
      marginTop: spacing[3],
    },
    suggestedWrap: { paddingHorizontal: spacing[4], paddingBottom: spacing[6], gap: spacing[2] },
    suggestedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      paddingVertical: spacing.px11,
    },
    suggestedName: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    suggestedMeta: { fontSize: fontSize.sm, color: c.text3 },
    discoverCta: {
      marginTop: spacing[2],
      borderRadius: radius.xl,
      backgroundColor: c.text,
      alignItems: 'center',
      paddingVertical: spacing.px10,
    },
    discoverCtaText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.bg },
    grid: { flexDirection: 'row', gap: spacing.px6, padding: spacing[2], alignItems: 'flex-start' },
    feedList: { paddingTop: spacing[2] },
    loadingFooter: { paddingVertical: spacing[5], alignItems: 'center' },
    col: { gap: spacing.px6 },
    card: {
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    cardImg: { alignItems: 'center', justifyContent: 'center' },
    videoFallback: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface2,
    },
    cardInfo: { padding: spacing.px7, paddingHorizontal: spacing.px9, paddingBottom: spacing[2] },
    cardTitle: { fontSize: fontSize.sm2, color: c.text, lineHeight: lineHeight.tight, marginBottom: spacing.px6 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    avatarSm: {
      width: 16,
      height: 16,
      borderRadius: radius.sm3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarSmText: { fontSize: fontSize.micro, fontWeight: fontWeight.semibold },
    creatorName: { fontSize: fontSize.xs, color: c.text2 },
    likeCount: { flexDirection: 'row', alignItems: 'center', gap: spacing.px3 },
    likeText: { fontSize: fontSize.xs, color: c.text3 },
    nudgeBanner: {
      marginHorizontal: spacing[4],
      marginTop: spacing[3],
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing[4],
      borderWidth: 0.5,
      borderColor: c.border,
    },
    nudgeText: { marginBottom: spacing[3] },
    nudgeTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text, marginBottom: spacing[1] },
    nudgeSubtitle: { fontSize: fontSize.bodySm, color: c.text2 },
    nudgeActions: { flexDirection: 'row', gap: spacing[2] },
    nudgeBtn: {
      flex: 1,
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px10,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    nudgeBtnSecondary: { backgroundColor: c.bg, borderWidth: 0.5, borderColor: c.border2 },
    nudgeBtnText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.bg },
    nudgeBtnTextSecondary: { color: c.text },
    nudgeDismiss: { position: 'absolute', top: spacing[3], right: spacing[3], minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    nudgeDismissText: { fontSize: fontSize.bodySm, color: c.text3 },
  })
}
