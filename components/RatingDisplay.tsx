import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

export const STAR_ON = '#EF9F27' // check:tokens-ignore
export const VIBE_ON = '#8B6FBE' // check:tokens-ignore
export const DOLLAR_ON = '#1D9E75' // check:tokens-ignore

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

// Interactive tappable rating input — shared across all post creation and editing flows.
// Use STAR_ON / VIBE_ON / DOLLAR_ON for colorOn; use ★ / ◆ / $ for symbol.
export function RatingInputRow({
  label,
  count,
  max,
  onSelect,
  colorOn,
  symbol,
  labelMap,
}: {
  label: string
  count: number
  max: number
  onSelect: (n: number) => void
  colorOn: string
  symbol: string
  labelMap: Record<number, string>
}) {
  const c = useThemeColors()
  return (
    <View style={inputStyles.ratingRow}>
      <View style={inputStyles.ratingHeader}>
        <Text style={[inputStyles.ratingLabel, { color: c.text }]}>{label}</Text>
        <Text style={[inputStyles.ratingValueLabel, count > 0 ? { color: colorOn } : { color: c.text3 }]}>
          {count > 0 ? labelMap[count] : 'Choose'}
        </Text>
      </View>
      <View style={inputStyles.ratingSymbols}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <TouchableOpacity
            key={n}
            style={[
              inputStyles.ratingOption,
              {
                backgroundColor: n === count ? `${colorOn}18` : c.surface,
                borderColor: n === count ? colorOn : c.border,
              },
            ]}
            onPress={() => onSelect(n)}
          >
            <Text style={[inputStyles.ratingSymbol, { color: n === count ? colorOn : c.text2 }]}>
              {symbol === '$' ? '$'.repeat(n) : labelMap[n]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const inputStyles = StyleSheet.create({
  ratingRow: { paddingVertical: spacing.px13, gap: spacing.px10 },
  ratingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  ratingSymbols: { flexDirection: 'row', gap: spacing.px6, flexWrap: 'wrap' },
  ratingOption: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.px10,
    borderRadius: radius.lg2,
    borderWidth: 0.5,
  },
  ratingSymbol: { fontSize: fontSize.bodySm, fontWeight: fontWeight.bold },
  ratingValueLabel: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold },
})
