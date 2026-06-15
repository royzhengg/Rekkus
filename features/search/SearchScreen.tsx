import { useLocalSearchParams, useFocusEffect } from 'expo-router'
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SearchIcon, CloseIcon, FilterIcon, PinIcon } from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontFamily, fontSize, fontWeight, letterSpacing, maxFontSizeMultiplier } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { demoCurrentUser, demoRestaurants, demoUsers } from '@/lib/dataSources/demoData'
import { occasionLabel, valueLabel } from '@/lib/dataSources/rekkusPicks'
import { isEnabled } from '@/lib/featureFlags'
import { useNoResultsSuggestions } from '@/lib/hooks/useNoResultsSuggestions'
import { useSearch, type PlaceResult, type SearchFilters } from '@/lib/hooks/useSearch'
import { useSearchHistory, loadPersistedSearchState, persistSearchState } from '@/lib/hooks/useSearchHistory'
import { useTrendingData } from '@/lib/hooks/useTrendingData'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import { fetchStaffPickCollections, type Collection } from '@/lib/services/collections'
import { fetchUserEngagementCuisines } from '@/lib/services/searchPersonalization'
import { resolveTrendingCityFromCoords } from '@/lib/services/trending'
import { parseSearchQuery } from '@/lib/utils/queryParser'
import { resolveLocationSource } from '@/lib/utils/searchIntent'
import { DiscoveryPage } from './DiscoveryPage'
import { NoResultsCard } from './NoResultsCard'
import { CHIPS, TRENDING, SEARCH_SORTS, type ResultTab } from './searchConstants'
import { SearchFiltersSheet } from './SearchFiltersSheet'
import { SearchResultsTab } from './SearchResultsTab'
import { buildTypeaheadSuggestions } from './searchShared'

