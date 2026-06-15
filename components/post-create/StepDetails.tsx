import { useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
} from 'react-native'
import {
  CloseIcon,
  GlobeIcon,
  PlusIcon,
  StarIcon,
  TagIcon,
} from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
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
} from '@/lib/dataSources/rekkusPicks'
import type { DishTag, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'

type Props = {
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
  cashDiscount: boolean
  setCashDiscount: (v: boolean) => void
  googleReviewFreebie: boolean
  setGoogleReviewFreebie: (v: boolean) => void
  dishTags: DishTag[]
}

export default function StepDetails({
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
  cashDiscount,
  setCashDiscount,
  googleReviewFreebie,
  setGoogleReviewFreebie,
  dishTags,
}: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [cuisineSheetVisible, setCuisineSheetVisible] = useState(false)
  const [cuisineQuery, setCuisineQuery] = useState('')
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
    }
  }

  function selectTaste(value: RekkusTasteVerdict) {
    setTasteVerdict(tasteVerdict === value ? undefined : value)
    analytics.rekkusPickSelected(null, 'taste', value)
  }

  function selectValue(value: RekkusValueVerdict) {
    setValueVerdict(valueVerdict === value ? undefined : value)
    analytics.rekkusPickSelected(null, 'value', value)
  }

  function toggleOccasion(value: RekkusOccasionTag) {
    const next = occasionTags.includes(value)
      ? occasionTags.filter(item => item !== value)
      : [...occasionTags, value].slice(0, 3)
    setOccasionTags(next)
    analytics.rekkusPickSelected(null, 'occasion', value)
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── MANDATORY: Your take ─────────────────────────── */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>YOUR TAKE</Text>

          {/* Body */}
          <View style={styles.bodyWrap}>
            <TextInput
              style={styles.bodyInput}
              placeholder="What did you think? What stood out? Would you go back?"
              placeholderTextColor={c.text3}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              textContentType="none"
              autoComplete="off"
            />
            <Text style={styles.charCount}>{body.length} / 8000</Text>
          </View>

          {/* Taste verdict — required */}
          <View style={styles.fieldWrap}>
            <View style={styles.fieldHeader}>
              <StarIcon size={14} color={c.accent} />
              <Text style={styles.fieldLabel}>How was the food?</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {TASTE_PICK_OPTIONS.map(option => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={tasteVerdict === option.value}
                  variant="active"
                  onPress={() => selectTaste(option.value)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Cuisine — required */}
          <TouchableOpacity
            style={styles.cuisineRow}
            onPress={() => setCuisineSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={cuisineType ? `Cuisine, ${cuisineType}` : 'Select cuisine type'}
          >
            <GlobeIcon size={17} />
            <Text style={styles.cuisineLabel}>Cuisine type</Text>
            <Text style={[styles.cuisineValue, cuisineType ? styles.cuisineValueSet : null]} numberOfLines={1}>
              {cuisineType || 'Italian, Japanese…'}
            </Text>
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
          </TouchableOpacity>
        </View>

        {/* ── OPTIONAL: More details ────────────────────────── */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>MORE DETAILS</Text>

          {/* Value verdict */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Was it worth it?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {VALUE_PICK_OPTIONS.map(option => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={valueVerdict === option.value}
                  variant="active"
                  onPress={() => selectValue(option.value)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Occasion tags */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Best for</Text>
            <View style={styles.chipRowWrap}>
              {OCCASION_PICK_OPTIONS.map(option => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={occasionTags.includes(option.value)}
                  variant="active"
                  onPress={() => toggleOccasion(option.value)}
                />
              ))}
            </View>
          </View>

          {/* Must order */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Must order</Text>
            {uniqueDishNames.length > 0 ? (
              <View style={styles.chipRowWrap}>
                {uniqueDishNames.map(name => (
                  <Chip
                    key={name}
                    label={name}
                    selected={mustOrder === name}
                    variant="active"
                    leading={<TagIcon size={12} color={mustOrder === name ? c.accent : c.text3} />}
                    onPress={() => setMustOrder(mustOrder === name ? '' : name)}
                  />
                ))}
                <TextInput
                  style={styles.mustOrderInput}
                  placeholder="or type a dish name"
                  placeholderTextColor={c.text3}
                  value={mustOrder && !uniqueDishNames.includes(mustOrder) ? mustOrder : ''}
                  onChangeText={v => setMustOrder(v)}
                  textContentType="none"
                  autoComplete="off"
                  returnKeyType="done"
                />
              </View>
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Wagyu steak, spicy tuna roll…"
                placeholderTextColor={c.text3}
                value={mustOrder}
                onChangeText={setMustOrder}
                textContentType="none"
                autoComplete="off"
                returnKeyType="done"
              />
            )}
          </View>
        </View>

        {/* ── OPTIONAL: Community intel ─────────────────────── */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>COMMUNITY INTEL</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Cash discounts</Text>
              <Text style={styles.toggleSub}>This place accepts cash for a discount</Text>
            </View>
            <Switch
              value={cashDiscount}
              onValueChange={setCashDiscount}
              trackColor={{ false: c.border, true: c.accent }}
              thumbColor="#fff" /* check:tokens-ignore */
              accessibilityLabel="Cash discounts available"
            />
          </View>

          <View style={styles.toggleDivider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Google review freebie</Text>
              <Text style={styles.toggleSub}>Show your Google review to get a freebie</Text>
            </View>
            <Switch
              value={googleReviewFreebie}
              onValueChange={setGoogleReviewFreebie}
              trackColor={{ false: c.border, true: c.accent }}
              thumbColor="#fff" /* check:tokens-ignore */
              accessibilityLabel="Google review freebie available"
            />
          </View>
        </View>

        {/* ── OPTIONAL: Tags ────────────────────────────────── */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>TAGS</Text>
          <View style={styles.tagRow}>
            {hashtags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={styles.tagChip}
                onPress={() => setHashtags(hashtags.filter(item => item !== tag))}
                accessibilityLabel={`Remove tag ${tag}`}
                accessibilityRole="button"
              >
                <Text style={styles.tagChipText}>#{tag}</Text>
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
                <TouchableOpacity
                  style={styles.tagAddBtn}
                  onPress={() => setTagInputActive(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add tag"
                >
                  <PlusIcon size={11} color={c.text3} />
                  <Text style={styles.tagAddText}>Add tag</Text>
                </TouchableOpacity>
              )
            )}
          </View>
          <Text style={styles.muted}>Tap a tag to remove · max 10</Text>
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

    // ── Groups ─────────────────────────────────────────────
    group: {
      paddingHorizontal: spacing[4],
      paddingTop: spacing[6],
      paddingBottom: spacing[4],
      borderBottomWidth: spacing.hairline,
      borderBottomColor: c.border,
    },
    groupLabel: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: c.text3,
      textTransform: 'uppercase',
      letterSpacing: letterSpacing.widest,
      marginBottom: spacing[4],
    },

    // ── Body ───────────────────────────────────────────────
    bodyWrap: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[4],
      paddingBottom: spacing[3],
      marginBottom: spacing[4],
    },
    bodyInput: {
      fontSize: fontSize.lg,
      color: c.text,
      padding: spacing[0],
      lineHeight: lineHeight.titleRelaxed,
      minHeight: spacing.px60,
    },
    charCount: {
      fontSize: fontSize.xs,
      color: c.text3,
      textAlign: 'right',
      marginTop: spacing[2],
    },

    // ── Field wrapper ──────────────────────────────────────
    fieldWrap: { marginBottom: spacing[4] },
    fieldHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6, marginBottom: spacing[2] },
    fieldLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.text2,
      marginBottom: spacing[2],
    },

    // ── Cuisine row ────────────────────────────────────────
    cuisineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      minHeight: 44,
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing[4],
    },
    cuisineLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.text,
    },
    cuisineValue: {
      flex: 1,
      fontSize: fontSize.sm,
      color: c.text3,
      fontStyle: 'italic',
      textAlign: 'right',
    },
    cuisineValueSet: { color: c.text2, fontStyle: 'normal', fontWeight: fontWeight.medium },
    chevron: { fontSize: fontSize['2xl'], color: c.text3 },

    // ── Chip rows ──────────────────────────────────────────
    chipRow: {
      flexDirection: 'row',
      gap: spacing.px7,
      paddingVertical: spacing.px2,
    },
    chipRowWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.px7,
      paddingVertical: spacing.px2,
    },

    // ── Text inputs ────────────────────────────────────────
    textInput: {
      fontSize: fontSize.md,
      color: c.text,
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px10,
      minHeight: 44,
    },
    mustOrderInput: {
      fontSize: fontSize.sm,
      color: c.text,
      paddingVertical: spacing.px5,
      minWidth: 100,
      minHeight: spacing.px28,
    },

    // ── Toggles ────────────────────────────────────────────
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[3],
      gap: spacing[3],
    },
    toggleText: { flex: 1, gap: spacing.px3 },
    toggleLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.text,
    },
    toggleSub: {
      fontSize: fontSize.xs,
      color: c.text3,
    },
    toggleDivider: { height: spacing.hairline, backgroundColor: c.border },

    // ── Tags ───────────────────────────────────────────────
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.px6,
      alignItems: 'center',
      marginBottom: spacing[2],
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

    muted: { fontSize: fontSize.xs, color: c.text3 },
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
