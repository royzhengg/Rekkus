import { useRouter } from 'expo-router'
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, PinIcon, SortIcon, NavIcon } from '@/components/icons'
import { MapMarker } from '@/components/MapMarker'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { DARK_MAP_STYLE } from '@/constants/mapStyles'
import { analytics } from '@/lib/analytics'
import { SPRING_CARD } from '@/lib/animations'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors, useIsDarkMode } from '@/lib/contexts/ThemeContext'
import { useCollections } from '@/lib/hooks/useCollections'
import { usePostVisitPrompt } from '@/lib/hooks/usePostVisitPrompt'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { useSavedPlaces, type SavedPlace } from '@/lib/hooks/useSavedPlaces'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import { routes } from '@/lib/routes'
import {
  fetchPlaceProviderDetail,
  getPlaceProviderPhotoUrl,
} from '@/lib/services/places'
import { navigateToPlace } from '@/lib/utils/placeNavigation'
import { makeStyles } from './PlacesTabScreen.styles'
import { SelectedPlaceCard } from './SelectedPlaceCard'
import type { PlaceDetail } from './placeTypes'

type PlaceFilter =
  | { type: 'all'; id: 'all'; label: string }
  | { type: 'collection'; id: string; label: string }
function groupAlpha(savedPlaces: SavedPlace[]): { letter: string; items: SavedPlace[] }[] {
  const sorted = [...savedPlaces].sort((a, b) =>
    (a.places?.name ?? '').localeCompare(b.places?.name ?? '')
  )
  const map: Record<string, SavedPlace[]> = {}
  for (const loc of sorted) {
    const first = ((loc.places?.name ?? '#')[0] ?? '#').toUpperCase()
    const key = /[A-Z]/.test(first) ? first : '#'
    if (!map[key]) map[key] = []
    map[key].push(loc)
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, items]) => ({ letter, items }))
}
const PlaceRow = React.memo(function PlaceRow({
  loc,
  onPress,
}: {
  loc: SavedPlace
  onPress: (loc: SavedPlace) => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const r = loc.places
  return (
    <TouchableOpacity
      style={styles.placeRow}
      disabled={!loc.place_id && !r?.google_place_id}
      onPress={() => onPress(loc)}
    >
      <PinIcon />
      <View style={{ flex: 1 }}>
        <Text style={styles.placeRowName}>{r?.name ?? 'Unknown'}</Text>
        {!!r?.address && <Text style={styles.placeRowAddress}>{r.address}</Text>}
      </View>
    </TouchableOpacity>
  )
})
type PlacesScreenProps = {
  initialView?: 'list' | 'map'
  onBackToSaved?: () => void
}

export default function PlacesTabScreen({ initialView = 'list', onBackToSaved }: PlacesScreenProps) {
  const router = useRouter()
  const { user } = useAuth()
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const isDark = useIsDarkMode()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { savedPlaces, error, refresh, refreshing } = useSavedPlaces(user?.id)
  const placeIds = useMemo(
    () => savedPlaces.map(loc => loc.place_id).filter(Boolean),
    [savedPlaces]
  )
  const { collections, items: collectionItems, refresh: refreshCollections } =
    useCollections(user?.id, placeIds)
  const userLocation = useUserLocation()
  const gps = userLocation.coords
  const visitPrompt = usePostVisitPrompt(savedPlaces, gps)
  const [dismissedPromptId, setDismissedPromptId] = useState<string | null>(null)
  const activePrompt = visitPrompt && visitPrompt.place_id !== dismissedPromptId ? visitPrompt : null
  const [placesView, setPlacesView] = useState<'list' | 'map'>(initialView)
  const [sortBy, setSortBy] = useState<'alpha' | 'recent' | 'oldest'>('alpha')
  const [activeFilter, setActiveFilter] = useState<PlaceFilter>({
    type: 'all',
    id: 'all',
    label: 'All',
  })
  const [sortSheetVisible, setSortSheetVisible] = useState(false)
  const [mapsSheetPlace, setMapsSheetPlace] = useState<SavedPlace | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<SavedPlace | null>(null)
  const [pinDetail, setPinDetail] = useState<PlaceDetail | null>(null)
  const [pinPhoto, setPinPhoto] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const lastMarkerPress = useRef(0)
  const mapRef = useRef<MapView>(null)
  const deltaRef = useRef(0.08)
  const currentRegionRef = useRef({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  })
  const hasAnimatedToGps = useRef(false)

  useEffect(() => {
    if (!selectedPlace) {
      setPinDetail(null)
      setPinPhoto('')
      return
    }
    const pid = selectedPlace.places?.google_place_id
    if (!pid) return
    setPinLoading(true)
    fetchPlaceProviderDetail(
      pid,
      'rating,formatted_phone_number,opening_hours,photos'
    )
      .then(result => {
        if (!result) return
        setPinDetail(result)
        const ref = result.photos?.[0]?.photo_reference
        if (ref) setPinPhoto(getPlaceProviderPhotoUrl(ref))
        else setPinPhoto('')
      })
      .catch(() => {})
      .finally(() => setPinLoading(false))
  }, [selectedPlace])

  const filterOptions = useMemo<PlaceFilter[]>(
    () => [
      { type: 'all', id: 'all', label: 'All' },
      ...collections.map(c => ({ type: 'collection' as const, id: c.id, label: c.name })),
    ],
    [collections]
  )

  const filteredPlaces = useMemo(() => {
    if (activeFilter.type === 'all') return savedPlaces
    const placeIdsInCollection = new Set(
      collectionItems
        .filter(item => item.collection_id === activeFilter.id && item.target_type === 'place')
        .map(item => item.target_id)
    )
    return savedPlaces.filter(loc => placeIdsInCollection.has(loc.place_id))
  }, [activeFilter, collectionItems, savedPlaces])

  useEffect(() => {
    if (activeFilter.type !== 'collection') return
    if (collections.some(c => c.id === activeFilter.id)) return
    setActiveFilter({ type: 'all', id: 'all', label: 'All' })
  }, [activeFilter, collections])

  const validPlaces = useMemo(
    () =>
      filteredPlaces.filter(
        l => l.places?.latitude != null && l.places?.longitude != null
      ),
    [filteredPlaces]
  )

  useEffect(() => {
    if (!gps || hasAnimatedToGps.current) return
    hasAnimatedToGps.current = true
    mapRef.current?.animateToRegion(
      {
        latitude: gps.lat,
        longitude: gps.lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      },
      reduceMotion ? 0 : 600
    )
  }, [gps, reduceMotion])

  const zoom = useCallback((direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 0.5 : 2
    deltaRef.current = Math.min(
      Math.max(currentRegionRef.current.latitudeDelta * factor, 0.001),
      50
    )
    mapRef.current?.animateToRegion(
      {
        latitude: currentRegionRef.current.latitude,
        longitude: currentRegionRef.current.longitude,
        latitudeDelta: deltaRef.current,
        longitudeDelta: deltaRef.current,
      },
      reduceMotion ? 0 : 300
    )
  }, [reduceMotion])

  const slideY = useSharedValue(300)

  useEffect(() => {
    slideY.value = reduceMotion
      ? (selectedPlace ? 0 : 300)
      : withSpring(selectedPlace ? 0 : 300, SPRING_CARD)
  }, [reduceMotion, selectedPlace, slideY])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }))

  const defaultRegion = useMemo(() => {
    if (gps)
      return { latitude: gps.lat, longitude: gps.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    if (validPlaces.length > 0)
      return {
        latitude: validPlaces[0]?.places?.latitude ?? -33.8688,
        longitude: validPlaces[0]?.places?.longitude ?? 151.2093,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }
    return { latitude: -33.8688, longitude: 151.2093, latitudeDelta: 0.1, longitudeDelta: 0.1 }
  }, [gps, validPlaces])

  const oldestPlaces = useMemo(
    () =>
      [...filteredPlaces].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [filteredPlaces]
  )

  const recentPlaces = useMemo(
    () =>
      [...filteredPlaces].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [filteredPlaces]
  )

  const alphaGroups = useMemo(() => groupAlpha(filteredPlaces), [filteredPlaces])

  const refreshAll = useCallback(async () => {
    await refresh()
    await refreshCollections()
  }, [refresh, refreshCollections])

  const navigateTo = useCallback(
    (loc: SavedPlace) => { navigateToPlace(router, loc) },
    [router]
  )

  const openInMaps = useCallback((loc: SavedPlace) => {
    setMapsSheetPlace(loc)
  }, [])

  const openSelectedPlaceInMaps = useCallback((provider: string) => {
    const loc = mapsSheetPlace
    if (!loc) return
    const r = loc.places
    if (!r?.latitude || !r?.longitude) return
    const { latitude: lat, longitude: lng, name } = r
    if (provider === 'apple')
      void Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${lat},${lng}`)
    if (provider === 'google')
      void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
  }, [mapsSheetPlace])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        {onBackToSaved ? (
          <TouchableOpacity
            style={styles.backToSaved}
            onPress={onBackToSaved}
            accessibilityRole="button"
            accessibilityLabel="Back to saved overview"
          >
            <ChevronLeft />
            <Text style={styles.backToSavedText}>Saved</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>Places</Text>
        {onBackToSaved ? <View style={styles.backToSavedSpacer} /> : null}
      </View>

      {error && savedPlaces.length === 0 ? (
        <View style={styles.content}>
          <ErrorMessage title="Could not load places" message={error} />
        </View>
      ) : savedPlaces.length === 0 ? (
        <EmptyState
          title="No saved places yet"
          subtitle="Tap the pin icon on a post to save a location."
          icon={<PinIcon size={36} />}
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, placesView === 'list' && styles.toggleBtnActive]}
              onPress={() => setPlacesView('list')}
              accessibilityRole="tab"
              accessibilityState={{ selected: placesView === 'list' }}
            >
              <Text style={[styles.toggleText, placesView === 'list' && styles.toggleTextActive]}>
                List
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, placesView === 'map' && styles.toggleBtnActive]}
              onPress={() => {
                setPlacesView('map')
                setSelectedPlace(null)
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: placesView === 'map' }}
            >
              <Text style={[styles.toggleText, placesView === 'map' && styles.toggleTextActive]}>
                Map
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.filterScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filterOptions.map(option => (
              <Chip
                key={`${option.type}:${option.id}`}
                label={option.label}
                selected={activeFilter.type === option.type && activeFilter.id === option.id}
                variant="active"
                onPress={() => {
                  setActiveFilter(option)
                  analytics.collectionInteraction(
                    user?.id ?? null,
                    'places_filter_selected',
                    option.type === 'collection' ? option.id : undefined,
                    { filter_type: option.type, filter_id: option.id }
                  )
                }}
              />
            ))}
          </ScrollView>

          {/* Both views always mounted so MapView initialises tiles immediately */}
          <View style={styles.viewsContainer}>
            <View
              pointerEvents={placesView === 'list' ? 'auto' : 'none'}
              style={[StyleSheet.absoluteFill, placesView !== 'list' && { opacity: 0 }]}
            >
              <View style={styles.sortHeader}>
                <TouchableOpacity
                  style={styles.sortBtn}
                  onPress={() => setSortSheetVisible(true)}
                >
                  <SortIcon />
                  <Text style={styles.sortBtnText}>
                    {sortBy === 'alpha'
                      ? 'A–Z'
                      : sortBy === 'recent'
                        ? 'Last saved'
                        : 'Oldest saved'}
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={refreshAll}
                    tintColor={colors.text}
                  />
                }
              >
                {/* Post-visit prompt banner */}
                {activePrompt && (
                  <TouchableOpacity
                    style={styles.visitBanner}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push(routes.createPost({
                        prefillName: activePrompt.places?.name ?? '',
                        prefillAddress: activePrompt.places?.address ?? '',
                        prefillLat: String(activePrompt.places?.latitude ?? ''),
                        prefillLng: String(activePrompt.places?.longitude ?? ''),
                        prefillGooglePlaceId: activePrompt.places?.google_place_id ?? '',
                        prefillPlaceId: activePrompt.place_id ?? undefined,
                      }))
                    }
                    activeOpacity={0.85}
                  >
                    <View style={styles.visitBannerText}>
                      <Text style={styles.visitBannerTitle}>
                        Been to {activePrompt.places?.name ?? 'this place'}?
                      </Text>
                      <Text style={styles.visitBannerSub}>Tap to leave a review</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.visitBannerClose}
                      onPress={() => setDismissedPromptId(activePrompt.place_id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss"
                    >
                      <Text style={styles.visitBannerCloseText}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                {filteredPlaces.length === 0 ? (
                  <EmptyState
                    title={`Nothing in ${activeFilter.label}`}
                    subtitle="Saved places appear here when they match this filter."
                  />
                ) : sortBy === 'alpha'
                  ? alphaGroups.map(({ letter, items }) => (
                      <View key={letter}>
                        <View style={styles.letterHeader}>
                          <Text style={styles.letterText}>{letter}</Text>
                        </View>
                        {items.map(loc => (
                          <PlaceRow key={loc.id} loc={loc} onPress={navigateTo} />
                        ))}
                      </View>
                    ))
                  : sortBy === 'oldest'
                    ? oldestPlaces.map(loc => (
                        <PlaceRow key={loc.id} loc={loc} onPress={navigateTo} />
                      ))
                    : recentPlaces.map(loc => (
                        <PlaceRow key={loc.id} loc={loc} onPress={navigateTo} />
                      ))}
              </ScrollView>
            </View>

            <View
              pointerEvents={placesView === 'map' ? 'auto' : 'none'}
              style={[StyleSheet.absoluteFill, placesView !== 'map' && { opacity: 0 }]}
            >
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                initialRegion={defaultRegion}
                customMapStyle={isDark ? DARK_MAP_STYLE : []}
                onRegionChangeComplete={r => {
                  currentRegionRef.current = r
                }}
                onPress={() => {
                  // PROVIDER_GOOGLE fires MapView.onPress even when a Marker is tapped.
                  // Ignore the map tap if it fired within 400ms of a marker press.
                  if (Date.now() - lastMarkerPress.current > 400) {
                    setSelectedPlace(null)
                  }
                }}
              >
                {validPlaces.map(loc => {
                  const place = loc.places
                  if (place?.latitude == null || place.longitude == null) return null
                  return (
                    <Marker
                      key={loc.id}
                      coordinate={{
                        latitude: place.latitude,
                        longitude: place.longitude,
                      }}
                      tracksViewChanges={false}
                      anchor={{ x: 0.5, y: 1 }}
                      onPress={() => {
                        lastMarkerPress.current = Date.now()
                        setSelectedPlace(loc)
                      }}
                    >
                      <MapMarker name={place.name ?? ''} />
                    </Marker>
                  )
                })}
              </MapView>
              <TouchableOpacity
                style={styles.locateBtn}
                onPress={() => {
                  if (!gps) {
                    void userLocation.requestLocation()
                    return
                  }
                  mapRef.current?.animateToRegion(
                    {
                      latitude: gps.lat,
                      longitude: gps.lng,
                      latitudeDelta: currentRegionRef.current.latitudeDelta,
                      longitudeDelta: currentRegionRef.current.longitudeDelta,
                    },
                    reduceMotion ? 0 : 400
                  )
                }}
                activeOpacity={0.8}
                accessibilityLabel={gps ? 'Center map on your location' : 'Use current location'}
              >
                {userLocation.loading ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <NavIcon size={18} />
                )}
              </TouchableOpacity>
              <View style={styles.zoomControls}>
                <TouchableOpacity
                  style={styles.zoomBtn}
                  onPress={() => zoom('in')}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Zoom in"
                >
                  <Text style={styles.zoomBtnText}>+</Text>
                </TouchableOpacity>
                <View style={styles.zoomDivider} />
                <TouchableOpacity
                  style={styles.zoomBtn}
                  onPress={() => zoom('out')}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Zoom out"
                >
                  <Text style={styles.zoomBtnText}>−</Text>
                </TouchableOpacity>
              </View>

              <SelectedPlaceCard
                styles={styles}
                colors={colors}
                cardStyle={cardStyle}
                selectedPlace={selectedPlace}
                pinLoading={pinLoading}
                pinPhoto={pinPhoto}
                pinDetail={pinDetail}
                navigateTo={navigateTo}
                openInMaps={openInMaps}
              />
            </View>
          </View>
        </View>
      )}
      <RekkusActionSheet
        visible={sortSheetVisible}
        title="Sort places"
        options={[
          { label: 'A–Z', value: 'alpha', selected: sortBy === 'alpha' },
          { label: 'Last saved', value: 'recent', selected: sortBy === 'recent' },
          { label: 'Oldest saved', value: 'oldest', selected: sortBy === 'oldest' },
        ]}
        onSelect={value => setSortBy(value as 'alpha' | 'recent' | 'oldest')}
        onDismiss={() => setSortSheetVisible(false)}
      />
      <RekkusActionSheet
        visible={!!mapsSheetPlace}
        title="Open in Maps"
        subtitle={mapsSheetPlace?.places?.name}
        options={[
          { label: 'Apple Maps', value: 'apple' },
          { label: 'Google Maps', value: 'google' },
        ]}
        onSelect={openSelectedPlaceInMaps}
        onDismiss={() => setMapsSheetPlace(null)}
      />
    </SafeAreaView>
  )
}
