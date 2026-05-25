import React, { useEffect, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Svg, Path, Circle, Line } from 'react-native-svg'
import { BellIcon } from '@/components/icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Skeleton } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useAlerts, type AlertItem } from '@/lib/hooks/useAlerts'
import { avatarPalette } from '@/lib/utils/format'

function toInitials(username: string, name: string | null) {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
      : (parts[0] ?? '').slice(0, 2).toUpperCase()
  }
  return username.slice(0, 2).toUpperCase()
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return `${Math.floor(days / 7)}w`
}

const HeartIcon = React.memo(function HeartIcon() {
  const colors = useThemeColors()
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill={colors.liked}
      stroke={colors.liked}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  )
})

const CommentIcon = React.memo(function CommentIcon() {
  const colors = useThemeColors()
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.info}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  )
})

const ReplyIcon = React.memo(function ReplyIcon() {
  const colors = useThemeColors()
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.text2}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <Path d="M8 10h8M8 14h4" />
    </Svg>
  )
})

const FollowIcon = React.memo(function FollowIcon() {
  const colors = useThemeColors()
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.accent}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Line x1={19} y1={8} x2={19} y2={14} />
      <Line x1={22} y1={11} x2={16} y2={11} />
    </Svg>
  )
})

const AlertRow = React.memo(function AlertRow({ item }: { item: AlertItem }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const palette = avatarPalette(item.actorUsername)
  const inits = toInitials(item.actorUsername, item.actorName)

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
        <Text style={[styles.avatarText, { color: palette.color }]}>{inits}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowText} numberOfLines={2}>
          <Text style={styles.rowUsername}>@{item.actorUsername}</Text>
          {item.type === 'like' && ' liked your post'}
          {item.type === 'follow' && ' started following you'}
          {item.type === 'comment' && ' commented on your post'}
          {item.type === 'comment_reply' && ' replied to your comment'}
        </Text>
        <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>
      </View>
      <View style={styles.rowIcon}>
        {item.type === 'like' && <HeartIcon />}
        {item.type === 'comment' && <CommentIcon />}
        {item.type === 'comment_reply' && <ReplyIcon />}
        {item.type === 'follow' && <FollowIcon />}
      </View>
    </View>
  )
})

export default function AlertsScreen() {
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { alerts, loading, refreshing, refresh, error } = useAlerts(user?.id)

  useEffect(() => {
    if (!user) requireAuth()
  }, [user, requireAuth])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Alerts</Text>
      </View>
      {loading ? (
        <>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={38} height={38} radius={radius.xl2} />
              <View style={{ flex: 1, gap: spacing[2] }}>
                <Skeleton width="65%" height={14} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </>
      ) : error ? (
        <View style={styles.center}>
          <ErrorMessage title="Could not load alerts" message={error} />
        </View>
      ) : alerts.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} />
          }
        >
          <EmptyState
            title="No notifications yet"
            subtitle="When someone likes, comments, or replies to your posts, you'll see it here."
            icon={<BellIcon size={36} />}
          />
        </ScrollView>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} />
          }
        >
          {alerts.map(item => (
            <AlertRow key={item.id} item={item} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      height: 56,
      justifyContent: 'center',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing.px40,
    },
    centerScroll: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing.px40,
    },
    emptyTitle: { fontSize: fontSize.base, color: c.text3, textAlign: 'center' },
    emptyBody: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center', lineHeight: lineHeight.small },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px14,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      gap: spacing[3],
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: radius.xl2,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold },
    rowContent: { flex: 1, gap: spacing.px3 },
    rowText: { fontSize: fontSize.base, color: c.text, lineHeight: lineHeight.small },
    rowUsername: { fontWeight: fontWeight.semibold, color: c.text },
    rowTime: { fontSize: fontSize.xs, color: c.text3 },
    rowIcon: { flexShrink: 0 },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing.px14, gap: spacing[3] },
  })
}
