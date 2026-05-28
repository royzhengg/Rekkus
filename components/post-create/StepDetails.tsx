import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import {
  CheckCircleIcon,
  ChevronDown,
  CloseIcon,
  DishIcon,
  EditIcon,
  GlobeIcon,
  StarIcon,
  TagIcon,
  UsersIcon,
} from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { searchCuisines } from '@/lib/dataSources/cuisines'
import {
  OCCASION_PICK_OPTIONS,
  TASTE_PICK_OPTIONS,
  VALUE_PICK_OPTIONS,
  tasteToLegacyFood,
  valueToLegacyCost,
} from '@/lib/dataSources/rekkusPicks'
import { isEnabled } from '@/lib/featureFlags'
import type { RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'

type Props = {
  foodRating: number
  setFoodRating: (v: number) => void
  vibeRating: number
  setVibeRating: (v: number) => void
  costRating: number
  setCostRating: (v: number) => void
  tasteVerdict: RekkusTasteVerdict | undefined
  setTasteVerdict: (v: RekkusTasteVerdict | undefined) => void
  valueVerdict: RekkusValueVerdict | undefined
  setValueVerdict: (v: RekkusValueVerdict | undefined) => void
  occasionTags: RekkusOccasionTag[]
  setOccasionTags: (v: RekkusOccasionTag[]) => void
  body: string
  setBody: (v: string) => void
  bestDish: string
  setBestDish: (v: string) => void
  cuisineType: string
  setCuisineType: (v: string) => void
  hashtags: string[]
  setHashtags: (v: string[]) => void
  hashtagInput: string
  setHashtagInput: (v: string) => void
}


export default function StepDetails({
  setFoodRating,
  setVibeRating,
  setCostRating,
  tasteVerdict,
  setTasteVerdict,
  valueVerdict,
  setValueVerdict,
  occasionTags,
  setOccasionTags,
  body,
  setBody,
  bestDish,
  setBestDish,
  cuisineType,
  setCuisineType,
  hashtags,
  setHashtags,
  hashtagInput,
  setHashtagInput,
}: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [cuisineSheetVisible, setCuisineSheetVisible] = useState(false)
  const [cuisineQuery, setCuisineQuery] = useState('')
  const [optionalDetailsExpanded, setOptionalDetailsExpanded] = useState(
    () => cuisineType.trim().length > 0 || hashtags.length > 0 || hashtagInput.trim().length > 0
  )
  const optionalDetailsTouched = useRef(false)
  const cuisineOptions = useMemo(() => searchCuisines(cuisineQuery), [cuisineQuery])
  const optionalSummary = [
    cuisineType || null,
    hashtags.length > 0 ? `${hashtags.length} ${hashtags.length === 1 ? 'tag' : 'tags'}` : null,
  ].filter((value): value is string => value !== null).join(' · ')

  useEffect(() => {
    if (optionalDetailsTouched.current) return
    if (cuisineType.trim().length > 0 || hashtags.length > 0 || hashtagInput.trim().length > 0) {
      setOptionalDetailsExpanded(true)
    }
  }, [cuisineType, hashtagInput, hashtags.length])

  function toggleOptionalDetails() {
    optionalDetailsTouched.current = true
    setOptionalDetailsExpanded(expanded => !expanded)
  }

  function showCuisinePicker() {
    setCuisineSheetVisible(true)
  }

  function handleHashtagKey(key: string) {
    if ((key === ' ' || key === 'Enter') && hashtagInput.trim()) {
      const tag = hashtagInput.trim().replace(/^#/, '').replace(/\s/g, '')
      if (tag && !hashtags.includes(tag) && hashtags.length < 10) {
        setHashtags([...hashtags, tag])
      }
      setHashtagInput('')
    }
  }

  function selectTaste(value: RekkusTasteVerdict) {
    setTasteVerdict(value)
    setFoodRating(tasteToLegacyFood(value))
    analytics.rekkusPickSelected(null, 'taste', value)
  }

  function selectValue(value: RekkusValueVerdict) {
    setValueVerdict(value)
    setCostRating(valueToLegacyCost(value))
    analytics.rekkusPickSelected(null, 'value', value)
  }

  function toggleOccasion(value: RekkusOccasionTag) {
    const next = occasionTags.includes(value)
      ? occasionTags.filter(item => item !== value)
      : [...occasionTags, value].slice(0, 3)
    setOccasionTags(next)
    setVibeRating(next.length > 0 ? 4 : 0)
    analytics.rekkusPickSelected(null, 'occasion', value)
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Ratings */}
        {isEnabled('rekkusPicks') && (
          <>
            <Text style={styles.sectionHeading}>Rekkus Picks</Text>
            <View style={styles.card}>
              <View style={styles.pickGroup}>
                <View style={styles.pickHeader}>
                  <View style={styles.pickIcon}>
                    <StarIcon size={15} color={tasteVerdict ? c.accent : c.text3} />
                  </View>
                  <Text style={styles.pickTitle}>Taste</Text>
                </View>
                <View style={styles.pickChips}>
                  {TASTE_PICK_OPTIONS.map(option => {
                    const selected = tasteVerdict === option.value
                    return (
                      <Chip
                        key={option.value}
                        label={option.label}
                        selected={selected}
                        variant="active"
                        onPress={() => selectTaste(option.value)}
                        style={styles.pickChoice}
                      />
                    )
                  })}
                </View>
                {tasteVerdict && (
                  <Text style={styles.selectedHelp}>
                    {TASTE_PICK_OPTIONS.find(option => option.value === tasteVerdict)?.helper}
                  </Text>
                )}
              </View>
              <View style={styles.divider} />
              <View style={styles.pickGroup}>
                <View style={styles.pickHeader}>
                  <View style={styles.pickIcon}>
                    <CheckCircleIcon size={15} color={valueVerdict ? c.accent : c.text3} />
                  </View>
                  <Text style={styles.pickTitle}>Value</Text>
                </View>
                <View style={styles.pickChips}>
                  {VALUE_PICK_OPTIONS.map(option => {
                    const selected = valueVerdict === option.value
                    return (
                      <Chip
                        key={option.value}
                        label={option.label}
                        selected={selected}
                        variant="active"
                        onPress={() => selectValue(option.value)}
                        style={styles.pickChoice}
                      />
                    )
                  })}
                </View>
                {valueVerdict && (
                  <Text style={styles.selectedHelp}>
                    {VALUE_PICK_OPTIONS.find(option => option.value === valueVerdict)?.helper}
                  </Text>
                )}
              </View>
              <View style={styles.divider} />
              <View style={styles.pickGroup}>
                <View style={styles.pickHeader}>
                  <View style={styles.pickIcon}>
                    <UsersIcon size={15} color={occasionTags.length > 0 ? c.accent : c.text3} />
                  </View>
                  <Text style={styles.pickTitle}>Occasion</Text>
                </View>
                <View style={styles.pickChips}>
                  {OCCASION_PICK_OPTIONS.map(option => {
                    const selected = occasionTags.includes(option.value)
                    return (
                      <Chip
                        key={option.value}
                        label={option.label}
                        selected={selected}
                        variant="active"
                        onPress={() => toggleOccasion(option.value)}
                        style={styles.pickChoice}
                      />
                    )
                  })}
                </View>
                {occasionTags[0] && (
                  <Text style={styles.selectedHelp}>
                    {OCCASION_PICK_OPTIONS.find(option => option.value === occasionTags[0])?.helper}
                  </Text>
                )}
              </View>
            </View>
          </>
        )}

      {/* Core review content */}
      <View style={styles.sectionHeadingRow}>
        <EditIcon size={spacing.px17} color={c.text3} />
        <Text style={styles.sectionHeadingText}>Your review</Text>
      </View>
      <View style={[styles.card, styles.coreCard]}>
        <TextInput
          style={styles.bodyInput}
          placeholder="What did you try? Any standout dishes? Would you go back?"
          placeholderTextColor={c.text3}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          textContentType="none"
          autoComplete="off"
        />
        <View style={styles.divider} />
        <View style={styles.detailStack}>
          <View style={styles.detailStackHeader}>
            <View style={styles.fieldLabelRow}>
              <DishIcon size={spacing.px17} color={c.text3} />
              <Text style={styles.detailLabel}>Best dish</Text>
            </View>
            {bestDish ? (
              <IconButton
                onPress={() => setBestDish('')}
                accessibilityLabel="Clear best dish"
                size={spacing.px34}
                variant="plain"
              >
                <CloseIcon size={10} color={c.text3} />
              </IconButton>
            ) : null}
          </View>
          <TextInput
            style={styles.detailStackInput}
            placeholder="e.g. tonkotsu ramen"
            placeholderTextColor={c.text3}
            value={bestDish}
            onChangeText={v => setBestDish(v.slice(0, 60))}
            returnKeyType="done"
            textContentType="none"
            autoComplete="off"
          />
          <Text style={styles.detailHint}>Best dish helps people know what to order.</Text>
        </View>
      </View>

      {/* Optional metadata */}
      <Text style={styles.sectionHeading}>Optional details</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.optionalToggle}
          onPress={toggleOptionalDetails}
          accessibilityRole="button"
          accessibilityLabel={optionalDetailsExpanded ? 'Hide optional details' : 'Add optional details'}
          accessibilityState={{ expanded: optionalDetailsExpanded }}
        >
          <View style={styles.optionalLabelWrap}>
            <Text style={styles.optionalLabel}>{optionalDetailsExpanded ? 'Hide optional details' : 'Add optional details'}</Text>
            {!optionalDetailsExpanded && optionalSummary ? (
              <Text style={styles.optionalSummary} numberOfLines={1}>{optionalSummary}</Text>
            ) : null}
          </View>
          <ChevronDown expanded={optionalDetailsExpanded} />
        </TouchableOpacity>
        {optionalDetailsExpanded ? (
          <>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <TouchableOpacity
                style={styles.cuisinePicker}
                onPress={showCuisinePicker}
                accessibilityRole="button"
                accessibilityLabel={cuisineType ? `Cuisine, ${cuisineType}` : 'Select cuisine'}
              >
                <GlobeIcon size={spacing.px17} />
                <Text style={styles.detailLabel}>Cuisine</Text>
                <Text
                  style={[styles.detailValue, cuisineType ? styles.detailValueSet : null]}
                  numberOfLines={1}
                >
                  {cuisineType || 'Select type'}
                </Text>
              </TouchableOpacity>
              {cuisineType ? (
                <IconButton
                  onPress={() => setCuisineType('')}
                  accessibilityLabel="Clear cuisine"
                  size={spacing.px34}
                  variant="plain"
                >
                  <CloseIcon size={10} color={c.text3} />
                </IconButton>
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </View>
            <View style={styles.divider} />
            <View style={styles.tagBlock}>
              <View style={styles.fieldLabelRow}>
                <TagIcon size={spacing.px17} color={c.text3} />
                <Text style={styles.detailLabel}>Tags</Text>
              </View>
              <View style={styles.hashtagWrap}>
                {hashtags.map(tag => (
                  <Chip
                    key={tag}
                    label={`#${tag}`}
                    selected
                    onPress={() => setHashtags(hashtags.filter(item => item !== tag))}
                    accessibilityLabel={`Remove tag ${tag}`}
                  />
                ))}
                <TextInput
                  style={styles.hashtagField}
                  placeholder={hashtags.length === 0 ? 'e.g. surryhills, ramen' : ''}
                  placeholderTextColor={c.text3}
                  value={hashtagInput}
                  onChangeText={setHashtagInput}
                  onKeyPress={({ nativeEvent }) => handleHashtagKey(nativeEvent.key)}
                  onSubmitEditing={() => handleHashtagKey('Enter')}
                  blurOnSubmit={false}
                  textContentType="none"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </View>
              <Text style={styles.hashtagHint}>Space or return to add · tap to remove</Text>
            </View>
          </>
        ) : null}
      </View>

        <View style={styles.scrollEnd} />
      </ScrollView>
      <RekkusActionSheet
        visible={cuisineSheetVisible}
        title="Cuisine"
        header={(
          <TextInput
            style={styles.cuisineSearch}
            value={cuisineQuery}
            onChangeText={setCuisineQuery}
            placeholder="Search cuisines"
            placeholderTextColor={c.text3}
            autoCapitalize="none"
          />
        )}
        options={cuisineOptions.map(option => ({
          label: option.label,
          value: option.value,
          selected: cuisineType === option.value,
        }))}
        onSelect={value => {
          setCuisineType(value)
          setCuisineQuery('')
        }}
        onDismiss={() => setCuisineSheetVisible(false)}
      />
    </>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    scroll: { flex: 1 },

    sectionHeading: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: c.text2,
      paddingHorizontal: spacing[4],
      paddingTop: spacing.px14,
      paddingBottom: spacing.px7,
    },
    sectionHeadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingTop: spacing.px14,
      paddingBottom: spacing.px7,
    },
    sectionHeadingText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: c.text2,
    },

    card: {
      marginHorizontal: spacing[4],
      backgroundColor: c.bg,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      borderWidth: spacing.hairline,
      borderColor: c.border,
    },

    divider: { height: spacing.hairline, backgroundColor: c.border },
    pickGroup: { paddingVertical: spacing.px10, gap: spacing.px7 },
    pickHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.px10 },
    pickIcon: {
      width: spacing.px28,
      height: spacing.px28,
      borderRadius: radius.lg,
      backgroundColor: `${c.accent}10`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
    pickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px7 },
    pickChoice: { minHeight: spacing.px34 },
    selectedHelp: { fontSize: fontSize.sm, color: c.text2, lineHeight: lineHeight.tight },

    coreCard: { paddingTop: spacing.px14 },
    bodyInput: {
      fontSize: fontSize.lg,
      color: c.text,
      padding: spacing[0],
      paddingBottom: spacing.px14,
      lineHeight: lineHeight.titleRelaxed,
      minHeight: spacing.px60,
    },
    fieldLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    detailStack: { paddingVertical: spacing.px10, gap: spacing.px6 },
    detailStackHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    detailLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.text,
    },
    detailStackInput: { fontSize: fontSize.lg, color: c.text, padding: spacing[0], minHeight: spacing.px22 },
    detailHint: { fontSize: fontSize.sm, color: c.text3, lineHeight: lineHeight.xxs },

    optionalToggle: {
      minHeight: spacing.px50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[3],
    },
    optionalLabelWrap: { flex: 1 },
    optionalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text },
    optionalSummary: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px3 },
    detailRow: {
      minHeight: spacing.px56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    cuisinePicker: {
      minHeight: spacing.px56,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    detailValue: {
      flex: 1,
      fontSize: fontSize.md,
      color: c.text3,
      textAlign: 'right',
    },
    detailValueSet: { color: c.text2 },
    chevron: { fontSize: fontSize['2xl'], color: c.text3, lineHeight: lineHeight.title },

    tagBlock: { paddingTop: spacing.px10, paddingBottom: spacing.px14, gap: spacing.px7 },
    hashtagWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.px6,
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px7,
      minHeight: spacing.px50,
    },
    hashtagField: { flex: 1, minWidth: 80, fontSize: fontSize.md, color: c.text, padding: spacing[0] },
    hashtagHint: { fontSize: fontSize.sm, color: c.text3 },
    scrollEnd: { height: spacing.px22 },
    cuisineSearch: {
      marginHorizontal: spacing[4],
      marginBottom: spacing.px10,
      minHeight: 42,
      borderRadius: radius.sm3,
      backgroundColor: c.surface2,
      color: c.text,
      paddingHorizontal: spacing[3],
      fontSize: fontSize.md,
    },
  })
}
