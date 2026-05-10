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
  ActionSheetIOS,
  Modal,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useThemeColors } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/AuthContext'
import { useAuthGate } from '@/lib/AuthGateContext'
import { supabase } from '@/lib/supabase'
import { usePosts } from '@/lib/PostsContext'
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
} from '@/components/icons'
import { Stars, Dollars, PostRatingStrip } from '@/components/RatingDisplay'
import { OpenBadge } from '@/components/OpenBadge'
import { GOOGLE_PLACES_KEY as PLACES_KEY } from '@/lib/config'
import { parseLikes, todayHoursIndex } from '@/lib/utils/format'
const PHOTO_HEIGHT = 220

type PostSort = 'liked' | 'newest' | 'oldest'
const SORT_LABELS: Record<PostSort, string> = {
  liked: 'Most liked',
  newest: 'Newest',
  oldest: 'Oldest',
}

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

export default function LocationInfoScreen() {
  const { placeId, name, address, lat, lng } = useLocalSearchParams<{
    placeId: string
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
  const [hoursExpanded, setHoursExpanded] = useState(false)
  const [sortPosts, setSortPosts] = useState<PostSort>('liked')
  const [resolvedPid, setResolvedPid] = useState<string | null>(
    placeId && placeId !== 'none' ? placeId : null
  )

  // Filter PostsContext posts by placeId, fall back to name match
  const contextPosts = useMemo(() => {
    if (!name) return []
    const byPlaceId = posts.filter(p => p.placeId && p.placeId === placeId)
    if (byPlaceId.length > 0) return byPlaceId
    const nameLower = name.split(/[,\s]/)[0].toLowerCase()
    return posts.filter(p => p.location?.toLowerCase().includes(nameLower))
  }, [posts, placeId, name])

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

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (refreshTrigger === 0) setLoading(true)
      else setRefreshing(true)

      let effectivePid: string | null = placeId && placeId !== 'none' ? placeId : null
      if (!effectivePid && name) {
        effectivePid = await textSearchPlace(name)
        if (!cancelled && effectivePid) setResolvedPid(effectivePid)
      }

      const [placeResult, restaurantResult] = await Promise.all([
        effectivePid ? fetchPlaceDetail(effectivePid) : Promise.resolve(null),
        effectivePid
          ? (supabase.from('restaurants') as any)
              .select('id')
              .eq('google_place_id', effectivePid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (cancelled) return

      if (placeResult) {
        setDetail(placeResult)
        const refs = (placeResult.photos ?? [])
          .slice(0, 6)
          .map((p: { photo_reference: string }) => p.photo_reference)
        setPhotoUrls(
          refs.map(
            (ref: string) =>
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${PLACES_KEY}`
          )
        )
      }

      const resId: string | null = restaurantResult?.data?.id ?? null
      if (resId) setRestaurantId(resId)

      // Cache Google rating lazily and track detail view — both fire-and-forget
      if (resId && placeResult?.rating != null) {
        ;(supabase.from('restaurants') as any)
          .update({
            google_rating: placeResult.rating,
            google_review_count: placeResult.user_ratings_total ?? null,
          })
          .eq('id', resId)
          .then(() => {})
      }
      if (resId && user) {
        ;(supabase.from('analytics_events') as any)
          .insert({
            user_id: user.id,
            event_type: 'place_view',
            entity_type: 'restaurant',
            entity_id: resId,
          })
          .then(() => {})
      }

      if (resId) {
        const [ratingsRes, savedRes] = await Promise.all([
          (supabase.from('posts') as any)
            .select('food_rating, vibe_rating, cost_rating')
            .eq('restaurant_id', resId)
            .not('food_rating', 'is', null)
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
            food_rating: number
            vibe_rating: number
            cost_rating: number
          }[]
          const avg = (key: keyof (typeof rows)[0]) => {
            const vals = rows.map(r => r[key]).filter((v): v is number => v != null)
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
          }
          setDbRatings({
            food: avg('food_rating'),
            vibe: avg('vibe_rating'),
            cost: avg('cost_rating'),
          })
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
  }, [placeId, user?.id, refreshTrigger])

  async function findOrCreateRestaurant(): Promise<string | null> {
    if (restaurantId) return restaurantId
    const pid = resolvedPid
    if (!pid) return null

    const { data: existing } = await (supabase.from('restaurants') as any)
      .select('id')
      .eq('google_place_id', pid)
      .maybeSingle()
    if (existing?.id) {
      setRestaurantId(existing.id)
      return existing.id
    }

    const { data: created } = await (supabase.from('restaurants') as any)
      .insert({ name, address, latitude: parsedLat, longitude: parsedLng, google_place_id: pid })
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
  }, [user, saved, restaurantId, placeId, name, address, parsedLat, parsedLng, router])

  const openAddress = useCallback(() => {
    if (!address) return
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Apple Maps', 'Google Maps'], cancelButtonIndex: 0 },
      i => {
        if (i === 1)
          Linking.openURL(
            `https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${parsedLat},${parsedLng}`
          )
        if (i === 2)
          Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${parsedLat},${parsedLng}`
          )
      }
    )
  }, [address, name, parsedLat, parsedLng])

  const openPhone = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)
  }, [])

  const openWebsite = useCallback((url: string) => {
    WebBrowser.openBrowserAsync(url)
  }, [])

  const openSortSheet = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Most liked', 'Newest', 'Oldest'], cancelButtonIndex: 0 },
      i => {
        if (i === 1) setSortPosts('liked')
        if (i === 2) setSortPosts('newest')
        if (i === 3) setSortPosts('oldest')
      }
    )
  }, [])

  const goToMap = useCallback(() => {
    router.push({
      pathname: '/location/map',
      params: {
        placeId: resolvedPid ?? placeId ?? 'none',
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
  }, [router, placeId, name, lat, lng, detail, rekkusRatings, photoUrls])

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
          <TouchableOpacity style={styles.iconBtn} onPress={goToMap}>
            <NavIcon />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => requireAuth(toggleSave)}>
            <BookmarkIcon filled={saved} />
          </TouchableOpacity>
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
                          <Stars count={Math.round(rekkusRatings.vibe)} size={12} />
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
                  onPress={() => router.push(`/post/${post.id}`)}
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
              router.push('/(tabs)/places')
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
    </SafeAreaView>
  )
}

