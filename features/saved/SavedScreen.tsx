import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SaveIcon, ChevronRight, ImagePlaceholder, PlusIcon } from '@/components/icons'
import { ThumbGrid } from '@/components/ThumbGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { routes } from '@/lib/routes'
import {
  createPrivateCollection,
  updateCollectionVisibility,
  type Collection,
  type CollectionVisibility,
} from '@/lib/services/collections'
import type { SavedLibrarySection } from '@/types/domain'
import { SavedLibraryOverview } from './SavedLibraryOverview'
import { useSavedLibrary } from './useSavedLibrary'
import type { SavedLibraryScope } from './savedLibrary'

const VISIBILITY_LABELS: Record<CollectionVisibility, string> = {
  private: 'Private',
  unlisted: 'Link only',
  public: 'Public',
}

const VISIBILITY_DESCRIPTIONS: Record<CollectionVisibility, string> = {
  private: 'Only you can see this',
  unlisted: 'Anyone with the link can see this',
  public: 'Shown on your profile',
}

function parseSection(value: string | undefined): SavedLibrarySection {
  return value === 'dishes' || value === 'posts' || value === 'collections'
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
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SavedLibraryScope>('all')
  const library = useSavedLibrary(user?.id, scope, query)
  const { collections, raw } = library
  const [newCollectionName, setNewCollectionName] = useState('')
  const [creating, setCreating] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [visibilitySheetCollection, setVisibilitySheetCollection] = useState<Collection | null>(null)
  const [updatingVisibility, setUpdatingVisibility] = useState<Set<string>>(new Set())

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
      await raw.collections.refresh()
    } catch {
      setOperationError('Could not create that collection.')
    }
    setCreating(false)
  }

  async function changeVisibility(collection: Collection, visibility: CollectionVisibility) {
    if (!user?.id || visibility === collection.visibility) return
    setUpdatingVisibility(prev => new Set(prev).add(collection.id))
    setOperationError(null)
    try {
      await updateCollectionVisibility(collection.id, visibility)
      analytics.collectionInteraction(user.id, 'visibility_change', collection.id, { visibility })
      await raw.collections.refresh()
    } catch {
      setOperationError('Could not update visibility.')
    }
    setUpdatingVisibility(prev => { const next = new Set(prev); next.delete(collection.id); return next })
  }

  const title = section === 'overview' ? 'Saved' : section.charAt(0).toUpperCase() + section.slice(1)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {section === 'overview' ? null : (
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => router.replace(routes.saved())} accessibilityRole="button">
            <Text style={styles.backText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Saved</Text>
          </TouchableOpacity>
          <Text style={styles.title} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{title}</Text>
        </View>
      )}
      {operationError ? <ErrorMessage message={operationError} style={styles.error} /> : null}
      {section === 'overview' ? (
        <SavedLibraryOverview
          library={library}
          query={query}
          scope={scope}
          requireOnline={requireOnline}
          setOperationError={setOperationError}
          setQuery={setQuery}
          setScope={setScope}
          visibilityLabels={VISIBILITY_LABELS}
        />
      ) : section === 'dishes' ? (
        raw.dishes.loading ? (
          <EmptyState loading title="Loading saved dishes" />
        ) : raw.dishes.error ? (
          <ErrorMessage message={raw.dishes.error} style={styles.error} />
        ) : raw.dishes.savedDishes.length === 0 ? (
          <EmptyState title="No saved dishes yet" subtitle="Save a dish to keep it here." icon={<SaveIcon size={24} />} />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {raw.dishes.savedDishes.map(dish => (
              <TouchableOpacity
                key={dish.id}
                style={styles.row}
                onPress={() => router.push(routes.dishDetail(dish.id))}
                accessibilityRole="button"
              >
                <ImagePlaceholder size={22} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{dish.name}</Text>
                  {dish.place ? <Text style={styles.rowSubtitle} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>{dish.place.name}</Text> : null}
                </View>
                <ChevronRight />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      ) : section === 'posts' ? (
        raw.posts.loading ? (
          <EmptyState loading title="Loading saved posts" />
        ) : raw.posts.error ? (
          <ErrorMessage message={raw.posts.error} style={styles.error} />
        ) : raw.posts.savedPosts.length === 0 ? (
          <EmptyState title="No saved posts yet" subtitle="Save posts to find them here." icon={<SaveIcon size={24} />} />
        ) : (
          <ThumbGrid
            posts={raw.posts.savedPosts}
            hasMore={raw.posts.hasMore}
            loadingMore={raw.posts.loadingMore}
            onLoadMore={() => { void raw.posts.loadMore() }}
            onPressPost={post => router.push(routes.postDetail(post.dbId))}
            showLocation
          />
        )
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.createCard}>
            <Text style={styles.createTitle} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>New private collection</Text>
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
                  <Text style={styles.createButtonText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Create</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {collections.length === 0 ? (
            <EmptyState title="No collections yet" subtitle="Create one to organise saved dishes, posts, and places." />
          ) : collections.map(collection => (
            <TouchableOpacity
              key={collection.id}
              style={styles.row}
              onPress={() => router.push(routes.collectionDetail(collection.id))}
              accessibilityRole="button"
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{collection.name}</Text>
                <Text style={styles.rowSubtitle} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>{VISIBILITY_LABELS[collection.visibility]}</Text>
              </View>
              {updatingVisibility.has(collection.id) ? (
                <ActivityIndicator size="small" style={styles.visibilityLoader} />
              ) : (
                <TouchableOpacity
                  style={styles.visibilityBadge}
                  onPress={() => setVisibilitySheetCollection(collection)}
                  accessibilityRole="button"
                  accessibilityLabel={`Visibility: ${VISIBILITY_LABELS[collection.visibility]}. Tap to change.`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.visibilityBadgeText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{VISIBILITY_LABELS[collection.visibility]}</Text>
                </TouchableOpacity>
              )}
              <ChevronRight />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <RekkusActionSheet
        visible={visibilitySheetCollection !== null}
        title="Collection visibility"
        subtitle="Control who can see this collection."
        options={(['private', 'unlisted', 'public'] as CollectionVisibility[]).map(v => ({
          label: VISIBILITY_LABELS[v],
          value: v,
          description: VISIBILITY_DESCRIPTIONS[v],
          selected: visibilitySheetCollection?.visibility === v,
        }))}
        onSelect={value => {
          if (visibilitySheetCollection) void changeVisibility(visibilitySheetCollection, value as CollectionVisibility)
        }}
        onDismiss={() => setVisibilitySheetCollection(null)}
      />
    </SafeAreaView>
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
    visibilityBadge: {
      borderRadius: radius.pill,
      borderWidth: 0.5,
      borderColor: c.border2,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      backgroundColor: c.surface2,
    },
    visibilityBadgeText: { fontSize: fontSize.xs, color: c.text2, fontWeight: fontWeight.medium },
    visibilityLoader: { marginHorizontal: spacing[2] },
  })
}
