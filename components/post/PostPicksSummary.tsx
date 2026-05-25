import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { legacyFoodToTaste, occasionLabel, tasteLabel, valueLabel } from '@/lib/dataSources/rekkusPicks'
import type { Post, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'

type Props = {
  post?: Post | undefined
  tasteVerdict?: RekkusTasteVerdict | undefined
  valueVerdict?: RekkusValueVerdict | undefined
  occasionTags?: RekkusOccasionTag[] | undefined
  compact?: boolean | undefined
}

export function PostPicksSummary({ post, tasteVerdict, valueVerdict, occasionTags, compact }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const taste = tasteVerdict ?? post?.tasteVerdict ?? legacyFoodToTaste(post?.food)
  const value = valueVerdict ?? post?.valueVerdict
  const occasions = occasionTags ?? post?.occasionTags ?? []
  const chips = [
    taste ? tasteLabel(taste) : null,
    value ? valueLabel(value) : null,
    ...occasions.slice(0, compact ? 1 : 2).map(occasionLabel),
  ].filter(Boolean) as string[]

  if (chips.length === 0) return null

  return (
    <View style={styles.row}>
      {chips.map(chip => (
        <Text key={chip} style={[styles.chip, compact && styles.chipCompact]} numberOfLines={1}>
          {chip}
        </Text>
      ))}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px6 },
    chip: {
      overflow: 'hidden',
      borderRadius: radius.lg,
      backgroundColor: c.surface2,
      color: c.text2,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      paddingHorizontal: spacing.px9,
      paddingVertical: spacing.px5,
    },
    chipCompact: { fontSize: fontSize.xs, paddingHorizontal: spacing.px7, paddingVertical: spacing[1] },
  })
}
