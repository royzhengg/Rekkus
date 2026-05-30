import { StyleSheet } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import type { useThemeColors } from '@/lib/contexts/ThemeContext'

export function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    choiceHeader: {
      minHeight: 56,
      justifyContent: 'center',
      paddingHorizontal: spacing[5],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    choiceTitle: { fontSize: fontSize['2.5xl'], fontWeight: fontWeight.extrabold, color: c.text },
    choiceScroll: { flex: 1 },
    choiceContent: { padding: spacing[5], paddingBottom: spacing.px40, gap: spacing[3] },
    newPostCard: {
      borderRadius: radius.sm3,
      backgroundColor: c.text,
      paddingHorizontal: spacing.px18,
      paddingVertical: spacing[4],
    },
    newPostTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.bg },
    newPostSub: { fontSize: fontSize.base, color: c.bg, opacity: 0.68, marginTop: spacing.px3 },
    choiceSectionHeader: {
      marginTop: spacing.px10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    choiceSectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
    choiceSectionAction: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: c.accent },
    choiceDraftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingVertical: spacing.px10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    choiceThumb: {
      width: 52,
      height: 52,
      borderRadius: radius.sm3,
      backgroundColor: c.surface2,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    choiceDraftInfo: { flex: 1 },
    choiceDraftTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text },
    choiceDraftMeta: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px3 },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      minHeight: 40,
      paddingHorizontal: spacing[0],
      marginLeft: -spacing.px6,
      width: 96,
    },
    backText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text2 },
    centerWrap: { alignItems: 'center', gap: spacing.px2 },
    stepTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
    stepProgress: { fontSize: fontSize.xs, color: c.text3, textAlign: 'center' },
    rightActions: {
      width: 96,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.px2,
    },
    draftsText: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.semibold,
      color: c.text2,
    },
    saveText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: c.accent,
    },
    saveTextDisabled: { color: c.text3, opacity: 0.55 },
    headerAction: {
      minWidth: 42,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextBtn: {
      minWidth: 42,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextBtnDisabled: { opacity: 0.5 },
    nextBtnText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: c.accent,
    },
    nextBtnTextDisabled: { color: c.text3 },
  })
}
