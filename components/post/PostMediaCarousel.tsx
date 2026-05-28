import { VideoView } from 'expo-video'
import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native'
import { ImagePlaceholder, VideoIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { usePostVideoPlayback } from '@/lib/hooks/usePostVideoPlayback'
import type { Post, PostMediaAsset } from '@/types/domain'

function VideoSlide({ uri, height, autoplayActive }: { uri: string; height: number; autoplayActive: boolean }) {
  const player = usePostVideoPlayback(uri, { autoplayActive })
  return (
    <VideoView
      style={{ width: '100%', height }}
      player={player}
      contentFit="cover"
      nativeControls
      accessible
      accessibilityLabel="Post video"
    />
  )
}

type Props = {
  post?: Post | undefined
  media?: PostMediaAsset[] | undefined
  height?: number | undefined
  compact?: boolean | undefined
  autoplayActive?: boolean | undefined
}

function resolvePostMedia(post?: Post, media?: PostMediaAsset[]): PostMediaAsset[] {
  if (media?.length) return media
  if (post?.media?.length) return post.media
  if (post?.imageUrl) {
    return [{ localId: `image-${post.dbId || post.id}`, uri: post.imageUrl, type: 'image', processingStatus: 'ready' }]
  }
  if (post?.videoUrl) {
    return [{ localId: `video-${post.dbId || post.id}`, uri: post.videoUrl, type: 'video', processingStatus: 'ready' }]
  }
  return []
}

export function PostMediaCarousel({ post, media, height, compact, autoplayActive = false }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const items = resolvePostMedia(post, media)
  const slideHeight = height ?? (compact ? width * 0.72 : width * 0.9)

  if (items.length === 0) {
    return (
      <View style={[styles.empty, { height: slideHeight }]}>
        <ImagePlaceholder size={compact ? 24 : 42} color={c.text3} />
      </View>
    )
  }

  return (
    <View style={[styles.wrap, { height: slideHeight }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {items.map((item, itemIndex) => {
          const uri = item.processedUrl ?? item.thumbnailUrl ?? item.uri
          return (
            <View key={item.localId || uri} style={{ width, height: slideHeight }}>
              {item.type === 'image' ? (
                <CachedImage source={{ uri }} style={StyleSheet.absoluteFillObject} />
              ) : uri ? (
                <VideoSlide
                  uri={item.processedUrl ?? item.uri}
                  height={slideHeight}
                  autoplayActive={autoplayActive && itemIndex === index}
                />
              ) : (
                <View style={styles.videoFallback}>
                  <VideoIcon size={compact ? 24 : 42} color={c.accent} />
                </View>
              )}
              {item.type === 'video' && (
                <View style={styles.videoBadge}>
                  <VideoIcon size={11} color="#fff" /* check:tokens-ignore */ />
                  <Text style={styles.videoBadgeText}>Video</Text>
                </View>
              )}
              {item.processingStatus && !['ready', 'local_ready'].includes(item.processingStatus) && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{item.processingStatus === 'failed' ? 'Needs attention' : 'Preparing'}</Text>
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
      {items.length > 1 && (
        <>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{index + 1}/{items.length}</Text>
          </View>
          <View style={styles.dots}>
            {items.map((item, i) => (
              <View key={item.localId || i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </>
      )}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    wrap: { backgroundColor: c.surface2, overflow: 'hidden' },
    empty: { backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
    videoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
    videoBadge: {
      position: 'absolute',
      left: 10,
      top: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      borderRadius: radius.lg,
      backgroundColor: 'rgba(0,0,0,0.55)', // check:tokens-ignore
      paddingHorizontal: spacing[2],
      paddingVertical: spacing.px5,
    },
    videoBadgeText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold }, // check:tokens-ignore
    statusBadge: {
      position: 'absolute',
      right: 10,
      top: 10,
      borderRadius: radius.lg,
      backgroundColor: 'rgba(0,0,0,0.55)', // check:tokens-ignore
      paddingHorizontal: spacing.px9,
      paddingVertical: spacing.px5,
    },
    statusText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold }, // check:tokens-ignore
    countBadge: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      borderRadius: radius.lg,
      backgroundColor: 'rgba(0,0,0,0.55)', // check:tokens-ignore
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
    },
    countText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold }, // check:tokens-ignore
    dots: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.px5,
    },
    dot: { width: 5, height: 5, borderRadius: radius.tiny, backgroundColor: 'rgba(255,255,255,0.45)' }, // check:tokens-ignore
    dotActive: { width: 14, backgroundColor: c.white },
  })
}
