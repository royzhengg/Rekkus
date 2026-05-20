import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { useThemeColors, useIsDarkMode } from '@/lib/contexts/ThemeContext'
import { DARK_MAP_STYLE } from '@/constants/mapStyles'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useSavedLocations, type SavedLocation } from '@/lib/hooks/useSavedLocations'
import { useCollections } from '@/lib/hooks/useCollections'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import { usePostVisitPrompt } from '@/lib/hooks/usePostVisitPrompt'
import { updateSavedLocationStatus } from '@/lib/services/collections'
import { analytics } from '@/lib/analytics'
import { PinIcon, PhoneIcon, SortIcon, NavIcon } from '@/components/icons'
import { OpenBadge } from '@/components/OpenBadge'
import { MapMarker } from '@/components/MapMarker'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'

import {
  fetchRestaurantProviderDetail,
  getRestaurantProviderPhotoUrl,
} from '@/lib/services/restaurants'
import { navigateToRestaurant } from '@/lib/utils/restaurantNavigation'
import { todayHoursIndex } from '@/lib/utils/format'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

type PlaceDetail = {
  rating?: number
  formatted_phone_number?: string
  opening_hours?: { open_now?: boolean; weekday_text?: string[] }
  photos?: { photo_reference: string }[]
}

type PlaceFilter =
  | { type: 'all'; id: 'all'; label: string }
  | { type: 'status'; id: 'want_to_try' | 'been_here'; label: string }
  | { type: 'collection'; id: string; label: string }

function groupAlpha(locations: SavedLocation[]): { letter: string; items: SavedLocation[] }[] {
  const sorted = [...locations].sort((a, b) =>
    (a.restaurants?.name ?? '').localeCompare(b.restaurants?.name ?? '')
  )
  const map: Record<string, SavedLocation[]> = {}
  for (const loc of sorted) {
    const first = (loc.restaurants?.name ?? '#')[0].toUpperCase()
    const key = /[A-Z]/.test(first) ? first : '#'
    if (!map[key]) map[key] = []
    map[key].push(loc)
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, items]) => ({ letter, items }))
}

