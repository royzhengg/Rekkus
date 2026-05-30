import { useLocalSearchParams, useFocusEffect } from 'expo-router'
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SearchIcon, CloseIcon, FilterIcon } from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { demoCurrentUser, demoRestaurants, demoUsers } from '@/lib/dataSources/demoData'
import { occasionLabel, valueLabel } from '@/lib/dataSources/rekkusPicks'
import { isEnabled } from '@/lib/featureFlags'
import { useSearch, type PlaceResult, type SearchFilters } from '@/lib/hooks/useSearch'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { useTrendingData } from '@/lib/hooks/useTrendingData'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import { fetchStaffPickCollections, type Collection } from '@/lib/services/collections'
import { CUISINE_SYNONYMS, CUISINE_ALIASES } from '@/lib/utils/cuisineSynonyms'
import { DiscoveryPage } from './DiscoveryPage'
import { NoResultsCard } from './NoResultsCard'
import { TRENDING, SEARCH_SORTS, type ResultTab } from './searchConstants'
import { SearchFiltersSheet } from './SearchFiltersSheet'
import { SearchResultsTab } from './SearchResultsTab'

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
  const { trendingSearches } = useTrendingData()
  const { recentSearches, dismissSearch } = useSearchHistory()
  const searchSessionId = useRef(`search-${Date.now().toString(36)}`)
  const queryPosition = useRef(0)
  const previousTrackedQuery = useRef('')
  const sessionStartTime = useRef(Date.now())
  const sessionHadClick = useRef(false)
  const sessionHadResults = useRef(false)
  const sessionLastResultCount = useRef(0)

  const {
    postResults,
    peopleResults,
    placeResults,
    placeDistances,
    suggestions,
    hasQuery,
    expansionLabel,
  } = useSearch(query, userLocation.coords, {
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
    void fetchStaffPickCollections().then(setStaffPicks)
  }, [])

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
        }
      )
      previousTrackedQuery.current = trimmed
    }, 600)
    return () => clearTimeout(timer)
  }, [query, totalResults, user?.id, radiusKm, searchMode])

  const suggestedPeople = Object.entries(demoUsers).filter(
    ([u]) => u !== demoCurrentUser.username
  )

  const popularPlaces: PlaceResult[] = demoRestaurants.slice(0, 5).map(r => ({
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
  }))

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
    if (searchFilters.values?.length) {
      tokens.push(...searchFilters.values.slice(0, 1).map(valueLabel))
    }
    if (searchFilters.mediaTypes?.length) {
      tokens.push(
        searchFilters.mediaTypes
          .map(type =>
            type === 'mixed' ? 'Mixed media' : type === 'video' ? 'Videos' : 'Photos'
          )
          .join(', ')
      )
    }
    if (searchFilters.sort && searchFilters.sort !== 'best_match') {
      tokens.push(SEARCH_SORTS.find(s => s.key === searchFilters.sort)?.label ?? 'Sorted')
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
    analytics.searchFilter(user?.id ?? null, 'applied', 'search_filters')
  }

  function handleSelectRecent(item: string) {
    setQuery(item)
    setIsFocused(false)
    setSearchMode('search')
    setResultTab('top')
  }

  function handleNoResultsChip(q: string) {
    setQuery(q)
    setActiveChip('')
    setSearchMode('search')
    setResultTab('top')
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
            onDismissSearch={dismissSearch}
            onSelectRecent={handleSelectRecent}
            activeChip={activeChip}
            trendingItems={trendingItems}
            suggestedPeople={suggestedPeople}
            popularPlaces={popularPlaces}
            staffPicks={staffPicks}
            onChip={handleChip}
            onTrending={handleTrending}
            onOpenNearby={openNearbySearch}
            userId={user?.id}
          />
        ) : totalResults === 0 ? (
          <NoResultsCard query={query} onChipPress={handleNoResultsChip} />
        ) : (
          <SearchResultsTab
            resultTab={resultTab}
            onTabChange={setResultTab}
            topPlaces={topPlaces}
            topPosts={topPosts}
            topPeople={topPeople}
            postResults={postResults}
            peopleResults={peopleResults}
            placeResults={placeResults}
            placeDistances={placeDistances}
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
          setRadiusKm={setRadiusKm}
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
