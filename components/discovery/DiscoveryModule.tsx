import React from 'react'
import { StyleSheet, View } from 'react-native'
import { DiscoverySectionHeader } from './DiscoverySectionHeader'
import { discoveryTokens } from './tokens'
import type { DiscoveryColors, ProvenanceType } from './types'

type Props = {
  colors: DiscoveryColors
  title: string
  subtitle?: string
  provenance: ProvenanceType
  ctaLabel?: string
  onPressCta?: () => void
  children: React.ReactNode
}

export const DiscoveryModule = React.memo(function DiscoveryModule({
  colors,
  title,
  subtitle,
  provenance,
  ctaLabel,
  onPressCta,
  children,
}: Props) {
  return (
    <View style={styles.module}>
      <DiscoverySectionHeader
        colors={colors}
        title={title}
        provenance={provenance}
        {...(subtitle != null ? { subtitle } : {})}
        {...(ctaLabel != null ? { ctaLabel } : {})}
        {...(onPressCta != null ? { onPressCta } : {})}
      />
      <View style={styles.body}>{children}</View>
    </View>
  )
})

const styles = StyleSheet.create({
  module: {
    gap: discoveryTokens.cardGap,
    marginTop: discoveryTokens.sectionGap,
  },
  body: {
    gap: discoveryTokens.cardGap,
  },
})
