import React, { useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { CloseIcon, PinIcon } from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { searchCuisines } from '@/lib/dataSources/cuisines'
import {
  OCCASION_PICK_OPTIONS,
  VALUE_PICK_OPTIONS,
} from '@/lib/dataSources/rekkusPicks'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import type { SearchFilters } from '@/lib/hooks/useSearch'
import type { useUserLocation } from '@/lib/hooks/useUserLocation'
import { fetchAreaSuggestionsJson } from '@/lib/services/googlePlaces'
import { SEARCH_RADIUS_OPTIONS, SEARCH_SORTS, MEDIA_FILTERS } from './searchConstants'

interface SearchFiltersSheetProps {
  visible: boolean
  onClose: () => void
  radiusKm: number
  setRadiusKm: (value: number) => void
  userLocation: ReturnType<typeof useUserLocation>
  filters: SearchFilters
  setFilters: (filters: SearchFilters) => void
  onEnableNearby: () => void
}

export function SearchFiltersSheet({
  visible,
  onClose,
  radiusKm,
  setRadiusKm,
  userLocation,
  filters,
  setFilters,
  onEnableNearby,
}: SearchFiltersSheetProps) {
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
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
    if (text.length < 2) {
      setLocationSuggestions([])
      return
    }
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
    const current = (filters[key] ?? []) as T[]
    const next = current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value]
    patchFilters({ [key]: next } as Partial<SearchFilters>)
  }

  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetDismissArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.nearbySheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Search filters</Text>
              <Text style={styles.sheetSubtitle}>
                Keep results focused without crowding the page.
              </Text>
            </View>
            <IconButton
              accessibilityLabel="Close filters"
              onPress={onClose}
              size={34}
              style={styles.sheetClose}
            >
              <CloseIcon />
            </IconButton>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollContent}
          >
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
                    accessibilityRole="button"
                    accessibilityLabel="Clear current search location"
                  >
                    <CloseIcon />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.locationInputWrap}>
                  {userLocation.loading ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.text}
                      style={{ marginLeft: spacing[3] }}
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.locationGpsButton}
                      onPress={() => {
                        void userLocation.requestLocation()
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
              {suggestionsLoading && (
                <ActivityIndicator size="small" style={{ marginTop: spacing.px6 }} />
              )}
              {locationSuggestions.length > 0 && (
                <View style={styles.locationSuggestions}>
                  {locationSuggestions.map(s => (
                    <TouchableOpacity
                      key={s.place_id}
                      style={styles.locationSuggestionRow}
                      onPress={() => selectAreaSuggestion(s)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={s.main_text}
                    >
                      <Text style={styles.locationSuggestionMain}>{s.main_text}</Text>
                      <Text style={styles.locationSuggestionSub}>{s.secondary_text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {!!userLocation.error && (
                <Text style={styles.locationError}>{userLocation.error}</Text>
              )}
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sheetChipWrap}
              >
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
                      label={
                        option === 'image' ? 'Photos' : option === 'video' ? 'Videos' : 'Mixed'
                      }
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
              accessibilityRole="switch"
              accessibilityLabel="Open now"
              accessibilityState={{ checked: !!filters.openNow }}
            >
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionTitle}>Open now</Text>
                <Text style={styles.sheetOptionBody}>Only show places marked open.</Text>
              </View>
              <Text style={styles.sheetToggleText}>{filters.openNow ? 'On' : 'Off'}</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.sheetFooterRow}>
            <TouchableOpacity
              style={styles.sheetSecondaryButton}
              onPress={() => setFilters({ sort: 'best_match' })}
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
            >
              <Text style={styles.sheetSecondaryText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetDoneButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
            >
              <Text style={styles.sheetDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
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
    sheetClose: { backgroundColor: c.surface },
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
    sheetOptionText: { flex: 1 },
    sheetOptionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.text },
    sheetOptionBody: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    sheetLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      color: c.text3,
      marginBottom: spacing[2],
    },
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
    locationSuggestionMain: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.medium,
      color: c.text,
    },
    locationSuggestionSub: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px1 },
    locationError: { fontSize: fontSize.sm, color: c.text3, paddingBottom: spacing.px10 },
    radiusSheetBlock: { marginBottom: spacing[3] },
    radiusSheetOptions: { flexDirection: 'row', gap: spacing[2] },
    radiusSheetOption: { minWidth: 66 },
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
    sheetToggleText: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.bold,
      color: c.accent,
    },
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
