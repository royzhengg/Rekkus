import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { spacing } from '@/constants/Spacing'
import { fontFamily, fontSize, fontWeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { Avatar } from './Avatar'
import { PinIcon } from './icons'

type Props = {
  initials: string
  avatarBg: string
  avatarColor: string
  displayName: string
  username: string
  postCount: number
  followersLabel: string | number
  followingLabel: string | number
  locationLabel?: string | null
  rightActions?: React.ReactNode
  onPressFollowers?: (() => void) | undefined
  onPressFollowing?: (() => void) | undefined
}

// Shared profile header used on own profile and user profile screens.
// Covers: compact food identity, primary trust stats, and secondary following access.
// Each screen composes its own action buttons and content tabs below this component.
export function ProfileHeader({
  initials,
  avatarBg,
  avatarColor,
  displayName,
  username,
  postCount,
  followersLabel,
  followingLabel,
  locationLabel,
  rightActions,
  onPressFollowers,
  onPressFollowing,
}: Props) {
  const c = useThemeColors()
  const styles = React.useMemo(() => makeStyles(c), [c])
  const followersContent = (
    <>
      <Text style={styles.statNum} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{followersLabel}</Text>
      <Text style={styles.statLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Followers</Text>
    </>
  )
  const followingContent = (
    <>
      <Text style={styles.statNum} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{followingLabel}</Text>
      <Text style={styles.statLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Following</Text>
    </>
  )

  return (
    <View style={styles.wrap}>
      <View style={styles.actionsRow}>
        <View />
        {rightActions ? <View style={styles.rightActions}>{rightActions}</View> : null}
      </View>

      <View style={styles.identityBlock}>
        <Avatar initials={initials} bg={avatarBg} color={avatarColor} size={104} />
        <View style={styles.identityText}>
          <Text style={styles.displayName} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {displayName}
          </Text>
          <Text style={styles.handle} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            @{username}
          </Text>
          {!!locationLabel && (
            <View style={styles.locationRow}>
              <PinIcon size={13} />
              <Text style={styles.locationText} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                {locationLabel}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statNum} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {postCount}
          </Text>
          <Text style={styles.statLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            Reviews
          </Text>
        </View>
        <View style={styles.statDivider} />
        {onPressFollowers ? (
          <Pressable
            style={styles.statCol}
            onPress={onPressFollowers}
            accessibilityRole="button"
            accessibilityLabel="Open followers"
          >
            {followersContent}
          </Pressable>
        ) : (
          <View style={styles.statCol}>{followersContent}</View>
        )}
        <View style={styles.statDivider} />
        {onPressFollowing ? (
          <Pressable
            style={styles.statCol}
            onPress={onPressFollowing}
            accessibilityRole="button"
            accessibilityLabel="Open following"
          >
            {followingContent}
          </Pressable>
        ) : (
          <View style={styles.statCol}>{followingContent}</View>
        )}
      </View>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: spacing[5], paddingTop: spacing[3] },
    actionsRow: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    identityBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[4],
      paddingTop: spacing[2],
    },
    identityText: { flex: 1 },
    displayName: { fontFamily: fontFamily.serif, fontSize: fontSize['8xl'], color: c.text },
    handle: { fontSize: fontSize.lg, color: c.text3, marginTop: spacing.px2 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingTop: spacing[3] },
    locationText: { fontSize: fontSize.base, color: c.text3 },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.px18,
    },
    statCol: {
      flex: 1,
      minHeight: 64,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[2],
    },
    statDivider: { width: 0.5, height: 34, backgroundColor: c.border2 },
    statNum: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: c.text },
    statLabel: { fontSize: fontSize.base, color: c.text3, marginTop: spacing.px2 },
  })
}
