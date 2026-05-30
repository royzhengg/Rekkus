import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Chip } from '@/components/ui/Chip'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { CHIPS } from './searchConstants'

const SUGGESTION_CHIPS = CHIPS.slice(0, 3)

interface Props {
  query: string
  onChipPress: (query: string) => void
}

export function NoResultsCard({ query, onChipPress }: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>No results for "{query}"</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {SUGGESTION_CHIPS.map(chip => (
          <Chip
            key={chip.query}
            label={`${chip.emoji} ${chip.label}`}
            onPress={() => onChipPress(chip.query)}
            accessibilityLabel={`Search for ${chip.label}`}
          />
        ))}
      </ScrollView>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingTop: spacing.px60,
      paddingHorizontal: spacing.px40,
      gap: spacing[4],
    },
    heading: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.text,
      textAlign: 'center',
    },
    chips: {
      gap: spacing.px7,
      paddingHorizontal: spacing[0],
    },
  })
}
