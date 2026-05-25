import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { CheckIcon, CloseIcon, ImagePlaceholder } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { usePostUploadQueue } from '@/lib/contexts/PostUploadContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

export function PostUploadProgress({ onGoToDraft }: { onGoToDraft: () => void }) {
  const { jobs, clearJob } = usePostUploadQueue()
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const job = jobs[0]

  if (!job) return null

  const failed = job.status === 'failed'
  const posted = job.status === 'posted'
  const label =
    job.status === 'failed'
      ? 'Post failed'
      : job.status === 'posted'
        ? 'Posted'
        : job.status === 'publishing'
          ? 'Publishing...'
          : 'Posting...'

  return (
    <View style={[styles.wrap, failed && styles.wrapFailed]}>
      <View style={styles.thumb}>
        {job.coverUri ? (
          <CachedImage source={{ uri: job.coverUri }} style={StyleSheet.absoluteFillObject} />
        ) : (
          <ImagePlaceholder size={18} color={c.text3} />
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.titleRow}>
            {posted ? <CheckIcon size={13} color={c.accent} /> : null}
            <Text style={[styles.title, failed && styles.titleFailed]}>{label}</Text>
          </View>
          {failed && (
            <View style={styles.failedActions}>
              <TouchableOpacity
                style={styles.goToDraftBtn}
                onPress={() => { clearJob(job.id); onGoToDraft() }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Go to draft to retry posting"
              >
                <Text style={styles.goToDraftText}>Go to draft</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dismissXBtn}
                onPress={() => clearJob(job.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss upload error"
              >
                <CloseIcon size={8} color={c.liked} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={styles.sub} numberOfLines={1}>{job.error ?? job.title}</Text>
        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              failed && styles.barFillFailed,
              { width: `${Math.max(8, Math.round(job.progress * 100))}%` },
            ]}
          />
        </View>
      </View>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    wrap: {
      marginHorizontal: spacing[3],
      marginTop: spacing.px10,
      marginBottom: spacing.px2,
      borderRadius: radius.md3,
      backgroundColor: c.bg,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: spacing.px10,
      flexDirection: 'row',
      gap: spacing.px10,
      alignItems: 'center',
    },
    wrapFailed: {
      borderColor: `${c.liked}33`,
      backgroundColor: `${c.liked}06`,
    },
    thumb: {
      width: 42,
      height: 42,
      borderRadius: radius.sm3,
      overflow: 'hidden',
      backgroundColor: c.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { flex: 1, gap: spacing[1] },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.px10 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.px5 },
    title: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: c.text },
    titleFailed: { color: c.liked },
    sub: { fontSize: fontSize.bodySm, color: c.text3 },
    failedActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    goToDraftBtn: {
      borderRadius: radius.md4,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing.px5,
      backgroundColor: `${c.liked}0D`,
    },
    goToDraftText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.extrabold, color: c.liked },
    dismissXBtn: { padding: spacing.px5 },
    bar: { height: 4, borderRadius: radius.xxs, backgroundColor: c.border, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: radius.xxs, backgroundColor: c.accent },
    barFillFailed: { backgroundColor: c.liked },
  })
}
