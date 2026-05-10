import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

type Props = {
  initials: string
  bg: string
  color: string
  size?: number
}

// Renders an initials circle avatar. fontSize scales with size automatically.
export const Avatar = React.memo(function Avatar({ initials, bg, color, size = 40 }: Props) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.text, { color, fontSize: Math.round(size * 0.34) }]}>{initials}</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '600' },
})
