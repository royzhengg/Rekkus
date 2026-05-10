import React, { useState, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { imgColors } from '@/constants/Colors'
import { useThemeColors } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/AuthContext'
import { useAuthGate } from '@/lib/AuthGateContext'
import { supabase } from '@/lib/supabase'
import { MOCK_USERS, RESTAURANTS, MY_CREATOR } from '@/lib/data'
import { useSearch, type PersonResult, type PlaceResult } from '@/lib/hooks/useSearch'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import { useTrendingData } from '@/lib/hooks/useTrendingData'
import { formatKm } from '@/lib/utils/geo'
import { SearchIcon, CloseIcon, PinIcon, ImagePlaceholder } from '@/components/icons'
import { PostRatingStrip } from '@/components/RatingDisplay'
import { Avatar } from '@/components/Avatar'
import type { Post } from '@/lib/data'

// ─── Constants ───────────────────────────────────────────────────────────────

const CHIPS = [
  { label: 'Ramen', emoji: '🍜', query: 'ramen' },
  { label: 'Brunch', emoji: '☀️', query: 'brunch' },
  { label: 'Dumplings', emoji: '🥟', query: 'dumplings' },
  { label: 'Date night', emoji: '🌙', query: 'date night' },
  { label: 'Cheap eats', emoji: '💸', query: 'cheap' },
  { label: 'Japanese', emoji: '🍣', query: 'japanese' },
  { label: 'Burgers', emoji: '🍔', query: 'burger' },
]

const TRENDING = [
  { tag: '#ramen', count: '4.2k posts' },
  { tag: '#sydneybrunch', count: '3.8k posts' },
  { tag: '#hiddengem', count: '2.9k posts' },
  { tag: '#melbournefood', count: '2.1k posts' },
  { tag: '#dumplings', count: '1.7k posts' },
  { tag: '#datenight', count: '1.4k posts' },
]

// ─── Reusable row components ──────────────────────────────────────────────────

const PersonRow = React.memo(function PersonRow({ person }: { person: PersonResult }) {
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [following, setFollowing] = useState(false)

  function handleFollow() {
    if (!user) {
      requireAuth()
      return
    }
    setFollowing(f => !f)
  }

  return (
    <TouchableOpacity
      style={styles.personRow}
      onPress={() =>
        router.push({ pathname: '/user/[username]', params: { username: person.username } })
      }
      activeOpacity={0.7}
    >
      <Avatar
        initials={person.initials}
        bg={person.avatarBg}
        color={person.avatarColor}
        size={40}
      />
      <View style={styles.personInfo}>
        <Text style={styles.personUsername}>@{person.username}</Text>
        <Text style={styles.personName} numberOfLines={1}>
          {person.displayName}
        </Text>
      </View>
      {person.followers !== '—' && (
        <Text style={styles.personFollowers}>{person.followers} followers</Text>
      )}
      <TouchableOpacity
        style={[styles.followPill, following && styles.followPillActive]}
        onPress={handleFollow}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.followPillText, following && styles.followPillTextActive]}>
          {following ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
})

const PostCompactRow = React.memo(function PostCompactRow({ post }: { post: Post }) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <TouchableOpacity
      style={styles.postRow}
      onPress={() => router.push(`/post/${post.id}`)}
      activeOpacity={0.8}
    >
      <View style={[styles.postThumb, { backgroundColor: imgColors[post.imgKey] }]}>
        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            resizeMode="cover"
          />
        ) : (
          <ImagePlaceholder size={18} />
        )}
      </View>
      <View style={styles.postRowContent}>
        <View style={styles.postRowTop}>
          <Text style={styles.postRowCreator}>@{post.creator}</Text>
          <Text style={styles.postRowLikes}>♡ {post.likes}</Text>
        </View>
        <Text style={styles.postRowTitle} numberOfLines={2}>
          {post.title}
        </Text>
        <PostRatingStrip food={post.food} vibe={post.vibe} cost={post.cost} />
      </View>
    </TouchableOpacity>
  )
})

