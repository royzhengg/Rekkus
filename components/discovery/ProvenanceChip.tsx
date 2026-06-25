import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing, maxFontSizeMultiplier } from '@/constants/Typography'
import { PROVENANCE_LABELS, provenanceColors } from './provenance'
import type { DiscoveryColors, ProvenanceType } from './types'

type Props = {
  colors: DiscoveryColors
  provenance: ProvenanceType
  label?: string
}

export const ProvenanceChip = React.memo(function ProvenanceChip({ colors, provenance, label }: Props) {
  const mapped = provenanceColors(colors, provenance)
  return (
    <View style={[styles.chip, { backgroundColor: mapped.bg }]}>
      <Text
        style={[styles.text, { color: mapped.text }]}
        numberOfLines={1}
        maxFontSizeMultiplier={maxFontSizeMultiplier.layout}
      >
        {label ?? PROVENANCE_LABELS[provenance]}
      </Text>
    </View>
  )
})

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing.px3,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wide,
  },
})

