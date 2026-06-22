import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { EditIcon, ImagePlaceholder, SettingsIcon, ShareIcon } from '@/components/icons'
import { ProfileHeader } from '@/components/ProfileHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { demoCurrentUser } from '@/lib/dataSources/demoData'
import { usePagedList } from '@/lib/hooks/usePagedList'
import { useSavedPlaces } from '@/lib/hooks/useSavedPlaces'
import { routes } from '@/lib/routes'
import { fetchProfileCollections, type Collection } from '@/lib/services/collections'
import { fetchTopSpotsWithDetails } from '@/lib/services/topSpots'
import {
  fetchFollowCounts,
  fetchProfile,
  removeFollowChannel,
  subscribeToFollowChanges,
} from '@/lib/services/users'
import { CollectionList, FavouriteCuisines } from './ProfileFoodSections'
import {
  deriveProfileInterests,
  derivePlacesWithPosts,
  deriveTopPlaces,
  formatProfileCount,
  normalizeProfileTabParam,
  type ProfilePlace,
} from './profileIdentity'
import { hydrateProfilePlacePhotos } from './profilePhotos'
import { ProfilePostCards } from './ProfilePostCards'
import { TopSpotCards } from './TopSpotCards'

type TabKey = 'posts' | 'collections'

const TAB_LABELS: Record<TabKey, string> = {
  posts: 'Posts',
  collections: 'Collections',
}

