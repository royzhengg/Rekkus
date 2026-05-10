import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/ThemeContext'
import { usePosts } from '@/lib/PostsContext'
import { useAuth } from '@/lib/AuthContext'
import { useAuthGate } from '@/lib/AuthGateContext'
import { useSavedLocations } from '@/lib/hooks/useSavedLocations'
import { supabase } from '@/lib/supabase'
import { MY_CREATOR, MY_INITIALS, MY_AVATAR_BG, MY_AVATAR_COLOR } from '@/lib/data'
import { SettingsIcon, ShareIcon } from '@/components/icons'
import { ProfileHeader } from '@/components/ProfileHeader'
import { ThumbGrid } from '@/components/ThumbGrid'
import { parseLikes } from '@/lib/utils/format'

type TabKey = 'posts' | 'saved' | 'liked'

function EmptyTabText({ children }: { children: string }) {
  const c = useThemeColors()
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 50 }}>
      <Text style={{ fontSize: 13, color: c.text3, textAlign: 'center', lineHeight: 20 }}>
        {children}
      </Text>
    </View>
  )
}

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
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [likedIds, setLikedIds] = useState<string[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const { savedLocations, refresh: refreshLocations } = useSavedLocations(user?.id)

  useEffect(() => {
    if (!user) requireAuth()
  }, [user])

  const loadProfileData = useCallback(async () => {
    if (!user) {
      setLikedIds([])
      setSavedIds([])
      setProfileInfo(null)
      return
    }
    const [likesRes, savesRes, profileRes] = await Promise.all([
      (supabase.from('likes') as any).select('post_id').eq('user_id', user.id).limit(500),
      (supabase.from('saves') as any).select('post_id').eq('user_id', user.id).limit(500),
      (supabase.from('users') as any)
        .select('full_name, bio, suburb, city, country')
        .eq('id', user.id)
        .single(),
    ])
    if (likesRes.data) setLikedIds(likesRes.data.map((r: any) => r.post_id))
    if (savesRes.data) setSavedIds(savesRes.data.map((r: any) => r.post_id))
    if (profileRes.data) setProfileInfo(profileRes.data)
  }, [user?.id])

  useEffect(() => {
    loadProfileData()
  }, [loadProfileData])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([loadProfileData(), refreshLocations()])
    setRefreshing(false)
  }

  const myPosts = posts.filter(p => p.creator === MY_CREATOR)
  const savedPosts = posts.filter(p => savedIds.includes(p.dbId))
  const likedPosts = posts.filter(p => likedIds.includes(p.dbId))

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
        <EmptyTabText>{'No posts yet.\nShare your first food experience.'}</EmptyTabText>
      ) : (
        <ThumbGrid posts={myPosts} />
      )
    }
    if (activeTab === 'saved') {
      return savedPosts.length === 0 ? (
        <EmptyTabText>{'No saved posts yet.\nBookmark reviews to find them here.'}</EmptyTabText>
      ) : (
        <ThumbGrid posts={savedPosts} />
      )
    }
    return likedPosts.length === 0 ? (
      <EmptyTabText>{'No liked posts yet.\nHeart reviews you love.'}</EmptyTabText>
    ) : (
      <ThumbGrid posts={likedPosts} />
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <View style={{ width: 34 }} />
        <Text style={styles.username}>@{MY_CREATOR}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')}>
          <SettingsIcon />
        </TouchableOpacity>
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
          initials={MY_INITIALS}
          avatarBg={MY_AVATAR_BG}
          avatarColor={MY_AVATAR_COLOR}
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
                        pathname: '/location/[placeId]',
                        params: {
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
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    username: { fontSize: 15, fontWeight: '500', color: c.text },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spotsSection: { paddingTop: 18, paddingLeft: 20 },
    spotsLabel: { fontSize: 11, color: c.text3, marginBottom: 8 },
    spotsScroll: { paddingRight: 20, gap: 8 },
    spotChip: {
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      maxWidth: 140,
    },
    spotName: { fontSize: 12, fontWeight: '500', color: c.text },
    spotAddress: { fontSize: 10, color: c.text3, marginTop: 2 },
    actionBtns: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 18 },
    editBtn: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border2,
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: 'center',
    },
    editBtnText: { fontSize: 13, fontWeight: '500', color: c.text },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border2,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 14,
    },
    shareBtnText: { fontSize: 13, fontWeight: '500', color: c.text },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      marginTop: 18,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -0.5,
    },
    tabActive: { borderBottomColor: c.text },
    tabText: { fontSize: 12, fontWeight: '500', color: c.text3 },
    tabTextActive: { color: c.text },
  })
}
