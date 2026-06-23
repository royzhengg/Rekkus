import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useMemo, useState } from 'react'
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import {
  CameraIcon,
  CloseIcon,
  ImagePlaceholder,
  TagIcon,
} from '@/components/icons'
import DishTagModal from '@/components/post-create/DishTagModal'
import DraggableMediaStrip from '@/components/post-create/DraggableMediaStrip'
import { RestaurantPicker } from '@/components/RestaurantPicker'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { analytics } from '@/lib/analytics'
import { SPRING_SNAPPY } from '@/lib/animations'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useUserLocationContext } from '@/lib/contexts/UserLocationContext'
import { usePostMediaPicker } from '@/lib/hooks/usePostMediaPicker'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { MEDIA_LIMITS } from '@/lib/services/media'
import type { SelectedPlace } from '@/lib/services/places'
import type { DishTag, PostMedia } from '@/types/domain'
import { makeStyles } from './StepMedia.styles'

type Props = {
  userId?: string | null
  media: PostMedia[]
  setMedia: (media: PostMedia[]) => void
  title: string
  setTitle: (title: string) => void
  selectedPlace: SelectedPlace | null
  setSelectedPlace: (place: SelectedPlace | null) => void
  cuisineType: string
  dishTags: DishTag[]
  setDishTags: (tags: DishTag[]) => void
}

