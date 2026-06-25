import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import type { DiscoveryColors } from './types'

type Props = {
  colors: DiscoveryColors
  message: string
}

export const ModulePlaceholder = React.memo(function ModulePlaceholder({ colors, message }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.text2 }]} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
        {message}
      </Text>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    minHeight: spacing.px60,
    marginHorizontal: spacing[4],
    borderRadius: radius.md,
    borderWidth: spacing.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[3],
  },
  text: {
    fontSize: fontSize.bodySm,
    lineHeight: lineHeight.small,
    textAlign: 'center',
  },
})

