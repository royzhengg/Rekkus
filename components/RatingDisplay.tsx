import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

const STAR_ON = '#EF9F27' // check:tokens-ignore
const VIBE_ON = '#8B6FBE' // check:tokens-ignore
const DOLLAR_ON = '#1D9E75' // check:tokens-ignore

/** Food quality rating (★ gold). For vibe/atmosphere, use `Vibes` instead. */
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

// 5-diamond vibe/atmosphere rating
export function Vibes({
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
        <Text key={i} style={{ fontSize: size, color: i < count ? VIBE_ON : border2 }}>
          ◆
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
          style={{ fontSize: size, fontWeight: fontWeight.medium, color: i < count ? DOLLAR_ON : border2 }}
        >
          $
        </Text>
      ))}
    </View>
  )
}

// Compact inline strip shown on post rows — replaces emoji ratings
export function PostRatingStrip({
  food = 0,
  vibe = 0,
  cost = 0,
}: {
  food?: number
  vibe?: number
  cost?: number
}) {
  const { text3, border2 } = useThemeColors()
  return (
    <View style={styles.strip}>
      <View style={styles.inline}>
        {[0, 1, 2, 3, 4].map(i => (
          <Text key={i} style={{ fontSize: fontSize['2xs'], color: i < food ? STAR_ON : border2 }}>
            ★
          </Text>
        ))}
      </View>
      <Text style={[styles.dot, { color: text3 }]}>·</Text>
      <View style={styles.inline}>
        {[0, 1, 2, 3, 4].map(i => (
          <Text key={i} style={{ fontSize: fontSize['2xs'], color: i < vibe ? VIBE_ON : border2 }}>
            ◆
          </Text>
        ))}
      </View>
      <Text style={[styles.dot, { color: text3 }]}>·</Text>
      <View style={styles.inline}>
        {[0, 1, 2, 3].map(i => (
          <Text
            key={i}
            style={{ fontSize: fontSize['2xs'], fontWeight: fontWeight.medium, color: i < cost ? DOLLAR_ON : border2 }}
          >
            $
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.px1_5 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  inline: { flexDirection: 'row', gap: spacing.px1 },
  dot: { fontSize: fontSize['2xs'] },
})
