import { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

export function PostCardSkeleton() {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])

  return (
    <View
      style={styles.card}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Skeleton width="100%" height={220} radius={0} />
      <View style={styles.body}>
        <View style={styles.creatorRow}>
          <Skeleton width={24} height={24} radius={radius.full} />
          <Skeleton width="40%" height={12} />
        </View>
        <Skeleton width="85%" height={20} />
        <Skeleton width="60%" height={20} />
        <SkeletonText lines={2} />
        <View style={styles.footer}>
          <Skeleton width={48} height={12} />
        </View>
      </View>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    card: {
      overflow: 'hidden',
      backgroundColor: c.bg,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    body: { padding: spacing[3], gap: spacing[2] },
    creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    footer: {
      paddingTop: spacing[1],
      borderTopWidth: 0.5,
      borderTopColor: c.border,
    },
  })
}
