import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useThemeColors } from '@/lib/ThemeContext'

const STAR_ON = '#EF9F27'
const DOLLAR_ON = '#1D9E75'

// 5-star food/vibe rating
export function Stars({
  count,
  max = 5,
  size = 10,
}: {
  count: number
  max?: number
  size?: number
}) {
  const { border2 } = useThemeColors()
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, i) => (
        <Text key={i} style={{ fontSize: size, color: i < count ? STAR_ON : border2 }}>
          ★
        </Text>
      ))}
    </View>
  )
}

// 4-dollar cost rating
export function Dollars({ count, size = 10 }: { count: number; size?: number }) {
  const { border2 } = useThemeColors()
  return (
    <View style={styles.row}>
      {[0, 1, 2, 3].map(i => (
        <Text
          key={i}
          style={{ fontSize: size, fontWeight: '500', color: i < count ? DOLLAR_ON : border2 }}
        >
          $
        </Text>
      ))}
    </View>
  )
}

// Compact inline strip shown on post rows — replaces emoji ratings
export function PostRatingStrip({
  food,
  vibe,
  cost,
}: {
  food: number
  vibe: number
  cost: number
}) {
  const { text3, border2 } = useThemeColors()
  return (
    <View style={styles.strip}>
      <View style={styles.inline}>
        {[0, 1, 2, 3, 4].map(i => (
          <Text key={i} style={{ fontSize: 9, color: i < food ? STAR_ON : border2 }}>
            ★
          </Text>
        ))}
      </View>
      <Text style={[styles.dot, { color: text3 }]}>·</Text>
      <View style={styles.inline}>
        {[0, 1, 2, 3, 4].map(i => (
          <Text key={i} style={{ fontSize: 9, color: i < vibe ? STAR_ON : border2 }}>
            ★
          </Text>
        ))}
      </View>
      <Text style={[styles.dot, { color: text3 }]}>·</Text>
      <View style={styles.inline}>
        {[0, 1, 2, 3].map(i => (
          <Text
            key={i}
            style={{ fontSize: 9, fontWeight: '500', color: i < cost ? DOLLAR_ON : border2 }}
          >
            $
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 1.5 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inline: { flexDirection: 'row', gap: 1 },
  dot: { fontSize: 9 },
})
