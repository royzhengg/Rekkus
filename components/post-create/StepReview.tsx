import { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native'
import { Avatar } from '@/components/Avatar'
import { EditIcon, ImagePlaceholder, PinIcon, TagIcon, VideoIcon } from '@/components/icons'
import { SendIcon } from '@/components/icons/engagement'
import { ChevronRight, GlobeIcon } from '@/components/icons/navigation'
import { PostMediaCarousel } from '@/components/post/PostMediaCarousel'
import { PostPicksSummary } from '@/components/post/PostPicksSummary'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { SelectedPlace } from '@/lib/services/places'
import type { DishTag, PostMedia, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'

type Props = {
  title: string
  body: string
  media: PostMedia[]
  dishTags?: DishTag[] | undefined
  selectedPlace: SelectedPlace | null
  tasteVerdict?: RekkusTasteVerdict | undefined
  valueVerdict?: RekkusValueVerdict | undefined
  occasionTags?: RekkusOccasionTag[] | undefined
  cuisineType: string
  mustOrder: string
  cashDiscount?: boolean | undefined
  googleReviewFreebie?: boolean | undefined
  hashtags: string[]
  onEditBasics: () => void
  onEditDetails: () => void
  onPost: () => void
  onSaveDraft: () => void
  primaryLabel?: string | undefined
  posting: boolean
  savingDraft: boolean
}

export default function StepReview({
  title,
  body,
  media,
  dishTags,
  selectedPlace,
  tasteVerdict,
  valueVerdict,
  occasionTags,
  cuisineType,
  mustOrder,
  cashDiscount,
  googleReviewFreebie,
  hashtags,
  onEditBasics,
  onEditDetails,
  onPost,
  onSaveDraft,
  primaryLabel = 'Post review',
  posting,
  savingDraft,
}: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const { width: screenWidth } = useWindowDimensions()

  const firstMedia = media[0]
  const firstDishTag = dishTags?.find(t => t.photoIndex === 0)
  const cardWidth = screenWidth - spacing[3] * 2

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Media card */}
      <View style={styles.mediaCard}>
        <View style={styles.photo}>
          {media.length > 0 ? (
            <PostMediaCarousel
              media={media}
              height={cardWidth * (3 / 4)}
            />
          ) : firstMedia?.type === 'video' ? (
            <View style={[styles.photoEmpty, { width: cardWidth, height: cardWidth * (3 / 4) }]}>
              <VideoIcon size={42} color={c.accent} />
              <Text style={styles.photoEmptyText}>Video ready</Text>
            </View>
          ) : (
            <View style={[styles.photoEmpty, { width: cardWidth, height: cardWidth * (3 / 4) }]}>
              <ImagePlaceholder size={40} color={c.text3} />
              <Text style={styles.photoEmptyText}>No media added</Text>
            </View>
          )}
          {firstDishTag && (
            <View style={styles.dishTagOverlay} pointerEvents="none">
              <TagIcon size={11} color={c.white} />
              <Text style={styles.dishTagText}>{firstDishTag.name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Post preview card */}
      <View style={styles.postCard}>
        <View style={styles.content}>
          {/* Creator row */}
          <View style={styles.creatorRow}>
            <Avatar initials="ME" bg={c.ratingBg} color={c.ratingText} size={32} />
            <View>
              <Text style={styles.handle}>@you</Text>
              <Text style={styles.timestamp}>Just now</Text>
            </View>
          </View>

          {/* Location */}
          {selectedPlace && (
            <View style={styles.locationRow}>
              <PinIcon size={11} />
              <Text style={styles.locationText} numberOfLines={1}>
                {selectedPlace.name}
              </Text>
            </View>
          )}

          {/* Title */}
          {title.trim().length > 0 ? (
            <Text style={styles.postTitle}>{title}</Text>
          ) : (
            <Text style={[styles.postTitle, styles.placeholder]}>Your title will appear here…</Text>
          )}

          {/* Body */}
          {body.trim().length > 0 && (
            <Text style={styles.postBody}>{body}</Text>
          )}

          {/* Ratings */}
          {(tasteVerdict || valueVerdict || (occasionTags?.length ?? 0) > 0) && (
            <PostPicksSummary
              tasteVerdict={tasteVerdict}
              valueVerdict={valueVerdict}
              occasionTags={occasionTags}
              compact
              variant="accent"
            />
          )}

          {/* Cuisine + best dish */}
          {(cuisineType || mustOrder.trim().length > 0) && (
            <View style={styles.metaRow}>
              {cuisineType ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{cuisineType}</Text>
                </View>
              ) : null}
              {mustOrder.trim().length > 0 ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>🍜 {mustOrder}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Community intel */}
          {(cashDiscount || googleReviewFreebie) && (
            <View style={styles.intelRow}>
              {cashDiscount && (
                <View style={styles.intelPill}>
                  <Text style={styles.intelPillText}>💵 Cash discount</Text>
                </View>
              )}
              {googleReviewFreebie && (
                <View style={styles.intelPill}>
                  <Text style={styles.intelPillText}>⭐ Review freebie</Text>
                </View>
              )}
            </View>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <View style={styles.hashtags}>
              {hashtags.map(tag => (
                <Text key={tag} style={styles.hashtag}>#{tag}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Edit buttons inside card */}
        <View style={styles.editRow}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={onEditBasics}
            accessibilityRole="button"
            accessibilityLabel="Edit media"
          >
            <EditIcon size={14} color={c.text2} />
            <Text style={styles.editBtnText}>Edit media</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={onEditDetails}
            accessibilityRole="button"
            accessibilityLabel="Edit review details"
          >
            <EditIcon size={14} color={c.text2} />
            <Text style={styles.editBtnText}>Edit review</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Audience card */}
      <View style={styles.audienceCard}>
        <TouchableOpacity
          style={styles.audienceRow}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Audience: Everyone"
        >
          <View style={styles.audienceLeft}>
            <GlobeIcon size={16} />
            <Text style={styles.audienceLabel}>Audience</Text>
          </View>
          <View style={styles.audienceRight}>
            <Text style={styles.audienceValue}>Everyone</Text>
            <ChevronRight size={14} />
          </View>
        </TouchableOpacity>
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.postBtn, posting && styles.postBtnDisabled]}
          onPress={onPost}
          disabled={posting}
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
        >
          {posting ? (
            <ActivityIndicator color={c.white} size="small" />
          ) : (
            <>
              <SendIcon active size={16} color={c.white} />
              <Text style={styles.postBtnText}>{primaryLabel}</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveDraftBtn, savingDraft && styles.saveDraftBtnDisabled]}
          onPress={onSaveDraft}
          disabled={savingDraft}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Save draft"
        >
          {savingDraft ? (
            <ActivityIndicator color={c.text2} size="small" />
          ) : (
            <Text style={styles.saveDraftText}>Save draft</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.confidenceText}>Your review helps others discover great food</Text>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.surface },

    // Media card
    mediaCard: {
      marginHorizontal: spacing[3],
      marginTop: spacing[3],
      borderRadius: radius.lg2,
      overflow: 'hidden',
    },

    // Photo
    photo: { backgroundColor: c.surface, position: 'relative' },
    photoEmpty: {
      backgroundColor: `${c.accent}08`,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
    },
    photoEmptyText: { fontSize: fontSize.base, color: c.text3 },
    dishTagOverlay: {
      position: 'absolute',
      bottom: spacing[3],
      left: spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      backgroundColor: c.overlay,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px5,
    },
    dishTagText: { fontSize: fontSize.sm, color: c.white, fontWeight: fontWeight.medium },

    // Actions bar
    actionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    actionsLeft: { flexDirection: 'row', gap: spacing[4], alignItems: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], padding: spacing[1] },
    actionCount: { fontSize: fontSize.sm, color: c.text3 },
    followPill: {
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border2,
    },
    followText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text },

    // Post preview card
    postCard: {
      backgroundColor: c.bg,
      borderRadius: radius.lg2,
      marginHorizontal: spacing[3],
      marginTop: spacing[2],
      paddingBottom: spacing[4],
    },

    // Content
    content: { padding: spacing[4], paddingBottom: spacing.px10, gap: spacing.px9 },
    creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.px9 },
    handle: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text },
    timestamp: { fontSize: fontSize.xs, color: c.text3, marginTop: spacing.px1 },
    postTitle: {
      fontSize: fontSize.title,
      fontWeight: fontWeight.extrabold,
      color: c.text,
      lineHeight: lineHeight.titleRelaxed,
    },
    placeholder: { color: c.text3 },
    postBody: { fontSize: fontSize.base, color: c.text2, lineHeight: lineHeight.loose },

    // Location
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.px5 },
    locationText: { fontSize: fontSize.bodySm, color: c.text2 },

    // Meta
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px6 },
    metaPill: {
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing[1],
      borderWidth: 0.5,
      borderColor: c.border,
    },
    metaPillText: { fontSize: fontSize.sm, color: c.text2 },

    // Community intel
    intelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px6 },
    intelPill: {
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing[1],
      borderWidth: 0.5,
      borderColor: c.border,
    },
    intelPillText: { fontSize: fontSize.sm, color: c.text2 },

    // Hashtags
    hashtags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px5, paddingBottom: spacing[1] },
    hashtag: { fontSize: fontSize.bodySm, color: c.info },

    // Audience card
    audienceCard: {
      marginHorizontal: spacing[4],
      marginTop: spacing[3],
      backgroundColor: c.bg,
      borderRadius: radius.lg2,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: spacing[4],
    },
    audienceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.px14,
    },
    audienceLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.px9 },
    audienceRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.px5 },
    audienceLabel: { fontSize: fontSize.base, color: c.text, fontWeight: fontWeight.medium },
    audienceValue: { fontSize: fontSize.base, color: c.text2 },

    // Footer (CTA only)
    footer: { paddingHorizontal: spacing[4], paddingTop: spacing[3], gap: spacing.px10 },
    editRow: { flexDirection: 'row', gap: spacing.px10, paddingHorizontal: spacing[4] },
    editBtn: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      gap: spacing.px6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editBtnText: { fontSize: fontSize.sm, color: c.text3, fontWeight: fontWeight.medium },
    saveDraftBtn: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill2,
      borderWidth: 1,
      borderColor: c.border,
    },
    saveDraftBtnDisabled: { opacity: 0.5 },
    saveDraftText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text2 },
    confidenceText: { fontSize: fontSize.xs, color: c.text3, textAlign: 'center' },
    postBtn: {
      minHeight: 52,
      borderRadius: radius.pill2,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing[2],
      backgroundColor: c.accent,
    },
    postBtnDisabled: { opacity: 0.5 },
    postBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.white },
  })
}
