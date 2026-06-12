import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ChevronLeft,
  NavIcon,
  BookmarkIcon,
  ShareIcon,
  PlusIcon,
} from '@/components/icons'
import { SavedTargetCollectionSheets } from '@/components/SavedTargetCollectionSheets'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { IconButton } from '@/components/ui/IconButton'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { spacing } from '@/constants/Spacing'
import { analytics } from '@/lib/analytics'
import type { SearchAttribution } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { useCollectionPicker } from '@/lib/hooks/useCollectionPicker'
import { routes } from '@/lib/routes'
import { fetchTargetCollectionItems } from '@/lib/services/collections'
import {
  fetchPlaceIdByTextSearch,
  fetchRestaurantProviderDetail,
  createUserRestaurant,
  getRestaurantDisplayPhotos,
  submitCommunityVerification,
  submitDuplicateRestaurantSuggestion,
  submitRestaurantEditSuggestion,
  submitRestaurantClaim,
  fetchRestaurantRow,
  fetchRestaurantRowByPlaceId,
  cacheRestaurantGoogleData,
  fetchRestaurantPostRatings,
  fetchIsLocationSaved,
  insertGoogleRestaurant,
} from '@/lib/services/restaurants'
import { parseLikes, todayHoursIndex } from '@/lib/utils/format'
import { routeParamNumber, routeParamString } from '@/lib/utils/routeParams'
import { RestaurantDetailContent } from './RestaurantDetailContent'
import { makeStyles } from './RestaurantDetailScreen.styles'
import { RestaurantDetailSheets } from './RestaurantDetailSheets'
import { RestaurantPhotoGallery } from './RestaurantPhotoGallery'
import type { PlaceDetail, PostSort } from './restaurantTypes'

type RestaurantAction = 'suggest_edit' | 'report_duplicate' | 'verify_info' | 'claim_restaurant'

type DbRatings = { food: number | null; vibe: number | null; cost: number | null }

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

function weightedAvg(rows: Array<{ rating: number | null; created_at: string }>): number | null {
  let sum = 0
  let total = 0
  for (const { rating, created_at } of rows) {
    if (rating == null) continue
    const w = Date.now() - new Date(created_at).getTime() <= NINETY_DAYS_MS ? 2 : 1
    sum += rating * w
    total += w
  }
  return total > 0 ? sum / total : null
}

