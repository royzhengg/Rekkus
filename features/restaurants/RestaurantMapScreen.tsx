import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { useThemeColors, useIsDarkMode } from '@/lib/contexts/ThemeContext'
import { DARK_MAP_STYLE } from '@/constants/mapStyles'
import { ChevronLeft, PhoneIcon } from '@/components/icons'
import { MapMarker } from '@/components/MapMarker'
import { Stars, Vibes, Dollars } from '@/components/RatingDisplay'
import { OpenBadge } from '@/components/OpenBadge'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

export default function RestaurantMapScreen() {
  const {
    restaurantId: _restaurantId,
    placeId: _placeId,
    name,
    lat,
    lng,
    phone,
    openNow,
    googleRating,
    avgFood,
    avgVibe,
    avgCost,
    photoUrl,
    todayHours,
  } = useLocalSearchParams<{
    restaurantId?: string
    placeId?: string
    name: string
    lat: string
    lng: string
    phone: string
    openNow: string
    googleRating: string
    avgFood: string
    avgVibe: string
    avgCost: string
    photoUrl: string
    todayHours: string
  }>()
  const router = useRouter()
  const colors = useThemeColors()
  const isDark = useIsDarkMode()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const parsedLat = parseFloat(lat)
  const parsedLng = parseFloat(lng)
  const isOpen = openNow === 'true'
  const hasOpenInfo = openNow === 'true' || openNow === 'false'
  const gRating = googleRating ? parseFloat(googleRating) : null
  const fFood = avgFood ? parseFloat(avgFood) : null
  const fVibe = avgVibe ? parseFloat(avgVibe) : null
  const fCost = avgCost ? parseFloat(avgCost) : null
  const hasRekkusRatings = fFood != null || fVibe != null || fCost != null

  const [cardVisible, setCardVisible] = useState(false)
  const [mapsSheetVisible, setMapsSheetVisible] = useState(false)
  const lastMarkerPress = useRef(0)
  const mapRef = useRef<MapView>(null)
  const deltaRef = useRef(0.01)

  const zoom = useCallback(
    (direction: 'in' | 'out') => {
      const factor = direction === 'in' ? 0.5 : 2
      deltaRef.current = Math.min(Math.max(deltaRef.current * factor, 0.001), 50)
      mapRef.current?.animateToRegion(
        {
          latitude: parsedLat,
          longitude: parsedLng,
          latitudeDelta: deltaRef.current,
          longitudeDelta: deltaRef.current,
        },
        300
      )
    },
    [parsedLat, parsedLng]
  )

  const slideY = useSharedValue(300)
  useEffect(() => {
    slideY.value = withSpring(cardVisible ? 0 : 300, { damping: 20, stiffness: 180 })
  }, [cardVisible])
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }))

  const openInMaps = useCallback(() => {
    setMapsSheetVisible(true)
  }, [])

  const openSelectedMap = useCallback((provider: string) => {
    if (provider === 'apple')
      Linking.openURL(
        `https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${parsedLat},${parsedLng}`
      )
    if (provider === 'google')
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${parsedLat},${parsedLng}`)
  }, [name, parsedLat, parsedLng])

  const callPhone = useCallback(() => {
    if (phone) Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)
  }, [phone])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {name}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: parsedLat,
            longitude: parsedLng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          onPress={() => {
            if (Date.now() - lastMarkerPress.current > 400) setCardVisible(false)
          }}
        >
          <Marker
            coordinate={{ latitude: parsedLat, longitude: parsedLng }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => {
              lastMarkerPress.current = Date.now()
              setCardVisible(true)
            }}
          >
            <MapMarker />
          </Marker>
        </MapView>
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomBtn} onPress={() => zoom('in')} activeOpacity={0.8}>
            <Text style={styles.zoomBtnText}>+</Text>
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomBtn} onPress={() => zoom('out')} activeOpacity={0.8}>
            <Text style={styles.zoomBtnText}>−</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={[styles.card, cardStyle]} pointerEvents={cardVisible ? 'auto' : 'none'}>
        <View style={styles.cardHandle} />

        {!!photoUrl && (
          <Image source={{ uri: photoUrl }} style={styles.cardPhoto} resizeMode="cover" />
        )}

        <Text style={styles.cardName} numberOfLines={1}>
          {name}
        </Text>

        <View style={styles.cardMeta}>
          {gRating != null && <Text style={styles.cardMetaText}>⭐ {gRating.toFixed(1)}</Text>}
          {hasOpenInfo && <OpenBadge openNow={isOpen} />}
        </View>

        {hasRekkusRatings && (
          <View style={styles.rekkusRow}>
            {fFood != null && (
              <View style={styles.ratingChip}>
                <Text style={styles.ratingChipLabel}>FOOD</Text>
                <Stars count={Math.round(fFood)} />
              </View>
            )}
            {fVibe != null && (
              <View style={styles.ratingChip}>
                <Text style={styles.ratingChipLabel}>VIBE</Text>
                <Vibes count={Math.round(fVibe)} />
              </View>
            )}
            {fCost != null && (
              <View style={styles.ratingChip}>
                <Text style={styles.ratingChipLabel}>COST</Text>
                <Dollars count={Math.round(fCost)} />
              </View>
            )}
            <Text style={styles.rekkusLabel}>Rekkus</Text>
          </View>
        )}

        {!!todayHours && (
          <Text style={styles.cardHours} numberOfLines={1}>
            {todayHours}
          </Text>
        )}

        {!!phone && (
          <TouchableOpacity style={styles.phoneRow} onPress={callPhone}>
            <PhoneIcon />
            <Text style={styles.phoneText}>{phone}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.cardBtnSecondary} onPress={() => router.back()}>
            <Text style={styles.cardBtnSecondaryText}>View details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cardBtnPrimary} onPress={openInMaps}>
            <Text style={styles.cardBtnPrimaryText}>Open in Maps</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      <RekkusActionSheet
        visible={mapsSheetVisible}
        title="Open in Maps"
        subtitle={name}
        options={[
          { label: 'Apple Maps', value: 'apple' },
          { label: 'Google Maps', value: 'google' },
        ]}
        onSelect={openSelectedMap}
        onDismiss={() => setMapsSheetVisible(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      gap: spacing[2],
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], padding: spacing.px6, marginLeft: -spacing.px6 },
    backText: { fontSize: fontSize.md, color: c.text2 },
    headerTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text, textAlign: 'center' },
    card: {
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
      paddingBottom: spacing.px36,
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
    rekkusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
    ratingChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.px2 },
    ratingChipLabel: { fontSize: fontSize['2xs'], color: c.text3, letterSpacing: 0.5, marginRight: spacing.px2 },
    rekkusLabel: { fontSize: fontSize.sm, color: c.text3, marginLeft: spacing.px2 },
    cardHours: { fontSize: fontSize.bodySm, color: c.text3 },
    phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    phoneText: { fontSize: fontSize.bodySm, color: c.text2 },
    cardActions: { flexDirection: 'row', gap: spacing.px10, marginTop: spacing[1] },
    cardBtnPrimary: {
      flex: 1,
      borderRadius: radius.pill,
      backgroundColor: c.text,
      paddingVertical: spacing.px11,
      alignItems: 'center',
    },
    cardBtnPrimaryText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.bg },
    cardBtnSecondary: {
      flex: 1,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border2,
      paddingVertical: spacing.px11,
      alignItems: 'center',
    },
    cardBtnSecondaryText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
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
