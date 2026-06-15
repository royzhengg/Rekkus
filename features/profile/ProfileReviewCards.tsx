import React, { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SaveIcon, CommentIcon, HeartIcon, ImagePlaceholder } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { parseLikes } from '@/lib/utils/format'
import type { Post } from '@/types/domain'

type Props = {
  posts: Post[]
  onPressPost: (post: Post) => void
  hasMore?: boolean
  onLoadMore?: () => void
}

function relativeLabel(createdAt: string | undefined): string {
  if (!createdAt) return ''
  const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000))
  if (days <= 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

export function ProfileReviewCards({ posts, onPressPost, hasMore, onLoadMore }: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  if (posts.length === 0) return null

  return (
    <View style={styles.list}>
      {posts.map(post => (
        <TouchableOpacity
          key={post.dbId || post.id}
          style={styles.card}
          onPress={() => onPressPost(post)}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={`Open review for ${post.location}`}
        >
          <View style={styles.image}>
            {post.imageUrl ? (
              <CachedImage source={{ uri: post.imageUrl }} style={StyleSheet.absoluteFillObject} />
            ) : (
              <ImagePlaceholder size={24} color={colors.text3} />
            )}
          </View>
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                {post.location}
              </Text>
              <Text style={styles.time} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                {relativeLabel(post.createdAt)}
              </Text>
            </View>
            <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              {[post.cuisine_type, post.address?.split(',')[0]].filter(Boolean).join(' • ')}
            </Text>
            <Text style={styles.rating} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              ★★★★★ {post.food?.toFixed(1) ?? '—'}
            </Text>
            <Text style={styles.body} numberOfLines={3} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
              {post.body || post.mustOrder || post.title}
            </Text>
            <View style={styles.actions}>
              <View style={styles.metric}>
                <HeartIcon size={18} />
                <Text style={styles.metricText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                  {parseLikes(post.likes)}
                </Text>
              </View>
              <View style={styles.metric}>
                <CommentIcon size={18} />
                <Text style={styles.metricText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                  {post.tags.length}
                </Text>
              </View>
              <View style={styles.saveIcon}>
                <SaveIcon size={18} inactiveColor={colors.text3} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ))}
      {hasMore ? (
        <TouchableOpacity style={styles.loadMore} onPress={onLoadMore} accessibilityRole="button">
          <Text style={styles.loadMoreText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            Load more
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    list: { paddingHorizontal: spacing[4], paddingTop: spacing[3], gap: spacing[3], paddingBottom: spacing[5] },
    card: {
      flexDirection: 'row',
      gap: spacing[3],
      backgroundColor: c.bg,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing[3],
    },
    image: {
      width: 110,
      aspectRatio: 1,
      borderRadius: radius.md,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface2,
    },
    content: { flex: 1, gap: spacing[1] },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    title: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
    time: { fontSize: fontSize.bodySm, color: c.text3 },
    meta: { fontSize: fontSize.base, color: c.text3 },
    rating: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.accent },
    body: { fontSize: fontSize.base, lineHeight: lineHeight.normal, color: c.text2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingTop: spacing[2] },
    metric: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    metricText: { fontSize: fontSize.bodySm, color: c.text3 },
    saveIcon: { marginLeft: 'auto' },
    loadMore: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    loadMoreText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text3 },
  })
}
