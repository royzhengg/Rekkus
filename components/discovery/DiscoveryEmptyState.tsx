import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontFamily, fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import type { DiscoveryColors } from './types'

type Action = {
  label: string
  onPress: () => void
  accessibilityLabel: string
}

type Props = {
  colors: DiscoveryColors
  title: string
  subtitle: string
  actions: Action[]
}

export const DiscoveryEmptyState = React.memo(function DiscoveryEmptyState({ colors, title, subtitle, actions }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: colors.text2 }]} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
        {subtitle}
      </Text>
      <View style={styles.actions}>
        {actions.slice(0, 4).map(action => (
          <TouchableOpacity
            key={action.label}
            style={[styles.action, { borderColor: colors.border2 }]}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
          >
            <Text style={[styles.actionText, { color: colors.text }]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: radius.lg,
    borderWidth: spacing.hairline,
    padding: spacing[4],
  },
  title: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize['4xl'],
    lineHeight: lineHeight.display,
  },
  subtitle: {
    marginTop: spacing[2],
    fontSize: fontSize.base,
    lineHeight: lineHeight.normal,
  },
  actions: {
    gap: spacing[2],
    marginTop: spacing[4],
  },
  action: {
    minHeight: spacing.px44,
    borderRadius: radius.pill,
    borderWidth: spacing.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  actionText: {
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.semibold,
  },
})
