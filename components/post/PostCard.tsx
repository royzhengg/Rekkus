import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { Avatar } from '@/components/Avatar'
import { BookmarkIcon, HeartIcon, PinIcon } from '@/components/icons'
import { PostMediaCarousel } from '@/components/post/PostMediaCarousel'
import { PostPicksSummary } from '@/components/post/PostPicksSummary'
import type { Post } from '@/types/domain'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

type Props = {
  post: Post
  compact?: boolean
}

export function PostCard({ post, compact }: Props) {
  const router = useRouter()
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      activeOpacity={0.92}
      onPress={() => router.push(`/posts/${post.dbId || post.id}`)}
    >
      <PostMediaCarousel post={post} compact={compact} height={compact ? 188 : undefined} />
      <View style={styles.body}>
        <TouchableOpacity
          style={styles.creatorRow}
          onPress={() =>
            router.push({ pathname: '/user/[username]', params: { username: post.creator } })
          }
          activeOpacity={0.75}
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
          {post.best_dish || post.title}
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
              <Text key={tag} style={styles.tag}>#{tag}</Text>
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
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
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
