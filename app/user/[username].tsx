import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/ThemeContext'
import { usePosts } from '@/lib/PostsContext'
import { useAuth } from '@/lib/AuthContext'
import { useAuthGate } from '@/lib/AuthGateContext'
import { MOCK_USERS } from '@/lib/data'
import { ChevronLeft } from '@/components/icons'
import { ProfileHeader } from '@/components/ProfileHeader'
import { ThumbGrid } from '@/components/ThumbGrid'
import { parseLikes } from '@/lib/utils/format'

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const { posts } = usePosts()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [following, setFollowing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const mockUser = MOCK_USERS[username ?? '']
  const userPosts = useMemo(() => posts.filter(p => p.creator === username), [posts, username])

  const badgeLabel = useMemo(() => {
    if (userPosts.length === 0) return null
    const avgFood = userPosts.reduce((s, p) => s + p.food, 0) / userPosts.length
    if (userPosts.length >= 10) return 'Local expert'
    if (userPosts.length >= 5) return 'Prolific reviewer'
    if (avgFood >= 4.5) return 'Quality hunter'
    return 'Explorer'
  }, [userPosts])

  const avgFoodRating = useMemo(() => {
    if (userPosts.length === 0) return null
    return (userPosts.reduce((s, p) => s + p.food, 0) / userPosts.length).toFixed(1)
  }, [userPosts])

  const totalLikesLabel = useMemo(() => {
    const sum = userPosts.reduce((s, p) => s + parseLikes(p.likes), 0)
    return sum >= 1000 ? `${(sum / 1000).toFixed(1)}k` : `${sum}`
  }, [userPosts])

  const displayName = mockUser?.displayName ?? username ?? ''
  const initials = mockUser?.initials ?? (username ?? '?').slice(0, 2).toUpperCase()
  const avatarBg = mockUser?.avatarBg ?? '#E8E8E4'
  const avatarColor = mockUser?.avatarColor ?? '#6B6B66'
  const bio = mockUser?.bio ?? null
  const locationLabel = mockUser
    ? [mockUser.suburb, mockUser.city].filter(Boolean).join(', ') || null
    : null

  function handleFollow() {
    if (!user) {
      requireAuth()
      return
    }
    setFollowing(f => !f)
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
          followersLabel={mockUser?.followers ?? '—'}
          followingLabel={mockUser?.following ?? '—'}
          bio={bio}
          locationLabel={locationLabel}
          avgFoodRating={avgFoodRating}
          totalLikesLabel={totalLikesLabel}
        />

        {/* Action buttons */}
        <View style={styles.actionBtns}>
          <TouchableOpacity
            style={[styles.followBtn, following && styles.followBtnActive]}
            onPress={handleFollow}
            activeOpacity={0.8}
          >
            <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.messageBtn} activeOpacity={0.8}>
            <Text style={styles.messageBtnText}>Message</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabHeader}>
          <Text style={styles.tabHeaderText}>Posts</Text>
        </View>

        {userPosts.length === 0 ? (
          <View style={styles.emptyTab}>
            <Text style={styles.emptyText}>{'No posts yet.\nCheck back later.'}</Text>
          </View>
        ) : (
          <ThumbGrid posts={userPosts} />
        )}
      </ScrollView>
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
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: 6,
      marginLeft: -6,
      width: 60,
    },
    backText: { fontSize: 14, color: c.text2 },
    username: { flex: 1, fontSize: 15, fontWeight: '500', color: c.text, textAlign: 'center' },
    actionBtns: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 18 },
    followBtn: {
      flex: 1,
      backgroundColor: c.text,
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: 'center',
    },
    followBtnActive: { backgroundColor: c.surface, borderWidth: 0.5, borderColor: c.border2 },
    followBtnText: { fontSize: 13, fontWeight: '500', color: c.bg },
    followBtnTextActive: { color: c.text },
    messageBtn: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border2,
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: 'center',
    },
    messageBtnText: { fontSize: 13, fontWeight: '500', color: c.text },
    tabHeader: {
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      paddingHorizontal: 20,
      paddingVertical: 12,
      marginTop: 18,
    },
    tabHeaderText: { fontSize: 12, fontWeight: '500', color: c.text },
    emptyTab: { alignItems: 'center', justifyContent: 'center', padding: 50 },
    emptyText: { fontSize: 13, color: c.text3, textAlign: 'center', lineHeight: 20 },
  })
}
