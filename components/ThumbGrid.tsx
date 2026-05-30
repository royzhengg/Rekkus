import React, { useMemo, useState } from 'react'
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native'
import { ImagePlaceholder, PlusIcon, VideoIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { imgColors } from '@/constants/Colors'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import type { Post } from '@/types/domain'

type Props = {
  posts: Post[]
  onLoadMore?: () => void
  loadingMore?: boolean
  hasMore?: boolean
  onPressPost?: (post: Post) => void
}

export const ThumbGrid = React.memo(function ThumbGrid({
  posts,
  onLoadMore,
  loadingMore,
  hasMore,
  onPressPost,
}: Props) {
  const c = useThemeColors()
  const reduceMotion = useReducedMotion()
  const { width } = useWindowDimensions()
  const styles = useMemo(() => makeStyles(c), [c])
  const thumbSize = (width - 4) / 3
  const [peekPost, setPeekPost] = useState<Post | null>(null)

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
              onPress={() => onPressPost?.(post)}
              onLongPress={() => setPeekPost(post)}
              delayLongPress={400}
              activeOpacity={0.8}
            >
              <View style={[styles.inner, { backgroundColor: imgColors[post.imgKey] }]}>
                {post.imageUrl ? (
                  <CachedImage
                    source={{ uri: post.imageUrl }}
                    style={StyleSheet.absoluteFillObject}
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
          accessibilityRole="button"
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color={c.text3} />
          ) : (
            <Text style={styles.loadMoreText}>Load more</Text>
          )}
        </TouchableOpacity>
      )}
      <Modal
        visible={!!peekPost}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setPeekPost(null)}
        accessibilityViewIsModal
      >
        <Pressable style={styles.peekBackdrop} onPress={() => setPeekPost(null)} accessibilityRole="button" accessibilityLabel="Close preview">
          <View style={[styles.peekCard, { width: width * 0.82 }]}>
            {peekPost?.imageUrl ? (
              <CachedImage
                source={{ uri: peekPost.imageUrl }}
                style={[styles.peekImage, { height: width * 0.82 }]}
              />
            ) : (
              <View style={[styles.peekImageFallback, { height: width * 0.82, backgroundColor: imgColors[peekPost?.imgKey ?? 0] }]}>
                <ImagePlaceholder size={32} />
              </View>
            )}
            <View style={styles.peekInfo}>
              <Text style={styles.peekTitle} numberOfLines={2}>
                {peekPost?.mustOrder ?? peekPost?.title ?? ''}
              </Text>
              <Text style={styles.peekCreator}>@{peekPost?.creator ?? ''}</Text>
            </View>
          </View>
        </Pressable>
      </Modal>
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
    peekBackdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    peekCard: {
      borderRadius: radius.lg3,
      overflow: 'hidden',
      backgroundColor: c.bg,
    },
    peekImage: { width: '100%' },
    peekImageFallback: { width: '100%', alignItems: 'center', justifyContent: 'center' },
    peekInfo: { padding: spacing[3], gap: spacing[1] },
    peekTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
    peekCreator: { fontSize: fontSize.bodySm, color: c.text3 },
  })
}
