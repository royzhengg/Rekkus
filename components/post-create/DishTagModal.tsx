import { useMemo } from 'react'
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import DishTagOverlay from '@/components/DishTagOverlay'
import { CloseIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import type { DishTag } from '@/types/domain'

type Props = {
  visible: boolean
  onClose: () => void
  photos: string[]
  activePhotoIndex: number
  onChangeActivePhoto: (index: number) => void
  dishTags: DishTag[]
  onAddTag: (tag: DishTag) => void
  onRemoveTag: (absoluteIndex: number) => void
  onMoveTag: (absoluteIndex: number, x: number, y: number) => void
}

export default function DishTagModal({
  visible,
  onClose,
  photos,
  activePhotoIndex,
  onChangeActivePhoto,
  dishTags,
  onAddTag,
  onRemoveTag,
  onMoveTag,
}: Props) {
  const c = useThemeColors()
  const reduceMotion = useReducedMotion()
  const styles = useMemo(() => makeStyles(c), [c])
  const { width: screenWidth } = useWindowDimensions()
  const photoWidth = screenWidth - 32
  const tagsOnActive = dishTags.filter(t => t.photoIndex === activePhotoIndex)

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Tag dishes</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>Tap the photo to pin a dish name. Drag tags to reposition.</Text>

        {photos.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStrip}
          >
            {photos.map((uri, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => onChangeActivePhoto(i)}
                style={[styles.photoThumb, i === activePhotoIndex && styles.photoThumbActive]}
              >
                <CachedImage source={{ uri }} style={styles.photoThumbImg} contentFit="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={[styles.photoArea, { width: photoWidth, height: (photoWidth * 3) / 4 }]}>
          <CachedImage
            source={photos[activePhotoIndex] ?? null}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <DishTagOverlay
            tags={dishTags}
            photoIndex={activePhotoIndex}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onMoveTag={onMoveTag}
            editable
          />
          {tagsOnActive.length === 0 && (
            <View style={styles.tapHint} pointerEvents="none">
              <Text style={styles.tapHintText}>Tap to tag a dish</Text>
            </View>
          )}
        </View>

        {tagsOnActive.length > 0 && (
          <View style={styles.tagList}>
            {tagsOnActive.map(tag => {
              const absoluteIndex = dishTags.findIndex(
                t =>
                  t.photoIndex === activePhotoIndex &&
                  t.x === tag.x &&
                  t.y === tag.y &&
                  t.name === tag.name
              )
              return (
                <View key={absoluteIndex} style={styles.tagListItem}>
                  <View style={styles.tagDot} />
                  <Text style={styles.tagName}>{tag.name}</Text>
                  <TouchableOpacity
                    onPress={() => onRemoveTag(absoluteIndex)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${tag.name} tag`}
                  >
                    <CloseIcon size={9} color={c.text3} />
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </Modal>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, alignItems: 'center' },
    header: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[5],
      paddingTop: spacing[5],
      paddingBottom: spacing[2],
    },
    title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.semibold, color: c.text },
    doneBtn: { padding: spacing[1] },
    doneBtnText: { fontSize: fontSize.xl, fontWeight: fontWeight.medium, color: c.accent },
    hint: { fontSize: fontSize.base, color: c.text2, paddingHorizontal: spacing[5], paddingBottom: spacing[3], textAlign: 'center' },
    photoStrip: { gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
    photoThumb: {
      width: 52,
      height: 52,
      borderRadius: radius.sm,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    photoThumbActive: { borderColor: c.accent },
    photoThumbImg: { width: '100%', height: '100%' },
    photoArea: { overflow: 'hidden', borderRadius: radius.sm3 },
    tapHint: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tapHintText: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.85)' }, // check:tokens-ignore
    tagList: { width: '100%', paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing.px10 },
    tagListItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    tagDot: { width: 6, height: 6, borderRadius: radius.tiny, backgroundColor: c.accent },
    tagName: { flex: 1, fontSize: fontSize.lg, color: c.text },
  })
}
