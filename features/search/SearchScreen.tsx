import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { imgColors } from '@/constants/Colors'
import { spacing } from '@/constants/Spacing'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { demoCurrentUser, demoRestaurants, demoUsers } from '@/lib/dataSources/demoData'
import {
  useSearch,
  type PersonResult,
  type PlaceResult,
  type SearchFilters,
  type SearchSortMode,
} from '@/lib/hooks/useSearch'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import { useTrendingData } from '@/lib/hooks/useTrendingData'
import { analytics } from '@/lib/analytics'
import { fetchStaffPickCollections, type Collection } from '@/lib/services/collections'
import { formatKm } from '@/lib/utils/geo'
import { SearchIcon, CloseIcon, PinIcon, ImagePlaceholder, FilterIcon, VideoIcon, ClockIcon } from '@/components/icons'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { fetchAreaSuggestionsJson } from '@/lib/services/googlePlaces'
import { CUISINE_SYNONYMS, CUISINE_ALIASES } from '@/lib/utils/cuisineSynonyms'
import { PostRatingStrip } from '@/components/RatingDisplay'
import { Avatar } from '@/components/Avatar'
import { OpenBadge } from '@/components/OpenBadge'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import type { MockUser, Post } from '@/types/domain'
import { searchCuisines } from '@/lib/dataSources/cuisines'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import {
  OCCASION_PICK_OPTIONS,
  VALUE_PICK_OPTIONS,
  occasionLabel,
  valueLabel,
} from '@/lib/dataSources/rekkusPicks'

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

const SEARCH_RADIUS_OPTIONS = [2, 5, 10, 25]
const SEARCH_SORTS: Array<{ key: SearchSortMode; label: string }> = [
  { key: 'best_match', label: 'Best match' },
  { key: 'nearby', label: 'Nearby' },
  { key: 'newest', label: 'Newest' },
  { key: 'most_saved', label: 'Most saved' },
  { key: 'highest_rekkus_picks', label: 'Highest Picks' },
]
const MEDIA_FILTERS: NonNullable<SearchFilters['mediaTypes']> = ['image', 'video', 'mixed']

type ResultTab = 'top' | 'dishes' | 'people' | 'places'

const RESULT_TABS: { key: ResultTab; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'dishes', label: 'Dishes' },
  { key: 'places', label: 'Places' },
  { key: 'people', label: 'People' },
]

function shortPlaceLocation(place: Pick<PlaceResult, 'suburb' | 'city' | 'address'>) {
  if (place.suburb) return place.suburb
  if (place.city) return place.city
  const addressParts = (place.address ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
  return addressParts.slice(0, 2).join(', ') || null
}

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
      <Chip
        label={following ? 'Following' : 'Follow'}
        selected={following}
        variant="active"
        onPress={handleFollow}
      />
    </TouchableOpacity>
  )
})

