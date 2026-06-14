import React from 'react'
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { PhoneIcon } from '@/components/icons'
import { OpenBadge } from '@/components/OpenBadge'
import { CachedImage } from '@/components/ui/CachedImage'
import { spacing } from '@/constants/Spacing'
import type { SavedLocation } from '@/lib/hooks/useSavedLocations'
import { todayHoursIndex } from '@/lib/utils/format'
import type { makeStyles } from './RestaurantsTabScreen.styles'
import type { PlaceDetail } from './restaurantTypes'

type Props = {
  styles: ReturnType<typeof makeStyles>
  colors: { text3: string }
  cardStyle: object
  selectedLocation: SavedLocation | null
  pinLoading: boolean
  pinPhoto: string
  pinDetail: PlaceDetail | null
  navigateTo: (loc: SavedLocation) => void
  openInMaps: (loc: SavedLocation) => void
}

export function SelectedLocationCard({
  styles,
  colors,
  cardStyle,
  selectedLocation,
  pinLoading,
  pinPhoto,
  pinDetail,
  navigateTo,
  openInMaps,
}: Props) {
  const todayText = pinDetail?.opening_hours?.weekday_text?.[todayHoursIndex()]
  const phoneNumber = pinDetail?.formatted_phone_number
  const hasMeta = pinDetail?.rating != null || pinDetail?.opening_hours?.open_now != null

  return (
    <Animated.View style={[styles.locationCard, cardStyle]} pointerEvents={selectedLocation ? 'auto' : 'none'}>
      <View style={styles.cardHandle} />
      {pinLoading && <ActivityIndicator size="small" color={colors.text3} style={{ marginBottom: spacing[1] }} />}
      {!!pinPhoto && <CachedImage source={{ uri: pinPhoto }} style={styles.cardPhoto} />}
      <Text style={styles.cardName} numberOfLines={1}>{selectedLocation?.restaurants?.name}</Text>
      {hasMeta ? (
        <View style={styles.cardMeta}>
          {pinDetail?.rating != null && <Text style={styles.cardMetaText}>⭐ {pinDetail.rating.toFixed(1)}</Text>}
          {pinDetail?.opening_hours?.open_now != null && <OpenBadge openNow={pinDetail.opening_hours.open_now} />}
        </View>
      ) : null}
      {todayText ? <Text style={styles.cardHours} numberOfLines={1}>{todayText}</Text> : null}
      {!!phoneNumber && (
        <TouchableOpacity style={styles.cardPhoneRow} onPress={() => Linking.openURL(`tel:${phoneNumber.replace(/\s/g, '')}`)}>
          <PhoneIcon />
          <Text style={styles.cardPhoneText}>{phoneNumber}</Text>
        </TouchableOpacity>
      )}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.cardBtnPrimary} onPress={() => selectedLocation && navigateTo(selectedLocation)} accessibilityRole="button">
          <Text style={styles.cardBtnPrimaryText}>View details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardBtnSecondary} onPress={() => selectedLocation && openInMaps(selectedLocation)} accessibilityRole="button">
          <Text style={styles.cardBtnSecondaryText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}
