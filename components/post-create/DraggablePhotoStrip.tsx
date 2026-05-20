import {
  View,
  Image,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { useRef, useState, useMemo } from 'react'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { CloseIcon, PlusIcon } from '@/components/icons'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

const ITEM_SIZE = 96
const GAP = 8
const STRIDE = ITEM_SIZE + GAP

type Props = {
  photos: string[]
  onChange: (photos: string[]) => void
  onRemove: (index: number) => void
  onAdd?: () => void
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

export default function DraggablePhotoStrip({ photos, onChange, onRemove, onAdd }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const [dragging, setDragging] = useState<number | null>(null)
  const dragX = useRef(new Animated.Value(0)).current
  const shiftAnims = useRef<Animated.Value[]>([])
  while (shiftAnims.current.length < photos.length) {
    shiftAnims.current.push(new Animated.Value(0))
  }

  const photosRef = useRef(photos)
  photosRef.current = photos
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const hoverRef = useRef<number | null>(null)

  const panResponders = useRef<ReturnType<typeof PanResponder.create>[]>([])
  const prevLengthRef = useRef(-1)
  if (photos.length !== prevLengthRef.current) {
    prevLengthRef.current = photos.length
    panResponders.current = photos.map((_, i) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 6,
        onPanResponderGrant: () => {
          dragX.setValue(0)
          shiftAnims.current.forEach(a => a.setValue(0))
          hoverRef.current = i
          setDragging(i)
        },
        onPanResponderMove: (_, gs) => {
          dragX.setValue(gs.dx)
          const n = photosRef.current.length
          const newHover = clamp(Math.round((i * STRIDE + gs.dx) / STRIDE), 0, n - 1)
          if (newHover !== hoverRef.current) {
            hoverRef.current = newHover
            for (let j = 0; j < n; j++) {
              if (j === i) continue
              let shift = 0
              if (newHover > i && j > i && j <= newHover) shift = -STRIDE
              else if (newHover < i && j >= newHover && j < i) shift = STRIDE
              shiftAnims.current[j]?.setValue(shift)
            }
          }
        },
        onPanResponderRelease: (_, gs) => {
          const n = photosRef.current.length
          const to = clamp(Math.round((i * STRIDE + gs.dx) / STRIDE), 0, n - 1)
          if (to !== i) {
            const next = [...photosRef.current]
            const [item] = next.splice(i, 1)
            next.splice(to, 0, item)
            onChangeRef.current(next)
          }
          dragX.setValue(0)
          shiftAnims.current.forEach(a => a.setValue(0))
          hoverRef.current = null
          setDragging(null)
        },
      })
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={dragging === null}
      contentContainerStyle={styles.strip}
    >
      {photos.map((uri, i) => {
        const isDragging = i === dragging
        const translateX = isDragging ? dragX : (shiftAnims.current[i] ?? new Animated.Value(0))

        return (
          <Animated.View
            key={`${i}`}
            {...(panResponders.current[i]?.panHandlers ?? {})}
            style={[
              styles.item,
              i === 0 && styles.itemCover,
              isDragging && styles.itemDragging,
              { transform: [{ translateX }] },
            ]}
          >
            <Image source={{ uri }} style={styles.image} resizeMode="cover" />
            {i === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverText}>COVER</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => onRemove(i)}
              hitSlop={4}
            >
              <CloseIcon size={7} color="#fff" /* check:tokens-ignore */ />
            </TouchableOpacity>
          </Animated.View>
        )
      })}

      {onAdd && (
        <TouchableOpacity style={styles.addTile} onPress={onAdd}>
          <PlusIcon color={c.text3} />
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    strip: {
      gap: GAP,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[1],
    },
    item: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: c.surface2,
    },
    itemCover: {
      borderWidth: 2,
      borderColor: c.accent,
      borderRadius: radius.md2,
    },
    itemDragging: {
      opacity: 0.85,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 10,
    },
    image: { width: '100%', height: '100%' },
    coverBadge: {
      position: 'absolute',
      bottom: 5,
      left: 5,
      backgroundColor: c.accent,
      borderRadius: radius.xs,
      paddingHorizontal: spacing.px5,
      paddingVertical: spacing.px2,
    },
    coverText: { fontSize: fontSize['3xs'], fontWeight: fontWeight.bold, color: '#fff', letterSpacing: 0.5 }, // check:tokens-ignore
    removeBtn: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 18,
      height: 18,
      borderRadius: radius.sm4,
      backgroundColor: 'rgba(0,0,0,0.55)', // check:tokens-ignore
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTile: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.border2,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
