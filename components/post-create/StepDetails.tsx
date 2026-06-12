import { useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import {
  CameraIcon,
  CheckCircleIcon,
  CloseIcon,
  EditIcon,
  GlobeIcon,
  PlusIcon,
  StarIcon,
  TagIcon,
  UsersIcon,
} from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { elevation } from '@/constants/Elevation'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing, lineHeight } from '@/constants/Typography'
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
import type { DishTag, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'

type PickTab = 'taste' | 'value' | 'occasion'
type DishMode = 'type' | 'photo'

const PICK_TABS = [
  { id: 'taste' as const, label: 'Taste', Icon: StarIcon },
  { id: 'value' as const, label: 'Value', Icon: CheckCircleIcon },
  { id: 'occasion' as const, label: 'Occasion', Icon: UsersIcon },
]

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
  cuisineType: string
  setCuisineType: (v: string) => void
  hashtags: string[]
  setHashtags: (v: string[]) => void
  hashtagInput: string
  setHashtagInput: (v: string) => void
  mustOrder: string
  setMustOrder: (v: string) => void
  dishTags: DishTag[]
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
  cuisineType,
  setCuisineType,
  hashtags,
  setHashtags,
  hashtagInput,
  setHashtagInput,
  mustOrder,
  setMustOrder,
  dishTags,
}: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [cuisineSheetVisible, setCuisineSheetVisible] = useState(false)
  const [cuisineQuery, setCuisineQuery] = useState('')
  const [pickTab, setPickTab] = useState<PickTab>('taste')
  const [dishMode, setDishMode] = useState<DishMode>('type')
  const [tagInputActive, setTagInputActive] = useState(false)
  const hashtagInputRef = useRef<TextInput>(null)
  const cuisineOptions = useMemo(() => searchCuisines(cuisineQuery), [cuisineQuery])
  const uniqueDishNames = useMemo(
    () => [...new Set(dishTags.map(t => t.name))],
    [dishTags]
  )

  function handleHashtagKey(key: string) {
    if ((key === ' ' || key === 'Enter') && hashtagInput.trim()) {
      const tag = hashtagInput.trim().replace(/^#/, '').replace(/\s/g, '')
      if (tag && !hashtags.includes(tag) && hashtags.length < 10) {
        setHashtags([...hashtags, tag])
      }
      setHashtagInput('')
      // keep input active so user can add another tag immediately
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
        {/* Rekkus Picks */}
        {isEnabled('rekkusPicks') && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Rekkus Picks</Text>
            <View style={styles.segControl}>
              {PICK_TABS.map(({ id, label, Icon }) => {
                const active = pickTab === id
                return (
                  <TouchableOpacity key={id} style={[styles.segBtn, active && styles.segBtnActive]}
                    onPress={() => setPickTab(id)} accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Icon size={13} color={active ? c.accent : c.text3} />
                    <Text style={[styles.segBtnText, active && styles.segBtnTextActive]}>{label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {pickTab === 'taste' && TASTE_PICK_OPTIONS.map(option => (
                <Chip key={option.value} label={option.label} selected={tasteVerdict === option.value}
                  variant="active" onPress={() => selectTaste(option.value)} />
              ))}
              {pickTab === 'value' && VALUE_PICK_OPTIONS.map(option => (
                <Chip key={option.value} label={option.label} selected={valueVerdict === option.value}
                  variant="active" onPress={() => selectValue(option.value)} />
              ))}
              {pickTab === 'occasion' && OCCASION_PICK_OPTIONS.map(option => (
                <Chip key={option.value} label={option.label} selected={occasionTags.includes(option.value)}
                  variant="active" onPress={() => toggleOccasion(option.value)} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Best Dish */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Best Dish</Text>
          <View style={styles.segControl}>
            <TouchableOpacity style={[styles.segBtn, dishMode === 'type' && styles.segBtnActive]}
              onPress={() => setDishMode('type')} accessibilityRole="tab"
              accessibilityState={{ selected: dishMode === 'type' }}
            >
              <EditIcon size={13} color={dishMode === 'type' ? c.accent : c.text3} />
              <Text style={[styles.segBtnText, dishMode === 'type' && styles.segBtnTextActive]}>Type it</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.segBtn, dishMode === 'photo' && styles.segBtnActive]}
              onPress={() => setDishMode('photo')} accessibilityRole="tab"
              accessibilityState={{ selected: dishMode === 'photo' }}
            >
              <CameraIcon size={13} color={dishMode === 'photo' ? c.accent : c.text3} />
              <Text style={[styles.segBtnText, dishMode === 'photo' && styles.segBtnTextActive]}>From photo</Text>
            </TouchableOpacity>
          </View>
          {dishMode === 'type' ? (
            <TextInput
              style={styles.dishInput}
              placeholder="e.g. Wagyu steak, spicy tuna roll…"
              placeholderTextColor={c.text3}
              value={mustOrder}
              onChangeText={setMustOrder}
              textContentType="none"
              autoComplete="off"
              returnKeyType="done"
            />
          ) : (
            <View style={styles.chipRow}>
              {uniqueDishNames.length === 0 ? (
                <Text style={styles.muted}>Tag dishes on your photos in step 1</Text>
              ) : (
                uniqueDishNames.map(name => (
                  <Chip key={name} label={name} selected={mustOrder === name} variant="active"
                    leading={<TagIcon size={12} color={mustOrder === name ? c.accent : c.text3} />}
                    onPress={() => setMustOrder(mustOrder === name ? '' : name)}
                  />
                ))
              )}
            </View>
          )}
        </View>

        {/* Your Take */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your Take</Text>
          <TextInput
            style={styles.bodyInput}
            placeholder="What would you recommend? What stood out? Would you go back?"
            placeholderTextColor={c.text3}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            textContentType="none"
            autoComplete="off"
          />
          <View style={styles.reviewMeta}>
            <Text style={styles.muted}>Be specific — it helps others decide</Text>
            <Text style={styles.muted}>{body.length} / 8000</Text>
          </View>
        </View>

        {/* Optional */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Optional</Text>
          <View style={styles.optCard}>
            <View style={styles.optRow}>
              <TouchableOpacity
                style={styles.optRowInner}
                onPress={() => setCuisineSheetVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={cuisineType ? `Cuisine, ${cuisineType}` : 'Select cuisine'}
              >
                <GlobeIcon size={17} />
                <Text style={styles.optLabel}>Cuisine</Text>
                <Text style={[styles.optValue, cuisineType ? styles.optValueSet : null]} numberOfLines={1}>
                  {cuisineType || 'Italian, Japanese…'}
                </Text>
              </TouchableOpacity>
              {cuisineType ? (
                <IconButton onPress={() => setCuisineType('')} accessibilityLabel="Clear cuisine"
                  size={spacing.px34} variant="plain"
                >
                  <CloseIcon size={10} color={c.text3} />
                </IconButton>
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </View>
            <View style={styles.optDivider} />
            <View style={styles.optTagSection}>
              <View style={styles.optTagHeader}>
                <TagIcon size={17} color={c.accent} />
                <Text style={styles.optLabel}>Tags</Text>
              </View>
              <View style={styles.tagRow}>
                {hashtags.map(tag => (
                  <TouchableOpacity key={tag} style={styles.tagChip}
                    onPress={() => setHashtags(hashtags.filter(item => item !== tag))}
                    accessibilityLabel={`Remove tag ${tag}`} accessibilityRole="button"
                  >
                    <Text style={styles.tagChipText}>{tag}</Text>
                    <CloseIcon size={9} color={c.accent} />
                  </TouchableOpacity>
                ))}
                {hashtags.length < 10 && (
                  tagInputActive ? (
                    <TextInput
                      ref={hashtagInputRef}
                      style={styles.tagInlineInput}
                      placeholder="e.g. surryhills, ramen"
                      placeholderTextColor={c.text3}
                      value={hashtagInput}
                      onChangeText={setHashtagInput}
                      onKeyPress={({ nativeEvent }) => handleHashtagKey(nativeEvent.key)}
                      onSubmitEditing={() => handleHashtagKey('Enter')}
                      onBlur={() => { if (!hashtagInput.trim()) setTagInputActive(false) }}
                      blurOnSubmit={false}
                      textContentType="none"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity style={styles.tagAddBtn}
                      onPress={() => setTagInputActive(true)}
                      accessibilityRole="button" accessibilityLabel="Add tag"
                    >
                      <PlusIcon size={11} color={c.text3} />
                      <Text style={styles.tagAddText}>Add tag</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
              <Text style={styles.muted}>Tap a tag to remove</Text>
            </View>
          </View>
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
    section: {
      paddingHorizontal: spacing[4],
      paddingTop: spacing.px14,
      paddingBottom: spacing.px14,
      borderBottomWidth: spacing.hairline,
      borderBottomColor: c.border,
    },
    sectionLabel: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: c.text3,
      textTransform: 'uppercase',
      letterSpacing: letterSpacing.widest,
      marginBottom: spacing.px10,
    },
    segControl: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: radius.md,
      padding: spacing.px3,
      gap: spacing.px2,
      marginBottom: spacing.px10,
    },
    segBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px5,
      paddingVertical: spacing.px7,
      borderRadius: radius.md,
    },
    segBtnActive: {
      backgroundColor: c.bg,
      ...elevation.xs,
    },
    segBtnText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.text3,
    },
    segBtnTextActive: { color: c.accent },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.px7,
      paddingVertical: spacing.px2,
    },
    dishInput: {
      fontSize: fontSize.md,
      color: c.text,
      borderBottomWidth: spacing.hairline,
      borderBottomColor: c.border,
      paddingVertical: spacing.px10,
      padding: spacing[0],
    },
    bodyInput: {
      fontSize: fontSize.lg,
      color: c.text,
      padding: spacing[0],
      paddingBottom: spacing.px14,
      lineHeight: lineHeight.titleRelaxed,
      minHeight: spacing.px60,
      borderBottomWidth: spacing.hairline,
      borderBottomColor: c.border,
    },
    reviewMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.px7,
    },
    muted: { fontSize: fontSize.xs, color: c.text3 },
    optCard: {
      borderRadius: radius.md3,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      backgroundColor: c.bg,
      overflow: 'hidden',
    },
    optRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: spacing.px56,
      paddingHorizontal: spacing.px14,
    },
    optRowInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      minHeight: spacing.px56,
    },
    optLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.text,
      flex: 0,
    },
    optValue: {
      flex: 1,
      fontSize: fontSize.sm,
      color: c.text3,
      fontStyle: 'italic',
      textAlign: 'right',
    },
    optValueSet: { color: c.text2, fontStyle: 'normal', fontWeight: fontWeight.medium },
    chevron: { fontSize: fontSize['2xl'], color: c.text3, lineHeight: lineHeight.title },
    optDivider: { height: spacing.hairline, backgroundColor: c.border },
    optTagSection: {
      paddingHorizontal: spacing.px14,
      paddingTop: spacing.px10,
      paddingBottom: spacing.px14,
      gap: spacing.px7,
    },
    optTagHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.px6,
      alignItems: 'center',
    },
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      backgroundColor: `${c.accent}14`,
      borderWidth: 1,
      borderColor: c.accent,
      borderRadius: radius.xl,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px5,
    },
    tagChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: c.accent },
    tagAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.border,
      borderRadius: radius.xl,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px5,
    },
    tagAddText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: c.text3 },
    tagInlineInput: {
      fontSize: fontSize.sm,
      color: c.text,
      padding: spacing[0],
      minWidth: 80,
      minHeight: spacing.px28,
    },
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