export default function SearchScreen() {
  const params = useLocalSearchParams<{ query?: string; source?: string }>()
  const routeQuery = typeof params.query === 'string' ? params.query : ''
  const [query, setQuery] = useState(routeQuery)
  const [activeChip, setActiveChip] = useState('')
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { user } = useAuth()
  const userLocation = useUserLocation()
  const [isFocused, setIsFocused] = useState(false)
  const [searchMode, setSearchMode] = useState<'search' | 'aroundMe'>('search')
  const [radiusKm, setRadiusKm] = useState(10)
  const [nearbySheetVisible, setNearbySheetVisible] = useState(false)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ sort: 'best_match' })
  const [resultTab, setResultTab] = useState<ResultTab>('top')
  const [staffPicks, setStaffPicks] = useState<Collection[]>([])
  const [nearCity, setNearCity] = useState<string | null>(null)
  const [viewedCuisines, setViewedCuisines] = useState<string[]>([])
  const [locationNudgeDismissed, setLocationNudgeDismissed] = useState(false)
  const {
    trendingSearches,
    popularPlaces: livePopularPlaces,
    trendingDishes,
  } = useTrendingData(nearCity)
  const {
    cuisineAffinities,
    recentSearches,
    savedSearches,
    dismissSearch,
    saveSearch,
    unsaveSearch,
  } = useSearchHistory()
  const searchSessionId = useRef(`search-${Date.now().toString(36)}`)
  const queryPosition = useRef(0)
  const previousTrackedQuery = useRef('')
  const sessionStartTime = useRef(Date.now())
  const sessionHadClick = useRef(false)
  const sessionHadResults = useRef(false)
  const sessionLastResultCount = useRef(0)
  const lastNoResultsKey = useRef('')
  const lastLocationNudgeKey = useRef('')
  const locationSource = resolveLocationSource(userLocation.status, userLocation.coords != null)

  const {
    postResults,
    peopleResults,
    placeResults,
    placeDistances,
    dishEntityResults,
    suggestions,
    providerFallbackSuppressed,
    queryIntent,
    hasQuery,
    expansionLabel,
  } = useSearch(query, userLocation.coords, {
    mode: searchMode,
    radiusKm,
    userId: user?.id,
    filters: searchFilters,
    locationSource,
  })

  const totalResults = postResults.length + peopleResults.length + placeResults.length + dishEntityResults.length
  const SEARCH_POST_LIMIT = 20
  const [visiblePostCount, setVisiblePostCount] = useState(SEARCH_POST_LIMIT)
  const noResultsSuggestions = useNoResultsSuggestions(query, {
    userId: user?.id ?? null,
    cuisineAffinities,
    viewedCuisines,
    recentSearches,
    trendingSearches,
    staticFallbacks: CHIPS,
  })

  const dishFirstTopResults = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return false
    try {
      const intent = parseSearchQuery(trimmed).intent
      return intent === 'dish' || intent === 'mixed'
    } catch {
      return false
    }
  }, [query])

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
    void loadPersistedSearchState(user?.id).then(state => {
      setSearchFilters(state?.filters ?? { sort: 'best_match' })
      setRadiusKm(state?.radiusKm ?? 10)
    })
  }, [user?.id])

  useEffect(() => {
    void fetchStaffPickCollections().then(setStaffPicks)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!user?.id) {
      setViewedCuisines([])
      return
    }

    void fetchUserEngagementCuisines(user.id)
      .then(cuisines => {
        if (!cancelled) setViewedCuisines(cuisines)
      })
      .catch(() => {
        if (!cancelled) setViewedCuisines([])
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false
    if (!userLocation.coords) {
      setNearCity(null)
      return
    }

    void resolveTrendingCityFromCoords(userLocation.coords)
      .then(city => {
        if (!cancelled) setNearCity(city)
      })
      .catch(() => {
        if (!cancelled) setNearCity(null)
      })

    return () => {
      cancelled = true
    }
  }, [userLocation.coords])

  useEffect(() => {
    sessionLastResultCount.current = totalResults
    if (totalResults > 0) sessionHadResults.current = true
  }, [totalResults])

  useFocusEffect(
    useCallback(() => {
      sessionStartTime.current = Date.now()
      sessionHadClick.current = false
      sessionHadResults.current = false
      sessionLastResultCount.current = 0

      return () => {
        const durationMs = Date.now() - sessionStartTime.current
        const lastQuery = previousTrackedQuery.current || null
        analytics.searchSessionEnd(
          user?.id ?? null,
          searchSessionId.current,
          durationMs,
          sessionHadResults.current,
          sessionHadClick.current,
          lastQuery
        )
        if (lastQuery && !sessionHadClick.current) {
          analytics.searchAbandon(
            user?.id ?? null,
            lastQuery,
            sessionLastResultCount.current,
            durationMs,
            searchSessionId.current
          )
        }
      }
    }, [user?.id])
  )

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
          near_city: nearCity,
        }
      )
      previousTrackedQuery.current = trimmed
    }, 600)
    return () => clearTimeout(timer)
  }, [query, totalResults, user?.id, radiusKm, searchMode, nearCity])

  useEffect(() => {
    const trimmed = query.trim()
    if (!hasQuery || totalResults !== 0 || trimmed.length === 0) return
    const suggestionQueries = noResultsSuggestions.map(s => s.query.trim()).filter(Boolean)
    const key = `${trimmed.toLowerCase().replace(/\s+/g, ' ')}|${suggestionQueries
      .map(s => s.toLowerCase().replace(/\s+/g, ' '))
      .join('|')}`
    if (lastNoResultsKey.current === key) return
    lastNoResultsKey.current = key
    analytics.noResultsShown(user?.id ?? null, trimmed, suggestionQueries)
  }, [hasQuery, noResultsSuggestions, query, totalResults, user?.id])

  const suggestedPeople = Object.entries(demoUsers).filter(
    ([u]) => u !== demoCurrentUser.username
  )

  const demoPopularPlaces: PlaceResult[] = demoRestaurants.slice(0, 5).map(r => ({
    id: r.name,
    name: r.name,
    address: r.address ?? null,
    city: r.suburb ?? null,
    suburb: r.suburb ?? null,
    cuisine_type: null,
    google_place_id: r.googlePlaceId ?? null,
    latitude: r.lat ?? null,
    longitude: r.lng ?? null,
    google_rating: null,
    google_review_count: null,
  }))

  const popularPlaces = livePopularPlaces.length > 0 ? livePopularPlaces : demoPopularPlaces

  const trendingItems = useMemo(
    () => trendingSearches.length > 0 ? trendingSearches.map(q => ({ tag: q, count: '' })) : TRENDING,
    [trendingSearches]
  )

  const typeaheadSuggestions = useMemo(
    () => buildTypeaheadSuggestions({ isFocused, query, suggestions, recentSearches }),
    [isFocused, query, recentSearches, suggestions]
  )

  const topPeople = useMemo(() => peopleResults.slice(0, 3), [peopleResults])
  const topPosts = useMemo(() => postResults.slice(0, 5), [postResults])
  const topPlaces = useMemo(() => placeResults.slice(0, 4), [placeResults])

  const nearbySummary = userLocation.label ? `${userLocation.label} · ${radiusKm} km` : `Nearby · ${radiusKm} km`

  const activeFilterTokens = useMemo(() => {
    const tokens: string[] = []
    if (searchMode === 'aroundMe') tokens.push(nearbySummary)
    if (searchFilters.cuisine) tokens.push(searchFilters.cuisine)
    if (searchFilters.openNow) tokens.push('Open now')
    if (searchFilters.occasions?.length) {
      tokens.push(...searchFilters.occasions.slice(0, 2).map(occasionLabel))
    }
    if (searchFilters.values?.length) {
      tokens.push(...searchFilters.values.slice(0, 1).map(valueLabel))
    }
    if (searchFilters.mediaTypes?.length) {
      tokens.push(searchFilters.mediaTypes.map(t => t === 'mixed' ? 'Mixed media' : t === 'video' ? 'Videos' : 'Photos').join(', '))
    }
    if (searchFilters.sort && searchFilters.sort !== 'best_match') {
      tokens.push(SEARCH_SORTS.find(s => s.key === searchFilters.sort)?.label ?? 'Sorted')
    }
    return tokens.slice(0, 5)
  }, [nearbySummary, searchFilters, searchMode])

  const activeTabEmpty =
    (resultTab === 'dishes' && postResults.length === 0 && dishEntityResults.length === 0) ||
    (resultTab === 'people' && peopleResults.length === 0) ||
    (resultTab === 'places' && placeResults.length === 0)

  const showTypeaheadSuggestions =
    typeaheadSuggestions.length > 0 &&
    (!hasQuery || totalResults === 0 || query.trim().length < 2)
  const showLocationNudge =
    !locationNudgeDismissed &&
    searchMode === 'search' &&
    !userLocation.coords &&
    query.trim().length >= 2 &&
    (providerFallbackSuppressed || queryIntent === 'food_dish')

  useEffect(() => {
    if (!showLocationNudge) return
    const key = `${query.trim().toLowerCase()}|${queryIntent}|${searchMode}`
    if (lastLocationNudgeKey.current === key) return
    lastLocationNudgeKey.current = key
    analytics.searchLocationNudgeShown(user?.id ?? null, queryIntent, locationSource, searchMode)
  }, [locationSource, query, queryIntent, searchMode, showLocationNudge, user?.id])

  const handleResultClick = useCallback(() => {
    sessionHadClick.current = true
  }, [])

  function handleChip(chip: { label: string; emoji: string; query: string }) {
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
    persistSearchState({ filters: next, radiusKm }, user?.id)
    analytics.searchFilter(user?.id ?? null, 'applied', 'search_filters')
  }

  function updateRadiusKm(next: number) {
    setRadiusKm(next)
    persistSearchState({ filters: searchFilters, radiusKm: next }, user?.id)
  }

  function handleSelectRecent(item: string) {
    setQuery(item)
    setIsFocused(false)
    setSearchMode('search')
    setResultTab('top')
  }

  function handleSelectSavedSearch(item: string) {
    analytics.savedSearchSelected(user?.id ?? null, item)
    handleSelectRecent(item)
  }

  function handleNoResultsChip(q: string) {
    const failedQuery = query.trim()
    const position = noResultsSuggestions.findIndex(chip => chip.query === q) + 1
    analytics.noResultsSuggestionClick(user?.id ?? null, failedQuery, q, position > 0 ? position : 1)
    setQuery(q)
    setActiveChip('')
    setSearchMode('search')
    setResultTab('top')
  }

  async function handleLocationNudgePress() {
    analytics.searchLocationNudgeClicked(user?.id ?? null, queryIntent, locationSource, searchMode)
    if (userLocation.status === 'denied') {
      await Linking.openSettings()
      analytics.searchLocationPermissionResult(user?.id ?? null, 'settings_opened', queryIntent, searchMode)
      setLocationNudgeDismissed(true)
      return
    }
    const next = await userLocation.requestLocation()
    analytics.searchLocationPermissionResult(
      user?.id ?? null,
      next ? 'granted' : userLocation.status,
      queryIntent,
      searchMode
    )
    if (next) setLocationNudgeDismissed(true)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
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
            accessibilityLabel="Search for restaurants, dishes, or people"
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
            textContentType="none"
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
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
              styles.filterButtonSurface,
              activeFilterTokens.length > 0 && styles.filterButtonSurfaceActive,
            ]}
            onPress={() => setNearbySheetVisible(true)}
            size={44}
            variant="ghost"
          >
            <FilterIcon
              size={15}
              color={activeFilterTokens.length > 0 ? colors.accent : colors.text2}
            />
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
                accessibilityRole="button"
                accessibilityLabel={`Filter: ${token}. Tap to edit.`}
                hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
              >
                <Text style={styles.activeTokenText} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                  {token}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {!!userLocation.error && searchMode === 'aroundMe' && (
          <View style={styles.locationErrorRow}>
            <Text style={styles.locationError}>{userLocation.error}</Text>
            {userLocation.status !== 'denied' ? (
              <TouchableOpacity
                onPress={() => { void userLocation.requestLocation() }}
                accessibilityRole="button"
                accessibilityLabel="Try again to enable location"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.locationRecoveryLink}>Try again</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { void Linking.openSettings() }}
                accessibilityRole="button"
                accessibilityLabel="Open device Settings to enable location"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.locationRecoveryLink}>Open Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {showLocationNudge && (
          <View style={styles.locationNudge}>
            <TouchableOpacity
              style={styles.locationNudgeAction}
              onPress={() => { void handleLocationNudgePress() }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={
                userLocation.status === 'denied'
                  ? 'Open Settings to enable location for better search results'
                  : 'Enable location for better search results'
              }
            >
              <PinIcon size={14} color={colors.accent} />
              <Text style={styles.locationNudgeText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                {userLocation.status === 'denied'
                  ? 'Open Settings for better local results'
                  : 'Enable location for better results'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.locationNudgeDismiss}
              onPress={() => setLocationNudgeDismissed(true)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Dismiss location suggestion"
            >
              <CloseIcon size={10} color={colors.accent} />
            </TouchableOpacity>
          </View>
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
              {...(s.detail != null ? { detail: s.detail } : {})}
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
          <DiscoveryPage
            isFocused={isFocused}
            recentSearches={recentSearches}
            savedSearches={savedSearches}
            onDismissSearch={dismissSearch}
            onSelectRecent={handleSelectRecent}
            onSelectSavedSearch={handleSelectSavedSearch}
            onSaveSearch={saveSearch}
            onUnsaveSearch={unsaveSearch}
            activeChip={activeChip}
            trendingItems={trendingItems}
            trendingDishes={trendingDishes}
            suggestedPeople={suggestedPeople}
            popularPlaces={popularPlaces}
            staffPicks={staffPicks}
            cuisineAffinities={cuisineAffinities}
            onChip={handleChip}
            onTrending={handleTrending}
            onTrendingDish={handleTrending}
            onOpenNearby={openNearbySearch}
            userId={user?.id}
          />
        ) : totalResults === 0 ? (
          <NoResultsCard query={query} chips={noResultsSuggestions} onChipPress={handleNoResultsChip} />
        ) : (
          <SearchResultsTab
            resultTab={resultTab}
            onTabChange={setResultTab}
            dishFirstTopResults={dishFirstTopResults}
            topPlaces={topPlaces}
            topPosts={topPosts}
            topPeople={topPeople}
            postResults={postResults}
            peopleResults={peopleResults}
            placeResults={placeResults}
            placeDistances={placeDistances}
            dishEntityResults={dishEntityResults}
            visiblePostCount={visiblePostCount}
            onShowMorePosts={() => setVisiblePostCount(c => c + SEARCH_POST_LIMIT)}
            expansionLabel={expansionLabel}
            searchMode={searchMode}
            radiusKm={radiusKm}
            locationLabel={userLocation.label}
            query={query}
            user={user}
            searchSessionId={searchSessionId.current}
            activeTabEmpty={activeTabEmpty}
            onResultClick={handleResultClick}
          />
        )}
      </ScrollView>

      {isEnabled('searchFiltersV2') && (
        <SearchFiltersSheet
          visible={nearbySheetVisible}
          onClose={() => setNearbySheetVisible(false)}
          radiusKm={radiusKm}
          setRadiusKm={updateRadiusKm}
          userLocation={userLocation}
          filters={searchFilters}
          setFilters={updateSearchFilters}
          onEnableNearby={() => setSearchMode('aroundMe')}
        />
      )}
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
      fontFamily: fontFamily.serif,
      fontSize: fontSize['3xl'],
      color: c.text,
      letterSpacing: letterSpacing.none,
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
    filterButtonSurface: { backgroundColor: c.bg },
    filterButtonSurfaceActive: { backgroundColor: c.focused },
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
    activeTokenText: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.semibold,
      color: c.accent,
    },
    locationErrorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingBottom: spacing.px10 },
    locationError: { fontSize: fontSize.sm, color: c.text3, flex: 1 },
    locationRecoveryLink: { fontSize: fontSize.sm, color: c.accent, fontWeight: fontWeight.medium },
    locationNudge: {
      minHeight: 44,
      marginBottom: spacing.px10,
      borderRadius: radius.md,
      backgroundColor: `${c.accent}12`,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
    },
    locationNudgeAction: {
      minHeight: 44,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px7,
      paddingLeft: spacing.px14,
      paddingRight: spacing[2],
    },
    locationNudgeText: {
      color: c.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      flexShrink: 1,
    },
    locationNudgeDismiss: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: { flex: 1 },
    suggestionScroll: { maxHeight: 52, flexGrow: 0 },
    suggestionRow: {
      gap: spacing.px7,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      alignItems: 'center',
    },
    suggestionOption: { height: 34, maxWidth: 156 },
  })
}
