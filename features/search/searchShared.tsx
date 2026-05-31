import { useRouter } from 'expo-router'
import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Animated from 'react-native-reanimated'
import { PinIcon } from '@/components/icons'
import { OpenBadge } from '@/components/OpenBadge'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { usePressScale } from '@/lib/hooks/usePressScale'
import type { PlaceResult, SearchSuggestion } from '@/lib/hooks/useSearch'
import { routes } from '@/lib/routes'
import { CUISINE_ALIASES, getCuisineSynonymTerms } from '@/lib/utils/cuisineSynonyms'
import { formatKm } from '@/lib/utils/geo'
import { shortPlaceLocation } from './searchConstants'

export function buildTypeaheadSuggestions({
  isFocused,
  query,
  suggestions,
  recentSearches,
}: {
  isFocused: boolean
  query: string
  suggestions: SearchSuggestion[]
  recentSearches: string[]
}): Array<{ label: string; detail?: string | null }> {
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
  const terms = [...getCuisineSynonymTerms(), ...Object.keys(CUISINE_ALIASES)]
  for (const term of terms) {
    if (term.startsWith(lq) && !seen.has(term)) {
      seen.add(term)
      results.push({ label: term, detail: 'Cuisine' })
    }
  }
  return results.slice(0, 6)
}

// ─── PlaceRow ─────────────────────────────────────────────────────────────────

export const PlaceRow = React.memo(function PlaceRow({
  place,
  distanceKm,
  user,
  query,
  position,
  searchSessionId,
  onResultClick,
}: {
  place: PlaceResult
  distanceKm?: number | undefined
  user?: { id: string } | null | undefined
  query?: string | undefined
  position?: number | undefined
  searchSessionId?: string | undefined
  onResultClick?: (() => void) | undefined
}) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const press = usePressScale()
  const locationLabel = shortPlaceLocation(place)
  const meta = [
    place.cuisine_type,
    locationLabel,
    distanceKm != null ? formatKm(distanceKm) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const badges = place.badges ?? []

  function handlePress() {
    onResultClick?.()
    if (place.id) {
      analytics.clickPlace(user?.id ?? null, place.id)
      if (query && searchSessionId && position != null) {
        analytics.searchResultClick(
          user?.id ?? null,
          'restaurant',
          place.id,
          query,
          position,
          searchSessionId
        )
      }
    }
    router.push(routes.restaurantDetail({
      restaurantId: place.google_place_id ?? place.id ?? 'none',
      ...(place.google_place_id ? { placeId: place.google_place_id } : {}),
      name: place.name,
      address: place.address ?? '',
      lat: place.latitude ?? '',
      lng: place.longitude ?? '',
    }))
  }

  return (
    <Animated.View style={press.animatedStyle}>
      <TouchableOpacity
        style={styles.placeRow}
        onPress={handlePress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={`${place.name}${meta ? `, ${meta}` : ''}${place.top_dishes?.length ? `, known for ${place.top_dishes.slice(0, 3).join(', ')}` : ''}`}
      >
        <View style={styles.placeIconWrap}>
          <PinIcon size={12} />
        </View>
        <View style={styles.placeInfo}>
          <View style={styles.placeTitleRow}>
            <Text style={styles.placeName} numberOfLines={1}>
              {place.name}
            </Text>
            {place.open_now != null && <OpenBadge openNow={place.open_now} />}
          </View>
          {!!meta && (
            <Text style={styles.placeMeta} numberOfLines={1}>
              {meta}
            </Text>
          )}
          {(badges.length > 0 || !!place.hint) && (
            <View style={styles.placeBadgeRow}>
              {badges.slice(0, 2).map(badge => (
                <Text key={badge} style={styles.placeBadge}>
                  {badge}
                </Text>
              ))}
              {!!place.hint && <Text style={styles.placeHint}>{place.hint}</Text>}
            </View>
          )}
          {(place.top_dishes?.length ?? 0) > 0 && (
            <View style={styles.placeDishRow}>
              {(place.top_dishes ?? []).slice(0, 3).map(dish => (
                <Text key={dish} style={styles.placeDish}>
                  {dish}
                </Text>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
})

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({ title, count }: { title: string; count?: number }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count != null && <Text style={styles.sectionCount}>{count}</Text>}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px10,
      borderBottomWidth: 0.35,
      borderBottomColor: c.border,
    },
    placeIconWrap: {
      width: 22,
      height: 22,
      borderRadius: radius.md2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeInfo: { flex: 1 },
    placeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6 },
    placeName: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    placeMeta: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px2 },
    placeBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
      marginTop: spacing.px5,
    },
    placeBadge: {
      overflow: 'hidden',
      borderRadius: radius.xs,
      backgroundColor: c.surface,
      color: c.text2,
      fontSize: fontSize.xs,
      paddingHorizontal: spacing.px6,
      paddingVertical: spacing.px2,
    },
    placeHint: { fontSize: fontSize.xs, color: c.text3 },
    placeDishRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.px6,
      marginTop: spacing.px5,
    },
    placeDish: {
      overflow: 'hidden',
      borderRadius: radius.xs,
      backgroundColor: c.surface2,
      color: c.text2,
      fontSize: fontSize.xs,
      paddingHorizontal: spacing.px6,
      paddingVertical: spacing.px2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingTop: spacing.px18,
      paddingBottom: spacing.px9,
    },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text, letterSpacing: 0 },
    sectionCount: { fontSize: fontSize.sm, color: c.text3 },
  })
}
