import { useMemo } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { usePostUploadQueue } from '@/lib/contexts/PostUploadContext'
import { CheckIcon, CloseIcon, ImagePlaceholder } from '@/components/icons'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

export function PostUploadProgress() {
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
          <Image source={{ uri: job.coverUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
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
            <TouchableOpacity style={styles.dismissBtn} onPress={() => clearJob(job.id)} hitSlop={8}>
              <CloseIcon size={8} color={c.liked} />
              <Text style={styles.retry}>Dismiss</Text>
            </TouchableOpacity>
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
    dismissBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      borderRadius: radius.md4,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing.px5,
      backgroundColor: `${c.liked}0D`,
    },
    retry: { fontSize: fontSize.bodySm, fontWeight: fontWeight.extrabold, color: c.liked },
    bar: { height: 4, borderRadius: radius.xxs, backgroundColor: c.border, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: radius.xxs, backgroundColor: c.accent },
    barFillFailed: { backgroundColor: c.liked },
  })
}
