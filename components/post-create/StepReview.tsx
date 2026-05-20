import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native'
import { useMemo } from 'react'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { PostPicksSummary } from '@/components/post/PostPicksSummary'
import { BookmarkIcon, CheckIcon, EditIcon, ImagePlaceholder, PinIcon, VideoIcon } from '@/components/icons'
import { PostMediaCarousel } from '@/components/post/PostMediaCarousel'
import { Avatar } from '@/components/Avatar'
import type { PostMedia, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'
import type { SelectedPlace } from '@/lib/services/restaurants'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

type Props = {
  title: string
  body: string
  media: PostMedia[]
  selectedPlace: SelectedPlace | null
  foodRating: number
  vibeRating: number
  costRating: number
  tasteVerdict?: RekkusTasteVerdict
  valueVerdict?: RekkusValueVerdict
  occasionTags?: RekkusOccasionTag[]
  cuisineType: string
  bestDish: string
  hashtags: string[]
  onEditBasics: () => void
  onEditDetails: () => void
  onPost: () => void
  onSaveDraft: () => void
  primaryLabel?: string
  posting: boolean
  savingDraft: boolean
}

export default function StepReview({
  title,
  body,
  media,
  selectedPlace,
  tasteVerdict,
  valueVerdict,
  occasionTags,
  cuisineType,
  bestDish,
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

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Media */}
      <View style={[styles.photo, { width: screenWidth }]}>
        {media.length > 0 ? (
          <PostMediaCarousel
            media={media}
            height={screenWidth * (3 / 4)}
          />
        ) : firstMedia?.type === 'video' ? (
          <View style={[styles.photoEmpty, { width: screenWidth, height: screenWidth * (3 / 4) }]}>
            <VideoIcon size={42} color={c.accent} />
            <Text style={styles.photoEmptyText}>Video ready</Text>
          </View>
        ) : (
          <View style={[styles.photoEmpty, { width: screenWidth, height: screenWidth * (3 / 4) }]}>
            <ImagePlaceholder size={40} color={c.text3} />
            <Text style={styles.photoEmptyText}>No media added</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Creator row */}
        <View style={styles.creatorRow}>
          <Avatar initials="ME" bg={c.ratingBg} color={c.ratingText} size={32} />
          <View>
            <Text style={styles.handle}>@you</Text>
            <Text style={styles.timestamp}>Just now</Text>
          </View>
        </View>

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
          />
        )}

        {/* Location */}
        {selectedPlace && (
          <View style={styles.locationRow}>
            <View style={styles.locationPill}>
              <PinIcon size={11} />
              <Text style={styles.locationText}>{selectedPlace.name}</Text>
            </View>
          </View>
        )}

        {/* Cuisine + best dish */}
        {(cuisineType || bestDish.trim().length > 0) && (
          <View style={styles.metaRow}>
            {cuisineType ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{cuisineType}</Text>
              </View>
            ) : null}
            {bestDish.trim().length > 0 ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>🍜 {bestDish}</Text>
              </View>
            ) : null}
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

      {/* Edit + post */}
      <View style={styles.footer}>
        <View style={styles.editRow}>
          <TouchableOpacity style={styles.editBtn} onPress={onEditBasics}>
            <EditIcon size={14} color={c.text2} />
            <Text style={styles.editBtnText}>Edit media</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={onEditDetails}>
            <EditIcon size={14} color={c.text2} />
            <Text style={styles.editBtnText}>Edit review</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.saveDraftBtn, (savingDraft || posting) && styles.saveDraftBtnDisabled]}
          onPress={onSaveDraft}
          disabled={savingDraft || posting}
          activeOpacity={0.75}
        >
          <BookmarkIcon size={15} inactiveColor={c.text2} />
          <Text style={styles.saveDraftText}>{savingDraft ? 'Saving draft…' : 'Save draft'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.postBtn, posting && styles.postBtnDisabled]}
          onPress={onPost}
          disabled={posting}
          activeOpacity={0.86}
        >
          {posting ? (
            <ActivityIndicator color={c.bg} size="small" />
          ) : (
            <>
              <CheckIcon size={16} color={c.bg} />
              <Text style={styles.postBtnText}>{primaryLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    scroll: { flex: 1 },

    // Photo
    photo: { backgroundColor: c.surface },
    photoEmpty: {
      backgroundColor: `${c.accent}08`,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
    },
    photoEmptyText: { fontSize: fontSize.base, color: c.text3 },

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

    // Content
    content: { padding: spacing[4], paddingBottom: spacing[0], gap: spacing.px9 },
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
    locationRow: { flexDirection: 'row', alignItems: 'center' },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      alignSelf: 'flex-start',
      backgroundColor: `${c.accent}10`,
      borderRadius: radius.pill,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px5,
      borderWidth: 0.5,
      borderColor: `${c.accent}24`,
    },
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

    // Hashtags
    hashtags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px5, paddingBottom: spacing[1] },
    hashtag: { fontSize: fontSize.bodySm, color: c.info },

    // Footer
    footer: { paddingHorizontal: spacing[4], paddingTop: spacing.px18, gap: spacing.px10 },
    editRow: { flexDirection: 'row', gap: spacing.px10 },
    editBtn: {
      flex: 1,
      minHeight: 42,
      borderRadius: radius.pill,
      borderWidth: 0.5,
      borderColor: c.border,
      backgroundColor: c.bg,
      flexDirection: 'row',
      gap: spacing.px6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editBtnText: { fontSize: fontSize.base, color: c.text2, fontWeight: fontWeight.extrabold },
    saveDraftBtn: {
      minHeight: 46,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.px7,
      backgroundColor: c.bg,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    saveDraftBtnDisabled: { opacity: 0.5 },
    saveDraftText: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text2 },
    postBtn: {
      minHeight: 52,
      borderRadius: radius.pill2,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing[2],
      backgroundColor: c.text,
    },
    postBtnDisabled: { opacity: 0.5 },
    postBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.bg },
  })
}
