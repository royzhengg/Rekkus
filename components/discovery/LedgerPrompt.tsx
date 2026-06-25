import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { provenanceColors } from './provenance'
import { TasteRail } from './TasteRail'
import type { DiscoveryColors, ProvenanceType } from './types'

type Action = {
  label: string
  onPress: () => void
  accessibilityLabel: string
}

type Props = {
  colors: DiscoveryColors
  provenance?: ProvenanceType
  title: string
  subtitle: string
  primaryAction: Action
  secondaryAction?: Action
  onDismiss?: () => void
}

export const LedgerPrompt = React.memo(function LedgerPrompt({
  colors,
  provenance = 'STAFF',
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  onDismiss,
}: Props) {
  const mapped = provenanceColors(colors, provenance)
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TasteRail color={mapped.rail} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text2 }]} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
          {subtitle}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primary, { backgroundColor: colors.text }]}
            onPress={primaryAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={primaryAction.accessibilityLabel}
          >
            <Text style={[styles.primaryText, { color: colors.bg }]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              {primaryAction.label}
            </Text>
          </TouchableOpacity>
          {secondaryAction ? (
            <TouchableOpacity
              style={[styles.secondary, { borderColor: colors.border2 }]}
              onPress={secondaryAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.accessibilityLabel}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                {secondaryAction.label}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {onDismiss ? (
        <TouchableOpacity
          style={styles.dismiss}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss welcome message"
          hitSlop={{ top: spacing[2], bottom: spacing[2], left: spacing[2], right: spacing[2] }}
        >
          <Text style={[styles.dismissText, { color: colors.text3 }]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            x
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: spacing[3],
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    borderRadius: radius.lg,
    borderWidth: spacing.hairline,
    padding: spacing[4],
  },
  content: {
    flex: 1,
    paddingRight: spacing[5],
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.normal,
  },
  subtitle: {
    marginTop: spacing[1],
    fontSize: fontSize.bodySm,
    lineHeight: lineHeight.small,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  primary: {
    flex: 1,
    minHeight: spacing.px44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  secondary: {
    flex: 1,
    minHeight: spacing.px44,
    borderRadius: radius.pill,
    borderWidth: spacing.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  primaryText: {
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.semibold,
  },
  secondaryText: {
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.semibold,
  },
  dismiss: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    minWidth: spacing.px44,
    minHeight: spacing.px44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.semibold,
  },
})
