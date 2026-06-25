import React from 'react'
import { StyleSheet, View } from 'react-native'
import { radius } from '@/constants/Radius'
import { discoveryTokens } from './tokens'

type Props = {
  color: string
}

export const TasteRail = React.memo(function TasteRail({ color }: Props) {
  return (
    <View
      style={[styles.rail, { backgroundColor: color }]}
      importantForAccessibility="no"
      accessibilityElementsHidden
    />
  )
})

const styles = StyleSheet.create({
  rail: {
    alignSelf: 'stretch',
    width: discoveryTokens.railWidth,
    borderRadius: radius.pill,
  },
})

