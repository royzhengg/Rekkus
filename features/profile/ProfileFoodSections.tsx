import React, { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { Collection } from '@/lib/services/collections'
import type { ProfileInterest, ProfilePlace } from './profileIdentity'

export function FavouriteCuisines({ interests }: { interests: ProfileInterest[] }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  if (interests.length === 0) return null
  return (
    <View style={styles.cuisineRow}>
      {interests.map(interest => (
        <View key={interest.subcategory} style={styles.cuisineChip}>
          <Text style={styles.cuisineText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {interest.emoji} {interest.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

export function PlaceList({
  places,
  onPressPlace,
  compact = false,
}: {
  places: ProfilePlace[]
  onPressPlace: (place: ProfilePlace) => void
  compact?: boolean
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const medals = ['🥇', '🥈', '🥉']
  return (
    <View style={[styles.rowList, compact && styles.compactRowList]}>
      {places.map((place, index) => (
        <TouchableOpacity
          key={place.id}
          style={styles.placeRow}
          onPress={() => onPressPlace(place)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Open ${place.name}`}
        >
          <Text style={styles.placeRank} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {compact ? medals[index] ?? `${index + 1}.` : `${index + 1}.`}
          </Text>
          <View style={styles.placeText}>
            <Text style={styles.placeName} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              {place.name}
            </Text>
            {!!place.address && (
              <Text style={styles.placeMeta} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                {place.address.split(',')[0]}
              </Text>
            )}
          </View>
          {!compact && place.postCount > 0 && (
            <Text style={styles.placeCount} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              {place.postCount} {place.postCount === 1 ? 'post' : 'posts'}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  )
}

export function CollectionList({
  collections,
  onPressCollection,
}: {
  collections: Collection[]
  onPressCollection: (collection: Collection) => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={styles.rowList}>
      {collections.map(collection => (
        <TouchableOpacity
          key={collection.id}
          style={styles.collectionRow}
          onPress={() => onPressCollection(collection)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Open ${collection.name}`}
        >
          <Text style={styles.collectionName} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {collection.name}
          </Text>
          {collection.description ? (
            <Text style={styles.collectionDescription} numberOfLines={2} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
              {collection.description}
            </Text>
          ) : (
            <Text style={styles.collectionDescription} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              {collection.visibility === 'private' ? 'Private collection' : 'Shareable collection'}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    cuisineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    cuisineChip: {
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      borderWidth: 0.5,
      borderColor: c.border2,
      paddingHorizontal: spacing[5],
      minHeight: 48,
      justifyContent: 'center',
    },
    cuisineText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text },
    rowList: { paddingHorizontal: spacing[5], paddingTop: spacing[3], gap: spacing[2] },
    compactRowList: { paddingHorizontal: spacing[0], paddingTop: spacing[0] },
    placeRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    placeRank: { width: spacing.px30, fontSize: fontSize.base, color: c.text, fontWeight: fontWeight.semibold },
    placeText: { flex: 1 },
    placeName: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.text },
    placeMeta: { fontSize: fontSize.xs, color: c.text3, marginTop: spacing.px2 },
    placeCount: { fontSize: fontSize.xs, color: c.text3 },
    collectionRow: {
      minHeight: 58,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      justifyContent: 'center',
    },
    collectionName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.text },
    collectionDescription: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
  })
}
