import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { PROVENANCE_LABELS, provenanceColors } from './provenance'
import { ProvenanceChip } from './ProvenanceChip'
import { TasteRail } from './TasteRail'
import type { DiscoveryColors, ProvenanceType } from './types'

type Props = {
  colors: DiscoveryColors
  title: string
  subtitle?: string
  provenance: ProvenanceType
  ctaLabel?: string
  onPressCta?: () => void
}

export const DiscoverySectionHeader = React.memo(function DiscoverySectionHeader({
  colors,
  title,
  subtitle,
  provenance,
  ctaLabel,
  onPressCta,
}: Props) {
  const mapped = provenanceColors(colors, provenance)
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <TasteRail color={mapped.rail} />
      <View style={styles.copy}>
        <ProvenanceChip colors={colors} provenance={provenance} label={PROVENANCE_LABELS[provenance]} />
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[styles.subtitle, { color: colors.text3 }]}
                maxFontSizeMultiplier={maxFontSizeMultiplier.body}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          {ctaLabel && onPressCta ? (
            <TouchableOpacity
              style={styles.cta}
              onPress={onPressCta}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
            >
              <Text style={[styles.ctaText, { color: colors.accent }]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                {ctaLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
  },
  copy: {
    flex: 1,
    gap: spacing[2],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.extrabold,
    lineHeight: lineHeight.title,
  },
  subtitle: {
    marginTop: spacing.px3,
    fontSize: fontSize.bodySm,
    lineHeight: lineHeight.small,
  },
  cta: {
    minHeight: spacing.px34,
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.semibold,
  },
})

