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
  Alert,
} from 'react-native'
import { useMemo, useRef, useCallback, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import {
  CloseIcon,
  PinIcon,
  SearchIcon,
  ImagePlaceholder,
  CameraIcon,
} from '@/components/icons'
import type { Prediction, SelectedPlace } from '@/lib/services/restaurants'
import {
  fetchPredictions,
  fetchPlaceDetails,
  upsertRestaurant,
  searchRestaurantsByText,
  fetchNearbyRestaurants,
} from '@/lib/services/restaurants'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import { MEDIA_LIMITS, validatePickedPostMedia } from '@/lib/services/media'
import { preparePostMedia } from '@/lib/services/postMediaProcessing'
import { analytics } from '@/lib/analytics'
import DishTagOverlay from '@/components/DishTagOverlay'
import DraggableMediaStrip from '@/components/post-create/DraggableMediaStrip'
import type { DishTag, PostMedia } from '@/types/domain'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

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

function mergeRestaurantPredictions(dbResults: Prediction[], googleResults: Prediction[]) {
  const seen = new Set<string>()
  return [...dbResults, ...googleResults]
    .map((item, index) => ({
      item,
      score:
        (item.source === 'rekkus' || item.dbDetails ? 100 : 0) +
        (item.score ?? 0) -
        index * 0.01,
    }))
    .filter(({ item }) => {
      const name = item.structured_formatting.main_text.toLowerCase()
      const key = item.place_id || name
      const looseKey = name.replace(/\s+/g, ' ').trim()
      if (seen.has(key) || seen.has(looseKey)) return false
      seen.add(key)
      seen.add(looseKey)
      return true
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
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

  const userLocation = useUserLocation()
  const [locationSearch, setLocationSearch] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [predictionsLoading, setPredictionsLoading] = useState(false)
  const [selectingPlace, setSelectingPlace] = useState(false)
  const [titleFocused, setTitleFocused] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState<Prediction[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [dishTagModal, setDishTagModal] = useState(false)
  const [activeTagPhotoIndex, setActiveTagPhotoIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestRef = useRef(0)

  const handleSearchChange = useCallback((text: string) => {
    setLocationSearch(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId
    if (text.length < 2) {
      setPredictions([])
      setPredictionsLoading(false)
      return
    }
    setPredictionsLoading(true)
    debounceRef.current = setTimeout(async () => {
      // DB-first: query restaurants table via FTS (GIN index), then Google for new places
      try {
        const [dbResults, googleResults] = await Promise.all([
          searchRestaurantsByText(text, 8),
          fetchPredictions(text, userLocation.coords),
        ])
        if (searchRequestRef.current !== requestId) return
        setPredictions(mergeRestaurantPredictions(dbResults, googleResults).slice(0, 8))
      } finally {
        if (searchRequestRef.current === requestId) setPredictionsLoading(false)
      }
    }, 300)
  }, [userLocation.coords])

  async function selectPrediction(item: Prediction) {
    setSelectingPlace(true)
    setSearchFocused(false)
    setLocationSearch('')
    setPredictions([])
    setNearbyPlaces([])

    if (item.dbDetails) {
      // Fast path: restaurant already in our DB — no Google API call needed
      setSelectedPlace({
        placeId: item.place_id,
        name: item.structured_formatting.main_text,
        address: item.dbDetails.address,
        lat: item.dbDetails.lat,
        lng: item.dbDetails.lng,
        restaurantId: item.dbDetails.restaurantId,
      })
      setSelectingPlace(false)
      return
    }

    // Slow path: new restaurant from Google — fetch details and upsert
    const detail = await fetchPlaceDetails(item.place_id)
    if (detail) {
      const restaurantId = await upsertRestaurant(detail, item.place_id, cuisineType || undefined)
      setSelectedPlace({
        placeId: item.place_id,
        name: item.structured_formatting.main_text,
        address: detail.formatted_address,
        lat: detail.geometry.location.lat,
        lng: detail.geometry.location.lng,
        restaurantId,
      })
    }
    setSelectingPlace(false)
  }

  const photos = useMemo(() => media.filter(item => item.type === 'image').map(item => item.uri), [media])
  const videoCount = media.filter(item => item.type === 'video').length

  function showMediaError(message: string) {
    Alert.alert('Could not add media', message)
  }

  async function addMedia() {
    const remaining = MEDIA_LIMITS.maxPostMedia - media.length
    if (remaining <= 0) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
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
        mixed[firstImageIndex] = {
          ...acceptedMedia[0],
          localId: media[firstImageIndex].localId,
          isCover: media[firstImageIndex].isCover,
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
          mediaLocalId: key,
        })
        return acc
      }, [])
    )
  }

  function handleAddTag(tag: DishTag) {
    const imageMedia = media.filter(item => item.type === 'image')
    setDishTags([...dishTags, { ...tag, mediaLocalId: imageMedia[tag.photoIndex]?.localId }])
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

  const showNearby = searchFocused && locationSearch.length < 2 && (nearbyLoading || nearbyPlaces.length > 0)
  const showDropdown = searchFocused && locationSearch.length >= 2 && (predictions.length > 0 || !predictionsLoading)
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
              <TouchableOpacity onPress={() => setSelectedPlace(null)} hitSlop={8}>
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
              onFocus={() => {
                setSearchFocused(true)
                if (!locationSearch && userLocation.coords) {
                  setNearbyLoading(true)
                  fetchNearbyRestaurants(userLocation.coords, 1)
                    .then(setNearbyPlaces)
                    .finally(() => setNearbyLoading(false))
                }
              }}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              returnKeyType="search"
            />
            {predictionsLoading && <ActivityIndicator size="small" color={c.text3} />}
            {locationSearch.length > 0 && !predictionsLoading && (
              <TouchableOpacity onPress={() => { setLocationSearch(''); setPredictions([]) }} hitSlop={8}>
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
      {media.length === 0 ? (
        <View style={styles.photoEmpty}>
          <ImagePlaceholder size={32} color={c.text3} />
          <Text style={styles.photoEmptyLabel}>Add food media</Text>
          <Text style={styles.photoEmptySub}>Take a photo or choose photos/video from your library</Text>
          <View style={styles.mediaActionRow}>
            <TouchableOpacity style={styles.mediaActionBtn} onPress={takePhoto}>
              <CameraIcon size={17} color={c.accent} />
              <Text style={styles.mediaActionText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaActionBtn} onPress={addMedia}>
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
              <TouchableOpacity style={styles.photoActionBtn} onPress={openDishTagModal}>
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
                    <TouchableOpacity onPress={() => handleRemoveTag(ai)} hitSlop={8}>
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

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    scroll: { flex: 1 },

    // Location
    locationSection: { paddingHorizontal: spacing[4], paddingTop: spacing.px10, zIndex: 10 },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: c.bg,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px13,
      minHeight: 46,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    fieldFocused: {
      borderColor: c.accent,
      backgroundColor: c.bg,
    },
    searchInput: { flex: 1, fontSize: fontSize.lg, color: c.text, padding: spacing[0] },
    locationConfirmed: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      backgroundColor: c.bg,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px13,
      minHeight: 46,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    locationConfirmedText: { flex: 1 },
    locationName: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text },
    locationAddress: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px1 },
    dropdown: {
      backgroundColor: c.bg,
      borderRadius: radius.md3,
      borderWidth: 0.5,
      borderColor: c.border,
      marginTop: spacing[1],
      overflow: 'hidden',
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing.px13,
      paddingVertical: spacing.px11,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    dropdownItemText: { flex: 1 },
    dropdownName: { fontSize: fontSize.base, color: c.text, fontWeight: fontWeight.medium },
    dropdownSub: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px1 },
    dropdownEmpty: { paddingVertical: spacing[4], alignItems: 'center' },
    dropdownEmptyText: { fontSize: fontSize.bodySm, color: c.text3 },
    nearbyLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.text3, paddingHorizontal: spacing[3], paddingTop: spacing.px10, paddingBottom: spacing[1] },

    // Photos — empty
    photoEmpty: {
      marginHorizontal: spacing[4],
      marginTop: spacing[3],
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: `${c.accent}55`,
      borderRadius: radius.lg2,
      aspectRatio: 1.42,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px10,
      backgroundColor: `${c.accent}08`,
    },
    photoEmptyLabel: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text2 },
    photoEmptySub: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center', paddingHorizontal: spacing.px28 },
    mediaActionRow: {
      flexDirection: 'row',
      gap: spacing.px10,
      marginTop: spacing[1],
    },
    mediaActionBtn: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px7,
      paddingHorizontal: spacing.px14,
      borderRadius: radius.xl2,
      backgroundColor: `${c.accent}14`,
      borderWidth: 0.5,
      borderColor: `${c.accent}24`,
    },
    mediaActionText: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: c.accent },

    // Photos — strip + actions
    photosSection: { marginTop: spacing.px14 },
    mixedStrip: {
      gap: spacing.px10,
      paddingHorizontal: spacing[4],
      paddingRight: spacing[6],
    },
    mediaTile: {
      width: 132,
      height: 176,
      borderRadius: radius.sm3,
      overflow: 'hidden',
      backgroundColor: c.surface2,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    mediaTileImage: { width: '100%', height: '100%' },
    mediaTileVideo: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px6,
      backgroundColor: c.surface2,
    },
    mediaTileVideoText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.bold, color: c.text2 },
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
      borderRadius: radius.md3,
      backgroundColor: 'rgba(0,0,0,0.55)', // check:tokens-ignore
      paddingHorizontal: spacing.px7,
      paddingVertical: spacing[1],
    },
    mediaStatusText: { fontSize: fontSize.xs, color: '#fff', fontWeight: fontWeight.bold }, // check:tokens-ignore
    mediaMoveRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      minHeight: 30,
      backgroundColor: 'rgba(0,0,0,0.45)', // check:tokens-ignore
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.px10,
    },
    mediaMoveText: { fontSize: fontSize['3xl'], lineHeight: lineHeight.relaxed, color: '#fff', fontWeight: fontWeight.bold }, // check:tokens-ignore
    mediaMoveDisabled: { color: 'rgba(255,255,255,0.28)' }, // check:tokens-ignore
    mediaIndexText: { fontSize: fontSize.sm, color: '#fff', fontWeight: fontWeight.extrabold }, // check:tokens-ignore
    mediaAddTile: { alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
    mediaAddText: { fontSize: fontSize.bodySm, color: c.accent, fontWeight: fontWeight.bold },
    photoActions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      marginTop: spacing.px10,
    },
    photoActionBtn: { paddingVertical: spacing[1], paddingHorizontal: spacing.px2 },
    photoActionText: { fontSize: fontSize.bodySm, color: c.text3 },
    photoActionDivider: {
      width: 1,
      height: 12,
      backgroundColor: c.border2,
      marginHorizontal: spacing.px10,
    },
    photoOnlyHint: { fontSize: fontSize.sm, color: c.text3, paddingHorizontal: spacing[4], paddingTop: spacing[2] },
    videoPreview: {
      marginHorizontal: spacing[4],
      minHeight: 96,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      borderRadius: radius.md3,
      backgroundColor: c.surface,
    },
    videoPreviewText: { flex: 1 },
    videoPreviewTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
    videoPreviewSub: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    dishTagChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.px6,
      paddingHorizontal: spacing[4],
      paddingTop: spacing.px10,
    },
    dishTagChip: {
      overflow: 'hidden',
      borderRadius: radius.lg,
      backgroundColor: `${c.accent}12`,
      color: c.accent,
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.semibold,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px5,
    },

    // Title
    titleSection: { paddingHorizontal: spacing[4], paddingTop: spacing.px14 },
    titleInput: {
      minHeight: 54,
      borderRadius: radius.lg,
      borderWidth: 0.5,
      borderColor: c.border,
      backgroundColor: c.bg,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
      fontSize: fontSize.title,
      fontWeight: fontWeight.bold,
      color: c.text,
      lineHeight: lineHeight.titleRelaxed,
    },
    charCount: { fontSize: fontSize.xs, color: c.text3, textAlign: 'right', marginTop: spacing.px5 },

    // Dish tag modal
    tagModalContainer: {
      flex: 1,
      backgroundColor: c.bg,
      alignItems: 'center',
    },
    tagModalHeader: {
      width: '100%',
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[5],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    tagModalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text },
    tagModalDone: { padding: spacing[1] },
    tagModalDoneText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.accent },
    tagModalHint: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      paddingHorizontal: spacing[5],
      paddingTop: spacing.px14,
      paddingBottom: spacing[1],
      alignSelf: 'flex-start',
    },
    tagPhotoStrip: {
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
    },
    tagPhotoThumb: {
      width: 52,
      height: 52,
      borderRadius: radius.sm3,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    tagPhotoThumbActive: {
      borderColor: c.accent,
    },
    tagPhotoThumbImg: { width: '100%', height: '100%' },
    tagPhotoArea: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: c.surface2,
      position: 'relative',
      marginTop: spacing[2],
    },
    tagHint: {
      position: 'absolute',
      bottom: 10,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)', // check:tokens-ignore
      borderRadius: radius.sm3,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing[1],
    },
    tagHintText: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.85)' }, // check:tokens-ignore
    tagList: {
      width: '100%',
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      gap: spacing.px10,
    },
    tagListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    tagListDot: {
      width: 6,
      height: 6,
      borderRadius: radius.tiny,
      backgroundColor: c.accent,
    },
    tagListName: { flex: 1, fontSize: fontSize.base, color: c.text },
  })
}
