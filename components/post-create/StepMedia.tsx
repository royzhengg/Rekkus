import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Modal,
  useWindowDimensions,
} from 'react-native'
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import DishTagOverlay from '@/components/DishTagOverlay'
import {
  CameraIcon,
  CloseIcon,
  TagIcon,
  ImagePlaceholder,
  PlusIcon,
} from '@/components/icons'
import DraggableMediaStrip from '@/components/post-create/DraggableMediaStrip'
import { RestaurantPicker } from '@/components/RestaurantPicker'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { analytics } from '@/lib/analytics'
import { SPRING_SNAPPY } from '@/lib/animations'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useUserLocationContext } from '@/lib/contexts/UserLocationContext'
import { isEnabled } from '@/lib/featureFlags'
import { usePermissionRecovery } from '@/lib/hooks/usePermissionRecovery'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { MEDIA_LIMITS, validatePickedPostMedia } from '@/lib/services/media'
import type { SelectedPlace } from '@/lib/services/places'
import { preparePostMedia } from '@/lib/services/postMediaProcessing'
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

const NATIVE_PICKER_PRESENTATION_DELAY_MS = 350
const PHOTO_LIBRARY_DENIED_MESSAGE =
  'Photo library access is needed to add photos. Enable it in Settings.'
const CAMERA_DENIED_MESSAGE =
  'Camera access is needed to take a food photo. Enable it in Settings.'
const PHOTO_LIBRARY_OPEN_ERROR =
  'Could not open your photo library. Please try again.'
const CAMERA_OPEN_ERROR =
  'Could not open your camera. Please try again.'

