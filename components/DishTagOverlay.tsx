import { useState, useMemo, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
  type GestureResponderEvent,
} from 'react-native'
import { CloseIcon } from '@/components/icons'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { DishTag } from '@/types/domain'

interface Props {
  tags: DishTag[]
  photoIndex: number
  onAddTag: (tag: DishTag) => void
  onRemoveTag: (index: number) => void
  onMoveTag: (index: number, x: number, y: number) => void
  editable?: boolean
}

type ChipProps = {
  tag: DishTag
  absoluteIndex: number
  size: { width: number; height: number }
  editable: boolean | undefined
  onRemove: (i: number) => void
  onMove: (i: number, x: number, y: number) => void
  styles: ReturnType<typeof makeStyles>
}

function DraggableChip({ tag, absoluteIndex, size, editable, onRemove, onMove, styles }: ChipProps) {
  const offsetX = useRef(new Animated.Value(0)).current
  const offsetY = useRef(new Animated.Value(0)).current
  const stateRef = useRef({ tag, absoluteIndex, size, editable, onRemove, onMove })
  stateRef.current = { tag, absoluteIndex, size, editable, onRemove, onMove }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!stateRef.current.editable,
      onMoveShouldSetPanResponder: (_, gs) =>
        !!stateRef.current.editable && (Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3),
      onPanResponderGrant: () => {
        offsetX.setValue(0)
        offsetY.setValue(0)
      },
      onPanResponderMove: (_, gs) => {
        offsetX.setValue(gs.dx)
        offsetY.setValue(gs.dy)
      },
      onPanResponderRelease: (_, gs) => {
        const { tag: t, absoluteIndex: ai, size: s, onMove: mv } = stateRef.current
        const baseX = t.x * s.width
        const baseY = t.y * s.height
        const newX = Math.max(0.02, Math.min(0.96, (baseX + gs.dx) / s.width))
        const newY = Math.max(0.02, Math.min(0.96, (baseY + gs.dy) / s.height))
        offsetX.setValue(0)
        offsetY.setValue(0)
        mv(ai, newX, newY)
      },
    })
  ).current

  const baseX = tag.x * size.width
  const baseY = tag.y * size.height

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.chip,
        {
          left: baseX - 4,
          top: baseY - 10,
          transform: [{ translateX: offsetX }, { translateY: offsetY }],
        },
      ]}
    >
      <View style={styles.chipDot} />
      <Text style={styles.chipText} numberOfLines={1}>
        {tag.name}
      </Text>
      {editable && (
        <TouchableOpacity
          onPress={() => stateRef.current.onRemove(stateRef.current.absoluteIndex)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${tag.name} tag`}
        >
          <CloseIcon size={7} color="rgba(255,255,255,0.9)" /* check:tokens-ignore */ />
        </TouchableOpacity>
      )}
    </Animated.View>
  )
}

export default function DishTagOverlay({
  tags,
  photoIndex,
  onAddTag,
  onRemoveTag,
  onMoveTag,
  editable,
}: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const [nameInput, setNameInput] = useState('')

  const visibleTags = useMemo(
    () => tags.map((tag, i) => ({ tag, absoluteIndex: i })).filter(({ tag }) => tag.photoIndex === photoIndex),
    [tags, photoIndex]
  )

  function handleTap(e: GestureResponderEvent) {
    if (!editable || !size.width) return
    const x = e.nativeEvent.locationX / size.width
    const y = e.nativeEvent.locationY / size.height
    setPending({ x, y })
    setNameInput('')
  }

  function handleConfirm() {
    if (!pending || !nameInput.trim()) {
      setPending(null)
      return
    }
    onAddTag({ photoIndex, x: pending.x, y: pending.y, name: nameInput.trim() })
    setPending(null)
    setNameInput('')
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={e => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {editable && <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />}

      {visibleTags.map(({ tag, absoluteIndex }) => (
        <DraggableChip
          key={absoluteIndex}
          tag={tag}
          absoluteIndex={absoluteIndex}
          size={size}
          editable={editable}
          onRemove={onRemoveTag}
          onMove={onMoveTag}
          styles={styles}
        />
      ))}

      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        onRequestClose={() => setPending(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPending(null)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'position' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Tag a dish</Text>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Dish name…"
              placeholderTextColor={c.text3}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
              maxLength={50}
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPending(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, !nameInput.trim() && styles.addBtnDisabled]}
                onPress={handleConfirm}
                disabled={!nameInput.trim()}
              >
                <Text style={styles.addBtnText}>Add tag</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    chip: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.62)', // check:tokens-ignore
      borderRadius: radius.pill,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      gap: spacing[1],
      maxWidth: 140,
    },
    chipDot: {
      width: 5,
      height: 5,
      borderRadius: radius.tiny,
      backgroundColor: c.white,
      flexShrink: 0,
    },
    chipText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.white,
      flex: 1,
    },
    backdrop: { flex: 1, backgroundColor: c.overlay },
    sheetWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: radius.pill,
      borderTopRightRadius: radius.pill,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingHorizontal: spacing[5],
      paddingTop: spacing[3],
      paddingBottom: spacing.px40,
      gap: spacing.px14,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: radius.xxs,
      backgroundColor: c.border2,
      alignSelf: 'center',
      marginBottom: spacing[1],
    },
    sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: c.text },
    input: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
      fontSize: fontSize.md,
      color: c.text,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    sheetActions: { flexDirection: 'row', gap: spacing.px10 },
    cancelBtn: {
      flex: 1,
      paddingVertical: spacing.px13,
      borderRadius: radius.pill,
      borderWidth: 0.5,
      borderColor: c.border2,
      alignItems: 'center',
    },
    cancelBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text2 },
    addBtn: {
      flex: 1,
      paddingVertical: spacing.px13,
      borderRadius: radius.pill,
      backgroundColor: c.text,
      alignItems: 'center',
    },
    addBtnDisabled: { backgroundColor: c.surface2 },
    addBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.bg },
  })
}