const PlaceRow = React.memo(function PlaceRow({
  place,
  distanceKm,
  user,
  query,
}: {
  place: PlaceResult
  distanceKm?: number
  user?: { id: string } | null
  query?: string
}) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const meta = [place.city, place.cuisine_type].filter(Boolean).join(' · ')

  function handlePress() {
    if (user && place.id) {
      ;(supabase.from('analytics_events') as any)
        .insert({
          user_id: user.id,
          event_type: 'place_click',
          entity_type: 'restaurant',
          entity_id: place.id,
          metadata: query ? { query } : null,
        })
        .then(() => {})
    }
    router.push({
      pathname: '/location/[placeId]',
      params: {
        placeId: place.google_place_id ?? 'none',
        name: place.name,
        address: place.address ?? '',
        lat: String(place.latitude ?? ''),
        lng: String(place.longitude ?? ''),
      },
    })
  }

  return (
    <TouchableOpacity style={styles.placeRow} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.placeIconWrap}>
        <PinIcon size={12} />
      </View>
      <View style={styles.placeInfo}>
        <Text style={styles.placeName}>{place.name}</Text>
        {(!!meta || distanceKm != null) && (
          <Text style={styles.placeMeta} numberOfLines={1}>
            {[meta, distanceKm != null ? formatKm(distanceKm) : null].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
})

const PersonChip = React.memo(function PersonChip({
  username,
  u,
}: {
  username: string
  u: (typeof MOCK_USERS)[string]
}) {
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [following, setFollowing] = useState(false)

  function handleFollow() {
    if (!user) {
      requireAuth()
      return
    }
    setFollowing(f => !f)
  }

  return (
    <View style={styles.personChip}>
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/user/[username]', params: { username } })}
        activeOpacity={0.8}
        style={styles.personChipInner}
      >
        <Avatar initials={u.initials} bg={u.avatarBg} color={u.avatarColor} size={52} />
        <Text style={styles.personChipUsername} numberOfLines={1}>
          @{username}
        </Text>
        <Text style={styles.personChipFollowers}>{u.followers}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.followPill, following && styles.followPillActive, { marginTop: 6 }]}
        onPress={handleFollow}
      >
        <Text style={[styles.followPillText, following && styles.followPillTextActive]}>
          {following ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </View>
  )
})

function SectionHeader({ title, count }: { title: string; count?: number }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {count != null && <Text style={styles.sectionCount}>{count}</Text>}
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState('')
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { user } = useAuth()
  const userLocation = useUserLocation()
  const { trendingSearches } = useTrendingData()

  const { postResults, peopleResults, placeResults, placeDistances, hasQuery } = useSearch(
    query,
    userLocation
  )

  // Track search queries (debounced to 600ms — fires after user pauses typing)
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2 || !user) return
    const timer = setTimeout(() => {
      ;(supabase.from('analytics_events') as any)
        .insert({
          user_id: user.id,
          event_type: 'search_query',
          metadata: { query: trimmed },
        })
        .then(() => {})
    }, 600)
    return () => clearTimeout(timer)
  }, [query, user?.id])

  const suggestedPeople = useMemo(
    () => Object.entries(MOCK_USERS).filter(([u]) => u !== MY_CREATOR),
    []
  )

  const popularPlaces = useMemo<PlaceResult[]>(
    () =>
      RESTAURANTS.slice(0, 5).map(r => ({
        id: r.name,
        name: r.name,
        address: r.address ?? null,
        city: r.suburb ?? null,
        cuisine_type: null,
        google_place_id: r.placeId ?? null,
        latitude: r.lat ?? null,
        longitude: r.lng ?? null,
        google_rating: null,
        google_review_count: null,
      })),
    []
  )

  // Use real trending data when available, fall back to hardcoded
  const trendingItems = useMemo(() => {
    if (trendingSearches.length > 0) {
      return trendingSearches.map(q => ({ tag: q, count: '' }))
    }
    return TRENDING
  }, [trendingSearches])

  const totalResults = postResults.length + peopleResults.length + placeResults.length

  function handleChip(chip: (typeof CHIPS)[number]) {
    setActiveChip(chip.query)
    setQuery(chip.query)
  }

  function handleTrending(tag: string) {
    setQuery(tag)
    setActiveChip('')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>
          rekkus<Text style={styles.wordmarkDot}>.</Text>
        </Text>
      </View>

      <View style={styles.searchTop}>
        <View style={styles.searchWrap}>
          <SearchIcon />
          <TextInput
            style={styles.searchField}
            placeholder="Search dishes, people, places…"
            placeholderTextColor={colors.text3}
            value={query}
            onChangeText={t => {
              setQuery(t)
              setActiveChip('')
            }}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setQuery('')
                setActiveChip('')
              }}
            >
              <CloseIcon />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CHIPS.map(chip => (
            <TouchableOpacity
              key={chip.query}
              style={[styles.chip, activeChip === chip.query && styles.chipActive]}
              onPress={() => handleChip(chip)}
            >
              <Text style={styles.chipEmoji}>{chip.emoji}</Text>
              <Text style={[styles.chipText, activeChip === chip.query && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {!hasQuery ? (
          <View style={styles.discoveryPage}>
            <SectionHeader title="People to follow" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.peopleChipsRow}
            >
              {suggestedPeople.map(([username, u]) => (
                <PersonChip key={username} username={username} u={u} />
              ))}
            </ScrollView>

            <SectionHeader title="Trending now" />
            <View style={styles.trendingList}>
              {trendingItems.map((item, i) => (
                <TouchableOpacity
                  key={item.tag}
                  style={[
                    styles.trendingItem,
                    i === trendingItems.length - 1 && styles.trendingItemLast,
                  ]}
                  onPress={() => handleTrending(item.tag)}
                >
                  <Text style={[styles.trendingRank, i < 3 && styles.trendingRankHot]}>
                    {i + 1}
                  </Text>
                  <Text style={styles.trendingTag}>{item.tag}</Text>
                  {!!item.count && <Text style={styles.trendingCount}>{item.count}</Text>}
                </TouchableOpacity>
              ))}
            </View>

            <SectionHeader title="Popular places" />
            <View style={styles.sectionContent}>
              {popularPlaces.map(place => (
                <PlaceRow key={place.id} place={place} />
              ))}
            </View>
          </View>
        ) : totalResults === 0 ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsTitle}>No results for "{query}"</Text>
            <Text style={styles.noResultsBody}>Try a different dish, place, or person</Text>
          </View>
        ) : (
          <View style={styles.resultsPage}>
            {peopleResults.length > 0 && (
              <View>
                <SectionHeader title="People" count={peopleResults.length} />
                <View style={styles.sectionContent}>
                  {peopleResults.slice(0, 5).map(p => (
                    <PersonRow key={p.username} person={p} />
                  ))}
                </View>
              </View>
            )}
            {postResults.length > 0 && (
              <View>
                <SectionHeader title="Posts" count={postResults.length} />
                <View style={styles.sectionContent}>
                  {postResults.map(p => (
                    <PostCompactRow key={p.id} post={p} />
                  ))}
                </View>
              </View>
            )}
            {placeResults.length > 0 && (
              <View>
                <SectionHeader title="Places" count={placeResults.length} />
                <View style={styles.sectionContent}>
                  {placeResults.slice(0, 8).map(p => (
                    <PlaceRow
                      key={p.id}
                      place={p}
                      distanceKm={placeDistances.get(p.id)}
                      user={user}
                      query={query}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    wordmark: {
      fontFamily: 'DMSerifDisplay-Regular',
      fontSize: 22,
      color: c.text,
      letterSpacing: -0.5,
    },
    wordmarkDot: { color: c.accent },
    searchTop: {
      paddingHorizontal: 16,
      paddingTop: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      backgroundColor: c.bg,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
      marginBottom: 12,
    },
    searchField: { flex: 1, fontSize: 14, color: c.text, padding: 0 },
    clearBtn: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: c.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chips: { gap: 7, paddingBottom: 12 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 13,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.text, borderColor: c.text },
    chipEmoji: { fontSize: 12 },
    chipText: { fontSize: 12, color: c.text2 } as any,
    chipTextActive: { color: c.bg },
    scroll: { flex: 1 },
    discoveryPage: { paddingBottom: 24 },
    peopleChipsRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
    personChip: { width: 88, alignItems: 'center' },
    personChipInner: { alignItems: 'center', gap: 6 },
    personChipUsername: { fontSize: 11, color: c.text, maxWidth: 84, textAlign: 'center' },
    personChipFollowers: { fontSize: 10, color: c.text3, textAlign: 'center' },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 10,
    },
    sectionTitle: { fontSize: 11, fontWeight: '600', color: c.text3, letterSpacing: 0.7 },
    sectionCount: { fontSize: 11, color: c.text3 },
    sectionContent: {},
    trendingList: { paddingHorizontal: 16 },
    trendingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    trendingItemLast: { borderBottomWidth: 0 },
    trendingRank: {
      fontSize: 13,
      fontWeight: '500',
      color: c.text3,
      width: 20,
      textAlign: 'center',
    },
    trendingRankHot: { color: c.accent },
    trendingTag: { flex: 1, fontSize: 13, color: c.text },
    trendingCount: { fontSize: 11, color: c.text3 },
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    personInfo: { flex: 1 },
    personUsername: { fontSize: 13, fontWeight: '500', color: c.text },
    personName: { fontSize: 11, color: c.text3, marginTop: 1 },
    personFollowers: { fontSize: 11, color: c.text3 },
    followPill: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border2,
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: c.text,
    },
    followPillActive: { backgroundColor: c.surface },
    followPillText: { fontSize: 12, fontWeight: '500', color: c.bg },
    followPillTextActive: { color: c.text },
    postRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    postThumb: {
      width: 60,
      height: 60,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    postRowContent: { flex: 1 },
    postRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    postRowCreator: { fontSize: 11, color: c.text3 },
    postRowLikes: { fontSize: 11, color: c.text3 },
    postRowTitle: { fontSize: 13, color: c.text, lineHeight: 18, marginBottom: 4 },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    placeIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeInfo: { flex: 1 },
    placeName: { fontSize: 13, fontWeight: '500', color: c.text },
    placeMeta: { fontSize: 11, color: c.text3, marginTop: 2 },
    resultsPage: { paddingBottom: 24 },
    noResults: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 8 },
    noResultsTitle: { fontSize: 14, fontWeight: '500', color: c.text, textAlign: 'center' },
    noResultsBody: { fontSize: 12, color: c.text3, textAlign: 'center' },
  })
}
