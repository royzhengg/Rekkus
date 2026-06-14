import { useRouter } from 'expo-router'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, CloseIcon, PlusIcon, PinIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { IconButton } from '@/components/ui/IconButton'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useRestaurantSearch } from '@/lib/hooks/useRestaurantSearch'
import type { Prediction, SelectedPlace } from '@/lib/services/restaurants'
import { fetchTopSpotsWithDetails, saveTopSpots } from '@/lib/services/topSpots'
import type { ProfileRestaurant } from './profileIdentity'

export default function ManageTopSpotsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [selectedSpots, setSelectedSpots] = useState<ProfileRestaurant[]>([])
  const [searchVisible, setSearchVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const onPlaceSelected = useCallback((place: SelectedPlace | null) => {
    if (!place) return
    const id = place.restaurantId ?? place.placeId
    setSelectedSpots(prev => {
      if (prev.some(s => s.id === id || s.placeId === place.placeId)) return prev
      if (prev.length >= 3) return prev
      const newSpot: ProfileRestaurant = {
        id,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        placeId: place.placeId,
        photoUrl: null,
        reviewCount: 0,
        avgFoodRating: null,
        lastReviewedAt: null,
      }
      const next = [...prev, newSpot]
      analytics.profileInteraction(user?.id ?? null, user?.id ?? null, 'top_spot_added', { position: next.length })
      return next
    })
    setSearchVisible(false)
  }, [user?.id])

  const { locationSearch, predictions, predictionsLoading, selectingPlace, handleSearchChange, selectPrediction, onSearchFocus, onSearchBlur, clearSearch } =
    useRestaurantSearch({ cuisineType: '', userId: user?.id, onPlaceSelected })

  useEffect(() => {
    analytics.screen(user?.id ?? null, 'manage_top_spots')
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    void fetchTopSpotsWithDetails(user.id)
      .then(spots => setSelectedSpots(spots))
      .catch(() => setLoadError(true))
  }, [user])

  const moveUp = useCallback((index: number) => {
    if (index === 0) return
    setSelectedSpots(prev => {
      const next = [...prev]
      const above = next[index - 1]
      const current = next[index]
      if (!above || !current) return prev
      next[index - 1] = current
      next[index] = above
      analytics.profileInteraction(user?.id ?? null, user?.id ?? null, 'top_spot_reordered', { position: index + 1, source: 'up' })
      return next
    })
  }, [user?.id])

  const moveDown = useCallback((index: number) => {
    setSelectedSpots(prev => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      const below = next[index + 1]
      const current = next[index]
      if (!below || !current) return prev
      next[index + 1] = current
      next[index] = below
      analytics.profileInteraction(user?.id ?? null, user?.id ?? null, 'top_spot_reordered', { position: index + 1, source: 'down' })
      return next
    })
  }, [user?.id])

  const removeSpot = useCallback((index: number) => {
    setSelectedSpots(prev => {
      analytics.profileInteraction(user?.id ?? null, user?.id ?? null, 'top_spot_removed', { position: index + 1 })
      return prev.filter((_, i) => i !== index)
    })
  }, [user?.id])

  const handleSave = useCallback(async () => {
    if (!user || saving) return
    setSaving(true)
    try {
      const spots = selectedSpots.map((r, i) => ({ position: i + 1, restaurantId: r.id }))
      await saveTopSpots(user.id, spots)
      analytics.profileInteraction(user.id, user.id, 'top_spots_saved', { visible_count: spots.length })
      router.back()
    } catch {
      setSaving(false)
    }
  }, [user, saving, selectedSpots, router])

  const handleSelectPrediction = useCallback((item: Prediction) => {
    void selectPrediction(item, 'prediction')
  }, [selectPrediction])

  const canSave = selectedSpots.length > 0 && !saving
  const canAddMore = selectedSpots.length < 3

  const renderPrediction = useCallback(({ item }: { item: Prediction }) => (
    <TouchableOpacity
      style={styles.predictionRow}
      onPress={() => handleSelectPrediction(item)}
      accessibilityRole="button"
      accessibilityLabel={`Add ${item.structured_formatting.main_text}`}
    >
      <PinIcon color={colors.text3} size={16} />
      <View style={styles.predictionText}>
        <Text style={styles.predictionMain} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          {item.structured_formatting.main_text}
        </Text>
        <Text style={styles.predictionSub} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          {item.structured_formatting.secondary_text}
        </Text>
      </View>
    </TouchableOpacity>
  ), [styles, colors.text3, handleSelectPrediction])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Top Spots"
        left={
          <IconButton accessibilityLabel="Go back" onPress={() => router.back()}>
            <ChevronLeft size={20} />
          </IconButton>
        }
        right={
          <TouchableOpacity
            onPress={() => { void handleSave() }}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save top spots"
            hitSlop={8}
          >
            <Text style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {loadError && (
            <ErrorMessage message="Couldn't load saved spots. Try again." />
          )}

          <Text style={styles.sectionLabel}>Selected</Text>

          {selectedSpots.map((spot, index) => (
            <View key={spot.id} style={styles.spotRow}>
              <View style={styles.rank}>
                <Text style={styles.rankText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                  {index + 1}
                </Text>
              </View>

              {spot.photoUrl ? (
                <CachedImage source={{ uri: spot.photoUrl }} style={styles.spotThumb} />
              ) : (
                <View style={[styles.spotThumb, styles.spotThumbFallback]} />
              )}

              <View style={styles.spotInfo}>
                <Text style={styles.spotName} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                  {spot.name}
                </Text>
                {spot.address ? (
                  <Text style={styles.spotAddress} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                    {spot.address.split(',')[0]}
                  </Text>
                ) : null}
              </View>

              <View style={styles.spotActions}>
                <TouchableOpacity
                  onPress={() => moveUp(index)}
                  disabled={index === 0}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Move up"
                  style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
                >
                  <Text style={[styles.arrowText, index === 0 && styles.arrowTextDisabled]}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveDown(index)}
                  disabled={index === selectedSpots.length - 1}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Move down"
                  style={[styles.arrowBtn, index === selectedSpots.length - 1 && styles.arrowBtnDisabled]}
                >
                  <Text style={[styles.arrowText, index === selectedSpots.length - 1 && styles.arrowTextDisabled]}>↓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeSpot(index)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${spot.name}`}
                >
                  <CloseIcon size={11} color={colors.text3} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {canAddMore && !searchVisible && (
            <TouchableOpacity
              style={styles.addRow}
              onPress={() => setSearchVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Add a spot"
            >
              <PlusIcon size={16} color={colors.accent} />
              <Text style={styles.addText}>Add a spot</Text>
            </TouchableOpacity>
          )}

          {searchVisible && (
            <View style={styles.searchPanel}>
              <View style={styles.searchInputRow}>
                <PinIcon color={colors.accent} size={18} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search restaurants..."
                  placeholderTextColor={colors.text3}
                  value={locationSearch}
                  onChangeText={handleSearchChange}
                  onFocus={onSearchFocus}
                  onBlur={onSearchBlur}
                  returnKeyType="search"
                  autoFocus
                  accessibilityLabel="Search for a restaurant"
                />
                {predictionsLoading || selectingPlace ? (
                  <ActivityIndicator size="small" color={colors.text3} />
                ) : locationSearch.length > 0 ? (
                  <TouchableOpacity onPress={clearSearch} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                    <CloseIcon size={10} color={colors.text3} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setSearchVisible(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel search">
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>

              {predictions.length > 0 && (
                <FlatList
                  data={predictions}
                  keyExtractor={item => item.place_id}
                  renderItem={renderPrediction}
                  keyboardShouldPersistTaps="always"
                  scrollEnabled={false}
                  style={styles.predictionList}
                />
              )}

              {!predictionsLoading && locationSearch.trim().length >= 2 && predictions.length === 0 && (
                <Text style={styles.noResults}>No results for "{locationSearch}"</Text>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    scrollContent: { paddingBottom: spacing[8] },
    sectionLabel: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text3, marginHorizontal: spacing[5], marginTop: spacing[5], marginBottom: spacing[2] },
    spotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    rank: {
      width: spacing.px36,
      height: spacing.px36,
      borderRadius: spacing.px18,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: c.white },
    spotThumb: { width: 50, height: 50, borderRadius: radius.md },
    spotThumbFallback: { backgroundColor: c.surface2 },
    spotInfo: { flex: 1 },
    spotName: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    spotAddress: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    spotActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    arrowBtn: { padding: spacing[1] },
    arrowBtnDisabled: { opacity: 0.3 },
    arrowText: { fontSize: fontSize.lg, color: c.text, lineHeight: lineHeight.normal },
    arrowTextDisabled: { color: c.text3 },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[4],
      minHeight: 44,
    },
    addText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.accent },
    saveBtn: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.accent },
    saveBtnDisabled: { opacity: 0.4 },
    searchPanel: { marginHorizontal: spacing[5], marginTop: spacing[3] },
    searchInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      backgroundColor: c.surface,
    },
    searchInput: { flex: 1, fontSize: fontSize.base, color: c.text, padding: spacing.px1 - spacing.px1 },
    cancelText: { fontSize: fontSize.bodySm, color: c.text3 },
    predictionList: { marginTop: spacing[2] },
    predictionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    predictionText: { flex: 1 },
    predictionMain: { fontSize: fontSize.base, color: c.text },
    predictionSub: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    noResults: { fontSize: fontSize.bodySm, color: c.text3, paddingVertical: spacing[3], textAlign: 'center' },
  })
}
