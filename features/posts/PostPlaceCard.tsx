import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Avatar } from '@/components/Avatar'
import { SaveIcon, PinIcon } from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { routes } from '@/lib/routes'
import type { Post } from '@/types/domain'

type Props = {
  post: Post
  locationSaved: boolean
  locationLoading: boolean
  onLocationPress: () => void
  onSaveLocation: () => void
  onHashtagPress: (tag: string) => void
  onDishPress?: (() => void) | undefined
  onAddToCollection?: (() => void) | undefined
}

export function PostPlaceCard({
  post,
  locationSaved,
  locationLoading,
  onLocationPress,
  onSaveLocation,
  onHashtagPress,
  onDishPress,
  onAddToCollection,
}: Props) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={styles.content}>
      <TouchableOpacity
        style={styles.creatorRow}
        onPress={() =>
          router.push(routes.userProfile(post.creator))
        }
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Open @${post.creator}'s profile`}
      >
        <Avatar initials={post.initials} bg={post.avatarBg} color={post.avatarColor} size={32} />
        <View>
          <Text style={styles.handle}>@{post.creator}</Text>
          <Text style={styles.timestamp}>2 days ago</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.postTitle}>{post.title}</Text>
      <Text style={styles.postBody}>{post.body}</Text>

      {(post.dishId && post.mustOrder && onDishPress) || onAddToCollection ? (
        <View style={styles.dishActions}>
          {post.dishId && post.mustOrder && onDishPress ? (
            <Chip
              label={post.mustOrder}
              onPress={onDishPress}
              accessibilityLabel={`Open dish ${post.mustOrder}`}
              style={styles.actionChip}
            />
          ) : null}
          {onAddToCollection ? (
            <Chip label="Add to collection" onPress={onAddToCollection} style={styles.actionChip} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.locationRow}>
        <TouchableOpacity
          style={styles.locationPill}
          onPress={onLocationPress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${post.location}`}
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color={colors.text3} style={styles.locationSpinner} />
          ) : (
            <PinIcon size={11} />
          )}
          <Text style={styles.locationText}>{post.location}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.locationSaveBtn}
          onPress={onSaveLocation}
          accessibilityRole="button"
          accessibilityLabel={locationSaved ? 'Remove saved location' : 'Save location'}
        >
          <SaveIcon size={14} filled={locationSaved} inactiveColor={colors.text3} />
        </TouchableOpacity>
      </View>

      <View style={styles.hashtags}>
        {post.tags.map(tag => (
          <TouchableOpacity
            key={tag}
            style={styles.hashtagPill}
            onPress={() => onHashtagPress(tag)}
            accessibilityRole="button"
            accessibilityLabel={`Search ${tag}`}
          >
            <Text style={styles.hashtag}>#{tag}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    content: { padding: spacing.px14, paddingHorizontal: spacing[4], paddingBottom: spacing[0] },
    creatorRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px9,
      marginBottom: spacing.px11,
    },
    handle: { fontSize: fontSize.bodySm, fontWeight: fontWeight.extrabold, color: c.text },
    timestamp: { fontSize: fontSize.xs, color: c.text3, marginTop: spacing.px1 },
    postTitle: {
      fontSize: fontSize.title,
      fontWeight: fontWeight.bold,
      color: c.text,
      lineHeight: lineHeight.relaxed,
      marginBottom: spacing.px9,
    },
    postBody: {
      fontSize: fontSize.base,
      color: c.text2,
      lineHeight: lineHeight.loose,
      marginBottom: spacing.px13,
    },
    dishActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing.px10 },
    actionChip: { minHeight: 44 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6, marginBottom: spacing.px10 },
    locationPill: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      alignSelf: 'flex-start',
      backgroundColor: `${c.accent}08`,
      borderRadius: radius.pill,
      paddingHorizontal: spacing[3],
      borderWidth: 0.5,
      borderColor: `${c.accent}22`,
    },
    locationSpinner: { width: 11, height: 11 },
    locationText: { fontSize: fontSize.bodySm, color: c.text2 },
    locationSaveBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.lg1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    hashtags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px5, paddingBottom: spacing.px14 },
    hashtagPill: {
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: radius.lg,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: spacing.px9,
    },
    hashtag: { fontSize: fontSize.bodySm, color: c.info, fontWeight: fontWeight.extrabold },
  })
}
