import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { useMemo, useState } from 'react'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { CheckCircleIcon, CloseIcon, StarIcon, UsersIcon } from '@/components/icons'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { analytics } from '@/lib/analytics'
import { searchCuisines } from '@/lib/dataSources/cuisines'
import {
  OCCASION_PICK_OPTIONS,
  TASTE_PICK_OPTIONS,
  VALUE_PICK_OPTIONS,
  tasteToLegacyFood,
  valueToLegacyCost,
} from '@/lib/dataSources/rekkusPicks'
import type { RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

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
  const cuisineOptions = useMemo(() => searchCuisines(cuisineQuery), [cuisineQuery])

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
        <Text style={styles.sectionLabel}>Rekkus Picks</Text>
        <View style={styles.card}>
          <View style={styles.pickGroup}>
            <View style={styles.pickHeader}>
              <View style={styles.pickIcon}>
                <StarIcon size={15} color={tasteVerdict ? c.accent : c.text3} />
              </View>
              <View style={styles.pickHeaderText}>
                <Text style={styles.pickTitle}>Taste</Text>
                <Text style={styles.pickHelp}>How strongly would you recommend this dish?</Text>
              </View>
            </View>
            <View style={styles.pickChips}>
              {TASTE_PICK_OPTIONS.map(option => {
                const selected = tasteVerdict === option.value
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.pickChip, selected && styles.pickChipSelected]}
                    onPress={() => selectTaste(option.value)}
                  >
                    <Text style={[styles.pickChipText, selected && styles.pickChipTextSelected]}>{option.label}</Text>
                  </TouchableOpacity>
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
              <View style={styles.pickHeaderText}>
                <Text style={styles.pickTitle}>Value</Text>
                <Text style={styles.pickHelp}>Did it feel worth what you paid?</Text>
              </View>
            </View>
            <View style={styles.pickChips}>
              {VALUE_PICK_OPTIONS.map(option => {
                const selected = valueVerdict === option.value
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.pickChip, selected && styles.pickChipSelected]}
                    onPress={() => selectValue(option.value)}
                  >
                    <Text style={[styles.pickChipText, selected && styles.pickChipTextSelected]}>{option.label}</Text>
                  </TouchableOpacity>
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
              <View style={styles.pickHeaderText}>
                <Text style={styles.pickTitle}>Occasion</Text>
                <Text style={styles.pickHelp}>When would you send someone here?</Text>
              </View>
            </View>
            <View style={styles.pickChips}>
              {OCCASION_PICK_OPTIONS.map(option => {
                const selected = occasionTags.includes(option.value)
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.pickChip, selected && styles.pickChipSelected]}
                    onPress={() => toggleOccasion(option.value)}
                  >
                    <Text style={[styles.pickChipText, selected && styles.pickChipTextSelected]}>{option.label}</Text>
                  </TouchableOpacity>
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

      {/* Review body */}
      <Text style={styles.sectionLabel}>Your review</Text>
      <View style={[styles.card, styles.bodyCard]}>
        <TextInput
          style={styles.bodyInput}
          placeholder="What did you try? Any standout dishes? Would you go back?"
          placeholderTextColor={c.text3}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Details */}
      <Text style={styles.sectionLabel}>Details</Text>
      <View style={styles.card}>
        <View style={styles.detailStack}>
          <View style={styles.detailStackHeader}>
            <Text style={styles.detailLabel}>Best dish</Text>
            {bestDish ? (
              <TouchableOpacity onPress={() => setBestDish('')} hitSlop={8}>
                <CloseIcon size={10} color={c.text3} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TextInput
            style={styles.detailStackInput}
            placeholder="e.g. tonkotsu ramen"
            placeholderTextColor={c.text3}
            value={bestDish}
            onChangeText={v => setBestDish(v.slice(0, 60))}
            returnKeyType="done"
          />
          <Text style={styles.detailHint}>Best dish helps people know what to order.</Text>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.detailRow} onPress={showCuisinePicker}>
          <Text style={styles.detailLabel}>Cuisine</Text>
          <Text
            style={[styles.detailValue, cuisineType ? styles.detailValueSet : null]}
            numberOfLines={1}
          >
            {cuisineType || 'Select type'}
          </Text>
          {cuisineType ? (
            <TouchableOpacity onPress={() => setCuisineType('')} hitSlop={8}>
              <CloseIcon size={10} color={c.text3} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Hashtags */}
      <Text style={styles.sectionLabel}>Tags</Text>
      <View style={styles.hashtagWrap}>
        {hashtags.map(tag => (
          <TouchableOpacity
            key={tag}
            style={styles.hashtagToken}
            onPress={() => setHashtags(hashtags.filter(t => t !== tag))}
          >
            <Text style={styles.hashtagTokenText}>#{tag}</Text>
            <CloseIcon size={8} color="rgba(255,255,255,0.75)" /* check:tokens-ignore */ />
          </TouchableOpacity>
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
        />
      </View>
      <Text style={styles.hashtagHint}>Space or return to add · tap to remove</Text>

        <View style={{ height: 22 }} />
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

    sectionLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.extrabold,
      color: c.text2,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      paddingHorizontal: spacing[4],
      paddingTop: spacing.px18,
      paddingBottom: spacing.px7,
    },

    card: {
      marginHorizontal: spacing[4],
      backgroundColor: c.bg,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      borderWidth: 0.5,
      borderColor: c.border,
    },

    divider: { height: 0.5, backgroundColor: c.border },
    pickGroup: { paddingVertical: spacing[3], gap: spacing.px9 },
    pickHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.px10 },
    pickIcon: {
      width: 28,
      height: 28,
      borderRadius: radius.lg,
      backgroundColor: `${c.accent}10`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickHeaderText: { flex: 1, gap: spacing.px1 },
    pickTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
    pickHelp: { fontSize: fontSize.bodySm, color: c.text3, lineHeight: lineHeight.tight },
    pickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px7 },
    pickChip: {
      minHeight: 32,
      borderRadius: radius.lg2,
      borderWidth: 0.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing.px11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickChipSelected: { borderColor: `${c.accent}55`, backgroundColor: `${c.accent}14` },
    pickChipText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.extrabold, color: c.text2 },
    pickChipTextSelected: { color: c.accent },
    selectedHelp: { fontSize: fontSize.sm, color: c.text2, lineHeight: lineHeight.tight },

    // Body
    bodyCard: { padding: spacing.px14, paddingHorizontal: spacing.px14 },
    bodyInput: {
      fontSize: fontSize.lg,
      color: c.text,
      padding: spacing[0],
      lineHeight: lineHeight.titleRelaxed,
      minHeight: 92,
    },

    // Details
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      paddingVertical: spacing.px14,
    },
    detailLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.text,
      width: 80,
    },
    detailStack: { paddingVertical: spacing.px14, gap: spacing.px7 },
    detailStackHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    detailStackInput: { fontSize: fontSize.lg, color: c.text, padding: spacing[0], minHeight: 22 },
    detailHint: { fontSize: fontSize.sm, color: c.text3, lineHeight: lineHeight.xxs },
    detailInput: {
      flex: 1,
      minWidth: 0,
      fontSize: fontSize.md,
      color: c.text,
      padding: spacing[0],
    },
    detailValue: {
      flex: 1,
      fontSize: fontSize.md,
      color: c.text3,
      textAlign: 'right',
    },
    detailValueSet: { color: c.text2 },
    chevron: { fontSize: fontSize['2xl'], color: c.text3, lineHeight: lineHeight.title },

    // Hashtags
    hashtagWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.px6,
      alignItems: 'center',
      backgroundColor: c.bg,
      borderRadius: radius.md3,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
      marginHorizontal: spacing[4],
      minHeight: 48,
    },
    hashtagToken: {
      backgroundColor: c.info,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
    },
    hashtagTokenText: { fontSize: fontSize.bodySm, color: '#fff', fontWeight: fontWeight.medium }, // check:tokens-ignore
    hashtagField: { flex: 1, minWidth: 80, fontSize: fontSize.md, color: c.text, padding: spacing[0] },
    hashtagHint: { fontSize: fontSize.sm, color: c.text3, paddingHorizontal: spacing[4], paddingTop: spacing.px6 },
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
