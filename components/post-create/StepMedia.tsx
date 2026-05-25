import * as ImagePicker from 'expo-image-picker'
import { useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  useWindowDimensions,
} from 'react-native'
import DishTagOverlay from '@/components/DishTagOverlay'
import {
  CloseIcon,
  PinIcon,
  SearchIcon,
  ImagePlaceholder,
  CameraIcon,
} from '@/components/icons'
import DraggableMediaStrip from '@/components/post-create/DraggableMediaStrip'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { spacing } from '@/constants/Spacing'
import { analytics } from '@/lib/analytics'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { isEnabled } from '@/lib/featureFlags'
import { useRestaurantSearch } from '@/lib/hooks/useRestaurantSearch'
import { MEDIA_LIMITS, validatePickedPostMedia } from '@/lib/services/media'
import { preparePostMedia } from '@/lib/services/postMediaProcessing'
import type { SelectedPlace } from '@/lib/services/restaurants'
import type { DishTag, PostMedia } from '@/types/domain'
import { makeStyles } from './StepMedia.styles'

type Props = {
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
  const styles = useMemo(() => makeStyles(c), [c])
  const { width: screenWidth } = useWindowDimensions()

  const [titleFocused, setTitleFocused] = useState(false)
  const [dishTagModal, setDishTagModal] = useState(false)
  const [activeTagPhotoIndex, setActiveTagPhotoIndex] = useState(0)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const {
    locationSearch,
    predictions,
    predictionsLoading,
    selectingPlace,
    nearbyPlaces,
    nearbyLoading,
    searchFocused,
    showNearby,
    showDropdown,
    handleSearchChange,
    selectPrediction,
    onSearchFocus,
    onSearchBlur,
    clearSearch,
  } = useRestaurantSearch({ cuisineType, onPlaceSelected: setSelectedPlace })

  const photos = useMemo(() => media.filter(item => item.type === 'image').map(item => item.uri), [media])
  const videoCount = media.filter(item => item.type === 'video').length

  function showMediaError(message: string) {
    setMediaError(message)
  }

  async function addMedia() {
    setMediaError(null)
    const remaining = MEDIA_LIMITS.maxPostMedia - media.length
    if (remaining <= 0) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: isEnabled('mixedMediaPosts') ? ['images', 'videos'] : ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remaining,
      videoMaxDuration: MEDIA_LIMITS.maxPostVideoSeconds,
    })
    if (!result.canceled) {
      analytics.mediaEvent(null, 'media_selected', 'post_create', {
        media_count: result.assets.length,
      })
      analytics.mediaEvent(null, 'media_prepare_started', 'post_create', {
        media_count: result.assets.length,
      })
      const { media: nextMedia, rejectedCount, error } = await preparePostMedia(result.assets, media)
      if (error) showMediaError(error)
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
  }

  async function takePhoto() {
    setMediaError(null)
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      showMediaError('Camera permission is needed to take a food photo.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    })
    if (!result.canceled) {
      analytics.mediaEvent(null, 'media_selected', 'post_create', {
        media_count: result.assets.length,
        media_type: 'image',
      })
      analytics.mediaEvent(null, 'media_prepare_started', 'post_create', {
        media_count: result.assets.length,
        media_type: 'image',
      })
      const { media: nextMedia, rejectedCount, error } = await preparePostMedia(result.assets, media)
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
          style={[styles.titleInput, titleFocused && styles.fieldFocused]}
          placeholder="What's your take?"
          placeholderTextColor={c.text3}
          value={title}
          onChangeText={setTitle}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          maxLength={100}
          multiline
        />
        <Text style={styles.charCount}>{title.length}/100</Text>
      </View>

      {/* Location search */}
      <View style={styles.locationSection}>
        {selectedPlace ? (
          <View style={styles.locationConfirmed}>
            <PinIcon color={c.accent} size={15} />
            <View style={styles.locationConfirmedText}>
              <Text style={styles.locationName} numberOfLines={1}>{selectedPlace.name}</Text>
              <Text style={styles.locationAddress} numberOfLines={1}>
                {selectedPlace.address.split(',').slice(0, 2).join(',')}
              </Text>
            </View>
            {selectingPlace ? (
              <ActivityIndicator size="small" color={c.text3} />
            ) : (
              <TouchableOpacity
                onPress={() => setSelectedPlace(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear selected restaurant"
              >
                <CloseIcon size={10} color={c.text3} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={[styles.searchWrap, searchFocused && styles.fieldFocused]}>
            <SearchIcon color={searchFocused ? c.text2 : c.text3} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a restaurant…"
              placeholderTextColor={c.text3}
              value={locationSearch}
              onChangeText={handleSearchChange}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              returnKeyType="search"
            />
            {predictionsLoading && <ActivityIndicator size="small" color={c.text3} />}
            {locationSearch.length > 0 && !predictionsLoading && (
              <TouchableOpacity
                onPress={clearSearch}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear restaurant search"
              >
                <CloseIcon size={10} color={c.text3} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {showNearby && (
          <View style={styles.dropdown}>
            {nearbyLoading ? (
              <ActivityIndicator size="small" style={{ marginVertical: spacing[3] }} />
            ) : (
              <>
                <Text style={styles.nearbyLabel}>Nearby on Rekkus</Text>
                {nearbyPlaces.map((item, index) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={[styles.dropdownItem, index === nearbyPlaces.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => selectPrediction(item)}
                  >
                    <PinIcon color={c.text3} size={13} />
                    <View style={styles.dropdownItemText}>
                      <Text style={styles.dropdownName}>{item.structured_formatting.main_text}</Text>
                      <Text style={styles.dropdownSub} numberOfLines={1}>
                        {item.structured_formatting.secondary_text}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}

        {showDropdown && (
          <View style={styles.dropdown}>
            {predictions.map((item, index) => (
              <TouchableOpacity
                key={item.place_id}
                style={[styles.dropdownItem, index === predictions.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => selectPrediction(item)}
              >
                <PinIcon color={c.text3} size={13} />
                <View style={styles.dropdownItemText}>
                  <Text style={styles.dropdownName}>{item.structured_formatting.main_text}</Text>
                  <Text style={styles.dropdownSub} numberOfLines={1}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {predictions.length === 0 && locationSearch.length >= 2 && !predictionsLoading && (
              <View style={styles.dropdownEmpty}>
                <Text style={styles.dropdownEmptyText}>No results</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Photo area */}
      {mediaError ? <ErrorMessage title="Could not add media" message={mediaError} /> : null}
      {media.length === 0 ? (
        <View style={styles.photoEmpty}>
          <ImagePlaceholder size={32} color={c.text3} />
          <Text style={styles.photoEmptyLabel}>Add food media</Text>
          <Text style={styles.photoEmptySub}>Take a photo or choose photos/video from your library</Text>
          <View style={styles.mediaActionRow}>
            <TouchableOpacity
              style={styles.mediaActionBtn}
              onPress={takePhoto}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <CameraIcon size={17} color={c.accent} />
              <Text style={styles.mediaActionText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mediaActionBtn}
              onPress={addMedia}
              accessibilityRole="button"
              accessibilityLabel="Choose media from library"
            >
              <ImagePlaceholder size={17} color={c.accent} />
              <Text style={styles.mediaActionText}>Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.photosSection}>
          <DraggableMediaStrip
            media={media}
            onChange={handleMediaReorder}
            onRemove={removeMedia}
            onAdd={media.length < MEDIA_LIMITS.maxPostMedia ? addMedia : undefined}
          />

          {/* Photo action row */}
          {photos.length > 0 && (
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoActionBtn} onPress={replaceCoverWithCrop}>
                <ImagePlaceholder size={13} color={c.accent} />
                <Text style={styles.photoActionText}>3:4 cover</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoActionBtn}
                onPress={openDishTagModal}
                accessibilityRole="button"
                accessibilityLabel="Tag dishes in photo"
              >
                <PinIcon size={13} color={c.accent} />
                <Text style={styles.photoActionText}>
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
              {dishTags.slice(0, 6).map((tag, index) => (
                <Text key={`${tag.name}-${index}`} style={styles.dishTagChip}>
                  {tag.name}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={{ height: 20 }} />

      {/* Dish tag modal */}
      <Modal
        visible={dishTagModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDishTagModal(false)}
      >
        <View style={styles.tagModalContainer}>
          {/* Header */}
          <View style={styles.tagModalHeader}>
            <Text style={styles.tagModalTitle}>Tag dishes</Text>
            <TouchableOpacity style={styles.tagModalDone} onPress={() => setDishTagModal(false)}>
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
    </ScrollView>
  )
}
