import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Avatar } from '@/components/Avatar'
import { ChevronLeft } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Skeleton } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { routes, type FollowListType } from '@/lib/routes'
import {
  fetchFollowers,
  fetchFollowing,
  fetchUserIdByUsername,
  removeFollowChannel,
  subscribeToFollowChanges,
  type FollowChange,
  type FollowListUser,
} from '@/lib/services/users'

const AVATAR_SIZE = spacing.px40 + spacing[1]
const TOUCH_SIZE = spacing.px40 + spacing[1]

function normaliseListType(value: string | string[] | undefined): FollowListType {
  const first = Array.isArray(value) ? value[0] : value
  return first === 'following' ? 'following' : 'followers'
}

function initialsForUser(user: FollowListUser): string {
  const source = user.full_name?.trim() || user.username
  return source.slice(0, 2).toUpperCase()
}

function displayNameForUser(user: FollowListUser): string {
  return user.full_name?.trim() || user.username
}

function changeMatchesList(change: FollowChange, targetUserId: string, listType: FollowListType): boolean {
  return listType === 'followers'
    ? change.followingId === targetUserId
    : change.followerId === targetUserId
}

export default function FollowListScreen() {
  const { username, listType } = useLocalSearchParams<{ username?: string; listType?: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { syncEpoch } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const initialListType = normaliseListType(listType)
  const [activeList, setActiveList] = useState<FollowListType>(initialListType)
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [rows, setRows] = useState<FollowListUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setActiveList(initialListType)
  }, [initialListType])

  const load = useCallback(async (nextList: FollowListType = activeList, isRefresh = false) => {
    if (!username) {
      setError('We could not find this profile right now.')
      setRows([])
      setLoading(false)
      setRefreshing(false)
      return
    }
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const uid = await fetchUserIdByUsername(username)
      setTargetUserId(uid)
      if (!uid) {
        setRows([])
        setError('We could not find this profile right now.')
        return
      }
      const nextRows = nextList === 'followers'
        ? await fetchFollowers(uid)
        : await fetchFollowing(uid)
      setRows(nextRows)
      analytics.profileFollowListOpened(user?.id ?? null, uid, nextList)
    } catch {
      setRows([])
      setError('This list could not be loaded right now.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeList, user?.id, username])

  useFocusEffect(
    useCallback(() => {
      void load(activeList)
    }, [activeList, load])
  )

  useEffect(() => {
    if (syncEpoch > 0) void load(activeList)
  }, [activeList, load, syncEpoch])

  useEffect(() => {
    if (!targetUserId) return
    const channel = subscribeToFollowChanges(targetUserId, change => {
      if (changeMatchesList(change, targetUserId, activeList)) void load(activeList, true)
    })
    return () => { removeFollowChannel(channel) }
  }, [activeList, load, targetUserId])

  const handleTabPress = useCallback((nextList: FollowListType) => {
    setActiveList(nextList)
    void load(nextList)
  }, [load])

  const renderItem = useCallback(({ item }: { item: FollowListUser }) => (
    <Pressable
      style={styles.row}
      onPress={() => router.push(routes.userProfile(item.username))}
      accessibilityRole="button"
      accessibilityLabel={`Open ${displayNameForUser(item)} profile`}
    >
      <View style={styles.avatarWrap}>
        {item.avatar_url ? (
          <CachedImage
            source={item.avatar_url}
            style={styles.avatarImage}
            accessibilityLabel={`${displayNameForUser(item)} avatar`}
          />
        ) : (
          <Avatar initials={initialsForUser(item)} bg={colors.surface2} color={colors.text2} size={AVATAR_SIZE} />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{displayNameForUser(item)}</Text>
        <Text style={styles.handle} numberOfLines={1}>@{item.username}</Text>
      </View>
    </Pressable>
  ), [colors.surface2, colors.text2, router, styles.avatarImage, styles.avatarWrap, styles.handle, styles.name, styles.row, styles.rowText])

  const title = activeList === 'followers' ? 'Followers' : 'Following'
  const emptyTitle = activeList === 'followers' ? 'No followers yet' : 'Not following anyone yet'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.tabs}>
        {(['followers', 'following'] as const).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeList === tab && styles.tabActive]}
            onPress={() => handleTabPress(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeList === tab }}
          >
            <Text style={[styles.tabText, activeList === tab && styles.tabTextActive]}>
              {tab === 'followers' ? 'Followers' : 'Following'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <ErrorMessage title="Could not load list" message={error} style={styles.error} />
      ) : null}

      {loading ? (
        <View style={styles.skeletonList}>
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={index} style={styles.skeletonRow}>
              <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} radius={radius.full} />
              <View style={styles.skeletonText}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="38%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(activeList, true)}
              tintColor={colors.text}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={emptyTitle}
              subtitle="Follow activity will appear here."
            />
          }
          contentContainerStyle={rows.length === 0 ? styles.emptyList : undefined}
        />
      )}
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      minHeight: spacing.px56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    backBtn: {
      minWidth: spacing.px60,
      minHeight: TOUCH_SIZE,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      marginLeft: -spacing.px6,
    },
    backText: { fontSize: fontSize.md, color: c.text2 },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: c.text,
    },
    topSpacer: { width: spacing.px60 },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      gap: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    tab: {
      flex: 1,
      minHeight: TOUCH_SIZE,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    tabActive: { backgroundColor: c.text, borderColor: c.text },
    tabText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text2 },
    tabTextActive: { color: c.bg },
    error: { marginHorizontal: spacing[5], marginTop: spacing[4] },
    skeletonList: { paddingTop: spacing[3] },
    skeletonRow: {
      minHeight: spacing.px60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[2],
    },
    skeletonText: { flex: 1, gap: spacing[2] },
    row: {
      minHeight: spacing.px60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    avatarWrap: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: radius.pill2,
      overflow: 'hidden',
    },
    avatarImage: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: radius.pill2,
    },
    rowText: { flex: 1 },
    name: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: c.text,
      lineHeight: lineHeight.normal,
    },
    handle: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      lineHeight: lineHeight.small,
    },
    emptyList: { flexGrow: 1 },
  })
}
