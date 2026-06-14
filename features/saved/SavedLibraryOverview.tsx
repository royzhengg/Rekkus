import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import {
  BookmarkIcon,
  ChevronRight,
  ImagePlaceholder,
  ListIcon,
  PinIcon,
  SearchIcon,
} from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { routes } from '@/lib/routes'
import { addTargetToCollection, removeTargetFromCollection, unsaveTarget } from '@/lib/services/collections'
import {
  isSelectableSavedLibraryItem,
  SAVED_LIBRARY_SCOPES,
  savedLibraryItemKindLabel,
  savedLibraryItemMetadata,
  type SavedLibraryItem,
  type SavedLibraryScope,
} from './savedLibrary'
import type { SavedLibraryModel } from './useSavedLibrary'

type BulkSheet = 'add' | 'remove' | 'unsave' | null

type Props = {
  library: SavedLibraryModel
  query: string
  scope: SavedLibraryScope
  requireOnline: () => boolean
  setOperationError: (message: string | null) => void
  setQuery: (query: string) => void
  setScope: (scope: SavedLibraryScope) => void
  visibilityLabels: Record<string, string>
}

export function SavedLibraryOverview({
  library,
  query,
  scope,
  requireOnline,
  setOperationError,
  setQuery,
  setScope,
  visibilityLabels,
}: Props) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkSheet, setBulkSheet] = useState<BulkSheet>(null)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  const selectedItems = library.items.filter(item => selectedIds.has(item.id) && isSelectableSavedLibraryItem(item))
  const selectedCount = selectedItems.length
  const selecting = selectedIds.size > 0
  const totalSavedCount = countForScope('all')
  const visibleCount = library.results.length
  const summaryLabel = query.trim()
    ? `${visibleCount} ${visibleCount === 1 ? 'match' : 'matches'}`
    : scope === 'all'
      ? `${totalSavedCount} ${totalSavedCount === 1 ? 'item' : 'items'}`
      : `${visibleCount} ${scopeSummaryNoun(scope, visibleCount)}`

  function countForScope(nextScope: SavedLibraryScope): number {
    if (nextScope === 'all') {
      return library.counts.dishes + library.counts.places + library.counts.posts + library.counts.collections
    }
    if (nextScope === 'dishes') return library.counts.dishes
    if (nextScope === 'places') return library.counts.places
    if (nextScope === 'posts') return library.counts.posts
    return library.counts.collections
  }

  function scopeSummaryNoun(nextScope: SavedLibraryScope, count: number): string {
    if (nextScope === 'places') return count === 1 ? 'place' : 'places'
    if (nextScope === 'collections') return count === 1 ? 'list' : 'lists'
    if (nextScope === 'dishes') return count === 1 ? 'dish' : 'dishes'
    if (nextScope === 'posts') return count === 1 ? 'post' : 'posts'
    return count === 1 ? 'item' : 'items'
  }

  function toggleSelected(item: SavedLibraryItem) {
    if (!isSelectableSavedLibraryItem(item)) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }

  function openLibraryItem(item: SavedLibraryItem) {
    if (selecting && isSelectableSavedLibraryItem(item)) {
      toggleSelected(item)
      return
    }
    if (item.type === 'dish') router.push(routes.dishDetail(item.routeId))
    else if (item.type === 'restaurant') router.push(routes.restaurantDetail({ restaurantId: item.routeId }))
    else if (item.type === 'post') router.push(routes.postDetail(item.routeId))
    else router.push(routes.collectionDetail(item.routeId))
  }

  function selectScope(nextScope: SavedLibraryScope) {
    setScope(nextScope)
    setSelectedIds(new Set())
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery)
  }

  function openSavedPlacesMap() {
    router.push(routes.savedPlaces({ view: 'map' }))
  }

  function openListsScope() {
    selectScope('collections')
  }

  async function runBulkCollectionAction(collectionId: string, mode: 'add' | 'remove') {
    if (selectedItems.length === 0) return
    if (!requireOnline()) {
      setOperationError('Reconnect to update collections.')
      return
    }
    setBulkWorking(true)
    setOperationError(null)
    const results = await Promise.allSettled(selectedItems.map(item => {
      if (!item.targetType || !item.targetId) return Promise.resolve()
      return mode === 'add'
        ? addTargetToCollection(collectionId, item.targetType, item.targetId)
        : removeTargetFromCollection(collectionId, item.targetType, item.targetId)
    }))
    await library.refresh()
    setBulkWorking(false)
    setBulkSheet(null)
    if (results.some(result => result.status === 'rejected')) {
      setOperationError(mode === 'add' ? 'Some items could not be added.' : 'Some items could not be removed from that collection.')
      return
    }
    setSelectedIds(new Set())
  }

  async function runBulkUnsave() {
    if (selectedItems.length === 0) return
    if (!requireOnline()) {
      setOperationError('Reconnect to update saved items.')
      return
    }
    setBulkWorking(true)
    setOperationError(null)
    const results = await Promise.allSettled(selectedItems.map(item => {
      if (!item.targetType || !item.targetId) return Promise.resolve()
      return unsaveTarget(item.targetType, item.targetId, true)
    }))
    await library.refresh()
    setBulkWorking(false)
    setBulkSheet(null)
    if (results.some(result => result.status === 'rejected')) {
      setOperationError('Some items could not be removed from Saved.')
      return
    }
    setSelectedIds(new Set())
  }

  return (
    <>
      {library.error ? <ErrorMessage message={library.error} style={styles.error} /> : null}
      <ScrollView contentContainerStyle={[styles.overview, selecting && styles.overviewWithDock]} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View>
            <Text style={styles.title} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Saved</Text>
            <Text style={styles.savedCount} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{summaryLabel}</Text>
          </View>
        </View>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={openSavedPlacesMap}
            accessibilityRole="button"
            accessibilityLabel="View saved places on map"
          >
            <PinIcon size={16} color={colors.accent} />
            <Text style={styles.quickActionText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, scope === 'collections' && styles.quickActionActive]}
            onPress={openListsScope}
            accessibilityRole="button"
            accessibilityLabel={`View saved lists, ${countForScope('collections')} saved`}
            accessibilityState={{ selected: scope === 'collections' }}
          >
            <ListIcon size={16} color={scope === 'collections' ? colors.accent : colors.text3} />
            <Text style={[styles.quickActionText, scope === 'collections' && styles.quickActionTextActive]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Lists</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <SearchIcon size={17} color={searchFocused ? colors.accent : colors.text3} />
          <TextInput
            value={query}
            onChangeText={updateQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search saved"
            placeholderTextColor={colors.text3}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search saved library"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeTabs} accessibilityRole="tablist">
          {SAVED_LIBRARY_SCOPES.map(option => {
            const selected = option.scope === scope
            return (
              <TouchableOpacity
                key={option.scope}
                style={[styles.scopeTab, selected && styles.scopeTabSelected]}
                onPress={() => selectScope(option.scope)}
                accessibilityRole="tab"
                accessibilityLabel={`${option.label}, ${countForScope(option.scope)} saved`}
                accessibilityState={{ selected }}
              >
                <ScopeIcon scope={option.scope} color={selected ? colors.accent : colors.text3} />
                <Text style={[styles.scopeTabText, selected && styles.scopeTabTextSelected]} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                  {option.scope === 'all' ? `${option.label} ${totalSavedCount}` : option.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
        {library.loading ? (
          <SavedLibrarySkeletonRows styles={styles} />
        ) : library.results.length === 0 ? (
          <EmptyState
            title={query.trim() ? 'No saved matches' : 'No saved items yet'}
            subtitle={query.trim() ? 'Try another saved dish, place, post, or collection.' : 'Bookmark dishes, places, or posts to build your library.'}
            icon={<BookmarkIcon size={24} />}
          />
        ) : (
          <View style={styles.results}>
            {library.results.map(item => (
              <SavedLibraryRow
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                selecting={selecting}
                onPress={() => openLibraryItem(item)}
                onLongPress={() => toggleSelected(item)}
                styles={styles}
              />
            ))}
          </View>
        )}
      </ScrollView>
      {selecting && (
        <View style={styles.actionDock}>
          <Text style={styles.actionDockText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{selectedCount} selected</Text>
          <DockButton label="Add to list" disabled={bulkWorking || library.collections.length === 0 || selectedCount === 0} onPress={() => setBulkSheet('add')} styles={styles} />
          <DockButton label="Remove" disabled={bulkWorking || library.collections.length === 0 || selectedCount === 0} onPress={() => setBulkSheet('remove')} styles={styles} />
          <TouchableOpacity style={styles.clearSelectionButton} onPress={() => setSelectedIds(new Set())} accessibilityRole="button">
            <Text style={styles.clearSelectionText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>Cancel</Text>
          </TouchableOpacity>
          <DockButton label="Unsave" destructive disabled={bulkWorking || selectedCount === 0} onPress={() => setBulkSheet('unsave')} styles={styles} />
        </View>
      )}
      <RekkusActionSheet
        visible={bulkSheet === 'add' || bulkSheet === 'remove'}
        title={bulkSheet === 'add' ? 'Add to collection' : 'Remove from collection'}
        subtitle={`${selectedCount} saved ${selectedCount === 1 ? 'item' : 'items'} selected.`}
        options={library.collections.map(collection => ({
          label: collection.name,
          value: collection.id,
          description: visibilityLabels[collection.visibility],
          loading: bulkWorking,
        }))}
        onSelect={collectionId => {
          if (bulkSheet === 'add' || bulkSheet === 'remove') void runBulkCollectionAction(collectionId, bulkSheet)
        }}
        onDismiss={() => setBulkSheet(null)}
      />
      <RekkusActionSheet
        visible={bulkSheet === 'unsave'}
        title="Remove from Saved?"
        subtitle="This also removes selected items from your collections."
        options={[
          { label: 'Remove from Saved', value: 'confirm', destructive: true, loading: bulkWorking },
          { label: 'Keep saved', value: 'cancel' },
        ]}
        onSelect={value => {
          if (value === 'confirm') void runBulkUnsave()
        }}
        onDismiss={() => setBulkSheet(null)}
      />
    </>
  )
}

function ScopeIcon({ color, scope }: { color: string; scope: SavedLibraryScope }) {
  if (scope === 'places') return <PinIcon size={14} color={color} />
  if (scope === 'collections') return <ListIcon size={14} color={color} />
  return <BookmarkIcon size={14} inactiveColor={color} />
}

function SavedLibrarySkeletonRows({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.results}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} style={styles.libraryRow}>
          <Skeleton width={spacing.px40} height={spacing.px40} radius={radius.md2} />
          <View style={styles.rowBody}>
            <Skeleton width="28%" height={10} />
            <Skeleton width={index === 1 ? '52%' : '68%'} height={14} />
            <Skeleton width={index === 2 ? '44%' : '76%'} height={12} />
          </View>
          <Skeleton width={spacing.px18} height={spacing.px18} radius={radius.full} />
        </View>
      ))}
    </View>
  )
}

function DockButton({
  destructive,
  disabled,
  label,
  onPress,
  styles,
}: {
  destructive?: boolean
  disabled: boolean
  label: string
  onPress: () => void
  styles: ReturnType<typeof makeStyles>
}) {
  return (
    <TouchableOpacity
      style={[styles.dockButton, destructive && styles.dockButtonDanger, disabled && styles.dockButtonDisabled]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={styles.dockButtonText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{label}</Text>
    </TouchableOpacity>
  )
}

function SavedLibraryRow({
  item,
  selected,
  selecting,
  onPress,
  onLongPress,
  styles,
}: {
  item: SavedLibraryItem
  selected: boolean
  selecting: boolean
  onPress: () => void
  onLongPress: () => void
  styles: ReturnType<typeof makeStyles>
}) {
  const selectable = isSelectableSavedLibraryItem(item)
  const itemKind = item.type === 'restaurant' ? 'place' : item.type === 'collection' ? 'list' : item.type
  const itemLabel = savedLibraryItemKindLabel(item)
  const itemMetadata = savedLibraryItemMetadata(item)
  const itemDetail = itemMetadata.startsWith(`${itemLabel} · `) ? itemMetadata.slice(itemLabel.length + 3) : item.subtitle
  return (
    <TouchableOpacity
      style={[styles.libraryRow, selected && styles.libraryRowSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`Open saved ${itemKind} ${item.title}${item.status ? `, ${item.status}` : ''}`}
      accessibilityState={{ selected }}
    >
      <View style={styles.preview}>
        {item.imageUrl ? <CachedImage source={{ uri: item.imageUrl }} style={styles.previewImage} /> : <ImagePlaceholder size={20} />}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{item.title}</Text>
        <View style={styles.rowMetaLine}>
          <Text style={styles.rowKind} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{itemLabel}</Text>
          <Text style={styles.rowSubtitle} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>{itemDetail}</Text>
        </View>
      </View>
      {selecting && selectable ? (
        <View style={[styles.selectionMark, selected && styles.selectionMarkSelected]}>
          <Text style={styles.selectionMarkText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{selected ? '✓' : ''}</Text>
        </View>
      ) : (
        <ChevronRight />
      )}
    </TouchableOpacity>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    overview: { paddingHorizontal: spacing[4], paddingTop: spacing[5], gap: spacing[4], paddingBottom: spacing.px34 },
    overviewWithDock: { paddingBottom: spacing.px60 + spacing.px34 },
    hero: { paddingBottom: spacing.px1 },
    title: { color: c.text, fontSize: fontSize['5xl'], lineHeight: lineHeight.display, fontWeight: fontWeight.bold },
    savedCount: { color: c.text3, fontSize: fontSize.bodySm, lineHeight: lineHeight.tight, fontWeight: fontWeight.medium, marginTop: spacing.px2 },
    quickActions: {
      flexDirection: 'row',
      gap: spacing[2],
      marginTop: -spacing.px2,
    },
    quickAction: {
      minHeight: spacing.px40 + spacing[1],
      borderRadius: radius.pill3,
      backgroundColor: c.surface,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      paddingHorizontal: spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
    },
    quickActionActive: {
      backgroundColor: c.chipActiveBg,
      borderColor: c.chipActiveBg,
    },
    quickActionText: {
      color: c.text2,
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.semibold,
    },
    quickActionTextActive: {
      color: c.chipActiveText,
    },
    searchBox: {
      minHeight: spacing.px40 + spacing[1],
      paddingHorizontal: spacing[3],
      backgroundColor: c.surface,
      borderRadius: radius.pill3,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    searchBoxFocused: { borderColor: c.accent, backgroundColor: c.focused },
    searchInput: {
      flex: 1,
      minHeight: spacing.px40 + spacing[1],
      color: c.text,
      fontSize: fontSize.md,
    },
    scopeTabs: { flexDirection: 'row', gap: spacing.px6, marginTop: -spacing.px2 },
    scopeTab: {
      minHeight: spacing.px40 + spacing[1],
      borderRadius: radius.pill,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      backgroundColor: c.bg,
      paddingHorizontal: spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
    },
    scopeTabSelected: { backgroundColor: c.chipActiveBg, borderColor: c.chipActiveBg },
    scopeTabText: { fontSize: fontSize.bodySm, color: c.text2, fontWeight: fontWeight.medium },
    scopeTabTextSelected: { color: c.chipActiveText },
    results: { gap: spacing[3] },
    libraryRow: {
      minHeight: spacing.px60 + spacing[4],
      borderRadius: radius.lg,
      backgroundColor: c.surface,
      borderWidth: spacing[0],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    libraryRowSelected: { backgroundColor: c.chipActiveBg },
    preview: {
      width: spacing.px56,
      height: spacing.px56,
      borderRadius: radius.md2,
      overflow: 'hidden',
      backgroundColor: c.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewImage: { width: '100%', height: '100%' },
    rowBody: { flex: 1, gap: spacing.px5 },
    rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6 },
    rowKind: {
      borderRadius: radius.pill,
      backgroundColor: c.bg,
      color: c.chipActiveText,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.tight,
      paddingHorizontal: spacing.px7,
      paddingVertical: spacing.px2,
      overflow: 'hidden',
    },
    rowTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text, lineHeight: lineHeight.title },
    rowSubtitle: { flex: 1, fontSize: fontSize.bodySm, color: c.text2, lineHeight: lineHeight.tight },
    selectionMark: {
      width: spacing.px28,
      height: spacing.px28,
      borderRadius: radius.pill,
      borderWidth: spacing.hairline,
      borderColor: c.border2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectionMarkSelected: { backgroundColor: c.accent, borderColor: c.accent },
    selectionMarkText: { color: c.bg, fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold },
    error: { marginHorizontal: spacing[4], marginTop: spacing[3] },
    actionDock: {
      position: 'absolute',
      left: spacing[3],
      right: spacing[3],
      bottom: spacing[3],
      minHeight: spacing.px60,
      borderRadius: radius.pill3,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      backgroundColor: c.surface,
      padding: spacing[2],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    actionDockText: { flex: 1, fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.text },
    dockButton: {
      minHeight: spacing.px40 + spacing[1],
      borderRadius: radius.pill,
      backgroundColor: c.text,
      paddingHorizontal: spacing[2],
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    dockButtonDanger: { backgroundColor: c.errorText },
    dockButtonDisabled: { opacity: 0.45 },
    dockButtonText: { fontSize: fontSize.bodySm, color: c.bg, fontWeight: fontWeight.semibold },
    clearSelectionButton: {
      minHeight: spacing.px40 + spacing[1],
      borderRadius: radius.pill,
      paddingHorizontal: spacing[2],
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearSelectionText: { fontSize: fontSize.bodySm, color: c.text2, fontWeight: fontWeight.medium },
  })
}
