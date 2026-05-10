import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useThemeColors } from '@/lib/ThemeContext'
import { Avatar } from './Avatar'
import { PinIcon } from './icons'

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
    avatarBlock: { alignItems: 'center', paddingTop: 28, paddingBottom: 4, paddingHorizontal: 20 },
    displayName: { fontSize: 17, fontWeight: '600', color: c.text, marginBottom: 8, marginTop: 12 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeDot: { fontSize: 11, color: c.accent },
    badgeText: { fontSize: 11, color: c.text2 },
    statsCard: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: 14,
      marginHorizontal: 20,
      marginTop: 20,
    },
    statCol: { flex: 1, alignItems: 'center', paddingVertical: 14 },
    statDivider: { width: 0.5, backgroundColor: c.border, marginVertical: 10 },
    statNum: { fontSize: 18, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
    statLabel: { fontSize: 10, color: c.text3, marginTop: 2 },
    bioBlock: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
    bio: { fontSize: 12, color: c.text2, lineHeight: 18 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { fontSize: 11, color: c.text3 },
    foodStats: { fontSize: 13, color: c.text3, paddingHorizontal: 20, paddingTop: 12 },
  })
}
