import { useMemo } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  ChevronRight,
  CloseIcon,
  PinIcon,
} from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useRestaurantSearch } from '@/lib/hooks/useRestaurantSearch'
import type { Prediction, PredictionDistanceGroup, SelectedPlace } from '@/lib/services/restaurants'

type Props = {
  value: SelectedPlace | null
  onSelect: (place: SelectedPlace | null) => void
  cuisineType: string
  userId: string | null
}

const DISTANCE_GROUP_LABELS: Record<PredictionDistanceGroup, string> = {
  nearby: 'Nearby',
  city: 'Further away',
  state: 'Regional',
  country: 'National',
  worldwide: 'International',
}

function distanceGroupLabel(group: PredictionDistanceGroup | undefined): string {
  return DISTANCE_GROUP_LABELS[group ?? 'worldwide']
}

export function RestaurantPicker({ value, onSelect, cuisineType, userId }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const {
    locationSearch,
    predictions,
    predictionsLoading,
    selectingPlace,
    nearbyPlaces,
    nearbyLoading,
    searchFocused,
    showNearby,
    showDropdown,
    locationStatus,
    locationConstrained,
    requestLocationAndSearch,
    handleSearchChange,
    selectPrediction,
    onSearchFocus,
    onSearchBlur,
    clearSearch,
  } = useRestaurantSearch({ cuisineType, userId, onPlaceSelected: onSelect })

  const showLocationNudge =
    !value &&
    !locationConstrained &&
    locationSearch.trim().length >= 2 &&
    locationStatus !== 'granted'

  const emptyText = locationConstrained
    ? `No venues found near you for "${locationSearch}"`
    : `No results for "${locationSearch}"`
  const emptyHint = locationConstrained
    ? 'Try a different name or check your location.'
    : 'Adding your location can improve nearby results.'

  function renderPredictionRows(items: Prediction[], source: 'nearby' | 'prediction') {
    let previousGroup: string | null = null
    return items.map((item, index) => {
      const groupLabel = distanceGroupLabel(item.distanceGroup)
      const showHeader = groupLabel !== previousGroup
      previousGroup = groupLabel
      return (
        <View key={item.place_id}>
          {showHeader && (
            <Text style={styles.sectionHeader}>{groupLabel}</Text>
          )}
          <TouchableOpacity
            style={[styles.dropdownItem, index === items.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() => selectPrediction(item, source)}
          >
            <PinIcon color={c.text3} size={13} />
            <View style={styles.dropdownItemText}>
              <Text style={styles.dropdownName}>{item.structured_formatting.main_text}</Text>
              <Text style={styles.dropdownSub} numberOfLines={1}>
                {item.structured_formatting.secondary_text}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>RESTAURANT</Text>

      {value ? (
        <View style={styles.confirmed}>
          <PinIcon color={c.accent} size={20} />
          <View style={styles.confirmedText}>
            <Text style={styles.confirmedName} numberOfLines={1}>{value.name}</Text>
            <Text style={styles.confirmedAddress} numberOfLines={1}>
              {value.address.split(',').slice(0, 2).join(',')}
            </Text>
          </View>
          {selectingPlace ? (
            <ActivityIndicator size="small" color={c.text3} />
          ) : (
            <TouchableOpacity
              onPress={() => onSelect(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear selected restaurant"
            >
              <CloseIcon size={10} color={c.text3} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.searchRow}>
          <PinIcon color={c.accent} size={20} />
          <TextInput
            style={styles.input}
            placeholder="Search or pick nearby..."
            placeholderTextColor={c.text3}
            value={locationSearch}
            onChangeText={handleSearchChange}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            returnKeyType="search"
            accessibilityLabel="Restaurant name"
            accessibilityHint="Search by name, or choose from restaurants near you"
          />
          {predictionsLoading && <ActivityIndicator size="small" color={c.text3} />}
          {locationSearch.length > 0 && !predictionsLoading ? (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear restaurant search"
            >
              <CloseIcon size={10} color={c.text3} />
            </TouchableOpacity>
          ) : (
            <ChevronRight size={16} />
          )}
        </View>
      )}

      {!value && nearbyPlaces.length > 0 && !searchFocused && locationSearch.length === 0 && (
        <View style={styles.nearbyChips}>
          {nearbyPlaces.slice(0, 3).map(item => (
            <Chip
              key={item.place_id}
              label={item.structured_formatting.main_text}
              onPress={() => selectPrediction(item, 'nearby')}
            />
          ))}
        </View>
      )}

      {showNearby && (
        <View style={styles.dropdown}>
          {nearbyLoading ? (
            <ActivityIndicator size="small" style={{ marginVertical: spacing[3] }} />
          ) : (
            <>
              <Text style={styles.nearbyLabel}>Nearby on Rekkus</Text>
              {renderPredictionRows(nearbyPlaces, 'nearby')}
            </>
          )}
        </View>
      )}

      {showDropdown && (
        <View style={styles.dropdown}>
          {renderPredictionRows(predictions, 'prediction')}
          {predictions.length === 0 && locationSearch.length >= 2 && !predictionsLoading && (
            <View style={styles.dropdownEmpty}>
              <Text style={styles.dropdownEmptyText}>{emptyText}</Text>
              {emptyHint ? <Text style={styles.dropdownEmptyHint}>{emptyHint}</Text> : null}
              {showLocationNudge ? (
                <TouchableOpacity
                  style={styles.locationBtn}
                  onPress={() => { void requestLocationAndSearch() }}
                  disabled={locationStatus === 'requesting'}
                  accessibilityRole="button"
                  accessibilityLabel="Use current location for restaurant search"
                >
                  <Text style={styles.locationBtnText}>
                    {locationStatus === 'requesting' ? 'Getting location…' : 'Use current location'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing[6],
      paddingTop: spacing.px22,
      paddingBottom: spacing[5],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      zIndex: 10,
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.text3,
      textTransform: 'uppercase',
      letterSpacing: letterSpacing.widest,
      marginBottom: spacing[3],
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      minHeight: 44,
    },
    input: { flex: 1, fontSize: fontSize.title, color: c.text, padding: spacing[0] },
    confirmed: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      minHeight: 44,
    },
    confirmedText: { flex: 1 },
    confirmedName: { fontSize: fontSize.title, fontWeight: fontWeight.medium, color: c.text },
    confirmedAddress: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px1 },
    nearbyChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
      marginTop: spacing.px14,
    },
    dropdown: {
      backgroundColor: c.bg,
      borderRadius: radius.md3,
      borderWidth: 0.5,
      borderColor: c.border,
      marginTop: spacing[1],
      overflow: 'hidden',
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing.px13,
      paddingVertical: spacing.px11,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    dropdownItemText: { flex: 1 },
    dropdownName: { fontSize: fontSize.base, color: c.text, fontWeight: fontWeight.medium },
    dropdownSub: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px1 },
    sectionHeader: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      color: c.text3,
      paddingHorizontal: spacing.px13,
      paddingTop: spacing.px10,
      paddingBottom: spacing[1],
      backgroundColor: c.surface2,
    },
    nearbyLabel: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      color: c.text3,
      paddingHorizontal: spacing[3],
      paddingTop: spacing.px10,
      paddingBottom: spacing[1],
    },
    dropdownEmpty: { paddingVertical: spacing[4], alignItems: 'center' },
    dropdownEmptyText: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center' },
    dropdownEmptyHint: { fontSize: fontSize.xs, color: c.text3, textAlign: 'center', marginTop: spacing[1] },
    locationBtn: {
      minHeight: 44,
      paddingHorizontal: spacing[4],
      marginTop: spacing[3],
      borderRadius: radius.pill,
      backgroundColor: `${c.accent}12`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationBtnText: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.medium,
      color: c.accent,
    },
  })
}
