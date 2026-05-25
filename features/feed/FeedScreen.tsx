import { useScrollToTop } from '@react-navigation/native'
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
import { IconButton } from '@/components/ui/IconButton'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { SPRING_SNAPPY } from '@/lib/animations'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { demoUsers, demoCurrentUser } from '@/lib/dataSources/demoData'
import { haptic } from '@/lib/haptics'
import { useDiscover } from '@/lib/hooks/useDiscover'
import { useFollowingFeed } from '@/lib/hooks/useFollowingFeed'
import { routes } from '@/lib/routes'
import { togglePostLike, togglePostSave } from '@/lib/services/posts'
import type { Post } from '@/types/domain'

const FEED_PAGE_SIZE = 20

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<'Following' | 'Discover'>('Following')
  const { refresh, loadMore, hasMore } = usePosts()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const [longPressPost, setLongPressPost] = useState<Post | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [newPostCount, setNewPostCount] = useState(0)
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE)
  const lastTopPostId = useRef<string | null>(null)
  const { posts: followingPosts, isLoaded: followingLoaded } = useFollowingFeed()
  const discoverPosts = useDiscover()
  const activePosts = activeTab === 'Discover' ? discoverPosts : followingPosts
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const router = useRouter()

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
    void haptic.light()
    setActiveTab(tab)
    const layout = tabLayouts.current[tab]
    if (layout) {
      indicatorLeft.value = withSpring(layout.x, SPRING_SNAPPY)
      indicatorWidth.value = withSpring(layout.width, SPRING_SNAPPY)
    }
  }

  useEffect(() => {
    setVisibleCount(FEED_PAGE_SIZE)
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

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
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

  function handleLongPressAction(value: string) {
    const post = longPressPost
    setLongPressPost(null)
    if (!post) return
    if (value === 'like') {
      requireAuth(() => {
        if (!post.dbId || !user?.id) return
        togglePostLike(post.dbId, user.id, true).catch(() => {})
      })
      return
    }
    if (value === 'save') {
      requireAuth(() => {
        if (!post.dbId || !user?.id) return
        togglePostSave(post.dbId, user.id, true).catch(() => {})
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
        <Text style={styles.wordmark}>
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

      <View style={styles.tabs}>
        {(['Following', 'Discover'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={styles.tab}
            onPress={() => handleTabPress(tab)}
            onLayout={e => handleTabLayout(tab, e)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
        <Animated.View style={[styles.tabSlider, indicatorStyle]} />
      </View>

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
        <PostUploadProgress onGoToDraft={() => router.push('/(tabs)/create')} />
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
                >
                  <Text style={styles.suggestedName}>@{username}</Text>
                  <Text style={styles.suggestedMeta}>{profile.followers} followers</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.discoverCta} onPress={() => setActiveTab('Discover')}>
                <Text style={styles.discoverCtaText}>Find dishes in Discover</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.feedList}>
              {visiblePosts.map(post => (
                <RekkusPostCard
                  key={post.dbId || post.id}
                  post={post}
                  onPressPost={item => router.push(routes.postDetail(String(item.dbId || item.id)))}
                  onPressCreator={username => router.push(routes.userProfile(username))}
                  onPressTag={tag => router.push(routes.search(tag))}
                  onDoubleTapLike={() =>
                    requireAuth(() => {
                      if (!post.dbId || !user?.id) return
                      togglePostLike(post.dbId, user.id, true).catch(() => {})
                    })
                  }
                  onLongPressPost={() => setLongPressPost(post)}
                />
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
        title={longPressPost?.best_dish ?? longPressPost?.title ?? 'Post'}
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
  })
}
