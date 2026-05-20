import React, { useMemo } from 'react'
import {
  View,
  TouchableOpacity,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { imgColors } from '@/constants/Colors'
import { ImagePlaceholder, PlusIcon, VideoIcon } from '@/components/icons'
import type { Post } from '@/types/domain'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

type Props = {
  posts: Post[]
  onLoadMore?: () => void
  loadingMore?: boolean
  hasMore?: boolean
}

export const ThumbGrid = React.memo(function ThumbGrid({
  posts,
  onLoadMore,
  loadingMore,
  hasMore,
}: Props) {
  const router = useRouter()
  const c = useThemeColors()
  const { width } = useWindowDimensions()
  const styles = useMemo(() => makeStyles(c), [c])
  const thumbSize = (width - 4) / 3

  if (posts.length === 0) return null

  return (
    <View>
      <View style={styles.grid}>
        {posts.map(post => {
          const mediaCount = post.media?.length ?? (post.imageUrl || post.videoUrl ? 1 : 0)
          const hasVideo = post.media?.some(item => item.type === 'video') || post.mediaType === 'video' || !!post.videoUrl
          return (
            <TouchableOpacity
              key={post.id}
              style={[styles.thumb, { width: thumbSize, height: thumbSize }]}
              onPress={() => router.push(`/posts/${post.dbId}`)}
              activeOpacity={0.8}
            >
              <View style={[styles.inner, { backgroundColor: imgColors[post.imgKey] }]}>
                {post.imageUrl ? (
                  <Image
                    source={{ uri: post.imageUrl }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                ) : post.videoUrl ? (
                  <View style={styles.videoFallback}>
                    <VideoIcon size={20} color={c.accent} />
                  </View>
                ) : (
                  <ImagePlaceholder size={20} />
                )}
                {(hasVideo || mediaCount > 1) && (
                  <View style={styles.badge}>
                    {hasVideo ? (
                      <VideoIcon size={10} color="#fff" /* check:tokens-ignore */ />
                    ) : (
                      <PlusIcon size={10} color="#fff" /* check:tokens-ignore */ />
                    )}
                    {mediaCount > 1 && <Text style={styles.badgeText}>{mediaCount}</Text>}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
      {(hasMore || loadingMore) && (
        <TouchableOpacity
          style={styles.loadMore}
          onPress={onLoadMore}
          disabled={loadingMore}
          activeOpacity={0.7}
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color={c.text3} />
          ) : (
            <Text style={styles.loadMoreText}>Load more</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
})

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px2, padding: spacing.px2 },
    thumb: { overflow: 'hidden' },
    inner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    badge: {
      position: 'absolute',
      right: 7,
      top: 7,
      minWidth: 22,
      height: 22,
      borderRadius: radius.md2,
      paddingHorizontal: spacing.px6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px3,
      backgroundColor: 'rgba(0,0,0,0.55)', // check:tokens-ignore
    },
    badgeText: { fontSize: fontSize.sm, color: '#fff', fontWeight: fontWeight.black }, // check:tokens-ignore
    videoFallback: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface2,
    },
    loadMore: { paddingVertical: spacing[4], alignItems: 'center' },
    loadMoreText: { fontSize: fontSize.base, color: c.text3 },
  })
}
