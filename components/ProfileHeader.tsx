import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { Avatar } from './Avatar'
import { PinIcon } from './icons'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

type Props = {
  initials: string
  avatarBg: string
  avatarColor: string
  displayName: string
  badgeLabel?: string | null
  postCount: number
  followersLabel: string | number
  followingLabel: string | number
  bio?: string | null
  locationLabel?: string | null
  avgFoodRating?: string | null
  totalLikesLabel?: string | null
  savedSpotsCount?: number
}

// Shared profile header used on own profile and user profile screens.
// Covers: avatar, display name, reviewer badge, stats card, bio, location, food stats strip.
// Each screen composes its own action buttons and content tabs below this component.
export function ProfileHeader({
  initials,
  avatarBg,
  avatarColor,
  displayName,
  badgeLabel,
  postCount,
  followersLabel,
  followingLabel,
  bio,
  locationLabel,
  avgFoodRating,
  totalLikesLabel,
  savedSpotsCount,
}: Props) {
  const c = useThemeColors()
  const styles = React.useMemo(() => makeStyles(c), [c])

  return (
    <>
      {/* Avatar + name + badge */}
      <View style={styles.avatarBlock}>
        <Avatar initials={initials} bg={avatarBg} color={avatarColor} size={80} />
        <Text style={styles.displayName}>{displayName}</Text>
        {!!badgeLabel && (
          <View style={styles.badge}>
            <Text style={styles.badgeDot}>✦ </Text>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        )}
      </View>

      {/* Stats card */}
      <View style={styles.statsCard}>
        <View style={styles.statCol}>
          <Text style={styles.statNum}>{postCount}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statNum}>{followersLabel}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statNum}>{followingLabel}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
      </View>

      {/* Bio + location */}
      {(bio || locationLabel) && (
        <View style={styles.bioBlock}>
          {!!bio && <Text style={styles.bio}>{bio}</Text>}
          {!!locationLabel && (
            <View style={styles.locationRow}>
              <PinIcon size={11} />
              <Text style={styles.locationText}>{locationLabel}</Text>
            </View>
          )}
        </View>
      )}

      {/* Food stats strip */}
      {avgFoodRating != null && (
        <Text style={styles.foodStats}>
          🍴 {avgFoodRating} avg
          {savedSpotsCount != null ? ` · 📍 ${savedSpotsCount} spots` : ''}
          {totalLikesLabel ? ` · ♡ ${totalLikesLabel}` : ''}
        </Text>
      )}
    </>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    avatarBlock: { alignItems: 'center', paddingTop: spacing.px28, paddingBottom: spacing[1], paddingHorizontal: spacing[5] },
    displayName: { fontSize: fontSize.title, fontWeight: fontWeight.semibold, color: c.text, marginBottom: spacing[2], marginTop: spacing[3] },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing[1],
    },
    badgeDot: { fontSize: fontSize.sm, color: c.accent },
    badgeText: { fontSize: fontSize.sm, color: c.text2 },
    statsCard: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      marginHorizontal: spacing[5],
      marginTop: spacing[5],
    },
    statCol: { flex: 1, alignItems: 'center', paddingVertical: spacing.px14 },
    statDivider: { width: 0.5, backgroundColor: c.border, marginVertical: spacing.px10 },
    statNum: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: c.text, letterSpacing: -0.3 },
    statLabel: { fontSize: fontSize.xs, color: c.text3, marginTop: spacing.px2 },
    bioBlock: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[2] },
    bio: { fontSize: fontSize.bodySm, color: c.text2, lineHeight: lineHeight.small },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    locationText: { fontSize: fontSize.sm, color: c.text3 },
    foodStats: { fontSize: fontSize.base, color: c.text3, paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  })
}
