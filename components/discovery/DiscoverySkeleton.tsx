import React from 'react'
import { StyleSheet, View } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import type { DiscoveryColors } from './types'

type Props = {
  colors: DiscoveryColors
}

export const DiscoverySkeleton = React.memo(function DiscoverySkeleton({ colors }: Props) {
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.image, { backgroundColor: colors.surface2 }]} />
      <View style={[styles.title, { backgroundColor: colors.surface2 }]} />
      <View style={[styles.meta, { backgroundColor: colors.surface2 }]} />
      <View style={[styles.action, { backgroundColor: colors.surface2 }]} />
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    minHeight: spacing.px60 + spacing.px60,
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  image: {
    height: spacing.px60,
    borderRadius: radius.md,
  },
  title: {
    width: '70%',
    height: spacing.px14,
    borderRadius: radius.pill,
  },
  meta: {
    width: '45%',
    height: spacing.px10,
    borderRadius: radius.pill,
  },
  action: {
    width: '35%',
    height: spacing.px34,
    borderRadius: radius.pill,
  },
})

