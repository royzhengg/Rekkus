import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, ImagePlaceholder } from '@/components/icons'
import { ProfileHeader } from '@/components/ProfileHeader'
import { ThumbGrid } from '@/components/ThumbGrid'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { demoUsers } from '@/lib/dataSources/demoData'
import { isEnabled } from '@/lib/featureFlags'
import { usePagedList } from '@/lib/hooks/usePagedList'
import { routes } from '@/lib/routes'
import { getOrCreateDirectConversation } from '@/lib/services/messaging'
import { blockUser, submitContentReport } from '@/lib/services/moderation'
import {
  fetchUserIdByUsername,
  fetchIsFollowing,
  fetchFollowCounts,
} from '@/lib/services/users'
import { contributorBadgeLabel } from '@/lib/utils/contributorStatus'
import { parseLikes } from '@/lib/utils/format'

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const { runDeferredMutation, requireOnline } = useConnectivity()
  const { posts } = usePosts()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [following, setFollowing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number } | null>(null)
  const [safetySheet, setSafetySheet] = useState(false)
  const [startingMessage, setStartingMessage] = useState(false)
  const [notice, setNotice] = useState<{ title: string; subtitle?: string } | null>(null)
  const [operationError, setOperationError] = useState<{ title: string; message: string } | null>(null)

  const loadUserData = useCallback(async () => {
    if (!username) return
    const uid = await fetchUserIdByUsername(username)
    setTargetUserId(uid)
    if (uid) {
      const counts = await fetchFollowCounts(uid)
      setFollowCounts(counts)
      if (user) {
        const isFollowing = await fetchIsFollowing(user.id, uid)
        setFollowing(isFollowing)
      }
    }
  }, [username, user])

  useEffect(() => {
    void loadUserData()
  }, [loadUserData])

  const mockUser = demoUsers[username ?? '']
  const userPosts = useMemo(() => posts.filter(p => p.creator === username), [posts, username])
  const { visible: visibleUserPosts, hasMore: userPostsHasMore, loadMore: loadMoreUserPosts } =
    usePagedList(userPosts)

  const badgeLabel = useMemo(() => contributorBadgeLabel(userPosts), [userPosts])

  const avgFoodRating = useMemo(() => {
    if (userPosts.length === 0) return null
    return (userPosts.reduce((s, p) => s + p.food, 0) / userPosts.length).toFixed(1)
  }, [userPosts])

  const totalLikesLabel = useMemo(() => {
    const sum = userPosts.reduce((s, p) => s + parseLikes(p.likes), 0)
    return sum >= 1000 ? `${(sum / 1000).toFixed(1)}k` : `${sum}`
  }, [userPosts])

  const openPost = useCallback((post: { dbId?: string; id: string | number }) => {
    router.push(routes.postDetail(String(post.dbId || post.id)))
  }, [router])

  const displayName = mockUser?.displayName ?? username ?? ''
  const initials = mockUser?.initials ?? (username ?? '?').slice(0, 2).toUpperCase()
  const avatarBg = mockUser?.avatarBg ?? colors.surface2
  const avatarColor = mockUser?.avatarColor ?? colors.text2
  const bio = mockUser?.bio ?? null
  const locationLabel = mockUser
    ? [mockUser.suburb, mockUser.city].filter(Boolean).join(', ') || null
    : null

  async function handleFollow() {
    if (!user) {
      requireAuth()
      return
    }
    if (!targetUserId) return
    const next = !following
    const previous = following
    setOperationError(null)
    setFollowing(next)
    try {
      const result = await runDeferredMutation({ kind: 'follow', targetUserId, targetState: next })
      if (!result.queued) {
        const counts = await fetchFollowCounts(targetUserId)
        setFollowCounts(counts)
      }
    } catch {
      setFollowing(previous)
      setOperationError({ title: 'Could not update follow', message: 'Check your connection and try again.' })
    }
  }

  async function handleSafetyAction(value: string) {
    if (!user) {
      requireAuth()
      return
    }
    if (!targetUserId) {
      setOperationError({ title: 'Not available', message: 'We could not find this user right now.' })
      return
    }
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to report or block this account.' })
      return
    }
    if (value === 'report_user') {
      const err = await submitContentReport({
        reporterId: user.id,
        targetType: 'user',
        targetId: targetUserId,
        reason: 'profile_or_behavior_issue',
        sourceSurface: 'user_profile',
      })
      if (err) setOperationError({ title: 'Report failed', message: err })
      else setNotice({ title: 'Report received', subtitle: 'Thanks. We will review this profile.' })
      return
    }
    if (value === 'block_user') {
      const err = await blockUser(user.id, targetUserId)
      if (err) setOperationError({ title: 'Block failed', message: err })
      else setNotice({ title: 'User blocked', subtitle: 'You will have a record of this block for moderation review.' })
    }
  }

  async function handleMessage() {
    if (!user) {
      requireAuth()
      return
    }
    if (!targetUserId) {
      setOperationError({ title: 'Not available', message: 'We could not find this user right now.' })
      return
    }
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to start a conversation.' })
      return
    }
    if (!isEnabled('directMessages')) {
      setNotice({ title: 'Messaging is not ready yet', subtitle: 'Rekkus is keeping private messages paused until the release checks finish.' })
      return
    }
    if (startingMessage) return
    setOperationError(null)
    setStartingMessage(true)
    const { conversationId, error } = await getOrCreateDirectConversation(user.id, targetUserId)
    setStartingMessage(false)
    if (error || !conversationId) {
      setOperationError({ title: 'Message unavailable', message: error ?? 'We could not open this conversation right now.' })
      return
    }

    router.push(routes.conversation(conversationId))
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.username} numberOfLines={1}>
          @{username}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true)
              await loadUserData()
              setRefreshing(false)
            }}
            tintColor={colors.text}
          />
        }
      >
        <ProfileHeader
          initials={initials}
          avatarBg={avatarBg}
          avatarColor={avatarColor}
          displayName={displayName}
          badgeLabel={badgeLabel}
          postCount={userPosts.length}
          followersLabel={followCounts?.followers ?? mockUser?.followers ?? '—'}
          followingLabel={followCounts?.following ?? mockUser?.following ?? '—'}
          bio={bio}
          locationLabel={locationLabel}
          avgFoodRating={avgFoodRating}
          totalLikesLabel={totalLikesLabel}
        />

        {operationError ? (
          <ErrorMessage title={operationError.title} message={operationError.message} style={{ marginHorizontal: spacing[5] }} />
        ) : null}

        {/* Action buttons */}
        <View style={styles.actionBtns}>
          <TouchableOpacity
            style={[styles.followBtn, following && styles.followBtnActive]}
            onPress={handleFollow}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.messageBtn} activeOpacity={0.8} onPress={handleMessage} accessibilityRole="button">
            <Text style={styles.messageBtnText}>{startingMessage ? 'Opening...' : 'Message'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.messageBtn}
            activeOpacity={0.8}
            onPress={() => requireAuth(() => setSafetySheet(true))}
            accessibilityRole="button"
          >
            <Text style={styles.messageBtnText}>Report</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabHeader}>
          <Text style={styles.tabHeaderText}>Posts</Text>
        </View>

        {userPosts.length === 0 ? (
          <View style={styles.emptyTab}>
            <View style={styles.emptyIcon}>
              <ImagePlaceholder size={24} color={colors.text3} />
            </View>
            <Text style={styles.emptyText}>No posts yet.</Text>
          </View>
        ) : (
          <ThumbGrid
            posts={visibleUserPosts}
            hasMore={userPostsHasMore}
            onLoadMore={loadMoreUserPosts}
            onPressPost={openPost}
          />
        )}
      </ScrollView>
      <RekkusActionSheet
        visible={safetySheet}
        title="Profile safety"
        subtitle="Report or block this profile."
        options={[
          { label: 'Report profile', value: 'report_user' },
          { label: 'Block user', value: 'block_user' },
        ]}
        onSelect={handleSafetyAction}
        onDismiss={() => setSafetySheet(false)}
      />
      <RekkusActionSheet
        visible={notice != null}
        title={notice?.title}
        subtitle={notice?.subtitle}
        options={[{ label: 'OK', value: 'ok', accentColor: colors.accent }]}
        onSelect={() => {}}
        onDismiss={() => setNotice(null)}
      />
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      padding: spacing.px6,
      marginLeft: -spacing.px6,
      width: 60,
    },
    backText: { fontSize: fontSize.md, color: c.text2 },
    username: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text, textAlign: 'center' },
    actionBtns: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[5], paddingTop: spacing.px18 },
    followBtn: {
      flex: 1,
      backgroundColor: c.text,
      borderRadius: radius.md,
      paddingVertical: spacing.px9,
      alignItems: 'center',
    },
    followBtnActive: { backgroundColor: c.surface, borderWidth: 0.5, borderColor: c.border2 },
    followBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.bg },
    followBtnTextActive: { color: c.text },
    messageBtn: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border2,
      borderRadius: radius.md,
      paddingVertical: spacing.px9,
      alignItems: 'center',
    },
    messageBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    tabHeader: {
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      marginTop: spacing.px18,
    },
    tabHeaderText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text },
    emptyTab: { alignItems: 'center', justifyContent: 'center', padding: spacing.px50, gap: spacing.px10 },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.pill3,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: { fontSize: fontSize.base, color: c.text3, textAlign: 'center', lineHeight: lineHeight.normal, fontWeight: fontWeight.semibold },
  })
}