const LocationRow = React.memo(function LocationRow({
  loc,
  onPress,
}: {
  loc: SavedLocation
  onPress: (loc: SavedLocation) => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const r = loc.restaurants
  return (
    <TouchableOpacity
      style={styles.placeRow}
      disabled={!loc.restaurant_id && !r?.google_place_id}
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

export default function PlacesScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const colors = useThemeColors()
  const isDark = useIsDarkMode()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { savedLocations, error, refresh, refreshing } = useSavedLocations(user?.id)
  const restaurantIds = useMemo(
    () => savedLocations.map(loc => loc.restaurant_id).filter(Boolean),
    [savedLocations]
  )
  const { collections, items: collectionItems, refresh: refreshCollections } =
    useCollections(user?.id, restaurantIds)
  const userLocation = useUserLocation()
  const gps = userLocation.coords
  const visitPrompt = usePostVisitPrompt(savedLocations, gps)
  const [dismissedPromptId, setDismissedPromptId] = useState<string | null>(null)
  const activePrompt =
    visitPrompt && visitPrompt.restaurant_id !== dismissedPromptId ? visitPrompt : null
  const [placesView, setPlacesView] = useState<'list' | 'map'>('list')
  const [sortBy, setSortBy] = useState<'alpha' | 'recent' | 'oldest'>('alpha')
  const [activeFilter, setActiveFilter] = useState<PlaceFilter>({
    type: 'all',
    id: 'all',
    label: 'All',
  })
  const [sortSheetVisible, setSortSheetVisible] = useState(false)
  const [mapsSheetLocation, setMapsSheetLocation] = useState<SavedLocation | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<SavedLocation | null>(null)
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
    if (!selectedLocation) {
      setPinDetail(null)
      setPinPhoto('')
      return
    }
    const pid = selectedLocation.restaurants?.google_place_id
    if (!pid) return
    setPinLoading(true)
    fetchRestaurantProviderDetail<PlaceDetail>(
      pid,
      'rating,formatted_phone_number,opening_hours,photos'
    )
      .then(result => {
        if (!result) return
        setPinDetail(result)
        const ref = result.photos?.[0]?.photo_reference
        if (ref) setPinPhoto(getRestaurantProviderPhotoUrl(ref))
        else setPinPhoto('')
      })
      .catch(() => {})
      .finally(() => setPinLoading(false))
  }, [selectedLocation?.id])

  const filterOptions = useMemo<PlaceFilter[]>(
    () => [
      { type: 'all', id: 'all', label: 'All' },
      { type: 'status', id: 'want_to_try', label: 'Want to try' },
      { type: 'status', id: 'been_here', label: 'Been here' },
      ...collections.map(c => ({ type: 'collection' as const, id: c.id, label: c.name })),
    ],
    [collections]
  )

  const filteredLocations = useMemo(() => {
    if (activeFilter.type === 'all') return savedLocations
    if (activeFilter.type === 'status') {
      return savedLocations.filter(loc => (loc.save_status ?? 'want_to_try') === activeFilter.id)
    }
    const restaurantIdsInCollection = new Set(
      collectionItems
        .filter(item => item.collection_id === activeFilter.id && item.target_type === 'restaurant')
        .map(item => item.target_id)
    )
    return savedLocations.filter(loc => restaurantIdsInCollection.has(loc.restaurant_id))
  }, [activeFilter, collectionItems, savedLocations])

  useEffect(() => {
    if (activeFilter.type !== 'collection') return
    if (collections.some(c => c.id === activeFilter.id)) return
    setActiveFilter({ type: 'all', id: 'all', label: 'All' })
  }, [activeFilter, collections])

  const validLocations = useMemo(
    () =>
      filteredLocations.filter(
        l => l.restaurants?.latitude != null && l.restaurants?.longitude != null
      ),
    [filteredLocations]
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
      600
    )
  }, [gps])

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
      300
    )
  }, [])

  const slideY = useSharedValue(300)

  useEffect(() => {
    slideY.value = withSpring(selectedLocation ? 0 : 300, { damping: 20, stiffness: 180 })
  }, [selectedLocation])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }))

  const defaultRegion = useMemo(() => {
    if (gps)
      return { latitude: gps.lat, longitude: gps.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    if (validLocations.length > 0)
      return {
        latitude: validLocations[0].restaurants!.latitude!,
        longitude: validLocations[0].restaurants!.longitude!,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }
    return { latitude: -33.8688, longitude: 151.2093, latitudeDelta: 0.1, longitudeDelta: 0.1 }
  }, [gps, validLocations])

  const oldestLocations = useMemo(
    () =>
      [...filteredLocations].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [filteredLocations]
  )

  const recentLocations = useMemo(
    () =>
      [...filteredLocations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [filteredLocations]
  )

  const alphaGroups = useMemo(() => groupAlpha(filteredLocations), [filteredLocations])

  const refreshAll = useCallback(async () => {
    await refresh()
    await refreshCollections()
  }, [refresh, refreshCollections])

  const toggleSelectedStatus = useCallback(async () => {
    if (!selectedLocation) return
    const next =
      (selectedLocation.save_status ?? 'want_to_try') === 'been_here'
        ? 'want_to_try'
        : 'been_here'
    const err = await updateSavedLocationStatus(selectedLocation.id, next)
    if (!err) {
      setSelectedLocation({ ...selectedLocation, save_status: next })
      analytics.collectionInteraction(user?.id ?? null, 'saved_location_status_changed', undefined, {
        status: next,
        restaurant_id: selectedLocation.restaurant_id,
      })
      refreshAll()
    }
  }, [refreshAll, selectedLocation, user?.id])

  const navigateTo = useCallback(
    (loc: SavedLocation) => { navigateToRestaurant(router, loc) },
    [router]
  )

  const openInMaps = useCallback((loc: SavedLocation) => {
    setMapsSheetLocation(loc)
  }, [])

  const openSelectedLocationInMaps = useCallback((provider: string) => {
    const loc = mapsSheetLocation
    if (!loc) return
    const r = loc.restaurants
    if (!r?.latitude || !r?.longitude) return
    const { latitude: lat, longitude: lng, name } = r
    if (provider === 'apple')
      Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${lat},${lng}`)
    if (provider === 'google')
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
  }, [mapsSheetLocation])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Places</Text>
      </View>

      {savedLocations.length === 0 ? (
        <EmptyState
          title={error ? 'Could not load places' : 'No saved places yet'}
          subtitle={error ? error : 'Tap the pin icon on a post to save a location.'}
          icon={<PinIcon size={36} />}
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, placesView === 'list' && styles.toggleBtnActive]}
              onPress={() => setPlacesView('list')}
            >
              <Text style={[styles.toggleText, placesView === 'list' && styles.toggleTextActive]}>
                List
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, placesView === 'map' && styles.toggleBtnActive]}
              onPress={() => {
                setPlacesView('map')
                setSelectedLocation(null)
              }}
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
                    onPress={() =>
                      router.push({
                        pathname: '/(tabs)/create',
                        params: {
                          prefillName: activePrompt.restaurants?.name ?? '',
                          prefillAddress: activePrompt.restaurants?.address ?? '',
                          prefillLat: String(activePrompt.restaurants?.latitude ?? ''),
                          prefillLng: String(activePrompt.restaurants?.longitude ?? ''),
                          prefillPlaceId: activePrompt.restaurants?.google_place_id ?? '',
                          prefillRestaurantId: activePrompt.restaurant_id,
                        },
                      })
                    }
                    activeOpacity={0.85}
                  >
                    <View style={styles.visitBannerText}>
                      <Text style={styles.visitBannerTitle}>
                        Been to {activePrompt.restaurants?.name ?? 'this place'}?
                      </Text>
                      <Text style={styles.visitBannerSub}>Tap to leave a review</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.visitBannerClose}
                      onPress={() => setDismissedPromptId(activePrompt.restaurant_id)}
                      hitSlop={8}
                    >
                      <Text style={styles.visitBannerCloseText}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                {filteredLocations.length === 0 ? (
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
                          <LocationRow key={loc.id} loc={loc} onPress={navigateTo} />
                        ))}
                      </View>
                    ))
                  : sortBy === 'oldest'
                    ? oldestLocations.map(loc => (
                        <LocationRow key={loc.id} loc={loc} onPress={navigateTo} />
                      ))
                    : recentLocations.map(loc => (
                        <LocationRow key={loc.id} loc={loc} onPress={navigateTo} />
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
                    setSelectedLocation(null)
                  }
                }}
              >
                {validLocations.map(loc => (
                  <Marker
                    key={loc.id}
                    coordinate={{
                      latitude: loc.restaurants!.latitude!,
                      longitude: loc.restaurants!.longitude!,
                    }}
                    tracksViewChanges={false}
                    anchor={{ x: 0.5, y: 1 }}
                    onPress={() => {
                      lastMarkerPress.current = Date.now()
                      setSelectedLocation(loc)
                    }}
                  >
                    <MapMarker name={loc.restaurants?.name ?? ''} />
                  </Marker>
                ))}
              </MapView>
              <TouchableOpacity
                style={styles.locateBtn}
                onPress={() => {
                  if (!gps) {
                    userLocation.requestLocation()
                    return
                  }
                  mapRef.current?.animateToRegion(
                    {
                      latitude: gps.lat,
                      longitude: gps.lng,
                      latitudeDelta: currentRegionRef.current.latitudeDelta,
                      longitudeDelta: currentRegionRef.current.longitudeDelta,
                    },
                    400
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
                >
                  <Text style={styles.zoomBtnText}>+</Text>
                </TouchableOpacity>
                <View style={styles.zoomDivider} />
                <TouchableOpacity
                  style={styles.zoomBtn}
                  onPress={() => zoom('out')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.zoomBtnText}>−</Text>
                </TouchableOpacity>
              </View>

              <Animated.View
                style={[styles.locationCard, cardStyle]}
                pointerEvents={selectedLocation ? 'auto' : 'none'}
              >
                <View style={styles.cardHandle} />
                {pinLoading && (
                  <ActivityIndicator
                    size="small"
                    color={colors.text3}
                    style={{ marginBottom: spacing[1] }}
                  />
                )}
                {!!pinPhoto && (
                  <Image source={{ uri: pinPhoto }} style={styles.cardPhoto} resizeMode="cover" />
                )}
                <Text style={styles.cardName} numberOfLines={1}>
                  {selectedLocation?.restaurants?.name}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardMetaText}>
                    {(selectedLocation?.save_status ?? 'want_to_try') === 'been_here'
                      ? 'Been here'
                      : 'Want to try'}
                  </Text>
                  {pinDetail?.rating != null && (
                    <Text style={styles.cardMetaText}>⭐ {pinDetail.rating.toFixed(1)}</Text>
                  )}
                  {pinDetail?.opening_hours?.open_now != null && (
                    <OpenBadge openNow={pinDetail.opening_hours.open_now} />
                  )}
                </View>
                {(() => {
                  const todayText = pinDetail?.opening_hours?.weekday_text?.[todayHoursIndex()]
                  return todayText ? (
                    <Text style={styles.cardHours} numberOfLines={1}>
                      {todayText}
                    </Text>
                  ) : null
                })()}
                {!!pinDetail?.formatted_phone_number && (
                  <TouchableOpacity
                    style={styles.cardPhoneRow}
                    onPress={() =>
                      Linking.openURL(
                        `tel:${pinDetail!.formatted_phone_number!.replace(/\s/g, '')}`
                      )
                    }
                  >
                    <PhoneIcon />
                    <Text style={styles.cardPhoneText}>{pinDetail.formatted_phone_number}</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.cardBtnSecondary} onPress={toggleSelectedStatus}>
                    <Text style={styles.cardBtnSecondaryText}>
                      {(selectedLocation?.save_status ?? 'want_to_try') === 'been_here'
                        ? 'Mark want'
                        : 'Mark been'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cardBtnPrimary}
                    onPress={() => selectedLocation && navigateTo(selectedLocation)}
                  >
                    <Text style={styles.cardBtnPrimaryText}>View details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cardBtnSecondary}
                    onPress={() => selectedLocation && openInMaps(selectedLocation)}
                  >
                    <Text style={styles.cardBtnSecondaryText}>Open in Maps</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
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
        visible={!!mapsSheetLocation}
        title="Open in Maps"
        subtitle={mapsSheetLocation?.restaurants?.name}
        options={[
          { label: 'Apple Maps', value: 'apple' },
          { label: 'Google Maps', value: 'google' },
        ]}
        onSelect={openSelectedLocationInMaps}
        onDismiss={() => setMapsSheetLocation(null)}
      />
    </SafeAreaView>
  )
}

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
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    content: { flex: 1 },
    toggleRow: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: radius.sm3,
      margin: spacing[4],
      marginBottom: spacing[0],
      padding: spacing.px3,
      gap: spacing.px3,
    },
    toggleBtn: { flex: 1, paddingVertical: spacing.px6, borderRadius: radius.sm, alignItems: 'center' },
    toggleBtnActive: { backgroundColor: c.bg },
    toggleText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text3 },
    toggleTextActive: { color: c.text },
    filterRow: {
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      gap: spacing[2],
    },
    filterScroll: {
      flexGrow: 0,
      flexShrink: 0,
      height: 52,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    viewsContainer: { flex: 1 },
    sortHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.px5 },
    sortBtnText: { fontSize: fontSize.bodySm, color: c.text2 },
    letterHeader: { paddingHorizontal: spacing[4], paddingVertical: spacing.px6, backgroundColor: c.surface },
    letterText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text3 },
    visitBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: spacing[4],
      marginTop: spacing[3],
      marginBottom: spacing[1],
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
    },
    visitBannerText: { flex: 1 },
    visitBannerTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.text, marginBottom: spacing.px2 },
    visitBannerSub: { fontSize: fontSize.sm, color: c.accent },
    visitBannerClose: { paddingLeft: spacing.px10 },
    visitBannerCloseText: { fontSize: fontSize.bodySm, color: c.text3 },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    placeRowName: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text, marginBottom: spacing.px2 },
    placeRowAddress: { fontSize: fontSize.sm, color: c.text3 },
    locationCard: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.bg,
      borderTopLeftRadius: radius.lg2,
      borderTopRightRadius: radius.lg2,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingHorizontal: spacing[5],
      paddingTop: spacing[3],
      paddingBottom: spacing[8],
      gap: spacing[1],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    cardHandle: {
      width: 36,
      height: 4,
      borderRadius: radius.xxs,
      backgroundColor: c.border2,
      alignSelf: 'center',
      marginBottom: spacing.px10,
    },
    cardPhoto: { width: '100%', height: 130, borderRadius: radius.md, marginBottom: spacing[1] },
    cardName: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    cardMetaText: { fontSize: fontSize.base, color: c.text2 },
    cardHours: { fontSize: fontSize.bodySm, color: c.text3 },
    cardPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    cardPhoneText: { fontSize: fontSize.bodySm, color: c.text2 },
    cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px10, marginTop: spacing[1] },
    cardBtnPrimary: {
      flexGrow: 1,
      minWidth: 128,
      borderRadius: radius.pill,
      backgroundColor: c.text,
      paddingVertical: spacing.px11,
      alignItems: 'center',
    },
    cardBtnPrimaryText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.bg },
    cardBtnSecondary: {
      flexGrow: 1,
      minWidth: 112,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border2,
      paddingVertical: spacing.px11,
      alignItems: 'center',
    },
    cardBtnSecondaryText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    locateBtn: {
      position: 'absolute',
      right: 16,
      bottom: 116,
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    zoomControls: {
      position: 'absolute',
      right: 16,
      bottom: 24,
      backgroundColor: c.bg,
      borderRadius: radius.md,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    zoomBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    zoomBtnText: { fontSize: fontSize['3xl'], fontWeight: fontWeight.light, color: c.text, lineHeight: lineHeight.display },
    zoomDivider: { height: 0.5, backgroundColor: c.border },
  })
}
