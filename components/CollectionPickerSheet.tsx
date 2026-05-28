import { useMemo, useState } from 'react'
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { PlusIcon } from '@/components/icons'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import type { Collection } from '@/lib/services/collections'

type Props = {
  visible: boolean
  title?: string
  collections: Collection[]
  loading?: boolean
  onDismiss: () => void
  onSelect: (collectionId: string) => void
  onCreate: (name: string) => void
}

export function CollectionPickerSheet({
  visible,
  title = 'Add to collection',
  collections,
  loading = false,
  onDismiss,
  onSelect,
  onCreate,
}: Props) {
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  function submitCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
    setName('')
    setCreating(false)
  }

  return (
    <>
      <RekkusActionSheet
        visible={visible && !creating}
        title={title}
        subtitle="Collections organise saved items and stay private unless you share them later."
        options={[
          {
            label: 'New collection',
            value: '__create__',
            icon: <PlusIcon size={18} color={colors.text2} />,
          },
          ...collections.map(collection => ({
            label: collection.name,
            value: collection.id,
            loading,
          })),
        ]}
        onSelect={value => {
          if (value === '__create__') {
            setCreating(true)
            return
          }
          onSelect(value)
        }}
        onDismiss={onDismiss}
      />
      <Modal
        visible={visible && creating}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setCreating(false)}
        accessibilityViewIsModal
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setCreating(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss new collection"
        />
        <View style={styles.card}>
          <Text style={styles.title}>New private collection</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Collection name"
            placeholderTextColor={colors.text3}
            style={styles.input}
            maxLength={80}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submitCreate}
          />
          <TouchableOpacity style={styles.primary} onPress={submitCreate} accessibilityRole="button">
            <Text style={styles.primaryText}>Create and add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => setCreating(false)} accessibilityRole="button">
            <Text style={styles.secondaryText}>Back</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.overlay },
    card: {
      position: 'absolute',
      bottom: spacing.px40,
      left: spacing[4],
      right: spacing[4],
      borderRadius: radius.lg3,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      backgroundColor: c.bg,
      padding: spacing[5],
      gap: spacing[3],
    },
    title: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text },
    input: {
      minHeight: 48,
      borderRadius: radius.lg,
      borderWidth: spacing.hairline,
      borderColor: c.border2,
      backgroundColor: c.surface,
      color: c.text,
      paddingHorizontal: spacing[3],
      fontSize: fontSize.md,
    },
    primary: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.lg,
      backgroundColor: c.text,
    },
    primaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.bg },
    secondary: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.lg,
      backgroundColor: c.surface,
    },
    secondaryText: { fontSize: fontSize.md, color: c.text2 },
  })
}
