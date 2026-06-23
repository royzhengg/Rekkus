import { useRouter } from 'expo-router'
import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { ImagePlaceholder } from '@/components/icons'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontFamily, fontSize, lineHeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { NoResultsSuggestionChip } from '@/lib/hooks/useNoResultsSuggestions'
import type { PlaceResult } from '@/lib/hooks/useSearch'
import { routes } from '@/lib/routes'

interface Props {
  query: string
  chips: NoResultsSuggestionChip[]
  onChipPress: (query: string) => void
  nearbyPlaces?: PlaceResult[]
}

export function NoResultsCard({ query, chips = [], onChipPress, nearbyPlaces = [] }: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{`Nothing for "${query}" yet.`}</Text>

      {chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsRow}
        >
          {chips.map(chip => (
            <TouchableOpacity
              key={chip.query}
              style={styles.chip}
              onPress={() => onChipPress(chip.query)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Search ${chip.label}`}
            >
              <Text style={styles.chipText}>
                {chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {nearbyPlaces.length > 0 && (
        <View style={styles.nearbySection}>
          <Text style={styles.nearbyHeader}>Popular places</Text>
          <View style={styles.divider} />
          {nearbyPlaces.slice(0, 3).map(place => (
            <NearbyRow
              key={place.id}
              place={place}
              onPress={() => router.push(routes.placeDetail({ placeId: place.id }))}
            />
          ))}
        </View>
      )}
    </View>
  )
}

function NearbyRow({ place, onPress }: { place: PlaceResult; onPress: () => void }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <TouchableOpacity
      style={styles.nearbyRow}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={place.name}
    >
      <View style={[styles.nearbyThumb, { backgroundColor: colors.surface2 }]}>
        <ImagePlaceholder size={14} />
      </View>
      <View style={styles.nearbyInfo}>
        <Text style={styles.nearbyName} numberOfLines={1}>{place.name}</Text>
        {!!place.cuisine_type && (
          <Text style={styles.nearbyMeta} numberOfLines={1}>{place.cuisine_type}</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: {
      paddingTop: spacing.px40,
      paddingHorizontal: spacing[4],
    },
    heading: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize['2xl'],
      color: c.text,
      lineHeight: lineHeight.tight,
    },
    nearbySection: {
      marginTop: spacing[6],
    },
    nearbyHeader: {
      fontSize: fontSize.bodySm,
      color: c.text2,
      marginBottom: spacing[2],
    },
    divider: {
      height: 0.5,
      backgroundColor: c.border,
      marginBottom: spacing[2],
    },
    chipsScroll: { marginTop: spacing[4] },
    chipsRow: { gap: spacing[2], paddingBottom: spacing[1] },
    chip: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px9,
      borderRadius: radius.full,
      backgroundColor: c.surface2,
    },
    chipText: { fontSize: fontSize.sm, color: c.text2 },
    nearbyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingVertical: spacing.px11,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    nearbyThumb: {
      width: 44,
      height: 44,
      borderRadius: radius.sm3,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    nearbyInfo: { flex: 1 },
    nearbyName: {
      fontSize: fontSize.base,
      color: c.text,
    },
    nearbyMeta: {
      fontSize: fontSize.sm,
      color: c.text3,
      marginTop: spacing.px2,
    },
  })
}
