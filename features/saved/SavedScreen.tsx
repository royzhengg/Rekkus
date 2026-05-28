import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BookmarkIcon, ChevronRight, ImagePlaceholder, PlusIcon } from '@/components/icons'
import { ThumbGrid } from '@/components/ThumbGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import RestaurantsTabScreen from '@/features/restaurants/RestaurantsTabScreen'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useCollections } from '@/lib/hooks/useCollections'
import { useSavedDishes } from '@/lib/hooks/useSavedDishes'
import { useSavedLocations } from '@/lib/hooks/useSavedLocations'
import { useSavedPosts } from '@/lib/hooks/useSavedPosts'
import { routes } from '@/lib/routes'
import { createPrivateCollection } from '@/lib/services/collections'
import type { SavedLibrarySection } from '@/types/domain'

function parseSection(value: string | undefined): SavedLibrarySection {
  return value === 'dishes' || value === 'places' || value === 'posts' || value === 'collections'
    ? value
    : 'overview'
}

export default function SavedScreen() {
  const { section: rawSection } = useLocalSearchParams<{ section?: string }>()
  const section = parseSection(rawSection)
  const router = useRouter()
  const { user } = useAuth()
  const { requireOnline } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const dishes = useSavedDishes(user?.id)
  const posts = useSavedPosts(user?.id)
  const locations = useSavedLocations(user?.id)
  const collections = useCollections(user?.id, [])
  const [newCollectionName, setNewCollectionName] = useState('')
  const [creating, setCreating] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)

  if (section === 'places') {
    return <RestaurantsTabScreen onBackToSaved={() => router.replace(routes.saved())} />
  }

  async function createCollection() {
    if (!user?.id || !newCollectionName.trim()) return
    if (!requireOnline()) {
      setOperationError('Reconnect to create a collection.')
      return
    }
    setCreating(true)
    setOperationError(null)
    try {
      const collection = await createPrivateCollection(user.id, newCollectionName)
      analytics.collectionInteraction(user.id, 'create', collection.id)
      setNewCollectionName('')
      await collections.refresh()
    } catch {
      setOperationError('Could not create that collection.')
    }
    setCreating(false)
  }

  const title = section === 'overview' ? 'Saved' : section.charAt(0).toUpperCase() + section.slice(1)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {section === 'overview' ? null : (
          <TouchableOpacity style={styles.back} onPress={() => router.replace(routes.saved())} accessibilityRole="button">
            <Text style={styles.backText}>Saved</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
      </View>
      {operationError ? <ErrorMessage message={operationError} style={styles.error} /> : null}
      {section === 'overview' ? (
        <ScrollView contentContainerStyle={styles.overview}>
          <Text style={styles.subtitle}>All the dishes, places, posts, and collections you want to return to.</Text>
          <LibraryCard label="Dishes" count={dishes.savedDishes.length} onPress={() => router.push(routes.saved('dishes'))} styles={styles} />
          <LibraryCard label="Places" count={locations.savedLocations.length} onPress={() => router.push(routes.saved('places'))} styles={styles} />
          <LibraryCard label="Posts" count={posts.savedPosts.length} onPress={() => router.push(routes.saved('posts'))} styles={styles} />
          <LibraryCard label="Collections" count={collections.collections.length} onPress={() => router.push(routes.saved('collections'))} styles={styles} />
        </ScrollView>
      ) : section === 'dishes' ? (
        dishes.loading ? (
          <EmptyState loading title="Loading saved dishes" />
        ) : dishes.error ? (
          <ErrorMessage message={dishes.error} style={styles.error} />
        ) : dishes.savedDishes.length === 0 ? (
          <EmptyState title="No saved dishes yet" subtitle="Bookmark a dish page to keep it here." icon={<BookmarkIcon size={24} />} />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {dishes.savedDishes.map(dish => (
              <TouchableOpacity
                key={dish.id}
                style={styles.row}
                onPress={() => router.push(routes.dishDetail(dish.id))}
                accessibilityRole="button"
              >
                <ImagePlaceholder size={22} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{dish.name}</Text>
                  {dish.restaurant ? <Text style={styles.rowSubtitle}>{dish.restaurant.name}</Text> : null}
                </View>
                <ChevronRight />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      ) : section === 'posts' ? (
        posts.loading ? (
          <EmptyState loading title="Loading saved posts" />
        ) : posts.error ? (
          <ErrorMessage message={posts.error} style={styles.error} />
        ) : posts.savedPosts.length === 0 ? (
          <EmptyState title="No saved posts yet" subtitle="Bookmark reviews to find them here." icon={<BookmarkIcon size={24} />} />
        ) : (
          <ThumbGrid
            posts={posts.savedPosts}
            hasMore={posts.hasMore}
            loadingMore={posts.loadingMore}
            onLoadMore={() => { void posts.loadMore() }}
            onPressPost={post => router.push(routes.postDetail(post.dbId))}
          />
        )
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.createCard}>
            <Text style={styles.createTitle}>New private collection</Text>
            <TextInput
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              placeholder="Weeknight favourites"
              placeholderTextColor={colors.text3}
              maxLength={80}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => { void createCollection() }}
            />
            <TouchableOpacity
              style={styles.createButton}
              disabled={creating || !newCollectionName.trim()}
              onPress={() => { void createCollection() }}
              accessibilityRole="button"
            >
              {creating ? <ActivityIndicator color={colors.bg} /> : (
                <>
                  <PlusIcon size={17} color={colors.bg} />
                  <Text style={styles.createButtonText}>Create</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {collections.collections.length === 0 ? (
            <EmptyState title="No collections yet" subtitle="Create one to organise saved dishes, posts, and places." />
          ) : collections.collections.map(collection => (
            <TouchableOpacity
              key={collection.id}
              style={styles.row}
              onPress={() => router.push(routes.collectionDetail(collection.id))}
              accessibilityRole="button"
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{collection.name}</Text>
                <Text style={styles.rowSubtitle}>Private collection</Text>
              </View>
              <ChevronRight />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function LibraryCard({
  label,
  count,
  onPress,
  styles,
}: {
  label: string
  count: number
  onPress: () => void
  styles: ReturnType<typeof makeStyles>
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
      <View>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.cardCount}>{count} saved</Text>
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
      justifyContent: 'center',
      alignItems: 'center',
      borderBottomWidth: spacing.hairline,
      borderBottomColor: c.border,
      paddingHorizontal: spacing[4],
    },
    back: { position: 'absolute', left: spacing[4], minHeight: 44, justifyContent: 'center' },
    backText: { fontSize: fontSize.md, color: c.text2 },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    overview: { padding: spacing[4], gap: spacing[3] },
    subtitle: { color: c.text2, fontSize: fontSize.base, marginBottom: spacing[2] },
    card: {
      minHeight: 76,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      borderRadius: radius.lg2,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: c.text },
    cardCount: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing[1] },
    list: { padding: spacing[4], gap: spacing[2], flexGrow: 1 },
    row: {
      minHeight: 64,
      borderRadius: radius.lg,
      backgroundColor: c.surface,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      paddingHorizontal: spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
    rowSubtitle: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing[1] },
    createCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg2,
      padding: spacing[4],
      gap: spacing[3],
      marginBottom: spacing[2],
    },
    createTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
    input: {
      minHeight: 48,
      paddingHorizontal: spacing[3],
      backgroundColor: c.bg,
      borderRadius: radius.lg,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      color: c.text,
      fontSize: fontSize.md,
    },
    createButton: {
      minHeight: 48,
      borderRadius: radius.lg,
      backgroundColor: c.text,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing[2],
    },
    createButtonText: { color: c.bg, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
    error: { marginHorizontal: spacing[4], marginTop: spacing[3] },
  })
}
