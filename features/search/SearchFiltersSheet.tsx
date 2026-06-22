import React, { useMemo, useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { CloseIcon } from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { searchCuisines } from '@/lib/dataSources/cuisines'
import { OCCASION_PICK_OPTIONS } from '@/lib/dataSources/rekkusPicks'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import type { SearchFilters } from '@/lib/hooks/useSearch'
import { SEARCH_SORTS } from './searchConstants'

interface SearchFiltersSheetProps {
  visible: boolean
  onClose: () => void
  filters: SearchFilters
  setFilters: (filters: SearchFilters) => void
}

export function SearchFiltersSheet({
  visible,
  onClose,
  filters,
  setFilters,
}: SearchFiltersSheetProps) {
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [cuisineQuery, setCuisineQuery] = useState('')
  const cuisineOptions = useMemo(() => searchCuisines(cuisineQuery).slice(0, 10), [cuisineQuery])

  function patchFilters(patch: Partial<SearchFilters>) {
    setFilters({ ...filters, ...patch })
  }

  function toggleOccasion(value: (typeof OCCASION_PICK_OPTIONS)[number]['value']) {
    const current = filters.occasions ?? []
    const next = current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value]
    patchFilters({ occasions: next })
  }

  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetDismissArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <IconButton
              accessibilityLabel="Close filters"
              onPress={onClose}
              size={34}
              style={styles.sheetClose}
            >
              <CloseIcon />
            </IconButton>
          </View>
          <View style={styles.divider} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollContent}
          >
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CUISINE</Text>
              <TextInput
                style={styles.cuisineInput}
                placeholder="Search cuisines…"
                placeholderTextColor={colors.text3}
                accessibilityLabel="Filter by cuisine type"
                value={cuisineQuery}
                onChangeText={setCuisineQuery}
              />
              <View style={styles.chipWrap}>
                {filters.cuisine && (
                  <Chip
                    label={`Clear ${filters.cuisine}`}
                    selected
                    onPress={() => patchFilters({ cuisine: null })}
                  />
                )}
                {cuisineOptions.map(option => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={filters.cuisine === option.value}
                    onPress={() => patchFilters({ cuisine: option.value })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>OCCASION</Text>
              <View style={styles.chipWrap}>
                {OCCASION_PICK_OPTIONS.map(option => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={filters.occasions?.includes(option.value) ?? false}
                    onPress={() => toggleOccasion(option.value)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SORT</Text>
              <View style={styles.chipWrap}>
                {SEARCH_SORTS.map(option => (
                  <Chip
                    key={option.key}
                    label={option.label}
                    selected={(filters.sort ?? 'best_match') === option.key}
                    onPress={() => patchFilters({ sort: option.key })}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => setFilters({ sort: 'best_match' })}
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
            >
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
            >
              <Text style={styles.applyText}>Apply filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
    sheetDismissArea: { flex: 1 },
    sheet: {
      paddingTop: spacing.px10,
      paddingBottom: spacing.px28,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      backgroundColor: c.bg,
      maxHeight: '86%',
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: radius.xxs,
      backgroundColor: c.border2,
      marginBottom: spacing[4],
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      marginBottom: spacing[3],
    },
    sheetTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: c.text },
    sheetClose: { backgroundColor: c.surface },
    divider: { height: 0.5, backgroundColor: c.border },
    sheetScrollContent: { paddingBottom: spacing[2] },
    section: {
      paddingHorizontal: spacing[4],
      paddingTop: spacing[5],
    },
    sectionLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      color: c.text3,
      letterSpacing: letterSpacing.wide,
      marginBottom: spacing[3],
    },
    cuisineInput: {
      minHeight: 40,
      borderRadius: radius.md3,
      paddingHorizontal: spacing[3],
      marginBottom: spacing[2],
      backgroundColor: c.surface,
      color: c.text,
      fontSize: fontSize.base,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.px10,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[4],
    },
    resetButton: {
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.lg,
      backgroundColor: c.surface,
      paddingHorizontal: spacing[5],
    },
    resetText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text2 },
    applyButton: {
      flex: 1,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.lg,
      backgroundColor: c.text,
    },
    applyText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.bg },
  })
}
