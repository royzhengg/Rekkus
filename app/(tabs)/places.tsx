import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActionSheetIOS,
  Linking,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Svg, Path, Circle } from 'react-native-svg'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { useThemeColors } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/AuthContext'
import { useSavedLocations, type SavedLocation } from '@/lib/hooks/useSavedLocations'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import { PinIcon, PhoneIcon, SortIcon, NavIcon } from '@/components/icons'
import { OpenBadge } from '@/components/OpenBadge'
import { MapMarker } from '@/components/MapMarker'

import { GOOGLE_PLACES_KEY as PLACES_KEY } from '@/lib/config'
import { todayHoursIndex } from '@/lib/utils/format'

type PlaceDetail = {
  rating?: number
  formatted_phone_number?: string
  opening_hours?: { open_now?: boolean; weekday_text?: string[] }
  photos?: { photo_reference: string }[]
}

function EmptyPinIcon() {
  const colors = useThemeColors()
  return (
    <Svg
      width={36}
      height={36}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.text3}
      strokeWidth={1}
      strokeLinecap="round"
    >
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} />
    </Svg>
  )
}

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
      disabled={!r?.latitude || !r?.longitude}
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
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { savedLocations, error, refresh, refreshing } = useSavedLocations(user?.id)
  const gps = useUserLocation()
  const [placesView, setPlacesView] = useState<'list' | 'map'>('list')
  const [sortBy, setSortBy] = useState<'alpha' | 'recent' | 'oldest'>('alpha')
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
    if (!pid || !PLACES_KEY) return
    setPinLoading(true)
    fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pid}&fields=rating,formatted_phone_number,opening_hours,photos&key=${PLACES_KEY}`
    )
      .then(r => r.json())
      .then(json => {
        const result: PlaceDetail = json.result ?? {}
        setPinDetail(result)
        const ref = result.photos?.[0]?.photo_reference
        if (ref)
          setPinPhoto(
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${PLACES_KEY}`
          )
        else setPinPhoto('')
      })
      .catch(() => {})
      .finally(() => setPinLoading(false))
  }, [selectedLocation?.id])

  const validLocations = useMemo(
    () =>
      savedLocations.filter(
        l => l.restaurants?.latitude != null && l.restaurants?.longitude != null
      ),
    [savedLocations]
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

  const recentLocations = useMemo(
    () =>
      [...savedLocations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [savedLocations]
  )

  const oldestLocations = useMemo(
    () =>
      [...savedLocations].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [savedLocations]
  )

  const alphaGroups = useMemo(() => groupAlpha(savedLocations), [savedLocations])

  const navigateTo = useCallback(
    (loc: SavedLocation) => {
      const r = loc.restaurants
      if (!r?.latitude || !r?.longitude) return
      router.push({
        pathname: '/location/[placeId]',
        params: {
          placeId: r.google_place_id ?? 'none',
          name: r.name,
          address: r.address ?? '',
          lat: String(r.latitude),
          lng: String(r.longitude),
        },
      })
    },
    [router]
  )

  const openInMaps = useCallback((loc: SavedLocation) => {
    const r = loc.restaurants
    if (!r?.latitude || !r?.longitude) return
    const { latitude: lat, longitude: lng, name } = r
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Apple Maps', 'Google Maps'], cancelButtonIndex: 0 },
      i => {
        if (i === 1)
          Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${lat},${lng}`)
        if (i === 2)
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
      }
    )
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Places</Text>
      </View>

      {savedLocations.length === 0 ? (
        <View style={styles.empty}>
          <EmptyPinIcon />
          <Text style={styles.emptyTitle}>
            {error ? 'Could not load places' : 'No saved places yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {error ? error : 'Tap the pin icon on a post\nto save a location.'}
          </Text>
        </View>
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

          {/* Both views always mounted so MapView initialises tiles immediately */}
          <View style={styles.viewsContainer}>
            <View
              pointerEvents={placesView === 'list' ? 'auto' : 'none'}
              style={[StyleSheet.absoluteFill, placesView !== 'list' && { opacity: 0 }]}
            >
              <View style={styles.sortHeader}>
                <TouchableOpacity
                  style={styles.sortBtn}
                  onPress={() =>
                    ActionSheetIOS.showActionSheetWithOptions(
                      {
                        options: ['Cancel', 'A–Z', 'Last saved', 'Oldest saved'],
                        cancelButtonIndex: 0,
                      },
                      i => {
                        if (i === 1) setSortBy('alpha')
                        if (i === 2) setSortBy('recent')
                        if (i === 3) setSortBy('oldest')
                      }
                    )
                  }
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
                    onRefresh={refresh}
                    tintColor={colors.text}
                  />
                }
              >
                {sortBy === 'alpha'
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
              {gps && (
                <TouchableOpacity
                  style={styles.locateBtn}
                  onPress={() =>
                    mapRef.current?.animateToRegion(
                      {
                        latitude: gps.lat,
                        longitude: gps.lng,
                        latitudeDelta: currentRegionRef.current.latitudeDelta,
                        longitudeDelta: currentRegionRef.current.longitudeDelta,
                      },
                      400
                    )
                  }
                  activeOpacity={0.8}
                >
                  <NavIcon size={18} />
                </TouchableOpacity>
              )}
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
                    style={{ marginBottom: 4 }}
                  />
                )}
                {!!pinPhoto && (
                  <Image source={{ uri: pinPhoto }} style={styles.cardPhoto} resizeMode="cover" />
                )}
                <Text style={styles.cardName} numberOfLines={1}>
                  {selectedLocation?.restaurants?.name}
                </Text>
                <View style={styles.cardMeta}>
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
                  <TouchableOpacity
                    style={styles.cardBtnPrimary}
                    onPress={() => selectedLocation && navigateTo(selectedLocation)}
                  >
                    <Text style={styles.cardBtnPrimaryText}>View detail</Text>
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
    </SafeAreaView>
  )
}

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
    title: { fontSize: 15, fontWeight: '500', color: c.text },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 40,
    },
    emptyTitle: { fontSize: 13, fontWeight: '500', color: c.text3, textAlign: 'center' },
    emptyBody: { fontSize: 12, color: c.text3, textAlign: 'center', lineHeight: 18 },
    content: { flex: 1 },
    toggleRow: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: 8,
      margin: 16,
      marginBottom: 0,
      padding: 3,
      gap: 3,
    },
    toggleBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
    toggleBtnActive: { backgroundColor: c.bg },
    toggleText: { fontSize: 12, fontWeight: '500', color: c.text3 },
    toggleTextActive: { color: c.text },
    viewsContainer: { flex: 1 },
    sortHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sortBtnText: { fontSize: 12, color: c.text2 },
    letterHeader: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: c.surface },
    letterText: { fontSize: 11, fontWeight: '600', color: c.text3 },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    placeRowName: { fontSize: 13, fontWeight: '500', color: c.text, marginBottom: 2 },
    placeRowAddress: { fontSize: 11, color: c.text3 },
    locationCard: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.bg,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 32,
      gap: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    cardHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border2,
      alignSelf: 'center',
      marginBottom: 10,
    },
    cardPhoto: { width: '100%', height: 130, borderRadius: 10, marginBottom: 4 },
    cardName: { fontSize: 16, fontWeight: '600', color: c.text },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardMetaText: { fontSize: 13, color: c.text2 },
    cardHours: { fontSize: 12, color: c.text3 },
    cardPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardPhoneText: { fontSize: 12, color: c.text2 },
    cardActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cardBtnPrimary: {
      flex: 1,
      borderRadius: 20,
      backgroundColor: c.text,
      paddingVertical: 11,
      alignItems: 'center',
    },
    cardBtnPrimaryText: { fontSize: 13, fontWeight: '500', color: c.bg },
    cardBtnSecondary: {
      flex: 1,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border2,
      paddingVertical: 11,
      alignItems: 'center',
    },
    cardBtnSecondaryText: { fontSize: 13, fontWeight: '500', color: c.text },
    locateBtn: {
      position: 'absolute',
      right: 16,
      bottom: 116,
      width: 40,
      height: 40,
      borderRadius: 10,
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
      borderRadius: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    zoomBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    zoomBtnText: { fontSize: 22, fontWeight: '300', color: c.text, lineHeight: 26 },
    zoomDivider: { height: 0.5, backgroundColor: c.border },
  })
}
