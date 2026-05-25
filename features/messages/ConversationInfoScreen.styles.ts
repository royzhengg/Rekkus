import { StyleSheet } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import type { useThemeColors } from '@/lib/contexts/ThemeContext'

export function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { width: 36, alignItems: 'flex-start' },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text, textAlign: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { paddingBottom: spacing.px40 },

    // Profile / group header
    profileHeader: { alignItems: 'center', paddingTop: spacing.px28, paddingBottom: spacing[5], gap: spacing[2] },
    profileAvatar: { width: 80, height: 80, borderRadius: radius.round40 },
    profileAvatarText: { fontSize: fontSize['8xl'], fontWeight: fontWeight.bold },
    profileName: { fontSize: fontSize['2.5xl'], fontWeight: fontWeight.bold, color: c.text, textAlign: 'center' },
    profileSub: { fontSize: fontSize.base, color: c.text3 },

    // Tabs
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      marginBottom: spacing[2],
    },
    tab: { flex: 1, paddingVertical: spacing[3], alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: c.text },
    tabLabel: { fontSize: fontSize.base, color: c.text3, fontWeight: fontWeight.medium },
    tabLabelActive: { color: c.text, fontWeight: fontWeight.semibold },

    // Members
    section: { paddingHorizontal: spacing[4] },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.px11,
      gap: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    memberAvatar: { width: 44, height: 44, borderRadius: radius.pill2 },
    memberText: { flex: 1 },
    memberName: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: c.text },
    memberUsername: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px1 },
    adminBadge: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: c.text2,
      borderWidth: 1,
      borderColor: c.border2,
      paddingHorizontal: spacing.px6,
      paddingVertical: spacing.px2,
      borderRadius: radius.xs,
    },
    youBadge: { fontSize: fontSize.xs, color: c.text3 },
    memberAction: { padding: spacing[1] },
    memberActionLabel: { fontSize: fontSize.md, color: c.text3 },

    // Media
    mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px2, padding: spacing.px2 },
    mediaThumb: { width: '33.33%', aspectRatio: 1, position: 'relative' },
    mediaThumbImage: { width: '100%', height: '100%' },
    mediaThumbFallback: { backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    videoOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.overlay,
    },
    videoOverlayIcon: { fontSize: fontSize['3xl'], color: c.white },

    // Pinned messages
    pinnedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    pinnedContent: { flex: 1 },
    pinnedPreview: { fontSize: fontSize.md, color: c.text },
    pinnedDate: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px2 },
    unpinBtn: { padding: spacing[2] },

    // Empty
    emptySection: { paddingVertical: spacing.px40, alignItems: 'center' },
    emptyLabel: { fontSize: fontSize.base, color: c.text3 },

    // Actions
    actionsSection: {
      marginTop: spacing[6],
      marginHorizontal: spacing[4],
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    sectionLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: c.text3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing[2],
      paddingHorizontal: spacing[4],
      paddingTop: spacing[1],
    },
    actionRow: {
      paddingVertical: spacing.px14,
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    actionRowDestructive: { borderBottomWidth: 0 },
    actionLabel: { fontSize: fontSize.lg, color: c.text },
    actionLabelDestructive: { color: c.actionDelete },

    // Mute sheet
    muteOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
    muteSheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: radius.pill,
      borderTopRightRadius: radius.pill,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[5],
      paddingBottom: spacing.px36,
    },
    muteTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: c.text, marginBottom: spacing[4] },
    muteOption: {
      paddingVertical: spacing.px14,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    muteOptionLabel: { fontSize: fontSize.lg, color: c.text },
    muteCancelBtn: { marginTop: spacing[3], alignItems: 'center' },
    muteCancelLabel: { fontSize: fontSize.lg, color: c.text3 },
  })
}