function waitForNativePickerPresentationWindow(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, NATIVE_PICKER_PRESENTATION_DELAY_MS)
  })
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
  const { width: screenWidth } = useWindowDimensions()

  const [_titleFocused, setTitleFocused] = useState(false)
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false)
  const [dishTagModal, setDishTagModal] = useState(false)
  const [showDishTagTooltip, setShowDishTagTooltip] = useState(false)
  const [tooltipSeen, setTooltipSeen] = useState(true)
  const [activeTagPhotoIndex, setActiveTagPhotoIndex] = useState(0)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const { request: requestPermission, recoveryVisible, recoveryMessage, dismissRecovery, openSettings } = usePermissionRecovery()

  const { coords: userCoords, setManualCoords } = useUserLocationContext()

  const photos = useMemo(() => media.filter(item => item.type === 'image').map(item => item.uri), [media])
  const videoCount = media.filter(item => item.type === 'video').length

  const preparingCount = media.filter(item => item.processingStatus === 'preparing').length
  const progressValue = useSharedValue(1)
  useEffect(() => {
    const ratio = media.length === 0 ? 1 : (media.length - preparingCount) / media.length
    progressValue.value = withSpring(ratio, SPRING_SNAPPY)
  }, [preparingCount, media.length, progressValue])
  const progressBarStyle = useAnimatedStyle(() => ({ width: `${progressValue.value * 100}%` as `${number}%` }), [])

  function showMediaError(message: string) {
    setMediaError(message)
  }

  async function addMedia() {
    setMediaError(null)
    const remaining = MEDIA_LIMITS.maxPostMedia - media.length
    if (remaining <= 0) return
    try {
      const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync()
      let requestedPermission = false
      if (!currentPermission.granted && !currentPermission.canAskAgain) {
        await requestPermission(() => Promise.resolve(currentPermission), PHOTO_LIBRARY_DENIED_MESSAGE)
        return
      }
      if (!currentPermission.granted) {
        requestedPermission = true
        const requestedResult = await requestPermission(
          () => ImagePicker.requestMediaLibraryPermissionsAsync(),
          PHOTO_LIBRARY_DENIED_MESSAGE
        )
        if (!requestedResult.granted) return
      }
      if (requestedPermission) await waitForNativePickerPresentationWindow()
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: isEnabled('mixedMediaPosts') ? ['images', 'videos'] : ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: remaining,
        videoMaxDuration: MEDIA_LIMITS.maxPostVideoSeconds,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        exif: true,
      })
      if (!result.canceled) {
        // Pre-fill search bias from photo EXIF if user location is unknown
        if (!userCoords) {
          const firstAsset = result.assets[0]
          const exifLat = firstAsset?.exif?.GPSLatitude as number | undefined
          const exifLng = firstAsset?.exif?.GPSLongitude as number | undefined
          if (typeof exifLat === 'number' && typeof exifLng === 'number') {
            setManualCoords?.({ lat: exifLat, lng: exifLng })
          }
        }
        analytics.mediaEvent(null, 'media_selected', 'post_create', {
          media_count: result.assets.length,
        })
        analytics.mediaEvent(null, 'media_prepare_started', 'post_create', {
          media_count: result.assets.length,
        })
        const { media: nextMedia, rejectedCount, error } = await preparePostMedia(result.assets, media)
        if (error) showMediaError(error)
        else if (rejectedCount > 0 && nextMedia.length === media.length) {
          showMediaError('Could not add the selected media. Check the file type and size.')
        }
        if (rejectedCount > 0) {
          analytics.uploadFailure(null, 'post_media_picker', 'validation_rejected', rejectedCount)
          analytics.mediaEvent(null, 'media_prepare_failed', 'post_create', {
            reason: error ?? 'validation_rejected',
          })
        }
        setMedia(nextMedia)
        analytics.mediaEvent(null, 'media_prepare_completed', 'post_create', {
          media_count: nextMedia.length,
        })
      }
    } catch (e) {
      showMediaError(PHOTO_LIBRARY_OPEN_ERROR)
      analytics.uploadFailure(null, 'post_media_picker', 'picker_unavailable')
      analytics.mediaEvent(null, 'media_prepare_failed', 'post_create', {
        reason: e instanceof Error ? e.message : 'picker_unavailable',
      })
    }
  }

  async function takePhoto() {
    setMediaError(null)
    try {
      const currentPermission = await ImagePicker.getCameraPermissionsAsync()
      let requestedPermission = false
      if (!currentPermission.granted && !currentPermission.canAskAgain) {
        await requestPermission(() => Promise.resolve(currentPermission), CAMERA_DENIED_MESSAGE)
        return
      }
      if (!currentPermission.granted) {
        requestedPermission = true
        const requestedResult = await requestPermission(
          () => ImagePicker.requestCameraPermissionsAsync(),
          CAMERA_DENIED_MESSAGE
        )
        if (!requestedResult.granted) return
      }
      if (requestedPermission) await waitForNativePickerPresentationWindow()
      const cameraResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      })
      if (!cameraResult.canceled) {
        analytics.mediaEvent(null, 'media_selected', 'post_create', {
          media_count: cameraResult.assets.length,
          media_type: 'image',
        })
        analytics.mediaEvent(null, 'media_prepare_started', 'post_create', {
          media_count: cameraResult.assets.length,
          media_type: 'image',
        })
        const { media: nextMedia, rejectedCount, error } = await preparePostMedia(cameraResult.assets, media)
        if (error) showMediaError(error)
        if (rejectedCount > 0) {
          analytics.uploadFailure(null, 'post_camera', 'validation_rejected', rejectedCount)
          analytics.mediaEvent(null, 'media_prepare_failed', 'post_create', {
            reason: error ?? 'validation_rejected',
          })
        }
        setMedia(nextMedia)
        analytics.mediaEvent(null, 'media_prepare_completed', 'post_create', {
          media_count: nextMedia.length,
          media_type: 'image',
        })
      }
    } catch (e) {
      showMediaError(CAMERA_OPEN_ERROR)
      analytics.uploadFailure(null, 'post_camera', 'picker_unavailable')
      analytics.mediaEvent(null, 'media_prepare_failed', 'post_create', {
        reason: e instanceof Error ? e.message : 'picker_unavailable',
        media_type: 'image',
      })
    }
  }

  async function replaceCoverWithCrop() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.9,
    })
    if (!result.canceled && result.assets[0]) {
      const { acceptedMedia, rejectedCount } = validatePickedPostMedia(result.assets, 0)
      if (!acceptedMedia[0] || acceptedMedia[0].type !== 'image') {
        analytics.uploadFailure(null, 'post_cover_picker', 'validation_rejected', rejectedCount || 1)
        return
      }
      const imageMedia = media.filter(item => item.type === 'image')
      const next = [...imageMedia]
      const firstImageIndex = media.findIndex(item => item.type === 'image')
      if (firstImageIndex >= 0) {
        const mixed = [...media]
        const currentImage = media[firstImageIndex]
        if (!currentImage) return
        mixed[firstImageIndex] = {
          ...acceptedMedia[0],
          localId: currentImage.localId,
          isCover: currentImage.isCover,
        }
        setMedia(mixed)
      } else {
        next[0] = { ...acceptedMedia[0], localId: `media-${Date.now()}` }
        setMedia(next)
      }
    }
  }

  function removeMedia(idx: number) {
    const removed = media[idx]
    const imageIdx = removed?.type === 'image'
      ? media.slice(0, idx).filter(item => item.type === 'image').length
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
    const oldImageKeys = media
      .filter(item => item.type === 'image')
      .map(item => item.localId || item.uri)
    const nextImageKeys = nextMedia
      .filter(item => item.type === 'image')
      .map(item => item.localId || item.uri)

    setMedia(nextMedia)
    setDishTags(
      dishTags.reduce<DishTag[]>((acc, tag) => {
        const key = tag.mediaLocalId ?? oldImageKeys[tag.photoIndex]
        const nextPhotoIndex = key ? nextImageKeys.indexOf(key) : tag.photoIndex
        if (nextPhotoIndex < 0) return acc
        acc.push({
          ...tag,
          photoIndex: nextPhotoIndex,
          ...(key ? { mediaLocalId: key } : {}),
        })
        return acc
      }, [])
    )
  }

  function handleAddTag(tag: DishTag) {
    const imageMedia = media.filter(item => item.type === 'image')
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

  function dismissDishTagTooltip() {
    setShowDishTagTooltip(false)
  }

  function openDishTagModal() {
    if (photos.length === 0) return
    setActiveTagPhotoIndex(0)
    setDishTagModal(true)
  }

  const tagsOnActive = dishTags.filter(t => t.photoIndex === activeTagPhotoIndex)
  const photoWidth = screenWidth - 32

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
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
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

      {/* Restaurant */}
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
            <Text style={styles.photoEmptyTitle}>Add your photos</Text>
            <Text style={styles.photoEmptySub}>Tag dishes to help friends discover what to order</Text>
          </View>
          <TouchableOpacity
            style={styles.mediaAddBtn}
            onPress={() => setMediaPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Add photos or video"
            accessibilityHint="Opens a menu to take a photo or choose from your library"
          >
            <PlusIcon size={16} color="#fff" /* check:tokens-ignore */ />
            <Text style={styles.mediaAddBtnText}>Add photos</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photosSection}>
          <DraggableMediaStrip
            media={media}
            onChange={handleMediaReorder}
            onRemove={removeMedia}
            onAdd={media.length < MEDIA_LIMITS.maxPostMedia ? addMedia : undefined}
          />

          {/* Compression progress bar */}
          {preparingCount > 0 && (
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressBarStyle]} />
            </View>
          )}

          {/* Dish tag hint — shown once on first photo */}
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
                onPress={dismissDishTagTooltip}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss tip"
                style={styles.dishTagTooltipDismiss}
              >
                <CloseIcon size={12} color={c.text3} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Actions */}
          {photos.length > 0 && (
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.photoActionBtn}
                onPress={replaceCoverWithCrop}
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
                accessibilityHint={dishTags.length > 0 ? `${dishTags.length} dish${dishTags.length !== 1 ? 'es' : ''} tagged. Tap to add more.` : 'Opens a photo view where you can pin dish names'}
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
              {[...new Set(dishTags.map(t => t.name))].slice(0, 8).map((name) => (
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
      <Modal
        visible={dishTagModal}
        animationType={reduceMotion ? 'none' : 'slide'}
        presentationStyle="pageSheet"
        onRequestClose={() => setDishTagModal(false)}
      >
        <View style={styles.tagModalContainer}>
          {/* Header */}
          <View style={styles.tagModalHeader}>
            <Text style={styles.tagModalTitle}>Tag dishes</Text>
            <TouchableOpacity style={styles.tagModalDone} onPress={() => setDishTagModal(false)} accessibilityRole="button">
              <Text style={styles.tagModalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.tagModalHint}>Tap the photo to pin a dish name. Drag tags to reposition.</Text>

          {/* Photo selector */}
          {photos.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagPhotoStrip}
            >
              {photos.map((uri, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setActiveTagPhotoIndex(i)}
                  style={[
                    styles.tagPhotoThumb,
                    i === activeTagPhotoIndex && styles.tagPhotoThumbActive,
                  ]}
                >
                  <Image source={{ uri }} style={styles.tagPhotoThumbImg} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Active photo with tag overlay */}
          <View
            style={[
              styles.tagPhotoArea,
              { width: photoWidth, height: (photoWidth * 3) / 4 },
            ]}
          >
            <Image
              source={{ uri: photos[activeTagPhotoIndex] }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <DishTagOverlay
              tags={dishTags}
              photoIndex={activeTagPhotoIndex}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              onMoveTag={handleMoveTag}
              editable
            />
            {tagsOnActive.length === 0 && (
              <View style={styles.tagHint} pointerEvents="none">
                <Text style={styles.tagHintText}>Tap to tag a dish</Text>
              </View>
            )}
          </View>

          {/* Tag list for active photo */}
          {tagsOnActive.length > 0 && (
            <View style={styles.tagList}>
              {tagsOnActive.map(tag => {
                const ai = dishTags.findIndex(
                  t => t.photoIndex === activeTagPhotoIndex && t.x === tag.x && t.y === tag.y && t.name === tag.name
                )
                return (
                  <View key={ai} style={styles.tagListItem}>
                    <View style={styles.tagListDot} />
                    <Text style={styles.tagListName}>{tag.name}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveTag(ai)}
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

      <RekkusActionSheet
        visible={mediaPickerVisible}
        title="Add media"
        options={[
          { label: 'Camera', value: 'camera', icon: <CameraIcon size={16} color={c.accent} /> },
          { label: 'Photo library', value: 'library', icon: <ImagePlaceholder size={16} color={c.accent} /> },
        ]}
        onSelect={v => {
          setMediaPickerVisible(false)
          // Defer past the sheet's ~300ms slide-out animation. iOS silently
          // drops a native picker presentation while a modal VC is still
          // dismissing; Android can also fail on some versions for the same reason.
          setTimeout(() => {
            if (v === 'camera') void takePhoto()
            else void addMedia()
          }, NATIVE_PICKER_PRESENTATION_DELAY_MS)
        }}
        onDismiss={() => setMediaPickerVisible(false)}
      />
      <RekkusActionSheet
        visible={recoveryVisible}
        title="Permission required"
        subtitle={recoveryMessage}
        options={[
          { label: 'Open Settings', value: 'settings', accentColor: c.accent },
          { label: 'Not now', value: 'cancel' },
        ]}
        onSelect={v => v === 'settings' ? openSettings() : dismissRecovery()}
        onDismiss={dismissRecovery}
      />
    </ScrollView>
  )
}
