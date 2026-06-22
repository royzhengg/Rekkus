import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Chip } from '@/components/ui/Chip'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { NoResultsSuggestionChip } from '@/lib/hooks/useNoResultsSuggestions'

interface Props {
  query: string
  chips: NoResultsSuggestionChip[]
  onChipPress: (query: string) => void
}

export function NoResultsCard({ query, chips, onChipPress }: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>No results for "{query}"</Text>
      {chips.length > 0 && (
        <>
          <Text style={styles.subheading}>Try instead</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {chips.map(chip => (
              <Chip
                key={chip.query}
                label={chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label}
                onPress={() => onChipPress(chip.query)}
                accessibilityLabel={`Search for ${chip.label}`}
              />
            ))}
          </ScrollView>
        </>
      )}
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
    subheading: {
      fontSize: fontSize.sm,
      color: c.text3,
      textAlign: 'center',
    },
    chips: {
      gap: spacing.px7,
      paddingHorizontal: spacing[0],
    },
  })
}