type ProfileInfo = {
  username: string
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
  const { syncEpoch } = useConnectivity()
  const router = useRouter()
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null)
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number } | null>(null)
  const [profileCollections, setProfileCollections] = useState<Collection[]>([])
  const [hydratedTopPlaces, setHydratedTopPlaces] = useState<ProfilePlace[]>([])
  const [manualTopSpots, setManualTopSpots] = useState<ProfilePlace[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const { savedPlaces, refresh: refreshLocations } = useSavedPlaces(user?.id)

  useEffect(() => {
    const normalisedTab = normalizeProfileTabParam(tabParam)
    if (normalisedTab === 'saved-legacy') {
      router.replace(routes.saved('posts'))
      return
    }
    if (normalisedTab === 'collections' || normalisedTab === 'posts') setActiveTab(normalisedTab)
  }, [router, tabParam])

  useEffect(() => {
    if (!user) requireAuth()
  }, [user, requireAuth])

  const loadProfileData = useCallback(async () => {
    if (!user) {
      setProfileInfo(null)
      return
    }
    const data = await fetchProfile(user.id)
    if (data) setProfileInfo(data)
  }, [user])

  const loadFollowCounts = useCallback(async () => {
    if (!user) {
      setFollowCounts(null)
      return
    }
    try {
      const counts = await fetchFollowCounts(user.id)
      setFollowCounts(counts)
    } catch {
      setFollowCounts(null)
    }
  }, [user])

  const loadProfileCollections = useCallback(async () => {
    if (!user) {
      setProfileCollections([])
      return
    }
    try {
      setProfileCollections(await fetchProfileCollections(user.id, false))
    } catch {
      setProfileCollections([])
    }
  }, [user])

  const loadManualTopSpots = useCallback(async () => {
    if (!user) { setManualTopSpots(null); return }
    const spots = await fetchTopSpotsWithDetails(user.id)
    setManualTopSpots(spots)
  }, [user])

  useEffect(() => {
    void loadProfileData()
    void loadFollowCounts()
    void loadProfileCollections()
    void loadManualTopSpots()
  }, [loadFollowCounts, loadProfileData, loadProfileCollections, loadManualTopSpots])

  useFocusEffect(
    useCallback(() => {
      void loadProfileData()
      void loadFollowCounts()
      void loadProfileCollections()
      void loadManualTopSpots()
    }, [loadFollowCounts, loadProfileData, loadProfileCollections, loadManualTopSpots])
  )

  useEffect(() => {
    if (syncEpoch > 0) void loadFollowCounts()
  }, [loadFollowCounts, syncEpoch])

  useEffect(() => {
    if (!user) return
    const channel = subscribeToFollowChanges(user.id, () => { void loadFollowCounts() })
    return () => { removeFollowChannel(channel) }
  }, [loadFollowCounts, user])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([loadProfileData(), loadFollowCounts(), loadProfileCollections(), refreshLocations(), loadManualTopSpots()])
    setRefreshing(false)
  }

  const myPosts = useMemo(() => posts.filter(p => p.userId === user?.id), [posts, user?.id])
  const { visible: visibleMyPosts, hasMore: myPostsHasMore, loadMore: loadMoreMyPosts } =
    usePagedList(myPosts)

  const profileInterests = useMemo(() => deriveProfileInterests(myPosts), [myPosts])
  const placesWithPosts = useMemo(() => derivePlacesWithPosts(myPosts), [myPosts])
  const topPlacesSource = useMemo(() => {
    if (manualTopSpots && manualTopSpots.length > 0) return manualTopSpots
    return deriveTopPlaces(placesWithPosts, savedPlaces)
  }, [manualTopSpots, placesWithPosts, savedPlaces])

  useEffect(() => {
    let cancelled = false
    void hydrateProfilePlacePhotos(topPlacesSource).then(places => {
      if (!cancelled) setHydratedTopPlaces(places)
    })
    return () => {
      cancelled = true
    }
  }, [topPlacesSource])

  const openPost = useCallback((post: { dbId?: string; id: string | number }) => {
    router.push(routes.postDetail(String(post.dbId || post.id)))
  }, [router])

  const locationLabel = useMemo(() => {
    if (!profileInfo) return null
    return (
      [profileInfo.suburb, profileInfo.city, profileInfo.country].filter(Boolean).join(', ') || null
    )
  }, [profileInfo])

  const displayName = profileInfo?.full_name ?? 'Sarah Lee'
  const profileUsername = profileInfo?.username ?? demoCurrentUser.username

  const openPlace = useCallback((place: ProfilePlace) => {
    analytics.profileInteraction(user?.id ?? null, user?.id ?? null, 'top_place_tapped')
    router.push(routes.placeDetail({
      placeId: place.id,
      ...(place.placeId ? { googlePlaceId: place.placeId } : {}),
      name: place.name,
      address: place.address ?? '',
      lat: place.lat ?? '',
      lng: place.lng ?? '',
    }))
  }, [router, user?.id])

  const selectTab = useCallback((key: TabKey) => {
    setActiveTab(key)
    analytics.profileInteraction(user?.id ?? null, user?.id ?? null, 'tab_selected', { profile_tab: key })
  }, [user?.id])

  function tabContent() {
    if (activeTab === 'posts') {
      return myPosts.length === 0 ? (
        <View style={styles.emptyWithAction}>
          <EmptyState
            title="Start your food journey"
            subtitle="Post about your first place."
            icon={<ImagePlaceholder size={25} color={colors.text3} />}
          />
          <TouchableOpacity
            style={styles.primaryEmptyButton}
            onPress={() => {
              analytics.profileInteraction(user?.id ?? null, user?.id ?? null, 'empty_review_cta_tapped')
              router.push(routes.createPost())
            }}
            accessibilityRole="button"
          >
            <Text style={styles.primaryEmptyButtonText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              Create Post
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ProfilePostCards
          posts={visibleMyPosts}
          hasMore={myPostsHasMore}
          onLoadMore={loadMoreMyPosts}
          onPressPost={openPost}
        />
      )
    }
    return profileCollections.length === 0 ? (
      <EmptyState
        title="No public collections"
        subtitle="Set a collection to public in Saved to show it here."
        icon={<ImagePlaceholder size={25} color={colors.text3} />}
      />
    ) : (
      <CollectionList collections={profileCollections} onPressCollection={collection => router.push(routes.collectionDetail(collection.id))} />
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          username={profileUsername}
          postCount={myPosts.length}
          followersLabel={followCounts ? formatProfileCount(followCounts.followers) : '—'}
          followingLabel={followCounts ? formatProfileCount(followCounts.following) : '—'}
          locationLabel={locationLabel}
          rightActions={(
            <>
              <IconButton
                accessibilityLabel="Edit profile"
                onPress={() => router.push('/settings/edit-profile')}
              >
                <EditIcon />
              </IconButton>
              <IconButton
                accessibilityLabel="Share profile"
                onPress={() => analytics.profileInteraction(user?.id ?? null, user?.id ?? null, 'share_profile_tapped')}
              >
                <ShareIcon />
              </IconButton>
              <IconButton accessibilityLabel="Open settings" onPress={() => router.push('/settings')}>
                <SettingsIcon />
              </IconButton>
            </>
          )}
          onPressFollowers={() => router.push(routes.userFollows(profileUsername, 'followers'))}
          onPressFollowing={() => router.push(routes.userFollows(profileUsername, 'following'))}
        />

        <TopSpotCards
          places={hydratedTopPlaces.length > 0 ? hydratedTopPlaces : topPlacesSource}
          onPressPlace={openPlace}
          onManage={() => {
            analytics.profileInteraction(user?.id ?? null, user?.id ?? null, 'manage_top_spots_tapped')
            router.push(routes.manageTopSpots())
          }}
        />

        {profileInterests.length > 0 && (
          <View style={styles.profileSection}>
            <Text style={styles.sectionHeading} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              Favourite Cuisines
            </Text>
            <FavouriteCuisines interests={profileInterests} />
          </View>
        )}

        <View style={styles.tabs} accessibilityRole="tablist">
          {(['posts', 'collections'] as TabKey[]).map(key => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, activeTab === key && styles.tabActive]}
              onPress={() => {
                selectTab(key)
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === key }}
            >
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
                {TAB_LABELS[key]}
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
    profileSection: {
      marginHorizontal: spacing[5],
      marginTop: spacing.px18,
      gap: spacing[2],
    },
    sectionHeading: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.text },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      marginTop: spacing.px18,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
      paddingVertical: spacing[3],
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -spacing.hairline,
    },
    tabActive: { borderBottomColor: c.text },
    tabText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text3 },
    tabTextActive: { color: c.text },
    emptyWithAction: { alignItems: 'center', paddingBottom: spacing[5] },
    primaryEmptyButton: {
      minHeight: 44,
      borderRadius: radius.md,
      backgroundColor: c.text,
      paddingHorizontal: spacing[5],
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -spacing[4],
    },
    primaryEmptyButtonText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.bg },
  })
}
