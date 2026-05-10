import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ActionSheetIOS,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/ThemeContext'
import {
  ChevronLeft,
  CloseIcon,
  PinIcon,
  SearchIcon,
  ImagePlaceholder,
  PlusIcon,
} from '@/components/icons'
import { usePosts } from '@/lib/PostsContext'
import { useAuth } from '@/lib/AuthContext'
import { useAuthGate } from '@/lib/AuthGateContext'
import { supabase } from '@/lib/supabase'

type Prediction = {
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
}

type PlaceDetail = {
  name: string
  formatted_address: string
  geometry: { location: { lat: number; lng: number } }
}

type SelectedPlace = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  restaurantId?: string
}

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? ''

async function fetchPredictions(input: string): Promise<Prediction[]> {
  if (!input.trim() || !PLACES_KEY) return []
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=establishment&key=${PLACES_KEY}`
    const res = await fetch(url)
    const json = await res.json()
    return json.predictions ?? []
  } catch {
    return []
  }
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetail | null> {
  if (!PLACES_KEY) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry&key=${PLACES_KEY}`
    const res = await fetch(url)
    const json = await res.json()
    return json.result ?? null
  } catch {
    return null
  }
}

const CUISINE_OPTIONS = [
  'Japanese',
  'Chinese',
  'Korean',
  'Thai',
  'Vietnamese',
  'Indian',
  'Italian',
  'French',
  'Mediterranean',
  'Middle Eastern',
  'American',
  'Mexican',
  'Cafe',
  'Bakery',
  'Seafood',
  'Other',
]

async function upsertRestaurant(
  detail: PlaceDetail,
  placeId: string,
  cuisine?: string
): Promise<string | undefined> {
  const { data } = await (supabase.from('restaurants') as any)
    .upsert(
      {
        name: detail.name,
        address: detail.formatted_address,
        latitude: detail.geometry.location.lat,
        longitude: detail.geometry.location.lng,
        google_place_id: placeId,
        cuisine_type: cuisine ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'google_place_id' }
    )
    .select('id')
    .single()
  return data?.id
}

const IMG_COLORS = ['#EDE4DA', '#DCE8D8', '#D8E2EE', '#EDD8E2', '#E8D8CC', '#D6E2D6']

