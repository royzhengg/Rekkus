import { useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { Avatar } from '@/components/Avatar'
import { BookmarkIcon, HeartIcon, PinIcon } from '@/components/icons'
import { PostMediaCarousel } from '@/components/post/PostMediaCarousel'
import { PostPicksSummary } from '@/components/post/PostPicksSummary'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { DUR_FAST, DUR_MID, SPRING_SNAPPY } from '@/lib/animations'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { usePressScale } from '@/lib/hooks/usePressScale'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import type { Post } from '@/types/domain'

const DOUBLE_TAP_MS = 280

type Props = {
  post: Post
  compact?: boolean | undefined
  onPressPost: (post: Post) => void
  onPressCreator: (username: string) => void
  onPressTag?: ((tag: string) => void) | undefined
  onDoubleTapLike?: (() => void) | undefined
  onLongPressPost?: (() => void) | undefined
  autoplayActive?: boolean | undefined
}

export function PostCard({ post, compact, onPressPost, onPressCreator, onPressTag, onDoubleTapLike, onLongPressPost, autoplayActive = false }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const press = usePressScale()
  const reduceMotion = useReducedMotion()
  const lastTapMs = useRef(0)
  const heartOpacity = useSharedValue(0)
  const heartScale = useSharedValue(0.3)
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }))

  function handlePress() {
    if (onDoubleTapLike) {
      const now = Date.now()
      const delta = now - lastTapMs.current
      lastTapMs.current = now
      if (delta < DOUBLE_TAP_MS) {
        lastTapMs.current = 0
        onDoubleTapLike()
        if (reduceMotion) return
        heartOpacity.value = 1
        heartScale.value = 0.3
        heartScale.value = withSpring(1.2, SPRING_SNAPPY, () => {
          heartScale.value = withTiming(1, { duration: DUR_FAST })
        })
        heartOpacity.value = withDelay(700, withTiming(0, { duration: DUR_MID }))
        return
      }
    }
    onPressPost(post)
  }

  return (
    <Animated.View
      {...(!reduceMotion ? { entering: FadeInDown.duration(DUR_MID).springify() } : {})}
      style={press.animatedStyle}
    >
      <TouchableOpacity
        style={[styles.card, compact && styles.cardCompact]}
        activeOpacity={1}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={handlePress}
        onLongPress={onLongPressPost}
        delayLongPress={380}
      >
      <View style={styles.mediaWrap}>
        <PostMediaCarousel post={post} compact={compact} height={compact ? 188 : undefined} autoplayActive={autoplayActive} />
        {onDoubleTapLike != null && (
          <Animated.View style={[styles.heartOverlay, heartStyle]} pointerEvents="none">
            <HeartIcon filled size={80} />
          </Animated.View>
        )}
      </View>
      <View style={styles.body}>
        <TouchableOpacity
          style={styles.creatorRow}
          onPress={() => onPressCreator(post.creator)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`View @${post.creator}'s profile`}
        >
          <Avatar initials={post.initials} bg={post.avatarBg} color={post.avatarColor} size={24} />
          <View style={styles.creatorCopy}>
            <Text style={styles.creatorText}>@{post.creator}</Text>
            {!!post.location && (
              <Text style={styles.creatorMeta} numberOfLines={1}>{post.location}</Text>
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={2}>
          {post.mustOrder || post.title}
        </Text>
        {!!post.body && (
          <Text style={styles.bodyText} numberOfLines={2}>
            {post.body}
          </Text>
        )}
        <PostPicksSummary post={post} compact />
        {!!post.location && (
          <View style={styles.placeRow}>
            <PinIcon size={11} color={c.text3} />
            <Text style={styles.placeText} numberOfLines={1}>{post.location}</Text>
          </View>
        )}
        {post.tags.length > 0 && (
          <View style={styles.tags}>
            {post.tags.slice(0, 3).map(tag => (
              <TouchableOpacity
                key={tag}
                onPress={() => onPressTag?.(tag)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Search for #${tag}`}
              >
                <Text style={styles.tag}>#{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={styles.footer}>
          <View style={styles.metricRow}>
            <HeartIcon size={12} />
            <Text style={styles.likeText}>{post.likes}</Text>
          </View>
          <BookmarkIcon size={13} inactiveColor={c.text3} />
        </View>
      </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    mediaWrap: { position: 'relative' },
    heartOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      overflow: 'hidden',
      backgroundColor: c.bg,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    cardCompact: {
      borderRadius: radius.sm3,
      borderWidth: 0.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    body: { padding: spacing[3], gap: spacing[2] },
    title: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.text, lineHeight: lineHeight.loose },
    bodyText: { fontSize: fontSize.base, color: c.text2, lineHeight: lineHeight.small },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    placeText: { flex: 1, fontSize: fontSize.bodySm, color: c.text3 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px5 },
    tag: {
      fontSize: fontSize.sm,
      color: c.info,
      fontWeight: fontWeight.extrabold,
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      overflow: 'hidden',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingTop: spacing[1],
      borderTopWidth: 0.5,
      borderTopColor: c.border,
    },
    creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    creatorCopy: { flex: 1, minWidth: 0 },
    creatorText: { fontSize: fontSize.bodySm, color: c.text, fontWeight: fontWeight.extrabold },
    creatorMeta: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px1 },
    metricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    likeText: { fontSize: fontSize.bodySm, color: c.text3, fontWeight: fontWeight.bold },
  })
}
