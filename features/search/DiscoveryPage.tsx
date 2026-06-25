import { useRouter } from 'expo-router'
import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native'
import {
  DiscoveryEmptyState,
  DiscoveryModule,
  discoveryTokens,
} from '@/components/discovery'
import { Chip } from '@/components/ui/Chip'
import { spacing } from '@/constants/Spacing'
import { fontSize, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { DishResult } from '@/lib/hooks/searchTypes'
import type { PlaceResult } from '@/lib/hooks/useSearch'
import { routes } from '@/lib/routes'
import type { Collection } from '@/lib/services/collections'
import type { MockUser } from '@/types/domain'
import {
  CollectionRow,
  PersonChip,
  PlaceCardGrid,
  SearchRows,
  TrendingDishCard,
} from './DiscoveryCards'
import { discoveryModule, DISCOVERY_MODULES, type DiscoveryModuleId } from './discoveryModules'

const MAX_VISIBLE_ITEMS = 4

interface DiscoveryPageProps {
  isFocused: boolean
  recentSearches: string[]
  savedSearches: string[]
  onDismissSearch: (item: string) => void
  onSelectRecent: (item: string) => void
  onSelectSavedSearch: (item: string) => void
  onSaveSearch: (item: string) => void
  onUnsaveSearch: (item: string) => void
  trendingItems: Array<{ tag: string; count: string }>
  trendingDishes: DishResult[]
  suggestedPeople: Array<[string, MockUser]>
  popularPlaces: PlaceResult[]
  staffPicks: Collection[]
  onTrending: (tag: string) => void
  onTrendingDish: (dishName: string) => void
  userId: string | undefined
}

export function DiscoveryPage({
  isFocused,
  recentSearches,
  savedSearches,
  onDismissSearch,
  onSelectRecent,
  onSelectSavedSearch,
  onSaveSearch,
  onUnsaveSearch,
  trendingItems,
  trendingDishes,
  suggestedPeople,
  popularPlaces,
  staffPicks,
  onTrending,
  onTrendingDish,
  userId,
}: DiscoveryPageProps) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { width } = useWindowDimensions()
  const router = useRouter()
  const cardWidth = (width - spacing[4] * 2 - discoveryTokens.cardGap) / 2
  const cardImageHeight = cardWidth * discoveryTokens.thumbnailRatio
  const visibility = {
    saved_searches: !!userId && savedSearches.length > 0,
    recent_searches: isFocused && recentSearches.length > 0,
    trending_now: trendingItems.length > 0,
    trending_dishes: trendingDishes.length > 0,
    popular_places: popularPlaces.length > 0,
    staff_picks: staffPicks.length > 0,
    taste_guides: suggestedPeople.length > 0,
  } satisfies Record<DiscoveryModuleId, boolean>
  const hasAnyModule = Object.values(visibility).some(Boolean)
  const renderedModules = useMemo(() => DISCOVERY_MODULES.map(module => module.id), [])

  function renderModule(id: DiscoveryModuleId) {
    if (!visibility[id]) return null
    const module = discoveryModule(id)
    if (id === 'saved_searches') {
      return (
        <DiscoveryModule key={id} colors={colors} {...module}>
          <SearchRows
            items={savedSearches.slice(0, MAX_VISIBLE_ITEMS)}
            mode="saved"
            onSelect={onSelectSavedSearch}
            onSave={onSaveSearch}
            onUnsave={onUnsaveSearch}
            onDismiss={onDismissSearch}
            userId={userId}
          />
        </DiscoveryModule>
      )
    }
    if (id === 'recent_searches') {
      return (
        <DiscoveryModule key={id} colors={colors} {...module}>
          <SearchRows
            items={recentSearches.slice(0, MAX_VISIBLE_ITEMS)}
            mode="recent"
            onSelect={onSelectRecent}
            onSave={onSaveSearch}
            onUnsave={onUnsaveSearch}
            onDismiss={onDismissSearch}
            userId={userId}
          />
        </DiscoveryModule>
      )
    }
    if (id === 'trending_now') {
      return (
        <DiscoveryModule key={id} colors={colors} {...module}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingTagsRow}>
            {trendingItems.slice(0, 8).map(item => (
              <Chip key={item.tag} label={item.tag.replace(/^#/, '')} onPress={() => onTrending(item.tag)} />
            ))}
          </ScrollView>
        </DiscoveryModule>
      )
    }
    if (id === 'trending_dishes') {
      return (
        <DiscoveryModule key={id} colors={colors} {...module}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
            {trendingDishes.slice(0, 10).map(dish => (
              <TrendingDishCard key={dish.id} dish={dish} userId={userId} onTrendingDish={onTrendingDish} />
            ))}
          </ScrollView>
        </DiscoveryModule>
      )
    }
    if (id === 'popular_places') {
      return (
        <DiscoveryModule key={id} colors={colors} {...module}>
          <PlaceCardGrid
            places={popularPlaces.slice(0, MAX_VISIBLE_ITEMS)}
            cardWidth={cardWidth}
            cardImageHeight={cardImageHeight}
            userId={userId}
          />
        </DiscoveryModule>
      )
    }
    if (id === 'staff_picks') {
      return (
        <DiscoveryModule key={id} colors={colors} {...module}>
          <View>
            {staffPicks.slice(0, MAX_VISIBLE_ITEMS).map(collection => (
              <CollectionRow key={collection.id} collection={collection} userId={userId} />
            ))}
          </View>
        </DiscoveryModule>
      )
    }
    return (
      <DiscoveryModule key={id} colors={colors} {...module}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleChipsRow}>
          {suggestedPeople.slice(0, MAX_VISIBLE_ITEMS).map(([username, u]) => (
            <PersonChip key={username} username={username} u={u} />
          ))}
        </ScrollView>
      </DiscoveryModule>
    )
  }

  return (
    <View style={styles.discoveryPage}>
      <View style={styles.contextBar}>
        <Text style={styles.contextText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
          Built from your saves, local activity, and trusted taste.
        </Text>
      </View>
      {hasAnyModule ? (
        renderedModules.map(renderModule)
      ) : (
        <DiscoveryEmptyState
          colors={colors}
          title="Today's Taste Ledger"
          subtitle="Start with a craving, a save, or a person whose taste you trust."
          actions={[
            { label: 'Search ramen', onPress: () => onTrending('ramen'), accessibilityLabel: 'Search ramen' },
            { label: 'Search dumplings', onPress: () => onTrending('dumplings'), accessibilityLabel: 'Search dumplings' },
            { label: 'Post a dish', onPress: () => router.push(routes.createPost()), accessibilityLabel: 'Post a dish' },
          ]}
        />
      )}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    discoveryPage: { paddingBottom: spacing[6] },
    contextBar: {
      marginHorizontal: spacing[4],
      marginTop: spacing[3],
      paddingVertical: spacing[3],
      borderBottomWidth: spacing.hairline,
      borderBottomColor: c.border,
    },
    contextText: {
      fontSize: fontSize.bodySm,
      color: c.text2,
      lineHeight: lineHeight.small,
    },
    trendingTagsRow: {
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[1],
    },
    trendingRow: {
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[1],
    },
    peopleChipsRow: {
      paddingHorizontal: spacing[4],
      gap: spacing.px10,
      paddingBottom: spacing[4],
    },
  })
}