export default function PostScreen() {
  const router = useRouter()
  const { addPost } = usePosts()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  useEffect(() => {
    if (!user) requireAuth()
  }, [user])

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [foodRating, setFoodRating] = useState(0)
  const [vibeRating, setVibeRating] = useState(0)
  const [costRating, setCostRating] = useState(0)
  const [cuisineType, setCuisineType] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [predictionsLoading, setPredictionsLoading] = useState(false)
  const [selectingPlace, setSelectingPlace] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const postReady = title.trim().length >= 3

  function addPhoto() {
    if (photos.length >= 9) return
    setPhotos(prev => [...prev, IMG_COLORS[prev.length % IMG_COLORS.length]])
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  function handleHashtagKey(key: string) {
    if ((key === ' ' || key === 'Enter') && hashtagInput.trim()) {
      const tag = hashtagInput.trim().replace(/^#/, '').replace(/\s/g, '')
      if (tag && !hashtags.includes(tag) && hashtags.length < 10) {
        setHashtags(prev => [...prev, tag])
      }
      setHashtagInput('')
    }
  }

  function removeHashtag(tag: string) {
    setHashtags(prev => prev.filter(t => t !== tag))
  }

  const handleSearchChange = useCallback((text: string) => {
    setLocationSearch(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.length < 2) {
      setPredictions([])
      return
    }
    setPredictionsLoading(true)
    debounceRef.current = setTimeout(async () => {
      const results = await fetchPredictions(text)
      setPredictions(results)
      setPredictionsLoading(false)
    }, 300)
  }, [])

  function showCuisinePicker() {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...CUISINE_OPTIONS, 'Cancel'],
        cancelButtonIndex: CUISINE_OPTIONS.length,
        title: 'Cuisine type',
      },
      idx => {
        if (idx < CUISINE_OPTIONS.length) setCuisineType(CUISINE_OPTIONS[idx])
      }
    )
  }

  async function selectPrediction(item: Prediction) {
    setSelectingPlace(true)
    setLocationModalOpen(false)
    setLocationSearch('')
    setPredictions([])
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

  function handleSubmit() {
    addPost({
      title: title.trim(),
      body: body.trim(),
      imgKey: 'warm',
      tall: Math.random() > 0.5,
      tags: hashtags,
      location: selectedPlace
        ? `${selectedPlace.name}, ${selectedPlace.address.split(',')[1]?.trim() ?? ''}`
        : 'Unknown location',
      food: foodRating || 3,
      vibe: vibeRating || 3,
      cost: costRating || 2,
      cuisine_type: cuisineType || undefined,
      placeId: selectedPlace?.placeId,
      lat: selectedPlace?.lat,
      lng: selectedPlace?.lng,
      address: selectedPlace?.address,
      restaurantId: selectedPlace?.restaurantId,
    })
    setTitle('')
    setBody('')
    setFoodRating(0)
    setVibeRating(0)
    setCostRating(0)
    setCuisineType('')
    setSelectedPlace(null)
    setHashtags([])
    setHashtagInput('')
    setPhotos([])
    router.replace('/(tabs)/profile')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/feed')} style={styles.cancelBtn}>
          <ChevronLeft size={16} />
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>New review</Text>
        <TouchableOpacity
          style={[styles.postBtn, !postReady && styles.postBtnDisabled]}
          onPress={postReady ? handleSubmit : undefined}
          disabled={!postReady}
        >
          <Text style={styles.postBtnText}>Post</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {photos.length === 0 ? (
            <TouchableOpacity style={styles.photoUpload} onPress={addPhoto}>
              <ImagePlaceholder size={28} />
              <Text style={styles.uploadLabel}>Add photos or video</Text>
              <Text style={styles.uploadSub}>Tap to select from library</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}
            >
              {photos.map((color, idx) => (
                <View key={idx} style={[styles.thumb, { backgroundColor: color }]}>
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => removePhoto(idx)}>
                    <CloseIcon size={8} color={colors.bg} />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 9 && (
                <TouchableOpacity style={styles.thumbAdd} onPress={addPhoto}>
                  <PlusIcon />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          <View style={styles.section}>
            <TextInput
              style={styles.titleInput}
              placeholder="Give your review a title…"
              placeholderTextColor={colors.text3}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              multiline
            />
            <Text style={styles.charCount}>{title.length}/100</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <TextInput
              style={styles.bodyInput}
              placeholder="Share your experience — what did you order, what was the vibe, would you go back?"
              placeholderTextColor={colors.text3}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.ratingsRow}>
            <View style={styles.ratingChip}>
              <Text style={styles.ratingLabel}>FOOD</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setFoodRating(n)}>
                    <Text style={[styles.star, n <= foodRating && styles.starOn]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.ratingChip}>
              <Text style={styles.ratingLabel}>VIBE</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setVibeRating(n)}>
                    <Text style={[styles.star, n <= vibeRating && styles.starOn]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.ratingChip}>
              <Text style={styles.ratingLabel}>COST</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4].map(n => (
                  <TouchableOpacity key={n} onPress={() => setCostRating(n)}>
                    <Text style={[styles.dollar, n <= costRating && styles.dollarOn]}>$</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.locationWrap} onPress={showCuisinePicker}>
            <Text style={styles.cuisineEmoji}>🍽</Text>
            <Text
              style={[styles.locationText, cuisineType ? styles.locationFilled : null]}
              numberOfLines={1}
            >
              {cuisineType || 'Add cuisine type (optional)'}
            </Text>
            {cuisineType ? (
              <TouchableOpacity onPress={() => setCuisineType('')}>
                <Text style={styles.locationClear}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity style={styles.locationWrap} onPress={() => setLocationModalOpen(true)}>
            {selectingPlace ? (
              <ActivityIndicator
                size="small"
                color={colors.text3}
                style={{ width: 15, height: 15 }}
              />
            ) : (
              <PinIcon color={selectedPlace ? colors.accent : colors.text3} />
            )}
            <Text
              style={[styles.locationText, selectedPlace ? styles.locationFilled : null]}
              numberOfLines={1}
            >
              {selectedPlace ? selectedPlace.name : 'Add location (optional)'}
            </Text>
            {selectedPlace ? (
              <TouchableOpacity onPress={() => setSelectedPlace(null)}>
                <Text style={styles.locationClear}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>

          <View style={styles.hashtagWrap}>
            {hashtags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={styles.hashtagToken}
                onPress={() => removeHashtag(tag)}
              >
                <Text style={styles.hashtagTokenText}>#{tag} ×</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.hashtagField}
              placeholder={hashtags.length === 0 ? 'Add hashtags…' : ''}
              placeholderTextColor={colors.text3}
              value={hashtagInput}
              onChangeText={setHashtagInput}
              onKeyPress={({ nativeEvent }) => handleHashtagKey(nativeEvent.key)}
              onSubmitEditing={() => handleHashtagKey('Enter')}
              blurOnSubmit={false}
            />
          </View>
          <Text style={styles.hashtagHint}>Press space or enter to add a tag</Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={locationModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLocationModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setLocationModalOpen(false)}
        />
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Tag a restaurant</Text>
          <View style={styles.modalSearch}>
            <SearchIcon />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search restaurants…"
              placeholderTextColor={colors.text3}
              value={locationSearch}
              onChangeText={handleSearchChange}
              autoFocus
            />
            {predictionsLoading && <ActivityIndicator size="small" color={colors.text3} />}
          </View>
          {predictions.length > 0 ? (
            <FlatList
              data={predictions}
              keyExtractor={item => item.place_id}
              style={styles.locationList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.locationResult,
                    index === predictions.length - 1 && styles.locationResultLast,
                  ]}
                  onPress={() => selectPrediction(item)}
                >
                  <Text style={styles.locationResultName}>
                    {item.structured_formatting.main_text}
                  </Text>
                  <Text style={styles.locationResultSub}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.locationEmpty}>
              <Text style={styles.locationEmptyText}>
                {locationSearch.length < 2
                  ? 'Type to search restaurants'
                  : predictionsLoading
                    ? ''
                    : 'No results found'}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, marginLeft: -6 },
    cancelText: { fontSize: 14, color: c.text2 },
    screenTitle: { fontSize: 15, fontWeight: '500', color: c.text },
    postBtn: {
      backgroundColor: c.text,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 7,
    },
    postBtnDisabled: { opacity: 0.35 },
    postBtnText: { fontSize: 13, fontWeight: '500', color: c.bg },
    scroll: { flex: 1 },
    photoUpload: {
      margin: 14,
      marginHorizontal: 16,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.border2,
      borderRadius: 12,
      aspectRatio: 4 / 3,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.surface,
    },
    uploadLabel: { fontSize: 13, color: c.text2, fontWeight: '500' },
    uploadSub: { fontSize: 11, color: c.text3 },
    photoStrip: { gap: 6, padding: 16, paddingBottom: 14 },
    thumb: { width: 56, height: 56, borderRadius: 8, position: 'relative' },
    thumbRemove: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbAdd: {
      width: 56,
      height: 56,
      borderRadius: 8,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.border2,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    section: { paddingHorizontal: 16, paddingTop: 14 },
    titleInput: { fontSize: 16, fontWeight: '500', color: c.text, padding: 0, lineHeight: 22 },
    charCount: { fontSize: 10, color: c.text3, textAlign: 'right', marginTop: 2 },
    divider: { height: 0.5, backgroundColor: c.border, marginHorizontal: 16, marginTop: 14 },
    bodyInput: { fontSize: 13, color: c.text2, padding: 0, lineHeight: 21, minHeight: 80 },
    ratingsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 14,
      marginBottom: 14,
    },
    ratingChip: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 8,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 9,
      paddingHorizontal: 8,
      gap: 6,
    },
    ratingLabel: { fontSize: 9, color: c.text3, letterSpacing: 0.6 },
    starsRow: { flexDirection: 'row', gap: 2 },
    star: { fontSize: 14, color: c.surface2 },
    starOn: { color: '#EF9F27' },
    dollar: { fontSize: 11, fontWeight: '600', color: c.surface2, paddingHorizontal: 1 },
    dollarOn: { color: '#1D9E75' },
    cuisineEmoji: { fontSize: 15 },
    locationWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: c.surface,
      borderRadius: 8,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: 13,
      paddingVertical: 10,
      marginHorizontal: 16,
      marginBottom: 14,
    },
    locationText: { flex: 1, fontSize: 13, color: c.text3 },
    locationFilled: { color: c.text2 },
    locationClear: { fontSize: 11, color: c.text3 },
    hashtagWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 8,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: 13,
      paddingVertical: 8,
      marginHorizontal: 16,
      minHeight: 40,
    },
    hashtagToken: {
      backgroundColor: c.info,
      borderRadius: 20,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    hashtagTokenText: { fontSize: 11, color: '#fff' },
    hashtagField: { flex: 1, minWidth: 80, fontSize: 13, color: c.text, padding: 0 },
    hashtagHint: { fontSize: 11, color: c.text3, paddingHorizontal: 16, paddingTop: 6 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
    modal: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingBottom: 20,
      maxHeight: '70%',
    },
    modalHandle: {
      width: 36,
      height: 4,
      backgroundColor: c.surface2,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: c.text,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    modalSearch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: 8,
      marginHorizontal: 16,
      marginBottom: 10,
    },
    modalSearchInput: { flex: 1, fontSize: 13, color: c.text, padding: 0 },
    locationList: { paddingHorizontal: 16 },
    locationResult: { paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: c.border },
    locationResultLast: { borderBottomWidth: 0 },
    locationResultName: { fontSize: 13, color: c.text },
    locationResultSub: { fontSize: 11, color: c.text3, marginTop: 2 },
    locationEmpty: { paddingVertical: 24, alignItems: 'center' },
    locationEmptyText: { fontSize: 12, color: c.text3 },
  })
}
