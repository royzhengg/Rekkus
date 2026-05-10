import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Image,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { imgColors } from '@/constants/Colors'
import { useThemeColors } from '@/lib/ThemeContext'
import { usePosts } from '@/lib/PostsContext'
import { useFollowingFeed } from '@/lib/hooks/useFollowingFeed'
import { useDiscover } from '@/lib/hooks/useDiscover'
import { BellIcon, HeartIcon, ImagePlaceholder } from '@/components/icons'
import type { Post } from '@/lib/data'

const PostCard = React.memo(function PostCard({
  post,
  colWidth,
}: {
  post: Post
  colWidth: number
}) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const imgH = post.tall ? colWidth * (5 / 3) : colWidth * (4 / 3)

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => router.push(`/post/${post.id}`)}
    >
      <View style={[styles.cardImg, { height: imgH, backgroundColor: imgColors[post.imgKey] }]}>
        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            resizeMode="cover"
          />
        ) : (
          <ImagePlaceholder size={24} />
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {post.title}
        </Text>
        <View style={styles.cardMeta}>
          <TouchableOpacity
            style={styles.creatorRow}
            onPress={() =>
              router.push({ pathname: '/user/[username]', params: { username: post.creator } })
            }
            activeOpacity={0.7}
          >
            <View style={[styles.avatarSm, { backgroundColor: post.avatarBg }]}>
              <Text style={[styles.avatarSmText, { color: post.avatarColor }]}>
                {post.initials}
              </Text>
            </View>
            <Text style={styles.creatorName}>@{post.creator}</Text>
          </TouchableOpacity>
          <View style={styles.likeCount}>
            <HeartIcon size={10} />
            <Text style={styles.likeText}>{post.likes}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
})

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<'Following' | 'Discover'>('Following')
  const { refresh } = usePosts()
  const [refreshing, setRefreshing] = useState(false)
  const followingPosts = useFollowingFeed()
  // TODO: pass followingIds once Following is filtered to followed users only
  const discoverPosts = useDiscover()
  const activePosts = activeTab === 'Discover' ? discoverPosts : followingPosts
  const { width } = useWindowDimensions()
  const colWidth = (width - 16 - 6) / 2
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const router = useRouter()

  const leftCol = activePosts.filter((_: Post, i: number) => i % 2 === 0)
  const rightCol = activePosts.filter((_: Post, i: number) => i % 2 === 1)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>
          rekkus<Text style={styles.wordmarkDot}>.</Text>
        </Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/alerts')}>
          <BellIcon />
        </TouchableOpacity>
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
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true)
              refresh()
              setRefreshing(false)
            }}
            tintColor={colors.text}
          />
        }
      >
        <View style={[styles.col, { width: colWidth }]}>
          {leftCol.map(post => (
            <PostCard key={post.id} post={post} colWidth={colWidth} />
          ))}
        </View>
        <View style={[styles.col, { width: colWidth }]}>
          {rightCol.map(post => (
            <PostCard key={post.id} post={post} colWidth={colWidth} />
          ))}
        </View>
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
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    wordmark: {
      fontFamily: 'DMSerifDisplay-Regular',
      fontSize: 22,
      color: c.text,
      letterSpacing: -0.5,
    },
    wordmarkDot: { color: c.accent },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 24,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    tab: { paddingVertical: 10, position: 'relative' },
    tabText: { fontSize: 13, color: c.text3 },
    tabTextActive: { color: c.text, fontWeight: '500' },
    tabUnderline: {
      position: 'absolute',
      bottom: -0.5,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: c.text,
      borderRadius: 1,
    },
    scroll: { flex: 1 },
    grid: { flexDirection: 'row', gap: 6, padding: 8, alignItems: 'flex-start' },
    col: { gap: 6 },
    card: {
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    cardImg: { alignItems: 'center', justifyContent: 'center' },
    cardInfo: { padding: 7, paddingHorizontal: 9, paddingBottom: 8 },
    cardTitle: { fontSize: 11.5, color: c.text, lineHeight: 16, marginBottom: 6 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    avatarSm: {
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarSmText: { fontSize: 6.5, fontWeight: '600' },
    creatorName: { fontSize: 10, color: c.text2 },
    likeCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    likeText: { fontSize: 10, color: c.text3 },
  })
}
