import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useSavedLocations } from '@/lib/hooks/useSavedLocations'
import { useSavedPosts } from '@/lib/hooks/useSavedPosts'
import { useLikedPosts } from '@/lib/hooks/useLikedPosts'
import { usePagedList } from '@/lib/hooks/usePagedList'
import { supabase } from '@/lib/supabase'
import { demoCurrentUser } from '@/lib/dataSources/demoData'
import { BookmarkIcon, HeartIcon, ImagePlaceholder, SettingsIcon, ShareIcon } from '@/components/icons'
import { ProfileHeader } from '@/components/ProfileHeader'
import { ThumbGrid } from '@/components/ThumbGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { parseLikes } from '@/lib/utils/format'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

type TabKey = 'posts' | 'saved' | 'liked'

type ProfileInfo = {
  full_name: string | null
  bio: string | null
  suburb: string | null
  city: string | null
  country: string | null
}

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('posts')
  const { posts } = usePosts()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const router = useRouter()
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const { savedLocations, refresh: refreshLocations } = useSavedLocations(user?.id)
  const {
    savedPosts,
    refresh: refreshSavedPosts,
    loadMore: loadMoreSaved,
    loadingMore: savedLoadingMore,
    hasMore: savedHasMore,
  } = useSavedPosts(user?.id)
  const {
    likedPosts,
    refresh: refreshLikedPosts,
    loadMore: loadMoreLiked,
    loadingMore: likedLoadingMore,
    hasMore: likedHasMore,
  } = useLikedPosts(user?.id)

  useEffect(() => {
    if (tabParam === 'saved' || tabParam === 'liked') setActiveTab(tabParam as TabKey)
  }, [tabParam])

  useEffect(() => {
    if (!user) requireAuth()
  }, [user])

  const loadProfileData = useCallback(async () => {
    if (!user) {
      setProfileInfo(null)
      return
    }
    const { data } = await (supabase.from('users') as any)
      .select('full_name, bio, suburb, city, country')
      .eq('id', user.id)
      .single()
    if (data) setProfileInfo(data)
  }, [user?.id])

  useEffect(() => {
    loadProfileData()
  }, [loadProfileData])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([loadProfileData(), refreshLocations(), refreshSavedPosts(), refreshLikedPosts()])
    setRefreshing(false)
  }

  const myPosts = useMemo(() => posts.filter(p => p.userId === user?.id), [posts, user?.id])
  const { visible: visibleMyPosts, hasMore: myPostsHasMore, loadMore: loadMoreMyPosts } =
    usePagedList(myPosts)

  const badgeLabel = useMemo(() => {
    if (myPosts.length === 0) return null
    const avgFood = myPosts.reduce((s, p) => s + p.food, 0) / myPosts.length
    if (myPosts.length >= 10) return 'Local expert'
    if (myPosts.length >= 5) return 'Prolific reviewer'
    if (avgFood >= 4.5) return 'Quality hunter'
    return 'Explorer'
  }, [myPosts])

  const avgFoodRating = useMemo(() => {
    if (myPosts.length === 0) return null
    return (myPosts.reduce((s, p) => s + p.food, 0) / myPosts.length).toFixed(1)
  }, [myPosts])

  const totalLikesLabel = useMemo(() => {
    const sum = myPosts.reduce((s, p) => s + parseLikes(p.likes), 0)
    return sum >= 1000 ? `${(sum / 1000).toFixed(1)}k` : `${sum}`
  }, [myPosts])

  const topSpots = useMemo(() => savedLocations.slice(0, 5), [savedLocations])

  const COST_RANGE_LABELS: Record<number, string> = { 1: 'Budget', 2: 'Mid-range', 3: 'Pricey', 4: 'Fine dining' }

  const tasteProfile = useMemo(() => {
    if (myPosts.length < 3) return null
    const byCuisine: Record<string, number[]> = {}
    for (const p of myPosts) {
      if (p.cuisine_type && p.food > 0) {
        if (!byCuisine[p.cuisine_type]) byCuisine[p.cuisine_type] = []
        byCuisine[p.cuisine_type].push(p.food)
      }
    }
    const topCuisines = Object.entries(byCuisine)
      .map(([name, ratings]) => ({ name, avgFood: ratings.reduce((a, b) => a + b, 0) / ratings.length }))
      .sort((a, b) => b.avgFood - a.avgFood)
      .slice(0, 3)
      .map(c => c.name)
    const costCounts: Record<number, number> = {}
    for (const p of myPosts) if (p.cost > 0) costCounts[p.cost] = (costCounts[p.cost] ?? 0) + 1
    const preferredCost = Object.entries(costCounts)
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0]
    const vibeScores = myPosts.filter(p => p.vibe > 0).map(p => p.vibe)
    const avgVibe = vibeScores.length
      ? (vibeScores.reduce((a, b) => a + b, 0) / vibeScores.length).toFixed(1)
      : null
    if (topCuisines.length === 0 && !preferredCost && !avgVibe) return null
    return { topCuisines, preferredCost: preferredCost ? COST_RANGE_LABELS[Number(preferredCost)] ?? null : null, avgVibe }
  }, [myPosts])

  const locationLabel = useMemo(() => {
    if (!profileInfo) return null
    return (
      [profileInfo.suburb, profileInfo.city, profileInfo.country].filter(Boolean).join(', ') || null
    )
  }, [profileInfo])

  const displayName = profileInfo?.full_name ?? 'Sarah Lee'
  const bio =
    profileInfo?.bio ??
    'Sydney-based food lover hunting hidden gems and honest eats. No sponsored content, ever.'

  function tabContent() {
    if (activeTab === 'posts') {
      return myPosts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          subtitle="Share your first food experience."
          icon={<ImagePlaceholder size={25} color={colors.text3} />}
        />
      ) : (
        <ThumbGrid posts={visibleMyPosts} hasMore={myPostsHasMore} onLoadMore={loadMoreMyPosts} />
      )
    }
    if (activeTab === 'saved') {
      return savedPosts.length === 0 ? (
        <EmptyState
          title="No saved posts yet"
          subtitle="Bookmark reviews to find them here."
          icon={<BookmarkIcon size={24} inactiveColor={colors.text3} />}
        />
      ) : (
        <ThumbGrid
          posts={savedPosts}
          onLoadMore={loadMoreSaved}
          loadingMore={savedLoadingMore}
          hasMore={savedHasMore}
        />
      )
    }
    return likedPosts.length === 0 ? (
      <EmptyState
        title="No liked posts yet"
        subtitle="Heart reviews you love."
        icon={<HeartIcon size={24} />}
      />
    ) : (
      <ThumbGrid
        posts={likedPosts}
        onLoadMore={loadMoreLiked}
        loadingMore={likedLoadingMore}
        hasMore={likedHasMore}
      />
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.iconSpacer} />
        <Text style={styles.username}>@{demoCurrentUser.username}</Text>
        <IconButton accessibilityLabel="Open settings" onPress={() => router.push('/settings')}>
          <SettingsIcon />
        </IconButton>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text}
          />
        }
      >
        <ProfileHeader
          initials={demoCurrentUser.initials}
          avatarBg={demoCurrentUser.avatarBg}
          avatarColor={demoCurrentUser.avatarColor}
          displayName={displayName}
          badgeLabel={badgeLabel}
          postCount={myPosts.length}
          followersLabel="1.4k"
          followingLabel={312}
          bio={bio}
          locationLabel={locationLabel}
          avgFoodRating={avgFoodRating}
          totalLikesLabel={totalLikesLabel}
          savedSpotsCount={savedLocations.length}
        />

        {/* Taste profile */}
        {tasteProfile && (
          <View style={styles.tasteCard}>
            <Text style={styles.tasteHeading}>Taste profile</Text>
            {tasteProfile.topCuisines.length > 0 && (
              <View style={styles.tasteRow}>
                <Text style={styles.tasteLabel}>Top cuisines</Text>
                <Text style={styles.tasteValue}>{tasteProfile.topCuisines.join(' · ')}</Text>
              </View>
            )}
            <View style={styles.tasteRow}>
              {tasteProfile.preferredCost && (
                <View style={styles.tasteChip}>
                  <Text style={styles.tasteChipText}>💳 {tasteProfile.preferredCost}</Text>
                </View>
              )}
              {tasteProfile.avgVibe && (
                <View style={styles.tasteChip}>
                  <Text style={styles.tasteChipText}>✦ {tasteProfile.avgVibe} avg vibe</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Favourite spots */}
        {topSpots.length > 0 && (
          <View style={styles.spotsSection}>
            <Text style={styles.spotsLabel}>Favourite spots</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.spotsScroll}
            >
              {topSpots.map(loc => {
                const r = loc.restaurants
                if (!r) return null
                return (
                  <TouchableOpacity
                    key={loc.id}
                    style={styles.spotChip}
                    onPress={() =>
                      router.push({
                        pathname: '/restaurants/[restaurantId]',
                        params: {
                          restaurantId: r.google_place_id ?? loc.restaurant_id ?? 'none',
                          placeId: r.google_place_id ?? 'none',
                          name: r.name,
                          address: r.address ?? '',
                          lat: String(r.latitude ?? ''),
                          lng: String(r.longitude ?? ''),
                        },
                      })
                    }
                    activeOpacity={0.75}
                  >
                    <Text style={styles.spotName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    {!!r.address && (
                      <Text style={styles.spotAddress} numberOfLines={1}>
                        {r.address.split(',')[0]}
                      </Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionBtns}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/settings/edit-profile')}
          >
            <Text style={styles.editBtnText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn}>
            <ShareIcon size={14} color={colors.text} />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['posts', 'saved', 'liked'] as TabKey[]).map(key => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, activeTab === key && styles.tabActive]}
              onPress={() => setActiveTab(key)}
            >
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tabContent()}
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
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    username: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    iconSpacer: { width: 34 },
    tasteCard: {
      marginHorizontal: spacing[5],
      marginTop: spacing[4],
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px14,
      gap: spacing.px10,
    },
    tasteHeading: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: c.text3, letterSpacing: 0.8 },
    tasteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
    tasteLabel: { fontSize: fontSize.sm, color: c.text3, width: 80 },
    tasteValue: { flex: 1, fontSize: fontSize.bodySm, color: c.text2 },
    tasteChip: {
      backgroundColor: c.bg,
      borderRadius: radius.pill,
      borderWidth: 0.5,
      borderColor: c.border2,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px5,
    },
    tasteChipText: { fontSize: fontSize.bodySm, color: c.text2 },
    spotsSection: { paddingTop: spacing.px18, paddingLeft: spacing[5] },
    spotsLabel: { fontSize: fontSize.sm, color: c.text3, marginBottom: spacing[2] },
    spotsScroll: { paddingRight: spacing[5], gap: spacing[2] },
    spotChip: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px10,
      maxWidth: 140,
    },
    spotName: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text },
    spotAddress: { fontSize: fontSize.xs, color: c.text3, marginTop: spacing.px2 },
    actionBtns: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[5], paddingTop: spacing.px18 },
    editBtn: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border2,
      borderRadius: radius.md,
      paddingVertical: spacing.px9,
      alignItems: 'center',
    },
    editBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border2,
      borderRadius: radius.md,
      paddingVertical: spacing.px9,
      paddingHorizontal: spacing.px14,
    },
    shareBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      marginTop: spacing.px18,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing[3],
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -spacing.hairline,
    },
    tabActive: { borderBottomColor: c.text },
    tabText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text3 },
    tabTextActive: { color: c.text },
  })
}
