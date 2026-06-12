import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CollectionPickerSheet } from '@/components/CollectionPickerSheet'
import { BookmarkIcon, ChevronLeft, ImagePlaceholder, PlusIcon } from '@/components/icons'
import { ThumbGrid } from '@/components/ThumbGrid'
import { CachedImage } from '@/components/ui/CachedImage'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { IconButton } from '@/components/ui/IconButton'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import type { SearchAttribution } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { useCollectionPicker } from '@/lib/hooks/useCollectionPicker'
import { useDishDetail } from '@/lib/hooks/useDishDetail'
import { routes } from '@/lib/routes'
import { routeParamNumber, routeParamString } from '@/lib/utils/routeParams'

export default function DishDetailScreen() {
  const {
    dishId = '',
    searchSessionId,
    searchQuery,
    searchResultType,
    searchResultPosition,
  } = useLocalSearchParams<{
    dishId?: string
    searchSessionId?: string
    searchQuery?: string
    searchResultType?: string
    searchResultPosition?: string
  }>()
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const detail = useDishDetail(dishId, user?.id)
  const picker = useCollectionPicker(user?.id, 'dish', dishId)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [confirmUnsave, setConfirmUnsave] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
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
    if (detail.dish) analytics.viewDish(user?.id ?? null, detail.dish.id, searchAttribution)
  }, [detail.dish, searchAttribution, user?.id])

  async function handleBookmark() {
    setOperationError(null)
    if (detail.saved && detail.collectionItems.length > 0) {
      setConfirmUnsave(true)
      return
    }
    try {
      await detail.toggleSaved()
      if (!detail.saved && user) {
        analytics.saveDish(user.id, dishId, searchAttribution)
        void haptic.confirmSave()
      }
    } catch {
      setOperationError('Could not update this bookmark. Please try again.')
    }
  }

  async function addToCollection(collectionId: string) {
    try {
      await picker.add(collectionId)
      analytics.collectionInteraction(user?.id ?? null, 'add_item', collectionId, { target_type: 'dish' })
      setPickerVisible(false)
      await detail.refresh()
    } catch {
      setOperationError('Could not add this dish to the collection.')
    }
  }

  const heroUrl = detail.posts.find(post => post.imageUrl)?.imageUrl

  if (detail.loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}><Skeleton width={80} height={34} /></View>
        <Skeleton width="100%" height={240} radius={0} />
        <View style={styles.content}><Skeleton width="70%" height={28} /><SkeletonText lines={3} /></View>
      </SafeAreaView>
    )
  }

  if (!detail.dish) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Go back" onPress={() => router.back()} variant="plain">
            <ChevronLeft />
          </IconButton>
        </View>
        {detail.error ? <ErrorMessage message={detail.error} style={styles.error} /> : (
          <EmptyState title="Dish not found" subtitle="This canonical dish is no longer available." />
        )}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Go back" onPress={() => router.back()} variant="plain">
          <ChevronLeft />
        </IconButton>
        <View style={styles.actions}>
          <IconButton accessibilityLabel="Add dish to collection" onPress={() => requireAuth(() => setPickerVisible(true))}>
            <PlusIcon color={colors.text2} />
          </IconButton>
          <IconButton
            accessibilityLabel={detail.saved ? 'Remove saved dish' : 'Save dish'}
            onPress={() => requireAuth(() => { void handleBookmark() })}
          >
            <BookmarkIcon filled={detail.saved} />
          </IconButton>
        </View>
      </View>
      {operationError ? <ErrorMessage message={operationError} style={styles.error} /> : null}
      <ScrollView showsVerticalScrollIndicator={false}>
        {heroUrl ? (
          <CachedImage source={{ uri: heroUrl }} style={styles.hero} />
        ) : (
          <View style={styles.heroFallback}><ImagePlaceholder size={28} /></View>
        )}
        <View style={styles.content}>
          <Text style={styles.name}>{detail.dish.name}</Text>
          {detail.dish.cuisineType ? <Text style={styles.cuisine}>{detail.dish.cuisineType}</Text> : null}
          {detail.dish.restaurant ? (
            <TouchableOpacity
              style={styles.restaurant}
              accessibilityRole="button"
              onPress={() => router.push(routes.restaurantDetail({
                restaurantId: detail.dish?.restaurant?.id ?? '',
                ...(detail.dish?.restaurant?.placeId ? { placeId: detail.dish.restaurant.placeId } : {}),
                ...(detail.dish?.restaurant?.name ? { name: detail.dish.restaurant.name } : {}),
                ...(detail.dish?.restaurant?.address ? { address: detail.dish.restaurant.address } : {}),
                ...(detail.dish?.restaurant?.lat != null ? { lat: detail.dish.restaurant.lat } : {}),
                ...(detail.dish?.restaurant?.lng != null ? { lng: detail.dish.restaurant.lng } : {}),
              }))}
            >
              <Text style={styles.restaurantLabel}>At</Text>
              <Text style={styles.restaurantName}>{detail.dish.restaurant.name}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.evidenceTitle}>Posts featuring this dish</Text>
        </View>
        {detail.posts.length > 0 ? (
          <ThumbGrid
            posts={detail.posts}
            hasMore={detail.hasMore}
            loadingMore={detail.loadingMore}
            onLoadMore={() => { void detail.loadMore() }}
            onPressPost={post => router.push(routes.postDetail(post.dbId))}
          />
        ) : (
          <EmptyState title="No linked posts yet" subtitle="Evidence appears here once posts link to this dish." />
        )}
      </ScrollView>
      <CollectionPickerSheet
        visible={pickerVisible}
        collections={picker.collections}
        loading={picker.loading}
        onDismiss={() => setPickerVisible(false)}
        onSelect={collectionId => { void addToCollection(collectionId) }}
        onCreate={name => {
          void picker.createAndAdd(name).then(collection => {
            if (!collection) return
            analytics.collectionInteraction(user?.id ?? null, 'create_and_add', collection.id, { target_type: 'dish' })
            setPickerVisible(false)
            void detail.refresh()
          }).catch(() => setOperationError('Could not create this collection.'))
        }}
      />
      <RekkusActionSheet
        visible={confirmUnsave}
        title="Remove saved dish?"
        subtitle="This dish is in a collection. Removing its bookmark also removes it from your collections."
        options={[
          { label: 'Keep saved', value: 'keep' },
          { label: 'Remove everywhere', value: 'remove', destructive: true },
        ]}
        onSelect={value => {
          if (value !== 'remove') return
          void detail.toggleSaved(true).then(() => {
            void haptic.confirmSave()
          }).catch(() => setOperationError('Could not remove this bookmark.'))
        }}
        onDismiss={() => setConfirmUnsave(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      height: 56,
      paddingHorizontal: spacing[4],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: spacing.hairline,
      borderBottomColor: c.border,
    },
    actions: { flexDirection: 'row', gap: spacing[2] },
    hero: { width: '100%', height: 240 },
    heroFallback: { height: 240, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
    content: { padding: spacing[5], gap: spacing[2] },
    name: { fontSize: fontSize['5xl'], fontWeight: fontWeight.bold, color: c.text },
    cuisine: { fontSize: fontSize.bodySm, color: c.text3 },
    restaurant: {
      marginTop: spacing[2],
      minHeight: 48,
      paddingHorizontal: spacing[3],
      borderRadius: radius.lg,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      backgroundColor: c.surface,
      justifyContent: 'center',
    },
    restaurantLabel: { fontSize: fontSize.xs, color: c.text3 },
    restaurantName: { fontSize: fontSize.md, color: c.text, fontWeight: fontWeight.semibold },
    evidenceTitle: { marginTop: spacing[4], fontSize: fontSize.lg, color: c.text, fontWeight: fontWeight.semibold },
    error: { marginHorizontal: spacing[4], marginTop: spacing[3] },
  })
}