export default function RestaurantDetailScreen() {
  const {
    restaurantId: routeRestaurantId,
    placeId,
    name,
    address,
    lat,
    lng,
    searchSessionId,
    searchQuery,
    searchResultType,
    searchResultPosition,
  } = useLocalSearchParams<{
    restaurantId?: string
    placeId?: string
    name: string
    address: string
    lat: string
    lng: string
    searchSessionId?: string
    searchQuery?: string
    searchResultType?: string
    searchResultPosition?: string
  }>()
  const router = useRouter()
  const { user } = useAuth()
  const { runDeferredMutation, requireOnline } = useConnectivity()
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { width } = useWindowDimensions()
  const { posts } = usePosts()

  const displayName = routeParamString(name) ?? ''
  const displayAddress = routeParamString(address) ?? ''
  const latParam = routeParamString(lat) ?? ''
  const lngParam = routeParamString(lng) ?? ''
  const parsedLat = routeParamNumber(lat)
  const parsedLng = routeParamNumber(lng)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [detail, setDetail] = useState<PlaceDetail | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saveSheet, setSaveSheet] = useState(false)
  const [dbRatings, setDbRatings] = useState<DbRatings>({ food: null, vibe: null, cost: null })
  const [hasRecentReviews, setHasRecentReviews] = useState(false)
  const [topDishes, setTopDishes] = useState<Array<{ name: string; dishId?: string | undefined }>>([])
  const [hoursExpanded, setHoursExpanded] = useState(false)
  const [sortPosts, setSortPosts] = useState<PostSort>('liked')
  const [galleryVisible, setGalleryVisible] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)
  const [sortSheetVisible, setSortSheetVisible] = useState(false)
  const [mapsSheetVisible, setMapsSheetVisible] = useState(false)
  const [restaurantActionsSheetVisible, setRestaurantActionsSheetVisible] = useState(false)
  const [shareSheet, setShareSheet] = useState(false)
  const [notice, setNotice] = useState<{ title: string; subtitle?: string } | null>(null)
  const [operationError, setOperationError] = useState<{ title: string; message: string } | null>(null)
  const [collectionPickerVisible, setCollectionPickerVisible] = useState(false)
  const [confirmCollectionUnsave, setConfirmCollectionUnsave] = useState(false)
  const placeIdParam = routeParamString(placeId)
  const routePlaceId = placeIdParam && placeIdParam !== 'none' ? placeIdParam : null
  const [resolvedPid, setResolvedPid] = useState<string | null>(
    routePlaceId && routePlaceId !== 'none' ? routePlaceId : null
  )
  const collectionPicker = useCollectionPicker(user?.id, 'restaurant', restaurantId ?? undefined)

  // Filter PostsContext posts by placeId, fall back to name match
  const contextPosts = useMemo(() => {
    if (!displayName) return []
    const byPlaceId = posts.filter(p => routePlaceId && p.placeId && p.placeId === routePlaceId)
    if (byPlaceId.length > 0) return byPlaceId
    const nameLower = (displayName.split(',')[0] ?? displayName).toLowerCase().trim()
    return posts.filter(p => p.location?.toLowerCase().includes(nameLower))
  }, [posts, routePlaceId, displayName])

  const contextPhotoUrls = useMemo(
    () =>
      contextPosts
        .map(p => p.imageUrl)
        .filter((url): url is string => typeof url === 'string' && url.length > 0)
        .filter((url, index, arr) => arr.indexOf(url) === index)
        .slice(0, 6),
    [contextPosts]
  )

  // Compute Rekkus averages from contextPosts (fall back to Supabase if empty)
  const rekkusRatings = useMemo(() => {
    if (contextPosts.length === 0) return dbRatings
    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    return {
      food: avg(contextPosts.map(p => p.food)),
      vibe: avg(contextPosts.map(p => p.vibe)),
      cost: avg(contextPosts.map(p => p.cost)),
    }
  }, [contextPosts, dbRatings])

  const sortedPosts = useMemo(() => {
    const arr = [...contextPosts]
    if (sortPosts === 'liked') arr.sort((a, b) => parseLikes(b.likes) - parseLikes(a.likes))
    else if (sortPosts === 'newest') arr.sort((a, b) => b.id - a.id)
    else arr.sort((a, b) => a.id - b.id)
    return arr
  }, [contextPosts, sortPosts])

  const popularDishes = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of contextPosts) {
      for (const tag of p.dishTags ?? []) {
        const key = tag.name.toLowerCase()
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
      }))
  }, [contextPosts])

  const restaurantCuisineType = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const post of contextPosts) {
      const cuisine = post.cuisine_type?.trim()
      if (cuisine) counts[cuisine] = (counts[cuisine] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }, [contextPosts])
  const searchAttribution = useMemo<SearchAttribution | null>(() => {
    const sessionId = routeParamString(searchSessionId)
    const query = routeParamString(searchQuery)
    const resultType = routeParamString(searchResultType)
    const position = routeParamNumber(searchResultPosition)
    if (
      !sessionId ||
      !query ||
      position == null ||
      (resultType !== 'post' && resultType !== 'restaurant' && resultType !== 'user' && resultType !== 'dish')
    ) {
      return null
    }
    return { searchSessionId: sessionId, query, resultType, resultPosition: position }
  }, [searchQuery, searchResultPosition, searchResultType, searchSessionId])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (refreshTrigger === 0) setLoading(true)
      else setRefreshing(true)

      let effectivePid: string | null = routePlaceId && routePlaceId !== 'none' ? routePlaceId : null

      // When only a Supabase UUID is available, resolve the canonical google_place_id from the
      // restaurants table before calling Google Places — avoids relying on the denormalised
      // restaurant_place_id field on the post row, which can be stale or mismatched.
      let preloadedRestaurantData: { id: string; google_place_id: string | null; google_photo_refs: string[] } | null = null
      if (!effectivePid && routeRestaurantId && routeRestaurantId !== 'none') {
        preloadedRestaurantData = await fetchRestaurantRow(routeRestaurantId)
        if (preloadedRestaurantData?.google_place_id) {
          effectivePid = preloadedRestaurantData.google_place_id
          if (!cancelled) setResolvedPid(effectivePid)
        }
      }

      if (!effectivePid && displayName) {
        effectivePid = await textSearchPlace(displayName)
        if (!cancelled && effectivePid) setResolvedPid(effectivePid)
      }

      const [placeResult, restaurantRowResult] = await Promise.all([
        effectivePid ? fetchPlaceDetail(effectivePid) : Promise.resolve(null),
        preloadedRestaurantData
          ? Promise.resolve(preloadedRestaurantData)
          : effectivePid
            ? fetchRestaurantRowByPlaceId(effectivePid)
            : Promise.resolve(null),
      ])

      if (cancelled) return

      const refs = (placeResult?.photos ?? [])
        .slice(0, 6)
        .map(p => p.photo_reference)
        .filter((ref): ref is string => typeof ref === 'string')
      const cachedRefs = restaurantRowResult?.google_photo_refs ?? []
      const providerRefs = refs.length > 0 ? refs : cachedRefs

      if (placeResult) {
        setDetail(placeResult)
      }

      const resId: string | null = restaurantRowResult?.id ?? null
      if (resId) setRestaurantId(resId)

      if (contextPhotoUrls.length > 0) {
        setPhotoUrls(contextPhotoUrls)
      } else {
        const displayPhotos = await getRestaurantDisplayPhotos(resId, providerRefs, 6)
        if (!cancelled) setPhotoUrls(displayPhotos)
      }

      // Cache Google rating lazily and track detail view — both fire-and-forget
      if (resId && (placeResult?.rating != null || placeResult?.opening_hours?.open_now != null)) {
        cacheRestaurantGoogleData(resId, {
          google_rating: placeResult.rating ?? null,
          google_review_count: placeResult.user_ratings_total ?? null,
          open_now: placeResult.opening_hours?.open_now ?? null,
          open_now_checked_at:
            placeResult.opening_hours?.open_now == null ? null : new Date().toISOString(),
        })
      }
      if (resId && user) {
        analytics.viewPlace(user.id, resId, undefined, restaurantCuisineType, searchAttribution)
      }

      if (resId) {
        const [rows, locationSaved] = await Promise.all([
          fetchRestaurantPostRatings(resId),
          user ? fetchIsLocationSaved(user.id, resId) : Promise.resolve(false),
        ])

        if (cancelled) return

        if (rows.length > 0) {
          setDbRatings({
            food: weightedAvg(rows.map(r => ({ rating: r.food_rating, created_at: r.created_at }))),
            vibe: weightedAvg(rows.map(r => ({ rating: r.vibe_rating, created_at: r.created_at }))),
            cost: weightedAvg(rows.map(r => ({ rating: r.cost_rating, created_at: r.created_at }))),
          })
          setHasRecentReviews(
            rows.some(r => Date.now() - new Date(r.created_at).getTime() <= NINETY_DAYS_MS)
          )
          const dishCounts: Record<string, { count: number; dishId?: string | undefined }> = {}
          for (const r of rows) {
            const d = r.must_order?.trim()
            if (d) {
              const key = d.toLowerCase()
              const existing = dishCounts[key]
              dishCounts[key] = {
                count: (existing?.count ?? 0) + 1,
                ...(existing?.dishId || r.dish_id ? { dishId: existing?.dishId ?? r.dish_id ?? undefined } : {}),
              }
            }
          }
          setTopDishes(
            Object.entries(dishCounts)
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 3)
              .map(([name, metadata]) => ({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                ...(metadata.dishId ? { dishId: metadata.dishId } : {}),
              }))
          )
        }

        if (locationSaved) setSaved(true)
      }

      if (!cancelled) {
        setLoading(false)
        setRefreshing(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [routePlaceId, routeRestaurantId, user, displayName, refreshTrigger, contextPhotoUrls, restaurantCuisineType, searchAttribution])

  const findOrCreateRestaurant = useCallback(async (): Promise<string | null> => {
    if (restaurantId) return restaurantId
    const pid = resolvedPid
    if (!pid) {
      const createdId = await createUserRestaurant({
        name: displayName,
        address: displayAddress,
        latitude: parsedLat,
        longitude: parsedLng,
      })
      if (createdId) setRestaurantId(createdId)
      return createdId
    }

    const existing = await fetchRestaurantRowByPlaceId(pid)
    if (existing?.id) {
      setRestaurantId(existing.id)
      return existing.id
    }
    if (parsedLat == null || parsedLng == null) return null

    const createdId = await insertGoogleRestaurant({
      name: displayName,
      address: displayAddress,
      latitude: parsedLat,
      longitude: parsedLng,
      google_place_id: pid,
    })
    if (createdId) setRestaurantId(createdId)
    return createdId
  }, [restaurantId, resolvedPid, displayName, displayAddress, parsedLat, parsedLng])

  const toggleSave = useCallback(async () => {
    if (!user) return
    const wasSaved = saved
    const resId = await findOrCreateRestaurant()
    if (!resId) {
      setSaved(wasSaved)
      return
    }
    if (wasSaved) {
      try {
        const memberships = await fetchTargetCollectionItems(user.id, 'restaurant', resId)
        if (memberships.length > 0) {
          setConfirmCollectionUnsave(true)
          return
        }
        await runDeferredMutation({ kind: 'place_save', restaurantId: resId, targetState: false })
        setSaved(false)
      } catch {
        setSaved(wasSaved)
      }
    } else {
      try {
        setSaved(true)
        await runDeferredMutation({ kind: 'place_save', restaurantId: resId, targetState: true })
        void haptic.confirmSave()
        analytics.savePlace(user.id, resId, restaurantCuisineType, searchAttribution)
        setSaveSheet(true)
      } catch {
        setSaved(wasSaved)
      }
    }
  }, [user, saved, findOrCreateRestaurant, runDeferredMutation, restaurantCuisineType, searchAttribution])

  const openCollectionPicker = useCallback(async () => {
    const resId = await findOrCreateRestaurant()
    if (!resId) {
      setOperationError({ title: 'Could not add to collection', message: 'Try again once this place has loaded.' })
      return
    }
    setCollectionPickerVisible(true)
  }, [findOrCreateRestaurant])

  const submitRestaurantAction = useCallback(
    async (action: RestaurantAction) => {
      setOperationError(null)
      if (!requireOnline()) {
        setOperationError({ title: 'You are offline', message: 'Reconnect to submit place information for review.' })
        return
      }
      const resId = await findOrCreateRestaurant()
      if (!resId) {
        setOperationError({ title: 'Could not save that yet', message: 'Try again after the restaurant details finish loading.' })
        return
      }

      try {
        if (action === 'suggest_edit') {
          await submitRestaurantEditSuggestion({
            restaurantId: resId,
            field: 'other',
            currentValue: { name: displayName, address: displayAddress },
            issueSummary: 'User reported that restaurant metadata needs review.',
          })
          setNotice({ title: 'Suggestion submitted', subtitle: 'Thanks. This will go into the restaurant data review queue.' })
        } else if (action === 'report_duplicate') {
          await submitDuplicateRestaurantSuggestion({
            restaurantId: resId,
            duplicateName: displayName,
            duplicateAddress: displayAddress,
            ...(resolvedPid ? { duplicateProvider: 'google_places', duplicateProviderPlaceId: resolvedPid } : {}),
            reason: 'possible_duplicate_reported_from_restaurant_detail',
          })
          setNotice({ title: 'Duplicate reported', subtitle: 'We saved this as duplicate evidence for manual review.' })
        } else if (action === 'verify_info') {
          await submitCommunityVerification({ restaurantId: resId })
          setNotice({ title: 'Verification submitted', subtitle: 'Thanks. Your signal helps Rekkus trust first-party place data.' })
        } else {
          await submitRestaurantClaim({
            restaurantId: resId,
            reason: 'claim_submitted_from_restaurant_detail',
            evidenceSummary: { source: 'restaurant_detail_action', restaurant_name: displayName },
          })
          setNotice({ title: 'Claim submitted', subtitle: 'Your claim is pending review before any owner tools are enabled.' })
        }
      } catch {
        setOperationError({ title: 'Could not submit', message: 'Check your connection and try again.' })
      }
    },
    [findOrCreateRestaurant, displayName, displayAddress, resolvedPid, requireOnline]
  )

  const handleRestaurantAction = useCallback(
    (value: string) => {
      requireAuth(() => submitRestaurantAction(value as RestaurantAction))
    },
    [requireAuth, submitRestaurantAction]
  )

  const openAddress = useCallback(() => {
    if (!displayAddress) return
    setMapsSheetVisible(true)
  }, [displayAddress])

  const openSelectedMap = useCallback(
    (provider: string) => {
      if (parsedLat == null || parsedLng == null) return
      if (provider === 'apple')
        void Linking.openURL(
          `https://maps.apple.com/?q=${encodeURIComponent(displayName)}&ll=${parsedLat},${parsedLng}`
        )
      if (provider === 'google')
        void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${parsedLat},${parsedLng}`)
    },
    [displayName, parsedLat, parsedLng]
  )

  const openPhone = useCallback((phone: string) => {
    void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)
  }, [])

  const openWebsite = useCallback((url: string) => {
    void WebBrowser.openBrowserAsync(url)
  }, [])

  const openSortSheet = useCallback(() => {
    setSortSheetVisible(true)
  }, [])

  const goToMap = useCallback(() => {
    router.push(routes.restaurantMap({
      restaurantId: resolvedPid ?? routePlaceId ?? 'none',
      placeId: resolvedPid ?? routePlaceId ?? 'none',
      name: displayName,
      lat: latParam,
      lng: lngParam,
      phone: detail?.formatted_phone_number ?? '',
      openNow: detail?.opening_hours?.open_now != null ? String(detail.opening_hours.open_now) : '',
      googleRating: detail?.rating != null ? String(detail.rating) : '',
      avgFood: rekkusRatings.food != null ? String(rekkusRatings.food.toFixed(1)) : '',
      avgVibe: rekkusRatings.vibe != null ? String(rekkusRatings.vibe.toFixed(1)) : '',
      avgCost: rekkusRatings.cost != null ? String(rekkusRatings.cost.toFixed(1)) : '',
      photoUrl: photoUrls[0] ?? '',
      todayHours: detail?.opening_hours?.weekday_text?.[todayHoursIndex()] ?? '',
    }))
  }, [router, routePlaceId, resolvedPid, displayName, latParam, lngParam, detail, rekkusRatings, photoUrls])

  const openGallery = useCallback((index: number) => {
    setGalleryInitialIndex(index)
    setGalleryVisible(true)
  }, [])

  const openNow = detail?.opening_hours?.open_now
  const todayIdx = todayHoursIndex()
  const weekdayText = detail?.opening_hours?.weekday_text ?? []
  const todayText = weekdayText[todayIdx]
  const hasRekkusRatings =
    rekkusRatings.food != null || rekkusRatings.vibe != null || rekkusRatings.cost != null
  const hasGoogleRating = detail?.rating != null
  const contentProps = { styles, colors, refreshing, refresh: () => setRefreshTrigger(t => t + 1), photoUrls, width, detail, name: displayName, address: displayAddress, openNow, hasGoogleRating, hasRekkusRatings, rekkusRatings, contextPosts, hasRecentReviews, topDishes, openAddress, openPhone, openWebsite, weekdayText, hoursExpanded, setHoursExpanded, todayIdx, todayText, popularDishes, sortedPosts, sortPosts, openSortSheet, openRestaurantActions: () => setRestaurantActionsSheetVisible(true), onPhotoPress: openGallery }
  const sheetProps = { styles, colors, name: displayName, address: displayAddress, restaurantId, detail, saveSheet, setSaveSheet, sortSheetVisible, setSortSheetVisible, sortPosts, setSortPosts, mapsSheetVisible, setMapsSheetVisible, openSelectedMap, restaurantActionsSheetVisible, setRestaurantActionsSheetVisible, handleRestaurantAction, shareSheet, setShareSheet, notice, setNotice }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <IconButton accessibilityLabel="Open map" onPress={goToMap}>
            <NavIcon />
          </IconButton>
          <IconButton accessibilityLabel={saved ? 'Remove saved restaurant' : 'Save restaurant'} onPress={() => requireAuth(toggleSave)}>
            <BookmarkIcon filled={saved} />
          </IconButton>
          <IconButton accessibilityLabel="Add restaurant to collection" onPress={() => requireAuth(() => { void openCollectionPicker() })}>
            <PlusIcon />
          </IconButton>
          <IconButton accessibilityLabel="Share restaurant" onPress={() => setShareSheet(true)}>
            <ShareIcon />
          </IconButton>
        </View>
      </View>

      {operationError ? (
        <ErrorMessage title={operationError.title} message={operationError.message} style={{ marginHorizontal: spacing[4] }} />
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <Skeleton width="100%" height={220} radius={0} />
          <View style={styles.infoSection}>
            <Skeleton width="70%" height={28} />
            <SkeletonText lines={3} />
          </View>
        </View>
      ) : (
        <RestaurantDetailContent {...contentProps} />
      )}

      <RestaurantDetailSheets {...sheetProps} />
      <SavedTargetCollectionSheets
        pickerVisible={collectionPickerVisible}
        confirmUnsaveVisible={confirmCollectionUnsave}
        targetLabel="place"
        collections={collectionPicker.collections}
        loading={collectionPicker.loading}
        onDismissPicker={() => setCollectionPickerVisible(false)}
        onSelectCollection={collectionId => {
          void collectionPicker.add(collectionId).then(() => {
            analytics.collectionInteraction(user?.id ?? null, 'add_item', collectionId, { target_type: 'restaurant' })
            setCollectionPickerVisible(false)
            setSaved(true)
          }).catch(() => setOperationError({ title: 'Could not add to collection', message: 'Check your connection and try again.' }))
        }}
        onCreateCollection={collectionName => {
          void collectionPicker.createAndAdd(collectionName).then(collection => {
            if (!collection) return
            analytics.collectionInteraction(user?.id ?? null, 'create_and_add', collection.id, { target_type: 'restaurant' })
            setCollectionPickerVisible(false)
            setSaved(true)
          }).catch(() => setOperationError({ title: 'Could not create collection', message: 'Check your connection and try again.' }))
        }}
        onDismissConfirmUnsave={() => setConfirmCollectionUnsave(false)}
        onConfirmUnsave={() => {
          if (!restaurantId) return
          void runDeferredMutation({ kind: 'place_save', restaurantId, targetState: false, removeCollectionMemberships: true }).then(() => {
            setSaved(false)
          }).catch(() => setOperationError({ title: 'Could not remove saved place', message: 'Check your connection and try again.' }))
        }}
      />
      <RestaurantPhotoGallery
        visible={galleryVisible}
        photos={photoUrls}
        initialIndex={galleryInitialIndex}
        onClose={() => setGalleryVisible(false)}
      />
    </SafeAreaView>
  )
}

async function textSearchPlace(query: string): Promise<string | null> {
  return fetchPlaceIdByTextSearch(query)
}

async function fetchPlaceDetail(placeId: string): Promise<PlaceDetail | null> {
  const fields =
    'rating,user_ratings_total,formatted_phone_number,website,opening_hours,price_level,photos,types,business_status,geometry'
  return fetchRestaurantProviderDetail(placeId, fields)
}
