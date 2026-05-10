import React, { useEffect, useMemo } from 'react'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Svg, Path, Circle, Line } from 'react-native-svg'
import { useThemeColors } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/AuthContext'
import { useAuthGate } from '@/lib/AuthGateContext'
import { useAlerts, type AlertItem } from '@/lib/hooks/useAlerts'
import { avatarPalette } from '@/lib/utils/format'

function toInitials(username: string, name: string | null) {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
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

function BellEmptyIcon() {
  const colors = useThemeColors()
  return (
    <Svg
      width={36}
      height={36}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.text3}
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  )
}

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
          {item.type === 'comment' &&
            ` commented: "${item.commentText?.slice(0, 60)}${(item.commentText?.length ?? 0) > 60 ? '…' : ''}"`}
        </Text>
        <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>
      </View>
      <View style={styles.rowIcon}>
        {item.type === 'like' && <HeartIcon />}
        {item.type === 'comment' && <CommentIcon />}
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
  const { alerts, loading, refreshing, refresh, error } = useAlerts(user)

  useEffect(() => {
    if (!user) requireAuth()
  }, [user])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Alerts</Text>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text3} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Could not load alerts</Text>
          <Text style={styles.emptyBody}>{error}</Text>
        </View>
      ) : alerts.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} />
          }
        >
          <BellEmptyIcon />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyBody}>
            When someone likes or comments{'\n'}on your posts, you'll see it here.
          </Text>
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
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    title: { fontSize: 15, fontWeight: '500', color: c.text },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 40,
    },
    centerScroll: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 40,
    },
    emptyTitle: { fontSize: 13, color: c.text3, textAlign: 'center' },
    emptyBody: { fontSize: 12, color: c.text3, textAlign: 'center', lineHeight: 18 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      gap: 12,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: { fontSize: 12, fontWeight: '600' },
    rowContent: { flex: 1, gap: 3 },
    rowText: { fontSize: 13, color: c.text, lineHeight: 18 },
    rowUsername: { fontWeight: '600', color: c.text },
    rowTime: { fontSize: 10, color: c.text3 },
    rowIcon: { flexShrink: 0 },
  })
}
