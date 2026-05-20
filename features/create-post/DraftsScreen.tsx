import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import {
  deleteCreatePostDraft,
  duplicateCreatePostDraft,
  listSavedCreatePostDrafts,
  type CreatePostDraftSummary,
} from '@/lib/services/postDrafts'
import { CopyIcon, ChevronLeft, ImagePlaceholder, TrashIcon } from '@/components/icons'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

export default function DraftsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [drafts, setDrafts] = useState<CreatePostDraftSummary[]>([])
  const [deleteDraftId, setDeleteDraftId] = useState<string | null>(null)

  async function refresh() {
    setDrafts(await listSavedCreatePostDrafts(user?.id))
  }

  useEffect(() => {
    if (user?.id) refresh()
  }, [user?.id])

  async function removeDraft(id: string) {
    await deleteCreatePostDraft(id)
    refresh()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <ChevronLeft size={16} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Drafts</Text>
        <View style={styles.back} />
      </View>
      {drafts.length === 0 ? (
        <View style={styles.empty}>
          <ImagePlaceholder size={34} />
          <Text style={styles.emptyTitle}>No drafts yet</Text>
          <Text style={styles.emptySub}>Reviews you explicitly save as drafts will appear here on every device.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {drafts.map(draft => (
            <TouchableOpacity
              key={draft.id}
              style={styles.row}
              onPress={() => router.replace({ pathname: '/(tabs)/create', params: { draftId: draft.id } })}
            >
              <View style={styles.thumb}>
                {draft.coverUri ? (
                  <Image source={{ uri: draft.coverUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                  <ImagePlaceholder size={18} />
                )}
              </View>
              <View style={styles.info}>
                <Text style={styles.rowTitle} numberOfLines={1}>{draft.title}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {[draft.restaurantName, `${draft.mediaCount} media`, new Date(draft.lastSavedAt ?? draft.updatedAt).toLocaleDateString()]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionPill}
                  onPress={async () => {
                    await duplicateCreatePostDraft(draft.id)
                    refresh()
                  }}
                >
                  <CopyIcon size={12} color={c.accent} />
                  <Text style={styles.actionText}>Duplicate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionPill, styles.deletePill]} onPress={() => setDeleteDraftId(draft.id)}>
                  <TrashIcon size={12} color={c.liked} />
                  <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <RekkusActionSheet
        visible={deleteDraftId != null}
        title="Delete draft?"
        subtitle="This removes the draft from your saved drafts. Your published posts will not be affected."
        options={[
          { label: 'Keep draft', value: 'keep' },
          { label: 'Delete draft', value: 'delete', destructive: true },
        ]}
        onSelect={value => {
          if (value === 'delete' && deleteDraftId) {
            removeDraft(deleteDraftId)
          }
        }}
        onDismiss={() => setDeleteDraftId(null)}
      />
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    back: { width: 82, flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    backText: { fontSize: fontSize.md, color: c.text2 },
    title: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.text },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingHorizontal: spacing.px30 },
    emptyTitle: { fontSize: fontSize.title, fontWeight: fontWeight.extrabold, color: c.text },
    emptySub: { fontSize: fontSize.base, color: c.text3, textAlign: 'center' },
    list: { paddingTop: spacing[2], paddingHorizontal: spacing[3], gap: spacing[2] },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing[3],
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radius.md3,
      backgroundColor: c.bg,
    },
    thumb: {
      width: 58,
      height: 58,
      borderRadius: radius.sm3,
      backgroundColor: c.surface2,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: { flex: 1 },
    rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text },
    rowMeta: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px3 },
    actions: { alignItems: 'flex-end', gap: spacing[2] },
    actionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      borderRadius: radius.md4,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing.px5,
      backgroundColor: `${c.accent}0D`,
    },
    deletePill: { backgroundColor: `${c.liked}0D` },
    actionText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.extrabold, color: c.accent },
    deleteText: { color: c.liked },
  })
}
