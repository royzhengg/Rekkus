import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { supabase } from '@/lib/supabase'
import { usePosts } from '@/lib/contexts/PostsContext'
import { imgColors } from '@/constants/Colors'
import {
  ChevronLeft,
  NavIcon,
  BookmarkIcon,
  PhoneIcon,
  GlobeIcon,
  PinIcon,
  ClockIcon,
  ChevronDown,
  SortIcon,
  ImagePlaceholder,
  ShareIcon,
} from '@/components/icons'
import { Stars, Vibes, Dollars, PostRatingStrip } from '@/components/RatingDisplay'
import { OpenBadge } from '@/components/OpenBadge'
import { IconButton } from '@/components/ui/IconButton'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import {
  fetchPlaceIdByTextSearch,
  fetchRestaurantProviderDetail,
  createUserRestaurant,
  getRestaurantDisplayPhotos,
  submitCommunityVerification,
  submitDuplicateRestaurantSuggestion,
  submitRestaurantEditSuggestion,
  submitRestaurantClaim,
} from '@/lib/services/restaurants'
import { analytics } from '@/lib/analytics'
import { parseLikes, todayHoursIndex } from '@/lib/utils/format'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
const PHOTO_HEIGHT = 220

type PostSort = 'liked' | 'newest' | 'oldest'
const SORT_LABELS: Record<PostSort, string> = {
  liked: 'Most liked',
  newest: 'Newest',
  oldest: 'Oldest',
}

type RestaurantAction = 'suggest_edit' | 'report_duplicate' | 'verify_info' | 'claim_restaurant'

type PlacesDetail = {
  rating?: number
  user_ratings_total?: number
  formatted_phone_number?: string
  website?: string
  price_level?: number
  types?: string[]
  business_status?: string
  opening_hours?: {
    open_now?: boolean
    weekday_text?: string[]
  }
  photos?: { photo_reference: string }[]
  geometry?: { location: { lat: number; lng: number } }
}

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

