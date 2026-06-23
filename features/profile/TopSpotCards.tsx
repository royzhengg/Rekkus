import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ImagePlaceholder } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { ProfilePlace } from './profileIdentity'

type Props = {
  places: ProfilePlace[]
  onPressPlace: (place: ProfilePlace) => void
  onManage?: () => void
}

export function TopSpotCards({ places, onPressPlace, onManage }: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  if (places.length === 0) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.heading} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          Top Spots
        </Text>
        {onManage ? (
          <TouchableOpacity
            style={styles.manage}
            onPress={onManage}
            accessibilityRole="button"
            accessibilityLabel="Manage Top Spots"
          >
            <Text style={styles.manageText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              Manage Top Spots
            </Text>
            <Text style={styles.manageText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              ›
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardScroll}
      >
        {places.map((place, index) => (
          <TouchableOpacity
            key={place.id}
            style={styles.card}
            onPress={() => onPressPlace(place)}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`Open ${place.name}`}
          >
            {place.photoUrl ? (
              <CachedImage source={{ uri: place.photoUrl }} style={StyleSheet.absoluteFillObject} />
            ) : (
              <View style={styles.fallback}>
                <ImagePlaceholder size={24} color={colors.text3} />
              </View>
            )}
            <View style={styles.scrim} />
            <View style={styles.rank}>
              <Text style={styles.rankText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                {index + 1}
              </Text>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardName} numberOfLines={2} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                {place.name}
              </Text>
              {place.address ? (
                <Text style={styles.cardMeta} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                  {place.address.split(',')[0]}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    wrap: {
      marginTop: spacing.px18,
      paddingVertical: spacing[4],
      borderTopWidth: 0.5,
      borderBottomWidth: 0.5,
      borderColor: c.border,
      backgroundColor: c.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
      paddingHorizontal: spacing[5],
      marginBottom: spacing[3],
    },
    heading: { fontSize: fontSize['2xl'], fontWeight: fontWeight.semibold, color: c.text },
    manage: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    manageText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.accent },
    cardScroll: { gap: spacing[3], paddingHorizontal: spacing[5] },
    card: {
      width: 156,
      aspectRatio: 0.74,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: c.surface,
    },
    fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
      opacity: 0.62,
    },
    rank: {
      position: 'absolute',
      top: spacing[3],
      left: spacing[3],
      width: spacing.px36,
      height: spacing.px36,
      borderRadius: radius.pill,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: c.white },
    cardText: { position: 'absolute', left: spacing[3], right: spacing[3], bottom: spacing[3] },
    cardName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.white },
    cardMeta: { fontSize: fontSize.bodySm, color: c.white, marginTop: spacing[1], opacity: 0.78 },
  })
}
