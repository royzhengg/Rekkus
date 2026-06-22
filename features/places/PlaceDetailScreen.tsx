import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import React, { useState, useMemo, useCallback } from 'react'
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
  SaveIcon,
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
  fetchPlaceRowByGooglePlaceId,
  createUserPlace,
  submitCommunityVerification,
  submitDuplicatePlaceSuggestion,
  submitPlaceEditSuggestion,
  submitPlaceClaim,
  insertGooglePlace,
} from '@/lib/services/places'
import { parseLikes, todayHoursIndex } from '@/lib/utils/format'
import { routeParamNumber, routeParamString } from '@/lib/utils/routeParams'
import { PlaceDetailContent } from './PlaceDetailContent'
import { makeStyles } from './PlaceDetailScreen.styles'
import { PlaceDetailSheets } from './PlaceDetailSheets'
import { PlacePhotoGallery } from './PlacePhotoGallery'
import { usePlaceDetailLoader } from './usePlaceDetailLoader'
import type { PlaceAction } from './placeDetailUtils'
import type { PostSort } from './placeTypes'

export default function PlaceDetailScreen() {
  const {
    placeId: routePlaceId,
    googlePlaceId,
    name,
    address,
    lat,
    lng,
    searchSessionId,
    searchQuery,
    searchResultType,
    searchResultPosition,
  } = useLocalSearchParams<{
    placeId?: string
    googlePlaceId?: string
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

  const googlePlaceIdParam = routeParamString(googlePlaceId)
  const routeGooglePlaceId = googlePlaceIdParam && googlePlaceIdParam !== 'none' ? googlePlaceIdParam : null

  const contextPosts = useMemo(() => {
    if (!displayName) return []
    const byPlaceId = posts.filter(p => routeGooglePlaceId && p.placeId && p.placeId === routeGooglePlaceId)
    if (byPlaceId.length > 0) return byPlaceId
    const nameLower = (displayName.split(',')[0] ?? displayName).toLowerCase().trim()
    return posts.filter(p => p.location?.toLowerCase().includes(nameLower))
  }, [posts, routeGooglePlaceId, displayName])

  const contextPhotoUrls = useMemo(
    () =>
      contextPosts
        .map(p => p.imageUrl)
        .filter((url): url is string => typeof url === 'string' && url.length > 0)
        .filter((url, index, arr) => arr.indexOf(url) === index)
        .slice(0, 6),
    [contextPosts]
  )

  const rekkusRatingsFromPosts = useMemo(() => {
    if (contextPosts.length === 0) return null
    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    return {
      food: avg(contextPosts.map(p => p.food).filter((v): v is number => v != null)),
      vibe: avg(contextPosts.map(p => p.vibe).filter((v): v is number => v != null)),
      cost: avg(contextPosts.map(p => p.cost).filter((v): v is number => v != null)),
    }
  }, [contextPosts])

  const placeCuisineType = useMemo(() => {
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
      (resultType !== 'post' && resultType !== 'place' && resultType !== 'user' && resultType !== 'dish')
    ) return null
    return { searchSessionId: sessionId, query, resultType, resultPosition: position }
  }, [searchQuery, searchResultPosition, searchResultType, searchSessionId])

  const loader = usePlaceDetailLoader({
    routePlaceId,
    routeGooglePlaceId,
    displayName,
    displayAddress,
    user,
    contextPhotoUrls,
    placeCuisineType,
    searchAttribution,
  })

  const rekkusRatings = rekkusRatingsFromPosts ?? loader.dbRatings

  const [hoursExpanded, setHoursExpanded] = useState(false)
  const [sortPosts, setSortPosts] = useState<PostSort>('liked')
  const [galleryVisible, setGalleryVisible] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)
  const [sortSheetVisible, setSortSheetVisible] = useState(false)
  const [mapsSheetVisible, setMapsSheetVisible] = useState(false)
  const [placeActionsSheetVisible, setPlaceActionsSheetVisible] = useState(false)
  const [saveSheet, setSaveSheet] = useState(false)
  const [shareSheet, setShareSheet] = useState(false)
  const [notice, setNotice] = useState<{ title: string; subtitle?: string } | null>(null)
  const [operationError, setOperationError] = useState<{ title: string; message: string } | null>(null)
  const [collectionPickerVisible, setCollectionPickerVisible] = useState(false)
  const [confirmCollectionUnsave, setConfirmCollectionUnsave] = useState(false)

  const collectionPicker = useCollectionPicker(user?.id, 'place', loader.placeId ?? undefined)

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

  const findOrCreatePlace = useCallback(async (): Promise<string | null> => {
    if (loader.placeId) return loader.placeId
    const gid = loader.resolvedGooglePlaceId
    if (!gid) {
      const createdId = await createUserPlace({
        name: displayName,
        address: displayAddress,
        latitude: parsedLat,
        longitude: parsedLng,
      })
      if (createdId) loader.setPlaceId(createdId)
      return createdId
    }
    const existing = await fetchPlaceRowByGooglePlaceId(gid)
    if (existing?.id) {
      loader.setPlaceId(existing.id)
      return existing.id
    }
    if (parsedLat == null || parsedLng == null) return null
    const createdId = await insertGooglePlace({
      name: displayName,
      address: displayAddress,
      latitude: parsedLat,
      longitude: parsedLng,
      google_place_id: gid,
    })
    if (createdId) loader.setPlaceId(createdId)
    return createdId
  }, [loader, displayName, displayAddress, parsedLat, parsedLng])

  const toggleSave = useCallback(async () => {
    if (!user) return
    const wasSaved = loader.saved
    const pid = await findOrCreatePlace()
    if (!pid) { loader.setSaved(wasSaved); return }
    if (wasSaved) {
      try {
        const memberships = await fetchTargetCollectionItems(user.id, 'place', pid)
        if (memberships.length > 0) { setConfirmCollectionUnsave(true); return }
        await runDeferredMutation({ kind: 'place_save', placeId: pid, targetState: false })
        loader.setSaved(false)
      } catch { loader.setSaved(wasSaved) }
    } else {
      try {
        loader.setSaved(true)
        await runDeferredMutation({ kind: 'place_save', placeId: pid, targetState: true })
        void haptic.confirmSave()
        analytics.savePlace(user.id, pid, placeCuisineType, searchAttribution)
        setSaveSheet(true)
      } catch { loader.setSaved(wasSaved) }
    }
  }, [user, loader, findOrCreatePlace, runDeferredMutation, placeCuisineType, searchAttribution])

  const openCollectionPicker = useCallback(async () => {
    const pid = await findOrCreatePlace()
    if (!pid) {
      setOperationError({ title: 'Could not add to collection', message: 'Try again once this place has loaded.' })
      return
    }
    setCollectionPickerVisible(true)
  }, [findOrCreatePlace])

  const submitPlaceAction = useCallback(
    async (action: PlaceAction) => {
      setOperationError(null)
      if (!requireOnline()) {
        setOperationError({ title: 'You are offline', message: 'Reconnect to submit place information for review.' })
        return
      }
      const pid = await findOrCreatePlace()
      if (!pid) {
        setOperationError({ title: 'Could not save that yet', message: 'Try again after the place details finish loading.' })
        return
      }
      try {
        if (action === 'suggest_edit') {
          await submitPlaceEditSuggestion({
            placeId: pid, field: 'other',
            currentValue: { name: displayName, address: displayAddress },
            issueSummary: 'User reported that place metadata needs review.',
          })
          setNotice({ title: 'Suggestion submitted', subtitle: 'Thanks. This will go into the place data review queue.' })
        } else if (action === 'report_duplicate') {
          await submitDuplicatePlaceSuggestion({
            placeId: pid, duplicateName: displayName, duplicateAddress: displayAddress,
            ...(loader.resolvedGooglePlaceId ? { duplicateProvider: 'google_places', duplicateProviderPlaceId: loader.resolvedGooglePlaceId } : {}),
            reason: 'possible_duplicate_reported_from_place_detail',
          })
          setNotice({ title: 'Duplicate reported', subtitle: 'We saved this as duplicate evidence for manual review.' })
        } else if (action === 'verify_info') {
          await submitCommunityVerification({ placeId: pid })
          setNotice({ title: 'Verification submitted', subtitle: 'Thanks. Your signal helps Rekkus trust first-party place data.' })
        } else {
          await submitPlaceClaim({
            placeId: pid, reason: 'claim_submitted_from_place_detail',
            evidenceSummary: { source: 'place_detail_action', place_name: displayName },
          })
          setNotice({ title: 'Claim submitted', subtitle: 'Your claim is pending review before any owner tools are enabled.' })
        }
      } catch {
        setOperationError({ title: 'Could not submit', message: 'Check your connection and try again.' })
      }
    },
    [findOrCreatePlace, displayName, displayAddress, loader.resolvedGooglePlaceId, requireOnline]
  )

  const handlePlaceAction = useCallback(
    (value: string) => requireAuth(() => submitPlaceAction(value as PlaceAction)),
    [requireAuth, submitPlaceAction]
  )

  const openAddress = useCallback(() => { if (displayAddress) setMapsSheetVisible(true) }, [displayAddress])
  const openPhone = useCallback((phone: string) => { void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`) }, [])
  const openWebsite = useCallback((url: string) => { void WebBrowser.openBrowserAsync(url) }, [])
  const openSortSheet = useCallback(() => setSortSheetVisible(true), [])
  const openGallery = useCallback((index: number) => { setGalleryInitialIndex(index); setGalleryVisible(true) }, [])

  const openSelectedMap = useCallback(
    (provider: string) => {
      if (parsedLat == null || parsedLng == null) return
      if (provider === 'apple')
        void Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(displayName)}&ll=${parsedLat},${parsedLng}`)
      if (provider === 'google')
        void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${parsedLat},${parsedLng}`)
    },
    [displayName, parsedLat, parsedLng]
  )

  const goToMap = useCallback(() => {
    router.push(routes.placeMap({
      placeId: routePlaceId ?? 'none',
      googlePlaceId: loader.resolvedGooglePlaceId ?? routeGooglePlaceId ?? 'none',
      name: displayName, lat: latParam, lng: lngParam,
      phone: loader.detail?.formatted_phone_number ?? '',
      openNow: loader.detail?.opening_hours?.open_now != null ? String(loader.detail.opening_hours.open_now) : '',
      googleRating: loader.detail?.rating != null ? String(loader.detail.rating) : '',
      avgFood: rekkusRatings.food != null ? String(rekkusRatings.food.toFixed(1)) : '',
      avgVibe: rekkusRatings.vibe != null ? String(rekkusRatings.vibe.toFixed(1)) : '',
      avgCost: rekkusRatings.cost != null ? String(rekkusRatings.cost.toFixed(1)) : '',
      photoUrl: loader.photoUrls[0] ?? '',
      todayHours: loader.detail?.opening_hours?.weekday_text?.[todayHoursIndex()] ?? '',
    }))
  }, [router, routePlaceId, loader, routeGooglePlaceId, displayName, latParam, lngParam, rekkusRatings])

  const openNow = loader.detail?.opening_hours?.open_now
  const todayIdx = todayHoursIndex()
  const weekdayText = loader.detail?.opening_hours?.weekday_text ?? []
  const todayText = weekdayText[todayIdx]
  const hasRekkusRatings = rekkusRatings.food != null || rekkusRatings.vibe != null || rekkusRatings.cost != null
  const hasGoogleRating = loader.detail?.rating != null

  const contentProps = {
    styles, colors, refreshing: loader.refreshing, refresh: loader.refresh,
    photoUrls: loader.photoUrls, width, detail: loader.detail,
    name: displayName, address: displayAddress, openNow, hasGoogleRating, hasRekkusRatings,
    rekkusRatings, contextPosts, hasRecentPosts: loader.hasRecentPosts, topDishes: loader.topDishes,
    openAddress, openPhone, openWebsite, weekdayText, hoursExpanded, setHoursExpanded,
    todayIdx, todayText, popularDishes, sortedPosts, sortPosts, openSortSheet,
    openPlaceActions: () => setPlaceActionsSheetVisible(true), onPhotoPress: openGallery,
  }
  const sheetProps = {
    styles, colors, name: displayName, address: displayAddress,
    placeId: loader.placeId, detail: loader.detail,
    saveSheet, setSaveSheet, sortSheetVisible, setSortSheetVisible, sortPosts, setSortPosts,
    mapsSheetVisible, setMapsSheetVisible, openSelectedMap,
    placeActionsSheetVisible, setPlaceActionsSheetVisible, handlePlaceAction,
    shareSheet, setShareSheet, notice, setNotice,
  }

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
          <IconButton accessibilityLabel={loader.saved ? 'Remove saved place' : 'Save place'} onPress={() => requireAuth(toggleSave)}>
            <SaveIcon filled={loader.saved} />
          </IconButton>
          <IconButton accessibilityLabel="Add place to collection" onPress={() => requireAuth(() => { void openCollectionPicker() })}>
            <PlusIcon />
          </IconButton>
          <IconButton accessibilityLabel="Share place" onPress={() => setShareSheet(true)}>
            <ShareIcon />
          </IconButton>
        </View>
      </View>

      {operationError ? (
        <ErrorMessage title={operationError.title} message={operationError.message} style={{ marginHorizontal: spacing[4] }} />
      ) : null}

      {loader.loading ? (
        <View style={styles.loadingContainer}>
          <Skeleton width="100%" height={220} radius={0} />
          <View style={styles.infoSection}>
            <Skeleton width="70%" height={28} />
            <SkeletonText lines={3} />
          </View>
        </View>
      ) : (
        <PlaceDetailContent {...contentProps} />
      )}

      <PlaceDetailSheets {...sheetProps} />
      <SavedTargetCollectionSheets
        pickerVisible={collectionPickerVisible}
        confirmUnsaveVisible={confirmCollectionUnsave}
        targetLabel="place"
        collections={collectionPicker.collections}
        loading={collectionPicker.loading}
        onDismissPicker={() => setCollectionPickerVisible(false)}
        onSelectCollection={collectionId => {
          void collectionPicker.add(collectionId).then(() => {
            analytics.collectionInteraction(user?.id ?? null, 'add_item', collectionId, { target_type: 'place' })
            setCollectionPickerVisible(false)
            loader.setSaved(true)
          }).catch(() => setOperationError({ title: 'Could not add to collection', message: 'Check your connection and try again.' }))
        }}
        onCreateCollection={collectionName => {
          void collectionPicker.createAndAdd(collectionName).then(collection => {
            if (!collection) return
            analytics.collectionInteraction(user?.id ?? null, 'create_and_add', collection.id, { target_type: 'place' })
            setCollectionPickerVisible(false)
            loader.setSaved(true)
          }).catch(() => setOperationError({ title: 'Could not create collection', message: 'Check your connection and try again.' }))
        }}
        onDismissConfirmUnsave={() => setConfirmCollectionUnsave(false)}
        onConfirmUnsave={() => {
          if (!loader.placeId) return
          void runDeferredMutation({ kind: 'place_save', placeId: loader.placeId, targetState: false, removeCollectionMemberships: true }).then(() => {
            loader.setSaved(false)
          }).catch(() => setOperationError({ title: 'Could not remove saved place', message: 'Check your connection and try again.' }))
        }}
      />
      <PlacePhotoGallery
        visible={galleryVisible}
        photos={loader.photoUrls}
        initialIndex={galleryInitialIndex}
        onClose={() => setGalleryVisible(false)}
      />
    </SafeAreaView>
  )
}