function formatCategory(types: string[] | undefined): string {
  if (!types) return ''
  const skip = new Set(['establishment', 'food', 'point_of_interest', 'store', 'premise'])
  const found = types.find(t => !skip.has(t))
  if (!found) return ''
  return found.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatPriceLevel(level: number | undefined): string {
  if (level == null) return ''
  return '$'.repeat(Math.max(1, level))
}

export default function RestaurantDetailScreen() {
  const {
    restaurantId: routeRestaurantId,
    placeId,
    name,
    address,
    lat,
    lng,
  } = useLocalSearchParams<{
    restaurantId?: string
    placeId?: string
    name: string
    address: string
    lat: string
    lng: string
  }>()
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { width } = useWindowDimensions()
  const { posts } = usePosts()

  const parsedLat = parseFloat(lat)
  const parsedLng = parseFloat(lng)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [detail, setDetail] = useState<PlacesDetail | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saveSheet, setSaveSheet] = useState(false)
  const [dbRatings, setDbRatings] = useState<DbRatings>({ food: null, vibe: null, cost: null })
  const [hasRecentReviews, setHasRecentReviews] = useState(false)
  const [topDishes, setTopDishes] = useState<string[]>([])
  const [hoursExpanded, setHoursExpanded] = useState(false)
  const [sortPosts, setSortPosts] = useState<PostSort>('liked')
  const [sortSheetVisible, setSortSheetVisible] = useState(false)
  const [mapsSheetVisible, setMapsSheetVisible] = useState(false)
  const [restaurantActionsSheetVisible, setRestaurantActionsSheetVisible] = useState(false)
  const [shareSheet, setShareSheet] = useState(false)
  const [notice, setNotice] = useState<{ title: string; subtitle?: string } | null>(null)
  const routePlaceId = placeId && placeId !== 'none' ? placeId : null
  const [resolvedPid, setResolvedPid] = useState<string | null>(
    routePlaceId && routePlaceId !== 'none' ? routePlaceId : null
  )

  // Filter PostsContext posts by placeId, fall back to name match
  const contextPosts = useMemo(() => {
    if (!name) return []
    const byPlaceId = posts.filter(p => routePlaceId && p.placeId && p.placeId === routePlaceId)
    if (byPlaceId.length > 0) return byPlaceId
    const nameLower = name.split(',')[0].toLowerCase().trim()
    return posts.filter(p => p.location?.toLowerCase().includes(nameLower))
  }, [posts, routePlaceId, name])

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
        const { data } = await (supabase.from('restaurants') as any)
          .select('id, google_place_id, google_photo_refs')
          .eq('id', routeRestaurantId)
          .maybeSingle()
        preloadedRestaurantData = data ?? null
        if (preloadedRestaurantData?.google_place_id) {
          effectivePid = preloadedRestaurantData.google_place_id
          if (!cancelled) setResolvedPid(effectivePid)
        }
      }

      if (!effectivePid && name) {
        effectivePid = await textSearchPlace(name)
        if (!cancelled && effectivePid) setResolvedPid(effectivePid)
      }

      const [placeResult, restaurantResult] = await Promise.all([
        effectivePid ? fetchPlaceDetail(effectivePid) : Promise.resolve(null),
        preloadedRestaurantData
          ? Promise.resolve({ data: preloadedRestaurantData })
          : effectivePid
            ? (supabase.from('restaurants') as any)
                .select('id, google_place_id, google_photo_refs')
                .eq('google_place_id', effectivePid)
                .maybeSingle()
            : Promise.resolve({ data: null }),
      ])

      if (cancelled) return

      const refs = (placeResult?.photos ?? [])
        .slice(0, 6)
        .map((p: { photo_reference: string }) => p.photo_reference)
      const cachedRefs = (restaurantResult?.data?.google_photo_refs ?? []) as string[]
      const providerRefs = refs.length > 0 ? refs : cachedRefs

      if (placeResult) {
        setDetail(placeResult)
      }

      const resId: string | null = restaurantResult?.data?.id ?? null
      if (resId) setRestaurantId(resId)

      if (contextPhotoUrls.length > 0) {
        setPhotoUrls(contextPhotoUrls)
      } else {
        const displayPhotos = await getRestaurantDisplayPhotos(resId, providerRefs, 6)
        if (!cancelled) setPhotoUrls(displayPhotos)
      }

      // Cache Google rating lazily and track detail view — both fire-and-forget
      if (resId && (placeResult?.rating != null || placeResult?.opening_hours?.open_now != null)) {
        ;(supabase.from('restaurants') as any)
          .update({
            google_rating: placeResult.rating,
            google_review_count: placeResult.user_ratings_total ?? null,
            open_now: placeResult.opening_hours?.open_now ?? null,
            open_now_checked_at:
              placeResult.opening_hours?.open_now == null ? null : new Date().toISOString(),
          })
          .eq('id', resId)
          .then(() => {})
      }
      if (resId && user) {
        analytics.viewPlace(user.id, resId)
      }

      if (resId) {
        const [ratingsRes, savedRes] = await Promise.all([
          (supabase.from('posts') as any)
            .select('food_rating, vibe_rating, cost_rating, created_at, best_dish')
            .eq('restaurant_id', resId)
            .limit(100),
          user
            ? (supabase.from('saved_locations') as any)
                .select('id')
                .eq('user_id', user.id)
                .eq('restaurant_id', resId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ])

        if (cancelled) return

        if (ratingsRes.data && ratingsRes.data.length > 0) {
          const rows = ratingsRes.data as {
            food_rating: number | null
            vibe_rating: number | null
            cost_rating: number | null
            created_at: string
            best_dish: string | null
          }[]
          setDbRatings({
            food: weightedAvg(rows.map(r => ({ rating: r.food_rating, created_at: r.created_at }))),
            vibe: weightedAvg(rows.map(r => ({ rating: r.vibe_rating, created_at: r.created_at }))),
            cost: weightedAvg(rows.map(r => ({ rating: r.cost_rating, created_at: r.created_at }))),
          })
          setHasRecentReviews(
            rows.some(r => Date.now() - new Date(r.created_at).getTime() <= NINETY_DAYS_MS)
          )
          const dishCounts: Record<string, number> = {}
          for (const r of rows) {
            const d = r.best_dish?.trim()
            if (d) dishCounts[d.toLowerCase()] = (dishCounts[d.toLowerCase()] ?? 0) + 1
          }
          setTopDishes(
            Object.entries(dishCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1))
          )
        }

        if (savedRes.data) setSaved(true)
      }

      if (!cancelled) {
        setLoading(false)
        setRefreshing(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [routePlaceId, routeRestaurantId, user?.id, refreshTrigger, contextPhotoUrls])

  async function findOrCreateRestaurant(): Promise<string | null> {
    if (restaurantId) return restaurantId
    const pid = resolvedPid
    if (!pid) {
      const createdId = await createUserRestaurant({
        name,
        address,
        latitude: Number.isFinite(parsedLat) ? parsedLat : null,
        longitude: Number.isFinite(parsedLng) ? parsedLng : null,
      })
      if (createdId) setRestaurantId(createdId)
      return createdId
    }

    const { data: existing } = await (supabase.from('restaurants') as any)
      .select('id')
      .eq('google_place_id', pid)
      .maybeSingle()
    if (existing?.id) {
      setRestaurantId(existing.id)
      return existing.id
    }

    const { data: created } = await (supabase.from('restaurants') as any)
      .insert({
        name,
        address,
        latitude: parsedLat,
        longitude: parsedLng,
        google_place_id: pid,
        canonical_source: 'google_places',
      })
      .select('id')
      .single()
    if (created?.id) setRestaurantId(created.id)
    return created?.id ?? null
  }

  const toggleSave = useCallback(async () => {
    if (!user) return
    const wasSaved = saved
    setSaved(!wasSaved)
    const resId = await findOrCreateRestaurant()
    if (!resId) {
      setSaved(wasSaved)
      return
    }
    if (wasSaved) {
      const { error } = await (supabase.from('saved_locations') as any)
        .delete()
        .eq('user_id', user.id)
        .eq('restaurant_id', resId)
      if (error) setSaved(wasSaved)
    } else {
      const { error } = await (supabase.from('saved_locations') as any).insert({
        user_id: user.id,
        restaurant_id: resId,
      })
      if (error) {
        setSaved(wasSaved)
        return
      }
      setSaveSheet(true)
    }
  }, [user, saved, restaurantId, routePlaceId, name, address, parsedLat, parsedLng, router])

  const submitRestaurantAction = useCallback(
    async (action: RestaurantAction) => {
      const resId = await findOrCreateRestaurant()
      if (!resId) {
        setNotice({ title: 'Could not save that yet', subtitle: 'Try again after the restaurant details finish loading.' })
        return
      }

      try {
        if (action === 'suggest_edit') {
          await submitRestaurantEditSuggestion({
            restaurantId: resId,
            field: 'other',
            currentValue: { name, address },
            issueSummary: 'User reported that restaurant metadata needs review.',
          })
          setNotice({ title: 'Suggestion submitted', subtitle: 'Thanks. This will go into the restaurant data review queue.' })
        } else if (action === 'report_duplicate') {
          await submitDuplicateRestaurantSuggestion({
            restaurantId: resId,
            duplicateName: name,
            duplicateAddress: address,
            duplicateProvider: resolvedPid ? 'google_places' : undefined,
            duplicateProviderPlaceId: resolvedPid ?? undefined,
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
            evidenceSummary: { source: 'restaurant_detail_action', restaurant_name: name },
          })
          setNotice({ title: 'Claim submitted', subtitle: 'Your claim is pending review before any owner tools are enabled.' })
        }
      } catch {
        setNotice({ title: 'Could not submit', subtitle: 'Please try again in a moment.' })
      }
    },
    [findOrCreateRestaurant, name, address, resolvedPid]
  )

  const handleRestaurantAction = useCallback(
    (value: string) => {
      requireAuth(() => submitRestaurantAction(value as RestaurantAction))
    },
    [requireAuth, submitRestaurantAction]
  )

  const openAddress = useCallback(() => {
    if (!address) return
    setMapsSheetVisible(true)
  }, [address])

  const openSelectedMap = useCallback(
    (provider: string) => {
      if (provider === 'apple')
        Linking.openURL(
          `https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${parsedLat},${parsedLng}`
        )
      if (provider === 'google')
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${parsedLat},${parsedLng}`)
    },
    [name, parsedLat, parsedLng]
  )

  const openPhone = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)
  }, [])

  const openWebsite = useCallback((url: string) => {
    WebBrowser.openBrowserAsync(url)
  }, [])

  const openSortSheet = useCallback(() => {
    setSortSheetVisible(true)
  }, [])

  const goToMap = useCallback(() => {
    router.push({
      pathname: '/restaurants/[restaurantId]/map',
      params: {
        restaurantId: resolvedPid ?? routePlaceId ?? 'none',
        placeId: resolvedPid ?? routePlaceId ?? 'none',
        name,
        lat,
        lng,
        phone: detail?.formatted_phone_number ?? '',
        openNow:
          detail?.opening_hours?.open_now != null ? String(detail.opening_hours.open_now) : '',
        googleRating: detail?.rating != null ? String(detail.rating) : '',
        avgFood: rekkusRatings.food != null ? String(rekkusRatings.food.toFixed(1)) : '',
        avgVibe: rekkusRatings.vibe != null ? String(rekkusRatings.vibe.toFixed(1)) : '',
        avgCost: rekkusRatings.cost != null ? String(rekkusRatings.cost.toFixed(1)) : '',
        photoUrl: photoUrls[0] ?? '',
        todayHours: detail?.opening_hours?.weekday_text?.[todayHoursIndex()] ?? '',
      },
    })
  }, [router, routePlaceId, name, lat, lng, detail, rekkusRatings, photoUrls])

  const openNow = detail?.opening_hours?.open_now
  const todayIdx = todayHoursIndex()
  const weekdayText = detail?.opening_hours?.weekday_text ?? []
  const todayText = weekdayText[todayIdx]
  const hasRekkusRatings =
    rekkusRatings.food != null || rekkusRatings.vibe != null || rekkusRatings.cost != null
  const hasGoogleRating = detail?.rating != null

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
          <IconButton accessibilityLabel="Share restaurant" onPress={() => setShareSheet(true)}>
            <ShareIcon />
          </IconButton>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.text3} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshTrigger(t => t + 1)}
              tintColor={colors.text}
            />
          }
        >
          {/* Photo carousel */}
          {photoUrls.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ height: PHOTO_HEIGHT }}
            >
              {photoUrls.map((url, i) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={{ width, height: PHOTO_HEIGHT }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.photoPlaceholder, { width }]}>
              <ImagePlaceholder size={20} />
              <Text style={styles.photoPlaceholderText}>No images available</Text>
            </View>
          )}

          {/* Info section */}
          <View style={styles.infoSection}>
            <Text style={styles.placeName}>{name}</Text>

            <View style={styles.metaRow}>
              {!!formatCategory(detail?.types) && (
                <Text style={styles.metaText}>{formatCategory(detail?.types)}</Text>
              )}
              {detail?.price_level != null && (
                <>
                  {!!formatCategory(detail?.types) && <Text style={styles.metaDot}>·</Text>}
                  <Text style={styles.metaText}>{formatPriceLevel(detail.price_level)}</Text>
                </>
              )}
              {openNow != null && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <OpenBadge openNow={openNow} />
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.improveButton}
              onPress={() => setRestaurantActionsSheetVisible(true)}
              activeOpacity={0.78}
            >
              <Text style={styles.improveButtonText}>Improve this place</Text>
            </TouchableOpacity>

            {/* Ratings card */}
            {(hasGoogleRating || hasRekkusRatings) && (
              <View style={styles.ratingsCard}>
                {hasGoogleRating && (
                  <View style={styles.ratingsCardRow}>
                    <Text style={styles.ratingsCardLabel}>Google</Text>
                    <View style={styles.ratingsCardValues}>
                      <Text style={styles.ratingEmoji}>⭐</Text>
                      <Text style={styles.ratingValue}>{detail!.rating!.toFixed(1)}</Text>
                      {detail!.user_ratings_total != null && (
                        <Text style={styles.ratingCount}>
                          {detail!.user_ratings_total.toLocaleString()} reviews
                        </Text>
                      )}
                    </View>
                  </View>
                )}
                {hasGoogleRating && hasRekkusRatings && <View style={styles.ratingsCardDivider} />}
                {hasRekkusRatings && (
                  <View style={styles.ratingsCardRow}>
                    <Text style={styles.ratingsCardLabel}>Rekkus</Text>
                    <View style={styles.ratingsCardValues}>
                      {rekkusRatings.food != null && (
                        <View style={styles.ratingChip}>
                          <Text style={styles.ratingChipLabel}>FOOD</Text>
                          <Stars count={Math.round(rekkusRatings.food)} size={12} />
                        </View>
                      )}
                      {rekkusRatings.vibe != null && (
                        <View style={styles.ratingChip}>
                          <Text style={styles.ratingChipLabel}>VIBE</Text>
                          <Vibes count={Math.round(rekkusRatings.vibe)} size={12} />
                        </View>
                      )}
                      {rekkusRatings.cost != null && (
                        <View style={styles.ratingChip}>
                          <Text style={styles.ratingChipLabel}>COST</Text>
                          <Dollars count={Math.round(rekkusRatings.cost)} size={11} />
                        </View>
                      )}
                      {contextPosts.length > 0 && (
                        <Text style={styles.ratingCount}>
                          {contextPosts.length} post{contextPosts.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
                {hasRekkusRatings && hasRecentReviews && (
                  <Text style={styles.recentReviewsNote}>(based on recent reviews)</Text>
                )}
                {topDishes.length > 0 && (
                  <>
                    {(hasGoogleRating || hasRekkusRatings) && (
                      <View style={styles.ratingsCardDivider} />
                    )}
                    <View style={styles.ratingsCardRow}>
                      <Text style={styles.ratingsCardLabel}>Dishes</Text>
                      <Text style={styles.dishMentions}>{topDishes.join(' · ')}</Text>
                    </View>
                  </>
                )}
              </View>
            )}

            <View style={styles.divider} />

            {/* Contact rows */}
            <View style={styles.contactSection}>
              {!!address && (
                <TouchableOpacity style={styles.contactRow} onPress={openAddress}>
                  <PinIcon />
                  <Text style={styles.contactText} numberOfLines={2}>
                    {address}
                  </Text>
                </TouchableOpacity>
              )}
              {!!detail?.formatted_phone_number && (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => openPhone(detail!.formatted_phone_number!)}
                >
                  <PhoneIcon />
                  <Text style={styles.contactText}>{detail.formatted_phone_number}</Text>
                </TouchableOpacity>
              )}
              {!!detail?.website && (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => openWebsite(detail!.website!)}
                >
                  <GlobeIcon />
                  <Text style={styles.contactTextLink} numberOfLines={1}>
                    {detail.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </Text>
                </TouchableOpacity>
              )}
              {weekdayText.length > 0 && (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => setHoursExpanded(e => !e)}
                  activeOpacity={0.7}
                >
                  <ClockIcon />
                  <View style={{ flex: 1 }}>
                    {hoursExpanded ? (
                      weekdayText.map((line, i) => (
                        <Text
                          key={i}
                          style={[styles.contactText, i === todayIdx && styles.contactTextBold]}
                        >
                          {line}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.contactText}>{todayText}</Text>
                    )}
                  </View>
                  <ChevronDown expanded={hoursExpanded} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Popular dishes */}
          {popularDishes.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.dishesSection}>
                <Text style={styles.dishesSectionTitle}>Popular dishes</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dishesRow}
                >
                  {popularDishes.map(d => (
                    <View key={d.name} style={styles.dishChip}>
                      <Text style={styles.dishChipName}>{d.name}</Text>
                      {d.count > 1 && <Text style={styles.dishChipCount}>{d.count}</Text>}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </>
          )}

          {/* Posts section */}
          <View style={styles.divider} />
          <View style={styles.postsSection}>
            <View style={styles.postsSectionHeader}>
              <Text style={styles.postsSectionTitle}>
                {contextPosts.length > 0
                  ? `${contextPosts.length} post${contextPosts.length !== 1 ? 's' : ''} on Rekkus`
                  : 'Posts on Rekkus'}
              </Text>
              {contextPosts.length > 1 && (
                <TouchableOpacity style={styles.sortBtn} onPress={openSortSheet}>
                  <SortIcon />
                  <Text style={styles.sortBtnText}>{SORT_LABELS[sortPosts]}</Text>
                </TouchableOpacity>
              )}
            </View>

            {sortedPosts.length === 0 ? (
              <Text style={styles.emptyPostsText}>No posts yet for this location</Text>
            ) : (
              sortedPosts.map(post => (
                <TouchableOpacity
                  key={post.id}
                  style={styles.postRow}
                  onPress={() => router.push(`/posts/${post.dbId || post.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.postThumb, { backgroundColor: imgColors[post.imgKey] }]}>
                    {post.imageUrl ? (
                      <Image
                        source={{ uri: post.imageUrl }}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <ImagePlaceholder size={20} />
                    )}
                  </View>
                  <View style={styles.postRowContent}>
                    <View style={styles.postRowTop}>
                      <Text style={styles.postRowCreator}>@{post.creator}</Text>
                      <Text style={styles.postRowLikes}>♡ {post.likes}</Text>
                    </View>
                    <Text style={styles.postRowTitle} numberOfLines={2}>
                      {post.title}
                    </Text>
                    <PostRatingStrip food={post.food} vibe={post.vibe} cost={post.cost} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal
        visible={saveSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setSaveSheet(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetIcon}>
            <BookmarkIcon filled size={22} />
          </View>
          <Text style={styles.sheetTitle}>Saved!</Text>
          <Text style={styles.sheetBody}>{name} has been added to your places.</Text>
          <TouchableOpacity
            style={styles.sheetBtnPrimary}
            onPress={() => {
              setSaveSheet(false)
              router.push('/(tabs)/restaurants')
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.sheetBtnPrimaryText}>View saved places</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetBtnSecondary}
            onPress={() => setSaveSheet(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.sheetBtnSecondaryText}>Stay here</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <RekkusActionSheet
        visible={sortSheetVisible}
        title="Sort posts"
        options={[
          { label: 'Most liked', value: 'liked', selected: sortPosts === 'liked' },
          { label: 'Newest', value: 'newest', selected: sortPosts === 'newest' },
          { label: 'Oldest', value: 'oldest', selected: sortPosts === 'oldest' },
        ]}
        onSelect={value => setSortPosts(value as PostSort)}
        onDismiss={() => setSortSheetVisible(false)}
      />
      <RekkusActionSheet
        visible={mapsSheetVisible}
        title="Open in Maps"
        subtitle={name}
        options={[
          { label: 'Apple Maps', value: 'apple' },
          { label: 'Google Maps', value: 'google' },
        ]}
        onSelect={openSelectedMap}
        onDismiss={() => setMapsSheetVisible(false)}
      />
      <RekkusActionSheet
        visible={restaurantActionsSheetVisible}
        title="Improve this place"
        subtitle={name}
        options={[
          { label: 'Suggest an edit', value: 'suggest_edit' },
          { label: 'Report duplicate', value: 'report_duplicate' },
          { label: 'Verify details look right', value: 'verify_info' },
          { label: 'Claim this restaurant', value: 'claim_restaurant' },
        ]}
        onSelect={handleRestaurantAction}
        onDismiss={() => setRestaurantActionsSheetVisible(false)}
      />
      <RekkusActionSheet
        visible={shareSheet}
        title="Share place"
        options={[
          { label: 'Send via message', value: 'send_dm' },
        ]}
        onSelect={value => {
          setShareSheet(false)
          if (value === 'send_dm') {
            router.push({
              pathname: '/messages',
              params: {
                sharePlaceId: restaurantId ?? '',
                sharePlaceName: name,
                sharePlaceAddress: address ?? '',
                sharePlaceCuisine: detail?.types?.[0] ?? '',
              },
            } as any)
          }
        }}
        onDismiss={() => setShareSheet(false)}
      />
      <RekkusActionSheet
        visible={notice != null}
        title={notice?.title}
        subtitle={notice?.subtitle}
        options={[{ label: 'OK', value: 'ok', accentColor: colors.accent }]}
        onSelect={() => {}}
        onDismiss={() => setNotice(null)}
      />
    </SafeAreaView>
  )
}

async function textSearchPlace(query: string): Promise<string | null> {
  return fetchPlaceIdByTextSearch(query)
}

async function fetchPlaceDetail(placeId: string): Promise<PlacesDetail | null> {
  const fields =
    'rating,user_ratings_total,formatted_phone_number,website,opening_hours,price_level,photos,types,business_status,geometry'
  return fetchRestaurantProviderDetail<PlacesDetail>(placeId, fields)
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], padding: spacing.px6, marginLeft: -spacing.px6 },
    backText: { fontSize: fontSize.md, color: c.text2 },
    headerActions: { flexDirection: 'row', gap: spacing.px6 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    photoPlaceholder: {
      height: PHOTO_HEIGHT,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
    },
    photoPlaceholderText: { fontSize: fontSize.bodySm, color: c.text3 },
    infoSection: { paddingHorizontal: spacing[5], paddingTop: spacing.px18, paddingBottom: spacing[2] },
    placeName: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, color: c.text, marginBottom: spacing.px6 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
      marginBottom: spacing[4],
      flexWrap: 'wrap',
    },
    metaText: { fontSize: fontSize.bodySm, color: c.text3 },
    metaDot: { fontSize: fontSize.bodySm, color: c.text3 },
    improveButton: {
      alignSelf: 'flex-start',
      borderWidth: 0.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      marginBottom: spacing.px14,
    },
    improveButtonText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.text2 },
    ratingsCard: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      marginBottom: spacing[5],
      overflow: 'hidden',
    },
    ratingsCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
      gap: spacing[3],
    },
    ratingsCardLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text3, width: 52 },
    ratingsCardValues: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
      flexWrap: 'wrap',
    },
    ratingsCardDivider: { height: 0.5, backgroundColor: c.border, marginHorizontal: spacing.px14 },
    ratingEmoji: { fontSize: fontSize.md },
    ratingValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
    ratingCount: { fontSize: fontSize.sm, color: c.text3, marginLeft: spacing.px2 },
    ratingChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.px2 },
    ratingChipLabel: { fontSize: fontSize['2xs'], color: c.text3, letterSpacing: 0.5, marginRight: spacing.px2 },
    recentReviewsNote: {
      fontSize: fontSize.xs,
      color: c.text3,
      paddingHorizontal: spacing.px14,
      paddingBottom: spacing[2],
      fontStyle: 'italic',
    },
    dishMentions: { flex: 1, fontSize: fontSize.bodySm, color: c.text2 },
    dishesSection: { paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[3] },
    dishesSectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.text, marginBottom: spacing.px10 },
    dishesRow: { gap: spacing[2] },
    dishChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px6,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    dishChipName: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text },
    dishChipCount: {
      fontSize: fontSize.xs,
      color: c.text3,
      backgroundColor: c.surface2,
      borderRadius: radius.sm3,
      paddingHorizontal: spacing.px5,
      paddingVertical: spacing.px1,
    },
    divider: { height: 0.5, backgroundColor: c.border },
    contactSection: { paddingVertical: spacing[1] },
    contactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingVertical: spacing.px11 },
    contactText: { flex: 1, fontSize: fontSize.base, color: c.text2, lineHeight: lineHeight.body },
    contactTextBold: { fontWeight: fontWeight.semibold, color: c.text },
    contactTextLink: { flex: 1, fontSize: fontSize.base, color: c.info, lineHeight: lineHeight.body },
    postsSection: { paddingTop: spacing[4], paddingBottom: spacing[1] },
    postsSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[5],
      marginBottom: spacing[3],
    },
    postsSectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.text },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    sortBtnText: { fontSize: fontSize.bodySm, color: c.text2 },
    emptyPostsText: { fontSize: fontSize.base, color: c.text3, paddingHorizontal: spacing[5], paddingVertical: spacing[2] },
    postRow: {
      flexDirection: 'row',
      gap: spacing[3],
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    postThumb: {
      width: 60,
      height: 60,
      borderRadius: radius.sm3,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    postRowContent: { flex: 1, gap: spacing.px3 },
    postRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    postRowCreator: { fontSize: fontSize.sm, color: c.text3 },
    postRowLikes: { fontSize: fontSize.sm, color: c.text3 },
    postRowTitle: { fontSize: fontSize.base, color: c.text, lineHeight: lineHeight.small },
    sheetBackdrop: { flex: 1, backgroundColor: c.overlay },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: radius.pill,
      borderTopRightRadius: radius.pill,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingHorizontal: spacing[6],
      paddingTop: spacing.px14,
      paddingBottom: spacing.px40,
      alignItems: 'center',
      gap: spacing.px10,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: radius.xxs,
      backgroundColor: c.border2,
      marginBottom: spacing.px6,
    },
    sheetIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.pill3,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.px2,
    },
    sheetTitle: { fontSize: fontSize.title, fontWeight: fontWeight.semibold, color: c.text },
    sheetBody: { fontSize: fontSize.base, color: c.text2, textAlign: 'center', lineHeight: lineHeight.body },
    sheetBtnPrimary: {
      width: '100%',
      backgroundColor: c.text,
      borderRadius: radius.lg,
      paddingVertical: spacing.px14,
      alignItems: 'center',
      marginTop: spacing.px6,
    },
    sheetBtnPrimaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.bg },
    sheetBtnSecondary: {
      width: '100%',
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border2,
      borderRadius: radius.lg,
      paddingVertical: spacing.px14,
      alignItems: 'center',
    },
    sheetBtnSecondaryText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text },
  })
}
