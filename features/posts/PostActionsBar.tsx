import { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { BookmarkIcon, CommentIcon, HeartIcon, ShareIcon } from '@/components/icons'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

type Props = {
  liked: boolean
  saved: boolean
  following: boolean
  isOwner: boolean
  likeCount: number
  commentCount: number
  onLike: () => void
  onComment: () => void
  onSave: () => void
  onShare: () => void
  onFollow: () => void
}

export function PostActionsBar({
  liked,
  saved,
  following,
  isOwner,
  likeCount,
  commentCount,
  onLike,
  onComment,
  onSave,
  onShare,
  onFollow,
}: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={styles.actionsBar}>
      <View style={styles.actionsLeft}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onLike}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike post' : 'Like post'}
        >
          <HeartIcon filled={liked} />
          <Text style={styles.actionCount}>{formatCount(likeCount)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onComment}
          accessibilityRole="button"
          accessibilityLabel="Comment on post"
        >
          <CommentIcon />
          <Text style={styles.actionCount}>{commentCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove saved post' : 'Save post'}
        >
          <BookmarkIcon filled={saved} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share post"
        >
          <ShareIcon />
        </TouchableOpacity>
      </View>
      {!isOwner && (
        <TouchableOpacity
          style={[styles.followPill, following && styles.followPillActive]}
          onPress={onFollow}
          accessibilityRole="button"
          accessibilityLabel={following ? 'Unfollow creator' : 'Follow creator'}
        >
          <Text style={[styles.followText, following && styles.followTextActive]}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    actionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px9,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    actionsLeft: { flexDirection: 'row', gap: spacing.px10, alignItems: 'center' },
    actionBtn: {
      minHeight: 44,
      minWidth: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[1],
      borderRadius: radius.lg3,
      paddingHorizontal: spacing.px7,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    actionCount: { fontSize: fontSize.sm, color: c.text3, fontWeight: fontWeight.extrabold },
    followPill: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.px14,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border2,
    },
    followPillActive: { backgroundColor: `${c.accent}12`, borderColor: `${c.accent}33` },
    followText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.extrabold, color: c.text },
    followTextActive: { color: c.text2 },
  })
}