export default function StepMedia({
  userId,
  media,
  setMedia,
  title,
  setTitle,
  selectedPlace,
  setSelectedPlace,
  cuisineType,
  dishTags,
  setDishTags,
}: Props) {
  const c = useThemeColors()
  const reduceMotion = useReducedMotion()
  const styles = useMemo(() => makeStyles(c), [c])
  const { setManualCoords } = useUserLocationContext()

  const [dishTagModal, setDishTagModal] = useState(false)
  const [activeTagPhotoIndex, setActiveTagPhotoIndex] = useState(0)
  const [showDishTagTooltip, setShowDishTagTooltip] = useState(false)
  const [tooltipSeen, setTooltipSeen] = useState(true)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const picker = usePostMediaPicker({
    existingMedia: media,
    onResult: setMedia,
    onError: setMediaError,
    onExifCoords: coords => setManualCoords?.(coords),
  })

  const photos = useMemo(() => media.filter(m => m.type === 'image').map(m => m.uri), [media])
  const videoCount = media.filter(m => m.type === 'video').length
  const preparingCount = media.filter(m => m.processingStatus === 'preparing').length

  const progressValue = useSharedValue(1)
  useEffect(() => {
    const ratio = media.length === 0 ? 1 : (media.length - preparingCount) / media.length
    progressValue.value = withSpring(ratio, SPRING_SNAPPY)
  }, [preparingCount, media.length, progressValue])
  const progressBarStyle = useAnimatedStyle(
    () => ({ width: `${progressValue.value * 100}%` as `${number}%` }),
    []
  )

  // Dish tag tooltip — shown once on first photo
  useEffect(() => {
    void AsyncStorage.getItem('rekkus:dish-tag-onboarding:v1').then(val => {
      if (!val) setTooltipSeen(false)
    })
  }, [])
  useEffect(() => {
    if (photos.length > 0 && !tooltipSeen) {
      setTooltipSeen(true)
      setShowDishTagTooltip(true)
      void AsyncStorage.setItem('rekkus:dish-tag-onboarding:v1', '1')
      analytics.dishTagOnboardingShown(null)
    }
  }, [photos.length, tooltipSeen])

  function removeMedia(idx: number) {
    const removed = media[idx]
    const imageIdx =
      removed?.type === 'image'
        ? media.slice(0, idx).filter(m => m.type === 'image').length
        : -1
    setMedia(media.filter((_, i) => i !== idx))
    if (imageIdx >= 0) {
      setDishTags(
        dishTags
          .filter(t => t.photoIndex !== imageIdx && t.mediaLocalId !== removed?.localId)
          .map(t => (t.photoIndex > imageIdx ? { ...t, photoIndex: t.photoIndex - 1 } : t))
      )
    }
  }

  function handleMediaReorder(nextMedia: PostMedia[]) {
    const oldImageKeys = media.filter(m => m.type === 'image').map(m => m.localId || m.uri)
    const nextImageKeys = nextMedia.filter(m => m.type === 'image').map(m => m.localId || m.uri)
    setMedia(nextMedia)
    setDishTags(
      dishTags.reduce<DishTag[]>((acc, tag) => {
        const key = tag.mediaLocalId ?? oldImageKeys[tag.photoIndex]
        const nextPhotoIndex = key ? nextImageKeys.indexOf(key) : tag.photoIndex
        if (nextPhotoIndex < 0) return acc
        acc.push({ ...tag, photoIndex: nextPhotoIndex, ...(key ? { mediaLocalId: key } : {}) })
        return acc
      }, [])
    )
  }

  function handleAddTag(tag: DishTag) {
    const imageMedia = media.filter(m => m.type === 'image')
    const mediaLocalId = imageMedia[tag.photoIndex]?.localId
    setDishTags([...dishTags, { ...tag, ...(mediaLocalId ? { mediaLocalId } : {}) }])
    analytics.mediaEvent(null, 'dish_tag_added', 'post_create')
  }

  function handleRemoveTag(absoluteIndex: number) {
    setDishTags(dishTags.filter((_, i) => i !== absoluteIndex))
  }

  function handleMoveTag(absoluteIndex: number, x: number, y: number) {
    setDishTags(dishTags.map((t, i) => (i === absoluteIndex ? { ...t, x, y } : t)))
  }

  function openDishTagModal() {
    if (photos.length === 0) return
    setActiveTagPhotoIndex(0)
    setDishTagModal(true)
  }

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <View style={styles.titleSection}>
        <TextInput
          style={styles.titleInput}
          placeholder="What's your take?"
          placeholderTextColor={c.text3}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          accessibilityLabel="Post title"
          accessibilityHint="One-line review — shown at the top of your post"
        />
        <View style={styles.titleMeta}>
          <Text style={styles.titleMetaLabel}>One-line review</Text>
          <Text
            style={styles.charCount}
            accessibilityLiveRegion="polite"
            accessibilityRole="text"
          >
            {title.length} / 80
          </Text>
        </View>
      </View>

      {/* Place */}
      <RestaurantPicker
        value={selectedPlace}
        onSelect={setSelectedPlace}
        cuisineType={cuisineType}
        userId={userId ?? null}
      />

      {/* Media */}
      {mediaError ? <ErrorMessage title="Could not add media" message={mediaError} /> : null}

      {media.length === 0 ? (
        <View style={styles.mediaSection}>
          <View style={styles.photoEmpty}>
            <CameraIcon size={40} color={c.text3} />
            <Text style={styles.photoEmptyTitle}>Add your photos or videos</Text>
            <Text style={styles.photoEmptySub}>Tag dishes to help friends discover what to order</Text>
          </View>
          <View style={styles.mediaAddRow}>
            <TouchableOpacity
              style={styles.mediaAddBtn}
              onPress={() => { setMediaError(null); void picker.pickFromCamera() }}
              accessibilityRole="button"
              accessibilityLabel="Take a photo"
            >
              <CameraIcon size={16} color="#fff" /* check:tokens-ignore */ />
              <Text style={styles.mediaAddBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mediaAddBtn, styles.mediaAddBtnSecondary]}
              onPress={() => { setMediaError(null); void picker.pickFromLibrary() }}
              accessibilityRole="button"
              accessibilityLabel="Choose from library"
            >
              <ImagePlaceholder size={16} color={c.text2} />
              <Text style={[styles.mediaAddBtnText, styles.mediaAddBtnTextSecondary]}>Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.photosSection}>
          <DraggableMediaStrip
            media={media}
            onChange={handleMediaReorder}
            onRemove={removeMedia}
            onAdd={
              media.length < MEDIA_LIMITS.maxPostMedia
                ? () => { setMediaError(null); void picker.pickFromLibrary() }
                : undefined
            }
          />

          {preparingCount > 0 && (
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressBarStyle]} />
            </View>
          )}

          {showDishTagTooltip && (
            <Animated.View
              {...(!reduceMotion ? { entering: FadeIn.duration(200) } : {})}
              style={styles.dishTagTooltip}
            >
              <TagIcon size={14} color={c.accent} />
              <Text style={styles.dishTagTooltipText}>
                Tap "Tag dishes" to pin dish names to your photos
              </Text>
              <TouchableOpacity
                onPress={() => setShowDishTagTooltip(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss tip"
                style={styles.dishTagTooltipDismiss}
              >
                <CloseIcon size={12} color={c.text3} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {photos.length > 0 && (
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.photoActionBtn}
                onPress={() => { setMediaError(null); void picker.pickFromCamera() }}
                accessibilityRole="button"
                accessibilityLabel="Take a photo"
              >
                <CameraIcon size={13} color={c.text3} />
                <Text style={styles.photoActionText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoActionBtn}
                onPress={() => void picker.replaceCover()}
                accessibilityRole="button"
                accessibilityLabel="Replace cover photo"
                accessibilityHint="Opens photo library to pick a 3 by 4 cropped cover image"
              >
                <ImagePlaceholder size={13} color={c.accent} />
                <Text style={styles.photoActionText}>3:4 cover</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dishTagBtn}
                onPress={openDishTagModal}
                accessibilityRole="button"
                accessibilityLabel="Tag dishes in photo"
                accessibilityHint={
                  dishTags.length > 0
                    ? `${dishTags.length} dish${dishTags.length !== 1 ? 'es' : ''} tagged. Tap to add more.`
                    : 'Opens a photo view where you can pin dish names'
                }
              >
                <TagIcon size={14} color={c.accent} />
                <Text style={styles.dishTagBtnText}>
                  Tag dishes{dishTags.length > 0 ? ` · ${dishTags.length}` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {videoCount > 0 && photos.length > 0 && (
            <Text style={styles.photoOnlyHint}>Dish tags apply to photos only.</Text>
          )}

          {photos.length > 0 && dishTags.length > 0 && (
            <View style={styles.dishTagChips}>
              {[...new Set(dishTags.map(t => t.name))]
                .slice(0, 8)
                .map(name => (
                  <View key={name} style={styles.dishTagChipPill}>
                    <Text style={styles.dishTagChip}>{name}</Text>
                  </View>
                ))}
            </View>
          )}
        </View>
      )}

      <View style={{ height: 20 }} />

      {/* Dish tag modal */}
      <DishTagModal
        visible={dishTagModal}
        onClose={() => setDishTagModal(false)}
        photos={photos}
        activePhotoIndex={activeTagPhotoIndex}
        onChangeActivePhoto={setActiveTagPhotoIndex}
        dishTags={dishTags}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onMoveTag={handleMoveTag}
      />

      {/* Permission recovery sheet */}
      <RekkusActionSheet
        visible={picker.recoveryVisible}
        title="Permission required"
        subtitle={picker.recoveryMessage}
        options={[
          { label: 'Open Settings', value: 'settings', accentColor: c.accent },
          { label: 'Not now', value: 'cancel' },
        ]}
        onSelect={v => (v === 'settings' ? picker.openSettings() : picker.dismissRecovery())}
        onDismiss={picker.dismissRecovery}
      />
    </ScrollView>
  )
}
