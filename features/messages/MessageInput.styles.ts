import { StyleSheet } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import type { useThemeColors } from '@/lib/contexts/ThemeContext'

export function makeMessageInputStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    replyBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.px10, paddingHorizontal: spacing.px14, paddingVertical: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.surface },
    replyBarAccent: { width: 3, alignSelf: 'stretch', borderRadius: radius.xxs, backgroundColor: c.accent },
    replyBarContent: { flex: 1, minWidth: 0 },
    replyBarLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.accent },
    replyBarText: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px1 },
    inputArea: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.bg, paddingVertical: spacing[2], paddingBottom: spacing.px10 },
    composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.px6, paddingHorizontal: spacing.px10 },
    attachBtn: { width: 36, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
    attachBtnActive: { backgroundColor: c.surface },
    attachmentTray: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.px14, paddingTop: spacing.px2, paddingBottom: spacing.px10 },
    trayAction: { alignItems: 'center', gap: spacing.px5, minWidth: 64 },
    trayIconWrap: { width: 44, height: 44, borderRadius: radius.pill2, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    trayActionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: c.text3 },
    gifTrayIcon: { fontSize: fontSize.bodySm, fontWeight: fontWeight.extrabold, color: c.accent, letterSpacing: 0 },
    input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: radius.pill, paddingHorizontal: spacing.px14, paddingTop: spacing.px10, paddingBottom: spacing.px10, backgroundColor: c.surface, color: c.text, fontSize: fontSize.md, lineHeight: lineHeight.body },
    sendBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    sendBtnActive: { backgroundColor: c.accent },
    sendBtnInactive: { backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border2 },
    pickerOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    pickerDismiss: { flex: 1 },
    pickerSheet: { backgroundColor: c.bg, borderTopLeftRadius: radius.pill, borderTopRightRadius: radius.pill, maxHeight: '70%' },
    gifSheet: { backgroundColor: c.bg, borderTopLeftRadius: radius.pill, borderTopRightRadius: radius.pill, height: '68%' },
    pickerHandle: { width: 36, height: 4, borderRadius: radius.xxs, backgroundColor: c.border2, alignSelf: 'center', marginTop: spacing.px10, marginBottom: spacing[2] },
    pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
    pickerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text },
    gifSearchWrap: { height: 40, marginHorizontal: spacing[4], marginBottom: spacing[3], borderRadius: radius.md3, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: c.surface },
    gifSearchInput: { flex: 1, fontSize: fontSize.md, color: c.text, paddingVertical: spacing[0] },
    gifGrid: { paddingHorizontal: spacing[3], paddingBottom: spacing.px26, gap: spacing[2] },
    gifGridRow: { gap: spacing[2] },
    gifTile: { flex: 1, height: 126, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface, marginBottom: spacing[2] },
    gifTileImage: { width: '100%', height: '100%' },
    gifState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.px28, paddingVertical: spacing.px36, gap: spacing[2] },
    gifStateTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text, textAlign: 'center' },
    gifStateBody: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center' },
    placeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
    placeRowIcon: { width: 36, height: 36, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
    placeRowText: { flex: 1, minWidth: 0 },
    placeRowName: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text },
    placeRowAddr: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
  })
}