async function textSearchPlace(query: string): Promise<string | null> {
  if (!PLACES_KEY || !query) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${PLACES_KEY}`
    const res = await fetch(url)
    const json = await res.json()
    return json.results?.[0]?.place_id ?? null
  } catch {
    return null
  }
}

async function fetchPlaceDetail(placeId: string): Promise<PlacesDetail | null> {
  if (!PLACES_KEY) return null
  try {
    const fields =
      'rating,user_ratings_total,formatted_phone_number,website,opening_hours,price_level,photos,types,business_status,geometry'
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${PLACES_KEY}`
    const res = await fetch(url)
    const json = await res.json()
    return json.result ?? null
  } catch {
    return null
  }
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, marginLeft: -6 },
    backText: { fontSize: 14, color: c.text2 },
    headerActions: { flexDirection: 'row', gap: 6 },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    photoPlaceholder: {
      height: PHOTO_HEIGHT,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    photoPlaceholderText: { fontSize: 12, color: c.text3 },
    infoSection: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
    placeName: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 6 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    metaText: { fontSize: 12, color: c.text3 },
    metaDot: { fontSize: 12, color: c.text3 },
    ratingsCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      marginBottom: 20,
      overflow: 'hidden',
    },
    ratingsCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    ratingsCardLabel: { fontSize: 11, fontWeight: '600', color: c.text3, width: 52 },
    ratingsCardValues: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    ratingsCardDivider: { height: 0.5, backgroundColor: c.border, marginHorizontal: 14 },
    ratingEmoji: { fontSize: 14 },
    ratingValue: { fontSize: 15, fontWeight: '700', color: c.text },
    ratingCount: { fontSize: 11, color: c.text3, marginLeft: 2 },
    ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    ratingChipLabel: { fontSize: 9, color: c.text3, letterSpacing: 0.5, marginRight: 2 },
    divider: { height: 0.5, backgroundColor: c.border },
    contactSection: { paddingVertical: 4 },
    contactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11 },
    contactText: { flex: 1, fontSize: 13, color: c.text2, lineHeight: 19 },
    contactTextBold: { fontWeight: '600', color: c.text },
    contactTextLink: { flex: 1, fontSize: 13, color: c.info, lineHeight: 19 },
    postsSection: { paddingTop: 16, paddingBottom: 4 },
    postsSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    postsSectionTitle: { fontSize: 13, fontWeight: '600', color: c.text },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    sortBtnText: { fontSize: 12, color: c.text2 },
    emptyPostsText: { fontSize: 13, color: c.text3, paddingHorizontal: 20, paddingVertical: 8 },
    postRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    postThumb: {
      width: 60,
      height: 60,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    postRowContent: { flex: 1, gap: 3 },
    postRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    postRowCreator: { fontSize: 11, color: c.text3 },
    postRowLikes: { fontSize: 11, color: c.text3 },
    postRowTitle: { fontSize: 13, color: c.text, lineHeight: 18 },
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingHorizontal: 24,
      paddingTop: 14,
      paddingBottom: 40,
      alignItems: 'center',
      gap: 10,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border2,
      marginBottom: 6,
    },
    sheetIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    sheetTitle: { fontSize: 17, fontWeight: '600', color: c.text },
    sheetBody: { fontSize: 13, color: c.text2, textAlign: 'center', lineHeight: 19 },
    sheetBtnPrimary: {
      width: '100%',
      backgroundColor: c.text,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 6,
    },
    sheetBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: c.bg },
    sheetBtnSecondary: {
      width: '100%',
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border2,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    sheetBtnSecondaryText: { fontSize: 14, fontWeight: '500', color: c.text },
  })
}
