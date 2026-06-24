import { useRouter } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BellIcon, ChevronRight, DotsIcon, UserIcon } from '@/components/icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { IconButton } from '@/components/ui/IconButton'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { elevation } from '@/constants/Elevation'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { useAlerts, type AlertItem } from '@/lib/hooks/useAlerts'
import { approveAllFollowRequests, approveFollowRequest, declineAllFollowRequests, declineFollowRequest } from '@/lib/services/users'
import { avatarPalette } from '@/lib/utils/format'

type AlertsTab = 'activity' | 'requests'
type SheetMode = 'bulk' | null

function toInitials(username: string, name: string | null) {
  const source = name?.trim() ? name.trim() : username
  const parts = source.split(' ')
  return parts.length >= 2
    ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
    : source.slice(0, 2).toUpperCase()
}

function relativeTime(iso: string, prefix = '') {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const value = mins < 1
    ? 'just now'
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : `${Math.floor(mins / 1440)}d ago`
  return `${prefix}${value}`
}

function displayName(item: AlertItem) {
  return item.actor?.fullName ?? `@${item.actor?.username ?? 'unknown'}`
}

function actorUsername(item: AlertItem) {
  return item.actor?.username ?? 'unknown'
}

const AlertRow = React.memo(function AlertRow({ item }: { item: AlertItem }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const username = actorUsername(item)
  const palette = avatarPalette(username)
  const inits = toInitials(username, item.actor?.fullName ?? null)

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
        <Text style={[styles.avatarText, { color: palette.color }]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          {inits}
        </Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowText} numberOfLines={2} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
          <Text style={styles.rowUsername}>@{username}</Text>
          {item.type === 'like' && ' liked your post'}
          {item.type === 'follow' && ' started following you'}
          {item.type === 'comment' && ' commented on your post'}
          {item.type === 'comment_reply' && ' replied to your comment'}
          {item.type === 'follow_request_approved' && ' approved your follow request'}
        </Text>
        <Text style={styles.rowTime} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          {relativeTime(item.createdAt)}
        </Text>
      </View>
    </View>
  )
})

