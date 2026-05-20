import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { spacing } from '@/constants/Spacing'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import { useFollowingFeed } from '@/lib/hooks/useFollowingFeed'
import { useDiscover } from '@/lib/hooks/useDiscover'
import { analytics } from '@/lib/analytics'
import { demoUsers, demoCurrentUser } from '@/lib/dataSources/demoData'
import { BellIcon, MessageIcon } from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { PostCard as RekkusPostCard } from '@/components/post/PostCard'
import { PostUploadProgress } from '@/components/post/PostUploadProgress'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

const FEED_PAGE_SIZE = 20

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<'Following' | 'Discover'>('Following')
  const { refresh, loadMore, hasMore } = usePosts()
  const { user } = useAuth()
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

  function handleScroll(e: any) {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
    if (
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 200 &&
      visibleCount < activePosts.length
    ) {
      setVisibleCount(c => c + FEED_PAGE_SIZE)
      if (hasMore) loadMore()
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refresh()
    analytics.feedDiagnostic(user?.id ?? null, 'refresh', activeTab, visibleCount, activePosts.length)
    setRefreshing(false)
  }

  const suggestedPeople = useMemo(
    () => Object.entries(demoUsers).filter(([username]) => username !== demoCurrentUser.username),
    []
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>
          rekkus<Text style={styles.wordmarkDot}>.</Text>
        </Text>
        <View style={styles.topActions}>
          <IconButton accessibilityLabel="Open messages" onPress={() => router.push('/messages' as any)}>
            <MessageIcon size={18} />
          </IconButton>
          <IconButton accessibilityLabel="Open alerts" onPress={() => router.push('/(tabs)/alerts')}>
            <BellIcon />
          </IconButton>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['Following', 'Discover'] as const).map(tab => (
          <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
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
        <PostUploadProgress />
        {activeTab === 'Following' && followingLoaded && followingPosts.length === 0 ? (
          <View>
            <EmptyState
              title="Your feed is empty"
              subtitle={'Follow useful reviewers to see their food finds here.'}
            />
            <View style={styles.suggestedWrap}>
              {suggestedPeople.slice(0, 5).map(([username, profile]) => (
                <TouchableOpacity
                  key={username}
                  style={styles.suggestedRow}
                  onPress={() =>
                    router.push({ pathname: '/user/[username]', params: { username } })
                  }
                >
                  <Text style={styles.suggestedName}>@{username}</Text>
                  <Text style={styles.suggestedMeta}>{profile.followers} followers</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.discoverCta} onPress={() => setActiveTab('Discover')}>
                <Text style={styles.discoverCtaText}>Explore Discover</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.feedList}>
              {visiblePosts.map(post => (
                <RekkusPostCard key={post.dbId || post.id} post={post} />
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
    tabUnderline: {
      position: 'absolute',
      bottom: -0.5,
      left: 0,
      right: 0,
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
