import {
  Animated,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useMemo, useRef, useState } from 'react'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { CloseIcon, ImagePlaceholder, VideoIcon } from '@/components/icons'
import type { PostMedia } from '@/types/domain'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

const ITEM_WIDTH = 132
const ITEM_HEIGHT = 176
const GAP = 10
const STRIDE = ITEM_WIDTH + GAP

type Props = {
  media: PostMedia[]
  onChange: (media: PostMedia[]) => void
  onRemove: (index: number) => void
  onAdd?: () => void
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export default function DraggableMediaStrip({ media, onChange, onRemove, onAdd }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [dragging, setDragging] = useState<number | null>(null)
  const dragX = useRef(new Animated.Value(0)).current
  const shiftAnims = useRef<Animated.Value[]>([])

  while (shiftAnims.current.length < media.length) {
    shiftAnims.current.push(new Animated.Value(0))
  }

  const mediaRef = useRef(media)
  mediaRef.current = media
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const hoverRef = useRef<number | null>(null)

  const panResponders = useRef<ReturnType<typeof PanResponder.create>[]>([])
  const prevLengthRef = useRef(-1)
  if (media.length !== prevLengthRef.current) {
    prevLengthRef.current = media.length
    panResponders.current = media.map((_, i) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6,
        onPanResponderGrant: () => {
          dragX.setValue(0)
          shiftAnims.current.forEach(anim => anim.setValue(0))
          hoverRef.current = i
          setDragging(i)
        },
        onPanResponderMove: (_, gesture) => {
          dragX.setValue(gesture.dx)
          const count = mediaRef.current.length
          const nextHover = clamp(Math.round((i * STRIDE + gesture.dx) / STRIDE), 0, count - 1)
          if (nextHover !== hoverRef.current) {
            hoverRef.current = nextHover
            for (let j = 0; j < count; j++) {
              if (j === i) continue
              let shift = 0
              if (nextHover > i && j > i && j <= nextHover) shift = -STRIDE
              if (nextHover < i && j >= nextHover && j < i) shift = STRIDE
              shiftAnims.current[j]?.setValue(shift)
            }
          }
        },
        onPanResponderRelease: (_, gesture) => {
          const count = mediaRef.current.length
          const to = clamp(Math.round((i * STRIDE + gesture.dx) / STRIDE), 0, count - 1)
          if (to !== i) {
            const next = [...mediaRef.current]
            const [item] = next.splice(i, 1)
            next.splice(to, 0, item)
            onChangeRef.current(next)
          }
          dragX.setValue(0)
          shiftAnims.current.forEach(anim => anim.setValue(0))
          hoverRef.current = null
          setDragging(null)
        },
        onPanResponderTerminate: () => {
          dragX.setValue(0)
          shiftAnims.current.forEach(anim => anim.setValue(0))
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
      {media.map((item, index) => {
        const isDragging = index === dragging
        const translateX = isDragging ? dragX : (shiftAnims.current[index] ?? new Animated.Value(0))
        const previewUri = item.thumbnailUrl ?? item.processedUrl ?? item.uri

        return (
          <Animated.View
            key={item.localId || item.uri}
            {...(panResponders.current[index]?.panHandlers ?? {})}
            style={[
              styles.mediaTile,
              index === 0 && styles.coverTile,
              isDragging && styles.draggingTile,
              { transform: [{ translateX }] },
            ]}
          >
            {item.type === 'image' ? (
              <Image source={{ uri: previewUri }} style={styles.mediaTileImage} resizeMode="cover" />
            ) : (
              <View style={styles.mediaTileVideo}>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.mediaTileImage} resizeMode="cover" />
                ) : (
                  <>
                    <VideoIcon size={24} color={c.accent} />
                    <Text style={styles.mediaTileVideoText}>Video</Text>
                  </>
                )}
                <View style={styles.videoBadge}>
                  <VideoIcon size={10} color="#fff" /* check:tokens-ignore */ />
                  <Text style={styles.videoBadgeText}>Video</Text>
                </View>
              </View>
            )}
            {item.processingStatus && !['ready', 'local_ready'].includes(item.processingStatus) && (
              <View style={styles.mediaStatus}>
                <Text style={styles.mediaStatusText}>
                  {item.processingStatus === 'failed' ? 'Needs attention' : 'Preparing'}
                </Text>
              </View>
            )}
            {index === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>Cover</Text>
              </View>
            )}
            <TouchableOpacity style={styles.mediaRemove} onPress={() => onRemove(index)} hitSlop={8}>
              <CloseIcon size={8} color="#fff" /* check:tokens-ignore */ />
            </TouchableOpacity>
            <View style={styles.mediaIndex}>
              <Text style={styles.mediaIndexText}>{index + 1}</Text>
            </View>
          </Animated.View>
        )
      })}
      {onAdd && (
        <TouchableOpacity style={[styles.mediaTile, styles.mediaAddTile]} onPress={onAdd}>
          <ImagePlaceholder size={22} color={c.accent} />
          <Text style={styles.mediaAddText}>Add</Text>
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
      paddingRight: spacing[6],
      paddingVertical: spacing[1],
    },
    mediaTile: {
      width: ITEM_WIDTH,
      height: ITEM_HEIGHT,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: c.surface2,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    coverTile: {
      borderColor: c.accent,
      borderWidth: 1.5,
    },
    draggingTile: {
      opacity: 0.88,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
      elevation: 10,
    },
    mediaTileImage: { width: '100%', height: '100%' },
    mediaTileVideo: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px6,
      backgroundColor: c.surface2,
    },
    mediaTileVideoText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.extrabold, color: c.text2 },
    videoBadge: {
      position: 'absolute',
      left: 8,
      top: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      borderRadius: radius.lg,
      backgroundColor: 'rgba(0,0,0,0.58)', // check:tokens-ignore
      paddingHorizontal: spacing.px7,
      paddingVertical: spacing[1],
    },
    videoBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.extrabold, color: '#fff' }, // check:tokens-ignore
    mediaRemove: {
      position: 'absolute',
      right: 7,
      top: 7,
      width: 22,
      height: 22,
      borderRadius: radius.md2,
      backgroundColor: 'rgba(0,0,0,0.55)', // check:tokens-ignore
      alignItems: 'center',
      justifyContent: 'center',
    },
    mediaStatus: {
      position: 'absolute',
      left: 7,
      top: 7,
      borderRadius: radius.md,
      backgroundColor: 'rgba(0,0,0,0.55)', // check:tokens-ignore
      paddingHorizontal: spacing.px7,
      paddingVertical: spacing.px3,
    },
    mediaStatusText: { fontSize: fontSize.xs, color: '#fff', fontWeight: fontWeight.extrabold }, // check:tokens-ignore
    coverBadge: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      borderRadius: radius.md3,
      backgroundColor: c.accent,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
    },
    coverBadgeText: { fontSize: fontSize.sm, fontWeight: fontWeight.black, color: '#fff' }, // check:tokens-ignore
    mediaIndex: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      width: 22,
      height: 22,
      borderRadius: radius.md2,
      backgroundColor: 'rgba(0,0,0,0.5)', // check:tokens-ignore
      alignItems: 'center',
      justifyContent: 'center',
    },
    mediaIndexText: { fontSize: fontSize.sm, color: '#fff', fontWeight: fontWeight.black }, // check:tokens-ignore
    mediaAddTile: {
      borderStyle: 'dashed',
      borderColor: `${c.accent}55`,
      backgroundColor: `${c.accent}08`,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
    },
    mediaAddText: { fontSize: fontSize.base, fontWeight: fontWeight.black, color: c.accent },
  })
}