function RequestCard({
  item,
  onApprove,
  onDelete,
  onOpenProfile,
}: {
  item: AlertItem
  onApprove: (item: AlertItem) => void
  onDelete: (item: AlertItem) => void
  onOpenProfile: (item: AlertItem) => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const username = actorUsername(item)
  const palette = avatarPalette(username)
  const pending = item.type === 'follow_request_pending'

  return (
    <View style={styles.requestCard}>
      <TouchableOpacity
        style={styles.requestIdentity}
        onPress={() => onOpenProfile(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${username}'s profile`}
      >
        <View style={[styles.requestAvatar, { backgroundColor: palette.bg }]}>
          <Text style={[styles.requestAvatarText, { color: palette.color }]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {toInitials(username, item.actor?.fullName ?? null)}
          </Text>
        </View>
        <View style={styles.requestCopy}>
          <Text style={styles.requestName} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {displayName(item)}
          </Text>
          <Text style={styles.requestMeta} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            @{username} · {item.actor?.privateAccount ? 'Private account' : 'Public account'}
          </Text>
          <Text style={styles.requestTime} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {pending ? relativeTime(item.createdAt, 'Requested ') : relativeTime(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>

      {pending ? (
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => onApprove(item)}
            accessibilityRole="button"
            accessibilityLabel={`Approve ${username}'s follow request`}
          >
            <Text style={styles.approveText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${username}'s follow request`}
          >
            <Text style={styles.deleteText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  )
}

export default function AlertsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const { showToast } = useToast()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [tab, setTab] = useState<AlertsTab>('activity')
  const [sheetMode, setSheetMode] = useState<SheetMode>(null)
  const [optimisticallyHiddenIds, setOptimisticallyHiddenIds] = useState<Set<string>>(() => new Set())
  const { alerts, pendingRequestCount, loading, refreshing, refresh, error } = useAlerts(user?.id, tab)

  useEffect(() => {
    if (!user) requireAuth()
  }, [user, requireAuth])

  function openProfile(item: AlertItem) {
    if (!item.actor?.username) return
    router.push(`/user/${item.actor.username}`)
  }

  async function actOnRequest(item: AlertItem, action: 'approve' | 'delete') {
    if (!item.requestId) return
    const verb = action === 'approve' ? 'approved' : 'deleted'
    setOptimisticallyHiddenIds(previous => new Set(previous).add(item.id))
    try {
      if (action === 'approve') await approveFollowRequest(item.requestId)
      else await declineFollowRequest(item.requestId)
      showToast(`Request ${verb}`)
      await refresh(true)
    } catch {
      setOptimisticallyHiddenIds(previous => {
        const next = new Set(previous)
        next.delete(item.id)
        return next
      })
      showToast(`The request could not be ${verb}. Check your connection and try again.`, { type: 'info' })
      await refresh(true)
    }
  }

  async function handleBulk(value: string) {
    setSheetMode(null)
    try {
      if (value === 'approve_all') {
        const result = await approveAllFollowRequests()
        showToast(`${result.approvedCount} follow requests approved`)
      }
      if (value === 'delete_all') {
        const count = await declineAllFollowRequests()
        showToast(`${count} follow requests deleted`)
      }
      await refresh(true)
    } catch {
      showToast('Follow requests could not be updated. Check your connection and try again.', { type: 'info' })
    }
  }

  const requestItems = alerts
    .filter(item => item.type === 'follow_request_pending' || item.type === 'follow_request_approved')
    .filter(item => !optimisticallyHiddenIds.has(item.id))
  const activityItems = alerts.filter(item => item.type !== 'follow_request_pending')
  const visibleItems = tab === 'activity' ? activityItems : requestItems

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.title} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Alerts</Text>
        {tab === 'requests' && pendingRequestCount > 0 ? (
          <IconButton
            accessibilityLabel="Open follow request bulk actions"
            onPress={() => setSheetMode('bulk')}
            variant="ghost"
            size={44}
          >
            <DotsIcon size={18} />
          </IconButton>
        ) : null}
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        <TouchableOpacity
          style={[styles.tab, tab === 'activity' && styles.tabActive]}
          onPress={() => setTab('activity')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'activity' }}
        >
          <Text style={[styles.tabText, tab === 'activity' && styles.tabTextActive]}>Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'requests' && styles.tabActive]}
          onPress={() => setTab('requests')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'requests' }}
        >
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
            Requests{pendingRequestCount > 0 ? ` (${pendingRequestCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={38} height={38} radius={radius.xl2} />
              <View style={styles.skeletonText}>
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
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} />
          }
          contentContainerStyle={visibleItems.length === 0 ? styles.centerScroll : styles.list}
        >
          {tab === 'activity' && pendingRequestCount > 0 ? (
            <TouchableOpacity
              style={styles.requestShortcut}
              onPress={() => setTab('requests')}
              accessibilityRole="button"
              accessibilityLabel={`View ${pendingRequestCount} follow requests`}
            >
              <View style={styles.shortcutIcon}>
                <UserIcon size={18} color={colors.accent} />
              </View>
              <Text style={styles.shortcutText}>Follow requests · {pendingRequestCount}</Text>
              <ChevronRight size={16} />
            </TouchableOpacity>
          ) : null}

          {visibleItems.length === 0 ? (
            <EmptyState
              title={tab === 'requests' ? 'No follow requests yet' : 'No notifications yet'}
              subtitle={tab === 'requests'
                ? "When someone requests to follow your private account, they'll appear here."
                : "When someone likes, comments, replies, or follows you, you'll see it here."}
              icon={<BellIcon size={36} />}
            />
          ) : visibleItems.map(item => (
            item.type === 'follow_request_pending' || item.type === 'follow_request_approved' ? (
              <RequestCard
                key={item.id}
                item={item}
                onApprove={request => { void actOnRequest(request, 'approve') }}
                onDelete={request => { void actOnRequest(request, 'delete') }}
                onOpenProfile={openProfile}
              />
            ) : (
              <AlertRow key={item.id} item={item} />
            )
          ))}
        </ScrollView>
      )}

      {sheetMode === 'bulk' ? (
        <RekkusActionSheet
          visible
          title="Follow requests"
          subtitle="Apply this action to every pending follow request."
          options={[
            { label: 'Approve all', value: 'approve_all', accentColor: colors.accent },
            { label: 'Delete all', value: 'delete_all', destructive: true },
          ]}
          onSelect={handleBulk}
          onDismiss={() => setSheetMode(null)}
        />
      ) : null}
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: spacing[4],
      paddingTop: spacing[3],
      gap: spacing[2],
    },
    tab: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing[4],
      borderRadius: radius.full,
      backgroundColor: c.surface,
    },
    tabActive: { backgroundColor: c.text },
    tabText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2 },
    tabTextActive: { color: c.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing.px40,
    },
    centerScroll: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing.px40,
    },
    list: {
      paddingTop: spacing[3],
      paddingBottom: spacing.px40,
    },
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
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px14,
      gap: spacing[3],
    },
    skeletonText: { flex: 1, gap: spacing[2] },
    requestShortcut: {
      minHeight: 56,
      marginHorizontal: spacing[4],
      marginBottom: spacing[3],
      paddingHorizontal: spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      borderRadius: radius.lg,
      backgroundColor: c.surface,
    },
    shortcutIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      backgroundColor: c.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shortcutText: {
      flex: 1,
      fontSize: fontSize.base,
      fontWeight: fontWeight.medium,
      color: c.text,
    },
    requestCard: {
      ...elevation.sm,
      marginHorizontal: spacing[4],
      marginBottom: spacing[3],
      padding: spacing[4],
      borderRadius: radius.xl,
      backgroundColor: c.surface,
      gap: spacing[4],
    },
    requestIdentity: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    requestAvatar: {
      width: 54,
      height: 54,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    requestAvatarText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
    requestCopy: { flex: 1, gap: spacing.px3 },
    requestName: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: c.text },
    requestMeta: { fontSize: fontSize.bodySm, color: c.text2 },
    requestTime: { fontSize: fontSize.xs, color: c.text3 },
    requestActions: { flexDirection: 'row', gap: spacing[2] },
    approveButton: {
      minHeight: 44,
      flex: 1,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent,
    },
    approveText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.white },
    deleteButton: {
      minHeight: 44,
      flex: 1,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border2,
      backgroundColor: c.surface,
    },
    deleteText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.text2 },
  })
}
