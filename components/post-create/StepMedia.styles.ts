import { StyleSheet } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing } from '@/constants/Typography'
import type { useThemeColors } from '@/lib/contexts/ThemeContext'

export function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    scroll: { flex: 1 },

    // ── Title ──────────────────────────────────────────────
    titleSection: {
      paddingHorizontal: spacing[6],
      paddingTop: spacing[6],
      paddingBottom: spacing[6],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    titleInput: {
      fontSize: fontSize['8xl'],
      fontWeight: fontWeight.semibold,
      color: c.text,
      padding: spacing[0],
      letterSpacing: letterSpacing.display,
    },
    titleMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing[3],
    },
    titleMetaLabel: { fontSize: fontSize.bodySm, color: c.text3 },
    charCount: { fontSize: fontSize.bodySm, color: c.text3 },

    // ── Section label (RESTAURANT / MEDIA / RECENTS) ───────
    sectionLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.text3,
      textTransform: 'uppercase',
      letterSpacing: letterSpacing.widest,
      marginBottom: spacing[3],
    },

    // ── Media section (flex: 1 container) ─────────────────
    mediaSection: {
      paddingHorizontal: spacing[6],
      paddingTop: spacing.px22,
      paddingBottom: spacing[0],
      flex: 1,
      flexDirection: 'column',
    },

    // Empty state (fills remaining space)
    photoEmpty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px10,
    },
    photoEmptySub: {
      fontSize: fontSize.base,
      color: c.text3,
      textAlign: 'center',
    },

    // Solid accent CTA button (centered, wraps content)
    mediaAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[1],
      minHeight: 44,
      paddingHorizontal: spacing[6],
      paddingVertical: spacing.px11,
      borderRadius: radius.md3,
      backgroundColor: c.accent,
      alignSelf: 'center',
      marginTop: spacing[5],
      marginBottom: spacing[3],
    },
    mediaAddBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: '#fff' }, // check:tokens-ignore

    // ── Media populated (DraggableMediaStrip) ─────────────
    photosSection: { marginTop: spacing.px14 },
    photoActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[6], marginTop: spacing.px10 },
    photoActionBtn: { paddingVertical: spacing[1], paddingHorizontal: spacing.px2, minHeight: 44, justifyContent: 'center' },
    photoActionText: { fontSize: fontSize.bodySm, color: c.text3 },
    photoOnlyHint: { fontSize: fontSize.sm, color: c.text3, paddingHorizontal: spacing[6], paddingTop: spacing[2] },
    dishTagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px6, paddingHorizontal: spacing[6], paddingTop: spacing.px10 },
    dishTagChip: {
      overflow: 'hidden',
      borderRadius: radius.lg,
      backgroundColor: `${c.accent}12`,
      color: c.accent,
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.semibold,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px5,
    },

    // ── Dish tag tooltip ───────────────────────────────────
    dishTagTooltip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      marginHorizontal: spacing[6],
      marginTop: spacing.px10,
      backgroundColor: `${c.accent}12`,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px13,
      paddingVertical: spacing.px10,
      borderWidth: 0.5,
      borderColor: `${c.accent}24`,
    },
    dishTagTooltipText: { flex: 1, fontSize: fontSize.bodySm, color: c.text2 },
    dishTagTooltipDismiss: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

    // ── Recents strip ──────────────────────────────────────
    recentPhotosWrap: {
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingTop: spacing.px14,
    },
    recentPhotosTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.text3,
      textTransform: 'uppercase',
      letterSpacing: letterSpacing.widest,
      marginBottom: spacing[2],
    },
    recentPhotosGrid: {
      flexDirection: 'row',
      gap: spacing.px7,
    },
    recentPhotoButton: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: radius.md3,
      overflow: 'hidden',
      backgroundColor: c.surface2,
    },
    recentPhotoImage: { width: '100%', height: '100%' },
    recentPhotoSkeleton: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: radius.md3,
      backgroundColor: c.surface2,
    },

    // ── Dish tag modal ─────────────────────────────────────
    tagModalContainer: { flex: 1, backgroundColor: c.bg, alignItems: 'center' },
    tagModalHeader: {
      width: '100%',
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[5],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    tagModalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text },
    tagModalDone: { padding: spacing[1] },
    tagModalDoneText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.accent },
    tagModalHint: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      paddingHorizontal: spacing[5],
      paddingTop: spacing.px14,
      paddingBottom: spacing[1],
      alignSelf: 'flex-start',
    },
    tagPhotoStrip: { gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
    tagPhotoThumb: { width: 52, height: 52, borderRadius: radius.sm3, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
    tagPhotoThumbActive: { borderColor: c.accent },
    tagPhotoThumbImg: { width: '100%', height: '100%' },
    tagPhotoArea: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: c.surface2,
      position: 'relative',
      marginTop: spacing[2],
    },
    tagHint: {
      position: 'absolute',
      bottom: 10,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)', // check:tokens-ignore
      borderRadius: radius.sm3,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing[1],
    },
    tagHintText: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.85)' }, // check:tokens-ignore
    tagList: { width: '100%', paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing.px10 },
    tagListItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    tagListDot: { width: 6, height: 6, borderRadius: radius.tiny, backgroundColor: c.accent },
    tagListName: { flex: 1, fontSize: fontSize.base, color: c.text },
  })
}
