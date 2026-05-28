import { useMemo } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { BookmarkIcon } from '@/components/icons'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

type Notice = { title: string; subtitle?: string } | null

type Props = {
  saveSheet: boolean
  safetySheet: boolean
  shareSheet: boolean
  deleteConfirmVisible: boolean
  noticeSheet: Notice
  isOwner: boolean
  onDismissSave: () => void
  onViewSavedPosts: () => void
  onDismissSafety: () => void
  onSafetySelect: (value: string) => void
  onDismissDeleteConfirm: () => void
  onDeleteConfirm: () => void
  onDismissNotice: () => void
  onDismissShare: () => void
  onShareMessage: () => void
}

export function PostDetailSheets({
  saveSheet,
  safetySheet,
  shareSheet,
  deleteConfirmVisible,
  noticeSheet,
  isOwner,
  onDismissSave,
  onViewSavedPosts,
  onDismissSafety,
  onSafetySelect,
  onDismissDeleteConfirm,
  onDeleteConfirm,
  onDismissNotice,
  onDismissShare,
  onShareMessage,
}: Props) {
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <>
      <Modal visible={saveSheet} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onDismissSave}>
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={onDismissSave}
          accessibilityRole="button"
          accessibilityLabel="Dismiss saved post confirmation"
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetIcon}>
            <BookmarkIcon size={22} filled />
          </View>
          <Text style={styles.sheetTitle}>Post saved!</Text>
          <Text style={styles.sheetBody}>Added to your saved posts.</Text>
          <TouchableOpacity style={styles.sheetBtnPrimary} onPress={onViewSavedPosts} accessibilityRole="button">
            <Text style={styles.sheetBtnPrimaryText}>View saved posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetBtnSecondary} onPress={onDismissSave} accessibilityRole="button">
            <Text style={styles.sheetBtnSecondaryText}>Stay here</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <RekkusActionSheet
        visible={safetySheet}
        title={isOwner ? 'Post options' : 'Post safety'}
        subtitle={isOwner ? 'Edit or manage this post.' : 'Report content or block the creator.'}
        options={[
          ...(isOwner ? [
            { label: 'Edit post', value: 'edit_post', accentColor: colors.accent },
            { label: 'Delete post', value: 'delete_post', destructive: true },
          ] : [
            { label: 'Report post', value: 'report_post' },
            { label: 'Report creator', value: 'report_user' },
            { label: 'Block creator', value: 'block_user' },
          ]),
        ]}
        onSelect={onSafetySelect}
        onDismiss={onDismissSafety}
      />

      <RekkusActionSheet
        visible={deleteConfirmVisible}
        title="Delete post?"
        subtitle="This removes the post from public surfaces. This cannot be undone here."
        options={[
          { label: 'Keep post', value: 'keep' },
          { label: 'Delete post', value: 'delete', destructive: true },
        ]}
        onSelect={value => {
          if (value === 'delete') onDeleteConfirm()
        }}
        onDismiss={onDismissDeleteConfirm}
      />

      <RekkusActionSheet
        visible={noticeSheet != null}
        title={noticeSheet?.title}
        subtitle={noticeSheet?.subtitle}
        options={[{ label: 'Done', value: 'done' }]}
        onSelect={onDismissNotice}
        onDismiss={onDismissNotice}
      />

      <RekkusActionSheet
        visible={shareSheet}
        title="Share post"
        options={[{ label: 'Send via message', value: 'send_dm' }]}
        onSelect={value => {
          onDismissShare()
          if (value === 'send_dm') onShareMessage()
        }}
        onDismiss={onDismissShare}
      />
    </>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    sheetBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.overlay,
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.bg,
      borderTopLeftRadius: radius.pill,
      borderTopRightRadius: radius.pill,
      paddingHorizontal: spacing[5],
      paddingBottom: spacing.px36,
      paddingTop: spacing[3],
      alignItems: 'center',
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: radius.xxs,
      backgroundColor: c.border2,
      marginBottom: spacing[5],
    },
    sheetIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.pill3,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing[3],
    },
    sheetTitle: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.semibold,
      color: c.text,
      marginBottom: spacing.px6,
    },
    sheetBody: {
      fontSize: fontSize.base,
      color: c.text2,
      textAlign: 'center',
      marginBottom: spacing[6],
    },
    sheetBtnPrimary: {
      width: '100%',
      backgroundColor: c.text,
      borderRadius: radius.lg,
      paddingVertical: spacing.px14,
      alignItems: 'center',
      marginBottom: spacing.px10,
    },
    sheetBtnPrimaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.bg },
    sheetBtnSecondary: {
      width: '100%',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      paddingVertical: spacing.px14,
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: c.border,
    },
    sheetBtnSecondaryText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text2 },
  })
}
