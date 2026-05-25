import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, ChevronRight, ImagePlaceholder, PinIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { IconButton } from '@/components/ui/IconButton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { routes } from '@/lib/routes'
import {
  fetchCollectionById,
  fetchCollectionItems,
  fetchCollectionRestaurantsByIds,
  type Collection,
  type CollectionItem,
  type CollectionRestaurant,
} from '@/lib/services/collections'
import { fetchDishesByIds } from '@/lib/services/dishes'
import { fetchPostsByIds, mapRowToPost } from '@/lib/services/posts'
import type { DishDetail, Post } from '@/types/domain'

export default function CollectionDetailScreen() {
  const { collectionId = '' } = useLocalSearchParams<{ collectionId?: string }>()
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [collection, setCollection] = useState<Collection | null>(null)
  const [items, setItems] = useState<CollectionItem[]>([])
  const [dishes, setDishes] = useState<Map<string, DishDetail>>(new Map())
  const [posts, setPosts] = useState<Map<string, Post>>(new Map())
  const [restaurants, setRestaurants] = useState<Map<string, CollectionRestaurant>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [nextCollection, itemPage] = await Promise.all([
          fetchCollectionById(collectionId),
          fetchCollectionItems(collectionId),
        ])
        const dishIds = itemPage.rows.filter(item => item.target_type === 'dish').map(item => item.target_id)
        const postIds = itemPage.rows.filter(item => item.target_type === 'post').map(item => item.target_id)
        const restaurantIds = itemPage.rows.filter(item => item.target_type === 'restaurant').map(item => item.target_id)
        const [dishRows, postRows, restaurantRows] = await Promise.all([
          fetchDishesByIds(dishIds),
          fetchPostsByIds(postIds),
          fetchCollectionRestaurantsByIds(restaurantIds),
        ])
        if (cancelled) return
        setCollection(nextCollection)
        setItems(itemPage.rows)
        setDishes(new Map(dishRows.map(dish => [dish.id, dish])))
        setPosts(new Map(postRows.map((post, index) => {
          const mapped = mapRowToPost(post, index)
          return [mapped.dbId, mapped]
        })))
        setRestaurants(new Map(restaurantRows.map(restaurant => [restaurant.id, restaurant])))
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load this collection.')
      }
      if (!cancelled) setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [collectionId])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Go back" onPress={() => router.back()} variant="plain">
          <ChevronLeft />
        </IconButton>
        <Text style={styles.title} numberOfLines={1}>{collection?.name ?? 'Collection'}</Text>
        <View style={styles.spacer} />
      </View>
      {loading ? (
        <EmptyState loading title="Loading collection" />
      ) : error ? (
        <ErrorMessage message={error} style={styles.error} />
      ) : !collection ? (
        <EmptyState title="Collection not found" subtitle="It may be private or no longer available." />
      ) : items.length === 0 ? (
        <EmptyState title="This collection is empty" subtitle="Add saved dishes, posts, or places to start." />
      ) : (
        <View style={styles.list}>
          {items.map(item => {
            if (item.target_type === 'dish') {
              const dish = dishes.get(item.target_id)
              if (!dish) return null
              return (
                <CollectionRow
                  key={item.id ?? item.target_id}
                  title={dish.name}
                  subtitle={dish.restaurant?.name ?? 'Dish'}
                  leading={<ImagePlaceholder size={22} />}
                  onPress={() => router.push(routes.dishDetail(dish.id))}
                  styles={styles}
                />
              )
            }
            if (item.target_type === 'post') {
              const post = posts.get(item.target_id)
              if (!post) return null
              return (
                <CollectionRow
                  key={item.id ?? item.target_id}
                  title={post.best_dish ?? post.title}
                  subtitle={`@${post.creator}`}
                  leading={post.imageUrl ? <CachedImage source={{ uri: post.imageUrl }} style={styles.thumbnail} /> : <ImagePlaceholder size={22} />}
                  onPress={() => router.push(routes.postDetail(post.dbId))}
                  styles={styles}
                />
              )
            }
            const restaurant = restaurants.get(item.target_id)
            if (!restaurant) return null
            return (
              <CollectionRow
                key={item.id ?? item.target_id}
                title={restaurant.name}
                subtitle={restaurant.address ?? 'Place'}
                leading={<PinIcon />}
                onPress={() => router.push(routes.restaurantDetail({
                  restaurantId: restaurant.id,
                  ...(restaurant.googlePlaceId ? { placeId: restaurant.googlePlaceId } : {}),
                  name: restaurant.name,
                  ...(restaurant.address ? { address: restaurant.address } : {}),
                  ...(restaurant.latitude != null ? { lat: restaurant.latitude } : {}),
                  ...(restaurant.longitude != null ? { lng: restaurant.longitude } : {}),
                }))}
                styles={styles}
              />
            )
          })}
        </View>
      )}
    </SafeAreaView>
  )
}

function CollectionRow({
  title,
  subtitle,
  leading,
  onPress,
  styles,
}: {
  title: string
  subtitle: string
  leading: ReactNode
  onPress: () => void
  styles: ReturnType<typeof makeStyles>
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.leading}>{leading}</View>
      <View style={styles.body}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <ChevronRight />
    </TouchableOpacity>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: spacing.hairline,
      borderBottomColor: c.border,
      paddingHorizontal: spacing[3],
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: fontSize.lg,
      color: c.text,
      fontWeight: fontWeight.medium,
    },
    spacer: { width: 34 },
    list: { padding: spacing[4], gap: spacing[2] },
    row: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      borderRadius: radius.lg,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing[3],
    },
    leading: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    thumbnail: { width: 44, height: 44, borderRadius: radius.sm3 },
    body: { flex: 1 },
    rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
    subtitle: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing[1] },
    error: { marginHorizontal: spacing[4], marginTop: spacing[3] },
  })
}
