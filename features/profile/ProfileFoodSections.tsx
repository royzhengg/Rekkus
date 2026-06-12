import React, { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { Collection } from '@/lib/services/collections'
import type { ProfileInterest, ProfileRestaurant } from './profileIdentity'

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

export function RestaurantList({
  restaurants,
  onPressRestaurant,
  compact = false,
}: {
  restaurants: ProfileRestaurant[]
  onPressRestaurant: (restaurant: ProfileRestaurant) => void
  compact?: boolean
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const medals = ['🥇', '🥈', '🥉']
  return (
    <View style={[styles.rowList, compact && styles.compactRowList]}>
      {restaurants.map((restaurant, index) => (
        <TouchableOpacity
          key={restaurant.id}
          style={styles.restaurantRow}
          onPress={() => onPressRestaurant(restaurant)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Open ${restaurant.name}`}
        >
          <Text style={styles.restaurantRank} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {compact ? medals[index] ?? `${index + 1}.` : `${index + 1}.`}
          </Text>
          <View style={styles.restaurantText}>
            <Text style={styles.restaurantName} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              {restaurant.name}
            </Text>
            {!!restaurant.address && (
              <Text style={styles.restaurantMeta} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                {restaurant.address.split(',')[0]}
              </Text>
            )}
          </View>
          {!compact && restaurant.reviewCount > 0 && (
            <Text style={styles.restaurantCount} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              {restaurant.reviewCount} {restaurant.reviewCount === 1 ? 'review' : 'reviews'}
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
              {collection.visibility === 'private' ? 'Private list' : 'Shareable list'}
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
    restaurantRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    restaurantRank: { width: spacing.px30, fontSize: fontSize.base, color: c.text, fontWeight: fontWeight.semibold },
    restaurantText: { flex: 1 },
    restaurantName: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.text },
    restaurantMeta: { fontSize: fontSize.xs, color: c.text3, marginTop: spacing.px2 },
    restaurantCount: { fontSize: fontSize.xs, color: c.text3 },
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