const PostCompactRow = React.memo(function PostCompactRow({
  post,
  position,
  query,
  searchSessionId,
  user,
}: {
  post: Post
  position?: number
  query?: string
  searchSessionId?: string
  user?: { id: string } | null
}) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <TouchableOpacity
      style={styles.postRow}
      onPress={() => {
        if (post.dbId && query && searchSessionId && position != null) {
          analytics.searchResultClick(
            user?.id ?? null,
            'post',
            post.dbId,
            query,
            position,
            searchSessionId
          )
        }
        router.push(`/posts/${post.dbId || post.id}`)
      }}
      activeOpacity={0.8}
    >
      <View style={[styles.postThumb, { backgroundColor: imgColors[post.imgKey] }]}>
        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            resizeMode="cover"
          />
        ) : post.videoUrl ? (
          <View style={styles.videoFallback}>
            <VideoIcon size={18} color={colors.accent} />
          </View>
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
  position,
  searchSessionId,
}: {
  place: PlaceResult
  distanceKm?: number
  user?: { id: string } | null
  query?: string
  position?: number
  searchSessionId?: string
}) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const locationLabel = shortPlaceLocation(place)
  const meta = [
    place.cuisine_type,
    locationLabel,
    distanceKm != null ? formatKm(distanceKm) : null,
  ].filter(Boolean).join(' · ')
  const badges = place.badges ?? []

  function handlePress() {
    if (place.id) {
      analytics.clickPlace(user?.id ?? null, place.id)
      if (query && searchSessionId && position != null) {
        analytics.searchResultClick(
          user?.id ?? null,
          'restaurant',
          place.id,
          query,
          position,
          searchSessionId
        )
      }
    }
    router.push({
      pathname: '/restaurants/[restaurantId]',
      params: {
        restaurantId: place.google_place_id ?? place.id ?? 'none',
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
        <View style={styles.placeTitleRow}>
          <Text style={styles.placeName} numberOfLines={1}>
            {place.name}
          </Text>
          {place.open_now != null && <OpenBadge openNow={place.open_now} />}
        </View>
        {!!meta && (
          <Text style={styles.placeMeta} numberOfLines={1}>
            {meta}
          </Text>
        )}
        {(badges.length > 0 || !!place.hint) && (
          <View style={styles.placeBadgeRow}>
            {badges.slice(0, 2).map(badge => (
              <Text key={badge} style={styles.placeBadge}>
                {badge}
              </Text>
            ))}
            {!!place.hint && <Text style={styles.placeHint}>{place.hint}</Text>}
          </View>
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
  u: MockUser
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
      <Chip
        label={following ? 'Following' : 'Follow'}
        selected={following}
        variant="active"
        onPress={handleFollow}
        style={styles.followChip}
      />
    </View>
  )
})

function SectionHeader({ title, count }: { title: string; count?: number }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count != null && <Text style={styles.sectionCount}>{count}</Text>}
    </View>
  )
}

function NearbyFilterSheet({
  visible,
  onClose,
  radiusKm,
  setRadiusKm,
  userLocation,
  filters,
  setFilters,
  onEnableNearby,
}: {
  visible: boolean
  onClose: () => void
  radiusKm: number
  setRadiusKm: (value: number) => void
  userLocation: ReturnType<typeof useUserLocation>
  filters: SearchFilters
  setFilters: (filters: SearchFilters) => void
  onEnableNearby: () => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [cuisineQuery, setCuisineQuery] = useState('')
  const cuisineOptions = useMemo(() => searchCuisines(cuisineQuery).slice(0, 10), [cuisineQuery])
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<
    Array<{ place_id: string; main_text: string; secondary_text: string; description: string }>
  >([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const locationDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleLocationQuery(text: string) {
    setLocationQuery(text)
    if (locationDebounce.current) clearTimeout(locationDebounce.current)
    if (text.length < 2) { setLocationSuggestions([]); return }
    setSuggestionsLoading(true)
    locationDebounce.current = setTimeout(async () => {
      const res = await fetchAreaSuggestionsJson(text, userLocation.coords)
      setLocationSuggestions(
        (res.predictions ?? []).slice(0, 5).map(p => ({
          place_id: p.place_id,
          main_text: p.structured_formatting.main_text,
          secondary_text: p.structured_formatting.secondary_text,
          description: p.description,
        }))
      )
      setSuggestionsLoading(false)
    }, 300)
  }

  async function selectAreaSuggestion(s: { description: string }) {
    setLocationQuery('')
    setLocationSuggestions([])
    await userLocation.setManualLocation(s.description)
    onEnableNearby()
  }

  function patchFilters(patch: Partial<SearchFilters>) {
    setFilters({ ...filters, ...patch })
  }

  function toggleArrayValue<T extends string>(
    key: 'occasions' | 'values' | 'mediaTypes',
    value: T
  ) {
    const current = ((filters[key] ?? []) as T[])
    const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value]
    patchFilters({ [key]: next } as Partial<SearchFilters>)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetDismissArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.nearbySheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Search filters</Text>
              <Text style={styles.sheetSubtitle}>Keep results focused without crowding the page.</Text>
            </View>
            <IconButton accessibilityLabel="Close filters" onPress={onClose} size={34} style={styles.sheetClose}>
              <CloseIcon />
            </IconButton>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScrollContent}>
          <View style={styles.locationBlock}>
            <Text style={styles.sheetLabel}>Location</Text>
            {userLocation.label ? (
              <View style={styles.locationActivePill}>
                <PinIcon size={12} />
                <Text style={styles.locationActiveText} numberOfLines={1}>
                  {userLocation.label}
                </Text>
                <TouchableOpacity
                  onPress={userLocation.clearLocation}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <CloseIcon />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.locationInputWrap}>
                {userLocation.loading ? (
                  <ActivityIndicator size="small" color={colors.text} style={{ marginLeft: spacing[3] }} />
                ) : (
                  <TouchableOpacity
                    style={styles.locationGpsButton}
                    onPress={() => {
                      userLocation.requestLocation()
                      onEnableNearby()
                    }}
                    activeOpacity={0.75}
                  >
                    <PinIcon size={12} />
                    <Text style={styles.locationGpsText}>Use current location</Text>
                  </TouchableOpacity>
                )}
                <TextInput
                  style={styles.locationInput}
                  placeholder="Or type suburb, city, postcode…"
                  placeholderTextColor={colors.text3}
                  value={locationQuery}
                  onChangeText={handleLocationQuery}
                  returnKeyType="search"
                />
              </View>
            )}
            {suggestionsLoading && <ActivityIndicator size="small" style={{ marginTop: spacing.px6 }} />}
            {locationSuggestions.length > 0 && (
              <View style={styles.locationSuggestions}>
                {locationSuggestions.map(s => (
                  <TouchableOpacity
                    key={s.place_id}
                    style={styles.locationSuggestionRow}
                    onPress={() => selectAreaSuggestion(s)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.locationSuggestionMain}>{s.main_text}</Text>
                    <Text style={styles.locationSuggestionSub}>{s.secondary_text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {!!userLocation.error && <Text style={styles.locationError}>{userLocation.error}</Text>}
          </View>

          <View style={styles.radiusSheetBlock}>
            <Text style={styles.sheetLabel}>Radius</Text>
            <View style={styles.radiusSheetOptions}>
             {SEARCH_RADIUS_OPTIONS.map(option => (
                <Chip
                  key={option}
                  label={`${option} km`}
                  selected={radiusKm === option}
                  variant="active"
                  onPress={() => setRadiusKm(option)}
                  style={styles.radiusSheetOption}
                />
              ))}
            </View>
          </View>

          <View style={styles.filterSheetBlock}>
            <Text style={styles.sheetLabel}>Sort</Text>
            <View style={styles.sheetChipWrap}>
              {SEARCH_SORTS.map(option => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={(filters.sort ?? 'best_match') === option.key}
                  onPress={() => patchFilters({ sort: option.key })}
                />
              ))}
            </View>
          </View>

          <View style={styles.filterSheetBlock}>
            <Text style={styles.sheetLabel}>Cuisine</Text>
            <TextInput
              style={styles.filterSearchInput}
              placeholder="Search cuisine alphabetically"
              placeholderTextColor={colors.text3}
              value={cuisineQuery}
              onChangeText={setCuisineQuery}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetChipWrap}>
              {filters.cuisine && (
                <Chip
                  label={`Clear ${filters.cuisine}`}
                  selected
                  onPress={() => patchFilters({ cuisine: null })}
                />
              )}
              {cuisineOptions.map(option => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={filters.cuisine === option.value}
                  onPress={() => patchFilters({ cuisine: option.value })}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSheetBlock}>
            <Text style={styles.sheetLabel}>Occasion</Text>
            <View style={styles.sheetChipWrap}>
              {OCCASION_PICK_OPTIONS.map(option => {
                const active = filters.occasions?.includes(option.value) ?? false
                return (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={active}
                    onPress={() => toggleArrayValue('occasions', option.value)}
                  />
                )
              })}
            </View>
          </View>

          <View style={styles.filterSheetBlock}>
            <Text style={styles.sheetLabel}>Value</Text>
            <View style={styles.sheetChipWrap}>
              {VALUE_PICK_OPTIONS.map(option => {
                const active = filters.values?.includes(option.value) ?? false
                return (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={active}
                    onPress={() => toggleArrayValue('values', option.value)}
                  />
                )
              })}
            </View>
          </View>

          <View style={styles.filterSheetBlock}>
            <Text style={styles.sheetLabel}>Media</Text>
            <View style={styles.sheetChipWrap}>
              {MEDIA_FILTERS.map(option => {
                const active = filters.mediaTypes?.includes(option) ?? false
                return (
                  <Chip
                    key={option}
                    label={option === 'image' ? 'Photos' : option === 'video' ? 'Videos' : 'Mixed'}
                    selected={active}
                    onPress={() => toggleArrayValue('mediaTypes', option)}
                  />
                )
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.sheetOption, filters.openNow && styles.sheetOptionActive]}
            onPress={() => patchFilters({ openNow: !filters.openNow })}
            activeOpacity={0.75}
          >
            <View style={styles.sheetOptionText}>
              <Text style={styles.sheetOptionTitle}>Open now</Text>
              <Text style={styles.sheetOptionBody}>Only show places marked open.</Text>
            </View>
            <Text style={styles.sheetToggleText}>{filters.openNow ? 'On' : 'Off'}</Text>
          </TouchableOpacity>

          </ScrollView>

          <View style={styles.sheetFooterRow}>
            <TouchableOpacity style={styles.sheetSecondaryButton} onPress={() => setFilters({ sort: 'best_match' })}>
              <Text style={styles.sheetSecondaryText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetDoneButton} onPress={onClose}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const params = useLocalSearchParams<{ query?: string; source?: string }>()
  const routeQuery = typeof params.query === 'string' ? params.query : ''
  const [query, setQuery] = useState(routeQuery)
  const [activeChip, setActiveChip] = useState('')
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { user } = useAuth()
  const userLocation = useUserLocation({ autoRequest: true })
  const [isFocused, setIsFocused] = useState(false)
  const [searchMode, setSearchMode] = useState<'search' | 'aroundMe'>('search')
  const [radiusKm, setRadiusKm] = useState(10)
  const [nearbySheetVisible, setNearbySheetVisible] = useState(false)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ sort: 'best_match' })
  const [resultTab, setResultTab] = useState<ResultTab>('top')
  const [staffPicks, setStaffPicks] = useState<Collection[]>([])
  const { trendingSearches } = useTrendingData()
  const { recentSearches, dismissSearch } = useSearchHistory()
  const searchSessionId = useRef(`search-${Date.now().toString(36)}`)
  const queryPosition = useRef(0)
  const previousTrackedQuery = useRef('')

  const {
    postResults,
    peopleResults,
    placeResults,
    placeDistances,
    suggestions,
    hasQuery,
    expansionLabel,
  } =
    useSearch(query, userLocation.coords, {
      mode: searchMode,
      radiusKm,
      userId: user?.id,
      filters: searchFilters,
    })
  const totalResults = postResults.length + peopleResults.length + placeResults.length

  const SEARCH_POST_LIMIT = 20
  const [visiblePostCount, setVisiblePostCount] = useState(SEARCH_POST_LIMIT)

  useEffect(() => {
    setVisiblePostCount(SEARCH_POST_LIMIT)
    setResultTab('top')
  }, [query, searchMode])

  useEffect(() => {
    if (!routeQuery) return
    setQuery(routeQuery)
    setActiveChip('')
    setSearchMode('search')
    setResultTab('top')
  }, [routeQuery])

  useEffect(() => {
    fetchStaffPickCollections().then(setStaffPicks)
  }, [])

  // Track search queries (debounced to 600ms — fires after user pauses typing)
  useEffect(() => {
    const trimmed = query.trim()
    if (searchMode === 'aroundMe') return
    if (!trimmed || trimmed.length < 2) return
    const timer = setTimeout(() => {
      queryPosition.current += 1
      analytics.searchQuery(
        user?.id ?? null,
        trimmed,
        totalResults,
        searchSessionId.current,
        queryPosition.current,
        {
          previous_query: previousTrackedQuery.current || null,
          radius_km: radiusKm,
          search_mode: searchMode,
        }
      )
      previousTrackedQuery.current = trimmed
    }, 600)
    return () => clearTimeout(timer)
  }, [query, totalResults, user?.id, radiusKm, searchMode])

  const suggestedPeople = useMemo(
    () => Object.entries(demoUsers).filter(([u]) => u !== demoCurrentUser.username),
    []
  )

  const popularPlaces = useMemo<PlaceResult[]>(
    () =>
      demoRestaurants.slice(0, 5).map(r => ({
        id: r.name,
        name: r.name,
        address: r.address ?? null,
        city: r.suburb ?? null,
        suburb: r.suburb ?? null,
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

  const typeaheadSuggestions = useMemo(() => {
    if (!isFocused || query.length < 1) return []
    const lq = query.toLowerCase()
    const seen = new Set<string>()
    const results: Array<{ label: string; detail?: string | null }> = []
    for (const suggestion of suggestions) {
      const label = suggestion.display_text.trim()
      const key = label.toLowerCase()
      if (label && !seen.has(key)) {
        seen.add(key)
        results.push({ label, detail: suggestion.secondary_text })
      }
    }
    for (const recent of recentSearches) {
      if (recent.toLowerCase().startsWith(lq) && !seen.has(recent.toLowerCase())) {
        seen.add(recent.toLowerCase())
        results.push({ label: recent, detail: 'Recent' })
      }
    }
    const terms = [...Object.keys(CUISINE_SYNONYMS), ...Object.keys(CUISINE_ALIASES)]
    for (const term of terms) {
      if (term.startsWith(lq) && !seen.has(term)) {
        seen.add(term)
        results.push({ label: term, detail: 'Cuisine' })
      }
    }
    return results.slice(0, 6)
  }, [isFocused, query, recentSearches, suggestions])

  const topPeople = useMemo(() => peopleResults.slice(0, 3), [peopleResults])
  const topPosts = useMemo(() => postResults.slice(0, 5), [postResults])
  const topPlaces = useMemo(() => placeResults.slice(0, 4), [placeResults])
  const nearbySummary = userLocation.label
    ? `${userLocation.label} · ${radiusKm} km`
    : `Nearby · ${radiusKm} km`
  const activeFilterTokens = useMemo(() => {
    const tokens: string[] = []
    if (searchMode === 'aroundMe') tokens.push(nearbySummary)
    if (searchFilters.cuisine) tokens.push(searchFilters.cuisine)
    if (searchFilters.openNow) tokens.push('Open now')
    if (searchFilters.occasions?.length) {
      tokens.push(...searchFilters.occasions.slice(0, 2).map(occasionLabel))
    }
    if (searchFilters.values?.length) tokens.push(...searchFilters.values.slice(0, 1).map(valueLabel))
    if (searchFilters.mediaTypes?.length) {
      tokens.push(searchFilters.mediaTypes.map(type => (type === 'mixed' ? 'Mixed media' : type === 'video' ? 'Videos' : 'Photos')).join(', '))
    }
    if (searchFilters.sort && searchFilters.sort !== 'best_match') {
      tokens.push(SEARCH_SORTS.find(sort => sort.key === searchFilters.sort)?.label ?? 'Sorted')
    }
    return tokens.slice(0, 5)
  }, [nearbySummary, searchFilters, searchMode])
  const activeTabEmpty =
    (resultTab === 'dishes' && postResults.length === 0) ||
    (resultTab === 'people' && peopleResults.length === 0) ||
    (resultTab === 'places' && placeResults.length === 0)
  const showTypeaheadSuggestions =
    typeaheadSuggestions.length > 0 &&
    (!hasQuery || totalResults === 0 || query.trim().length < 2)

  function handleChip(chip: (typeof CHIPS)[number]) {
    setActiveChip(chip.query)
    setQuery(chip.query)
    setSearchMode('search')
    setResultTab('top')
  }

  function handleTrending(tag: string) {
    setQuery(tag)
    setActiveChip('')
    setSearchMode('search')
    setResultTab('top')
  }

  function openNearbySearch() {
    setSearchMode('aroundMe')
    setActiveChip('')
    setResultTab('top')
    setNearbySheetVisible(true)
  }

  function updateSearchFilters(next: SearchFilters) {
    setSearchFilters(next)
    analytics.searchFilter(user?.id ?? null, 'applied', 'search_filters')
  }

  function showResultsTab(tab: ResultTab) {
    setResultTab(tab)
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
              setSearchMode('search')
              setResultTab('top')
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setQuery('')
                setActiveChip('')
                setSearchMode('search')
                setResultTab('top')
              }}
              hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <CloseIcon />
            </TouchableOpacity>
          )}
          <IconButton
            accessibilityLabel="Open search filters"
            style={[
              styles.searchFilterBtn,
              activeFilterTokens.length > 0 && styles.searchFilterBtnActive,
            ]}
            onPress={() => setNearbySheetVisible(true)}
            size={34}
            variant="ghost"
          >
            <FilterIcon size={15} color={activeFilterTokens.length > 0 ? colors.accent : colors.text2} />
          </IconButton>
        </View>
        {activeFilterTokens.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeTokenRow}
          >
            {activeFilterTokens.map(token => (
              <TouchableOpacity
                key={token}
                style={styles.activeToken}
                onPress={() => setNearbySheetVisible(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.activeTokenText} numberOfLines={1}>
                  {token}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {!!userLocation.error && searchMode === 'aroundMe' && (
          <Text style={styles.locationError}>{userLocation.error}</Text>
        )}
      </View>

      {showTypeaheadSuggestions && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionScroll}
          contentContainerStyle={styles.suggestionRow}
          keyboardShouldPersistTaps="handled"
        >
          {typeaheadSuggestions.map(s => (
            <Chip
              key={s.label}
              label={s.label}
              detail={s.detail ?? undefined}
              style={styles.suggestionOption}
              onPress={() => {
                setQuery(s.label)
                setActiveChip('')
                setSearchMode('search')
                setResultTab('top')
                setIsFocused(false)
              }}
            />
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {!hasQuery ? (
          <View style={styles.discoveryPage}>
            {isFocused && recentSearches.length > 0 && (
              <View>
                <SectionHeader title="Recent searches" />
                <View style={styles.sectionContent}>
                  {recentSearches.map(item => (
                    <TouchableOpacity
                      key={item}
                      style={styles.recentSearchRow}
                      onPress={() => {
                        setQuery(item)
                        setIsFocused(false)
                        setSearchMode('search')
                        setResultTab('top')
                      }}
                      activeOpacity={0.75}
                    >
                      <ClockIcon size={14} />
                      <Text style={styles.recentSearchText} numberOfLines={1}>{item}</Text>
                      <TouchableOpacity
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => dismissSearch(item)}
                      >
                        <CloseIcon />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <SectionHeader title="Quick starts" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickStartRow}
            >
              <Chip label="Nearby" leading={<PinIcon size={12} />} onPress={openNearbySearch} />
              {CHIPS.filter(chip =>
                ['ramen', 'brunch', 'date night', 'cheap'].includes(chip.query)
              ).map(chip => (
                <Chip
                  key={chip.query}
                  label={chip.label}
                  leading={<Text style={styles.chipEmoji}>{chip.emoji}</Text>}
                  selected={activeChip === chip.query}
                  onPress={() => handleChip(chip)}
                />
              ))}
            </ScrollView>

            <SectionHeader title="Trending now" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingRow}
            >
              {trendingItems.slice(0, 6).map(item => (
                <Chip
                  key={item.tag}
                  label={item.tag.replace(/^#/, '')}
                  onPress={() => handleTrending(item.tag)}
                />
              ))}
            </ScrollView>

            <SectionHeader title="Popular places" />
            <View style={styles.sectionContent}>
              {popularPlaces.map(place => (
                <PlaceRow key={place.id} place={place} />
              ))}
            </View>

            {staffPicks.length > 0 && (
              <>
                <SectionHeader title="Staff picks" />
                <View style={styles.sectionContent}>
                  {staffPicks.map(collection => (
                    <TouchableOpacity
                      key={collection.id}
                      style={styles.collectionRow}
                      onPress={() =>
                        analytics.collectionInteraction(
                          user?.id ?? null,
                          'staff_pick_selected',
                          collection.id,
                          { collection_visibility: collection.visibility }
                        )
                      }
                    >
                      <Text style={styles.collectionName}>{collection.name}</Text>
                      {!!collection.curator_note && (
                        <Text style={styles.collectionNote} numberOfLines={2}>
                          {collection.curator_note}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <SectionHeader title="Creators you may like" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.peopleChipsRow}
            >
              {suggestedPeople.map(([username, u]) => (
                <PersonChip key={username} username={username} u={u} />
              ))}
            </ScrollView>
          </View>
        ) : totalResults === 0 ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsTitle}>
              {searchMode === 'aroundMe' ? 'No nearby places yet' : `No results for "${query}"`}
            </Text>
            <Text style={styles.noResultsBody}>Try a different dish, place, or person</Text>
            {searchMode === 'aroundMe' && !userLocation.coords && (
              <Text style={styles.noResultsBody}>Use current location or set a suburb first.</Text>
            )}
          </View>
        ) : (
          <View style={styles.resultsPage}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.resultTabs}
            >
              {RESULT_TABS.map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.resultTab, resultTab === tab.key && styles.resultTabActive]}
                  onPress={() => showResultsTab(tab.key)}
                >
                  <Text
                    style={[
                      styles.resultTabText,
                      resultTab === tab.key && styles.resultTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {searchMode === 'aroundMe' && (
              <View style={styles.expansionNotice}>
                <Text style={styles.expansionNoticeText}>
                  Showing places within {radiusKm} km
                  {userLocation.label ? ` of ${userLocation.label}` : ''}
                </Text>
              </View>
            )}
            {!!expansionLabel && (
              <View style={styles.expansionNotice}>
                <Text style={styles.expansionNoticeText}>{expansionLabel}</Text>
              </View>
            )}
            {activeTabEmpty && (
              <EmptyState title="Nothing in this tab yet" subtitle="Try Top or adjust the search." />
            )}
            {resultTab === 'top' && (
              <>
                {topPlaces.length > 0 && (
                  <View>
                    <SectionHeader title="Places" count={placeResults.length} />
                    <View style={styles.sectionContent}>
                      {topPlaces.map((p, index) => (
                        <PlaceRow
                          key={p.id}
                          place={p}
                          distanceKm={placeDistances.get(p.id)}
                          user={user}
                          query={query}
                          position={index + 1}
                          searchSessionId={searchSessionId.current}
                        />
                      ))}
                    </View>
                  </View>
                )}
                {topPosts.length > 0 && (
                  <View>
                    <SectionHeader title="Dishes" count={postResults.length} />
                    <View style={styles.sectionContent}>
                      {topPosts.map((p, index) => (
                        <PostCompactRow
                          key={p.id}
                          post={p}
                          position={index + 1}
                          query={query}
                          searchSessionId={searchSessionId.current}
                          user={user}
                        />
                      ))}
                    </View>
                  </View>
                )}
                {topPeople.length > 0 && (
                  <View>
                    <SectionHeader title="People" count={peopleResults.length} />
                    <View style={styles.sectionContent}>
                      {topPeople.map(p => (
                        <PersonRow key={p.username} person={p} />
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
            {resultTab === 'people' && peopleResults.length > 0 && (
              <View>
                <SectionHeader title="People" count={peopleResults.length} />
                <View style={styles.sectionContent}>
                  {peopleResults.map(p => (
                    <PersonRow key={p.username} person={p} />
                  ))}
                </View>
              </View>
            )}
            {resultTab === 'dishes' && postResults.length > 0 && (
              <View>
                <SectionHeader title="Dishes" count={postResults.length} />
                <View style={styles.sectionContent}>
                  {postResults.slice(0, visiblePostCount).map((p, index) => (
                    <PostCompactRow
                      key={p.id}
                      post={p}
                      position={index + 1}
                      query={query}
                      searchSessionId={searchSessionId.current}
                      user={user}
                    />
                  ))}
                  {postResults.length > visiblePostCount && (
                    <TouchableOpacity
                      style={styles.showMore}
                      onPress={() => setVisiblePostCount(c => c + SEARCH_POST_LIMIT)}
                    >
                      <Text style={styles.showMoreText}>
                        Show {Math.min(SEARCH_POST_LIMIT, postResults.length - visiblePostCount)} more
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            {resultTab === 'places' && placeResults.length > 0 && (
              <View>
                <SectionHeader title="Places" count={placeResults.length} />
                <View style={styles.sectionContent}>
                  {placeResults.map((p, index) => (
                    <PlaceRow
                      key={p.id}
                      place={p}
                      distanceKm={placeDistances.get(p.id)}
                      user={user}
                      query={query}
                      position={index + 1}
                      searchSessionId={searchSessionId.current}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      <NearbyFilterSheet
        visible={nearbySheetVisible}
        onClose={() => setNearbySheetVisible(false)}
        radiusKm={radiusKm}
        setRadiusKm={setRadiusKm}
        userLocation={userLocation}
        filters={searchFilters}
        setFilters={updateSearchFilters}
        onEnableNearby={() => setSearchMode('aroundMe')}
      />
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
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    wordmark: {
      fontFamily: 'DMSerifDisplay-Regular',
      fontSize: fontSize['3xl'],
      color: c.text,
      letterSpacing: 0,
    },
    wordmarkDot: { color: c.accent },
    searchTop: {
      paddingHorizontal: spacing[4],
      paddingTop: spacing.px10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      backgroundColor: c.bg,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      paddingLeft: spacing.px14,
      paddingRight: spacing[2],
      paddingVertical: spacing[2],
      marginBottom: spacing.px10,
    },
    searchField: { flex: 1, fontSize: fontSize.md, color: c.text, padding: spacing[0] },
    searchFilterBtn: {
      backgroundColor: c.bg,
    },
    searchFilterBtnActive: { backgroundColor: `${c.accent}18` },
    clearBtn: {
      width: 18,
      height: 18,
      borderRadius: radius.sm4,
      backgroundColor: c.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeTokenRow: { gap: spacing.px7, paddingBottom: spacing.px10 },
    activeToken: {
      alignSelf: 'flex-start',
      minHeight: 28,
      paddingHorizontal: spacing.px10,
      borderRadius: radius.lg,
      backgroundColor: `${c.accent}12`,
      justifyContent: 'center',
    },
    activeTokenText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.accent },
    primaryFilters: { gap: spacing[2], paddingBottom: spacing[3] },
    filterPill: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
      paddingHorizontal: spacing.px13,
      borderRadius: radius.xl,
      backgroundColor: c.bg,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    filterPillActive: { backgroundColor: c.text, borderColor: c.text },
    filterPillText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2 },
    filterPillTextActive: { color: c.bg },
    nearbySummary: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      marginBottom: spacing.px10,
      paddingHorizontal: spacing[3],
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    nearbySummaryText: { flex: 1, fontSize: fontSize.bodySm, color: c.text2 },
    quickStartRow: { gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
    ideaChipsRow: { gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing.px10 },
    ideaChip: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
      paddingHorizontal: spacing.px13,
      borderRadius: radius.xl2,
      backgroundColor: c.surface,
    },
    ideaChipActive: { backgroundColor: `${c.accent}14` },
    ideaChipText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2 },
    ideaChipTextActive: { color: c.accent },
    resultTabs: { gap: spacing.px6, paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing.px2 },
    resultTab: {
      minHeight: 32,
      justifyContent: 'center',
      paddingHorizontal: spacing.px14,
      borderRadius: radius.lg2,
      backgroundColor: c.surface,
    },
    resultTabActive: { backgroundColor: `${c.accent}16` },
    resultTabText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.text2 },
    resultTabTextActive: { color: c.accent },
    chips: { gap: spacing.px7, paddingBottom: spacing[3] },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      paddingHorizontal: spacing.px13,
      paddingVertical: spacing.px6,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.text, borderColor: c.text },
    chipEmoji: { fontSize: fontSize.bodySm },
    chipText: { fontSize: fontSize.bodySm, color: c.text2 } as any,
    chipTextActive: { color: c.bg },
    locationFallback: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingBottom: spacing[3],
    },
    locationUseBtn: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
      paddingHorizontal: spacing.px10,
      borderRadius: radius.sm3,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    locationUseText: { fontSize: fontSize.bodySm, color: c.text2 },
    modeBtnActive: { backgroundColor: c.text, borderColor: c.text },
    modeBtnActiveText: { color: c.bg },
    manualAreaWrap: {
      flex: 1,
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.sm3,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      overflow: 'hidden',
    },
    manualAreaInput: {
      flex: 1,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px7,
      fontSize: fontSize.bodySm,
      color: c.text,
    },
    manualAreaBtn: {
      alignSelf: 'stretch',
      justifyContent: 'center',
      paddingHorizontal: spacing.px10,
      borderLeftWidth: 0.5,
      borderLeftColor: c.border,
    },
    manualAreaBtnText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.text },
    radiusRow: { gap: spacing.px7, paddingBottom: spacing.px10 },
    radiusChip: {
      borderRadius: radius.lg2,
      borderWidth: 0.5,
      borderColor: c.border,
      backgroundColor: c.bg,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px5,
    },
    radiusChipActive: { backgroundColor: c.surface2, borderColor: c.border2 },
    radiusChipText: { fontSize: fontSize.sm, color: c.text3 },
    radiusChipTextActive: { color: c.text },
    locationError: { fontSize: fontSize.sm, color: c.text3, paddingBottom: spacing.px10 },
    scroll: { flex: 1 },
    discoveryPage: { paddingBottom: spacing[6] },
    peopleChipsRow: { paddingHorizontal: spacing[4], gap: spacing.px10, paddingBottom: spacing[4] },
    personChip: { width: 82, alignItems: 'center' },
    personChipInner: { alignItems: 'center', gap: spacing.px6 },
    personChipUsername: { fontSize: fontSize.sm, color: c.text, maxWidth: 84, textAlign: 'center' },
    personChipFollowers: { fontSize: fontSize.xs, color: c.text3, textAlign: 'center' },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingTop: spacing.px18,
      paddingBottom: spacing.px9,
    },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text, letterSpacing: 0 },
    sectionCount: { fontSize: fontSize.sm, color: c.text3 },
    sectionContent: {},
    trendingGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing.px2,
    },
    trendingCard: {
      width: '48.8%',
      minHeight: 74,
      justifyContent: 'space-between',
      padding: spacing[3],
      borderRadius: radius.sm3,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    trendingList: { paddingHorizontal: spacing[4] },
    trendingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingVertical: spacing.px10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    trendingItemLast: { borderBottomWidth: 0 },
    trendingRank: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.text3,
    },
    trendingRankHot: { color: c.accent },
    trendingTag: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
    trendingCount: { fontSize: fontSize.xs, color: c.text3 },
    trendingRow: { gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing.px2 },
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px11,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    personInfo: { flex: 1 },
    personUsername: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    personName: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px1 },
    personFollowers: { fontSize: fontSize.sm, color: c.text3 },
    followChip: { marginTop: spacing[2] },
    postRow: {
      flexDirection: 'row',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px11,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    postThumb: {
      width: 60,
      height: 60,
      borderRadius: radius.sm3,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    videoFallback: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface2,
    },
    postRowContent: { flex: 1 },
    postRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.px3 },
    postRowCreator: { fontSize: fontSize.sm, color: c.text3 },
    postRowLikes: { fontSize: fontSize.sm, color: c.text3 },
    postRowTitle: { fontSize: fontSize.base, color: c.text, lineHeight: lineHeight.small, marginBottom: spacing[1] },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px10,
      borderBottomWidth: 0.35,
      borderBottomColor: c.border,
    },
    placeIconWrap: {
      width: 22,
      height: 22,
      borderRadius: radius.md2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeInfo: { flex: 1 },
    placeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6 },
    placeName: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    placeMeta: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px2 },
    placeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6, marginTop: spacing.px5 },
    placeBadge: {
      overflow: 'hidden',
      borderRadius: radius.xs,
      backgroundColor: c.surface,
      color: c.text2,
      fontSize: fontSize.xs,
      paddingHorizontal: spacing.px6,
      paddingVertical: spacing.px2,
    },
    placeHint: { fontSize: fontSize.xs, color: c.text3 },
    collectionRow: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    collectionName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.text },
    collectionNote: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px3, lineHeight: lineHeight.tight },
    resultsPage: { paddingBottom: spacing[6] },
    expansionNotice: {
      marginHorizontal: spacing[4],
      marginTop: spacing.px14,
      marginBottom: spacing.px2,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    expansionNoticeText: { fontSize: fontSize.bodySm, color: c.text2, lineHeight: lineHeight.compact },
    showMore: { paddingHorizontal: spacing[4], paddingVertical: spacing.px14 },
    showMoreText: { fontSize: fontSize.base, color: c.accent },
    noResults: { alignItems: 'center', paddingTop: spacing.px60, paddingHorizontal: spacing.px40, gap: spacing[2] },
    noResultsTitle: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text, textAlign: 'center' },
    noResultsBody: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center' },
    sheetBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: c.overlay,
    },
    sheetDismissArea: { flex: 1 },
    nearbySheet: {
      paddingHorizontal: spacing[4],
      paddingTop: spacing.px10,
      paddingBottom: spacing.px28,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      backgroundColor: c.bg,
      maxHeight: '86%',
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: radius.xxs,
      backgroundColor: c.border2,
      marginBottom: spacing[4],
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing[3],
      marginBottom: spacing[4],
    },
    sheetTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: c.text },
    sheetSubtitle: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px3 },
    sheetScrollContent: { paddingBottom: spacing[2] },
    sheetClose: {
      backgroundColor: c.surface,
    },
    sheetOption: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[3],
      borderRadius: radius.md3,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      marginBottom: spacing.px14,
    },
    sheetOptionActive: { backgroundColor: `${c.accent}12` },
    sheetOptionIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.lg2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg,
    },
    sheetOptionText: { flex: 1 },
    sheetOptionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.text },
    sheetOptionBody: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    sheetLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text3, marginBottom: spacing[2] },
    locationBlock: { marginBottom: spacing[4] },
    locationActivePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      minHeight: 44,
      paddingHorizontal: spacing[3],
      borderRadius: radius.md3,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    locationActiveText: { flex: 1, fontSize: fontSize.base, color: c.text },
    locationInputWrap: {
      borderRadius: radius.md3,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      overflow: 'hidden',
    },
    locationGpsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px10,
      borderBottomWidth: 0.35,
      borderBottomColor: c.border,
    },
    locationGpsText: { fontSize: fontSize.base, color: c.text2, fontWeight: fontWeight.medium },
    locationInput: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px10,
      fontSize: fontSize.md,
      color: c.text,
      minHeight: 44,
    },
    locationSuggestions: {
      marginTop: spacing.px6,
      borderRadius: radius.md3,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      overflow: 'hidden',
    },
    locationSuggestionRow: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px10,
      borderBottomWidth: 0.35,
      borderBottomColor: c.border,
    },
    locationSuggestionMain: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    locationSuggestionSub: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px1 },
    recentSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.35,
      borderBottomColor: c.border,
    },
    recentSearchText: { flex: 1, fontSize: fontSize.md, color: c.text },
    suggestionScroll: { maxHeight: 52, flexGrow: 0 },
    suggestionRow: {
      gap: spacing.px7,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      alignItems: 'center',
    },
    suggestionOption: {
      height: 34,
      maxWidth: 156,
    },
    radiusSheetBlock: { marginBottom: spacing[3] },
    radiusSheetOptions: { flexDirection: 'row', gap: spacing[2] },
    radiusSheetOption: {
      minWidth: 66,
    },
    filterSheetBlock: { marginBottom: spacing[4] },
    sheetChipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
      paddingTop: spacing[2],
    },
    filterSearchInput: {
      minHeight: 40,
      borderRadius: radius.md3,
      paddingHorizontal: spacing[3],
      marginTop: spacing[2],
      backgroundColor: c.surface,
      color: c.text,
      fontSize: fontSize.base,
    },
    sheetToggleText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.bold, color: c.accent },
    sheetFooterRow: { flexDirection: 'row', gap: spacing.px10 },
    sheetSecondaryButton: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md3,
      backgroundColor: c.surface,
      marginTop: spacing.px6,
    },
    sheetSecondaryText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text2 },
    sheetDoneButton: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md3,
      backgroundColor: c.text,
      marginTop: spacing.px6,
    },
    sheetDoneText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.bg },
  })
}
