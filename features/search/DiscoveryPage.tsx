import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native'
import { Avatar } from '@/components/Avatar'
import { SaveIcon, ClockIcon, CloseIcon } from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontFamily, fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { DishResult } from '@/lib/hooks/searchTypes'
import type { PlaceResult } from '@/lib/hooks/useSearch'
import { routes } from '@/lib/routes'
import type { Collection } from '@/lib/services/collections'
import { fetchUserIdByUsername } from '@/lib/services/users'
import type { MockUser } from '@/types/domain'
import { SectionHeader } from './searchShared'

// Stable placeholder colors derived from the place id to vary cards visually // check:tokens-ignore
const CARD_BG_COLORS = ['#EDE8E1', '#E1E8ED', '#E8EDE1', '#EDE1E8', '#E8E1ED', '#E1EDE8'] // check:tokens-ignore
function cardBgForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
  return CARD_BG_COLORS[Math.abs(h) % CARD_BG_COLORS.length] ?? '#EDE8E1' // check:tokens-ignore
}

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
  const cardWidth = (width - spacing[4] * 2 - spacing[3]) / 2
  const cardImageHeight = cardWidth * (4 / 3)

  return (
    <View style={styles.discoveryPage}>
      {userId && savedSearches.length > 0 && (
        <View>
          <SectionHeader title="Saved searches" />
          <View>
            {savedSearches.map(item => (
              <View key={item} style={styles.recentSearchRow}>
                <TouchableOpacity
                  style={styles.searchRowMain}
                  onPress={() => onSelectSavedSearch(item)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Search saved query ${item}`}
                >
                  <SaveIcon filled size={15} activeColor={colors.accent} />
                  <Text style={styles.recentSearchText} numberOfLines={1}>
                    {item}
                  </Text>
                </TouchableOpacity>
                <IconButton
                  size={44}
                  variant="plain"
                  onPress={() => onUnsaveSearch(item)}
                  accessibilityLabel={`Unsave search ${item}`}
                >
                  <SaveIcon filled size={18} activeColor={colors.accent} />
                </IconButton>
              </View>
            ))}
          </View>
        </View>
      )}

      {isFocused && recentSearches.length > 0 && (
        <View>
          <SectionHeader title="Recent searches" />
          <View>
            {recentSearches.map(item => (
              <View key={item} style={styles.recentSearchRow}>
                <TouchableOpacity
                  style={styles.searchRowMain}
                  onPress={() => onSelectRecent(item)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${item}`}
                >
                  <ClockIcon size={14} />
                  <Text style={styles.recentSearchText} numberOfLines={1}>
                    {item}
                  </Text>
                </TouchableOpacity>
                {!!userId && (
                  <IconButton
                    size={44}
                    variant="plain"
                    onPress={() => onSaveSearch(item)}
                    accessibilityLabel={`Save search ${item}`}
                  >
                    <SaveIcon size={18} inactiveColor={colors.text2} />
                  </IconButton>
                )}
                <IconButton
                  size={44}
                  variant="plain"
                  onPress={() => onDismissSearch(item)}
                  accessibilityLabel={`Remove recent search ${item}`}
                >
                  <CloseIcon />
                </IconButton>
              </View>
            ))}
          </View>
        </View>
      )}

      {popularPlaces.length > 0 && (
        <PlaceCardGrid places={popularPlaces} cardWidth={cardWidth} cardImageHeight={cardImageHeight} userId={userId} />
      )}

      {trendingItems.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trendingTagsRow}
        >
          {trendingItems.slice(0, 8).map(item => (
            <Chip
              key={item.tag}
              label={item.tag.replace(/^#/, '')}
              onPress={() => onTrending(item.tag)}
            />
          ))}
        </ScrollView>
      )}

      {trendingDishes.length > 0 && (
        <>
          <SectionHeader title="Trending dishes" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingRow}
          >
            {trendingDishes.map((dish) => (
              <TouchableOpacity
                key={dish.id}
                style={styles.trendingDishCard}
                onPress={() => {
                  analytics.viewDish(userId ?? null, dish.id)
                  onTrendingDish(dish.name)
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${dish.name}`}
              >
                <Text style={styles.trendingDishName} numberOfLines={1}>{dish.name}</Text>
                {!!dish.cuisine_type && (
                  <Text style={styles.trendingDishCuisine} numberOfLines={1}>{dish.cuisine_type}</Text>
                )}
                {dish.save_count > 0 && (
                  <Text style={styles.trendingDishSaveCount}>{dish.save_count} saves</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {staffPicks.length > 0 && (
        <>
          <SectionHeader title="Staff picks" />
          <View>
            {staffPicks.map(collection => (
              <TouchableOpacity
                key={collection.id}
                style={styles.collectionRow}
                activeOpacity={0.75}
                onPress={() =>
                  analytics.collectionInteraction(
                    userId ?? null,
                    'staff_pick_selected',
                    collection.id,
                    { collection_visibility: collection.visibility }
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={collection.name}
              >
                <Text style={styles.collectionName}>{collection.name}</Text>
                {!!collection.curator_note && (
                  <Text style={styles.collectionNote} numberOfLines={2}>
                    {collection.curator_note}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <SectionHeader title="Taste guides to follow" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.peopleChipsRow}
      >
        {suggestedPeople.map(([username, u]) => (
          <PersonChip key={username} username={username} u={u} />
        ))}
      </ScrollView>
    </View>
  )
}

// ─── PlaceCardGrid ────────────────────────────────────────────────────────────

const PlaceCardGrid = React.memo(function PlaceCardGrid({
  places,
  cardWidth,
  cardImageHeight,
  userId,
}: {
  places: PlaceResult[]
  cardWidth: number
  cardImageHeight: number
  userId?: string | undefined
}) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const rows: PlaceResult[][] = []
  for (let i = 0; i < places.length; i += 2) {
    rows.push(places.slice(i, i + 2))
  }

  return (
    <View style={styles.cardGrid}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.cardRow}>
          {row.map(place => (
            <TouchableOpacity
              key={place.id}
              style={[styles.card, { width: cardWidth }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={place.name}
              onPress={() => {
                analytics.viewPlace(userId ?? null, place.id)
                router.push(routes.placeDetail({ placeId: place.id }))
              }}
            >
              <View style={[styles.cardImage, { height: cardImageHeight, backgroundColor: cardBgForId(place.id) }]} />
              <Text style={styles.cardName} numberOfLines={2}>{place.name}</Text>
              {!!place.cuisine_type && (
                <Text style={styles.cardCuisine} numberOfLines={1}>{place.cuisine_type}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  )
})

// ─── PersonChip ───────────────────────────────────────────────────────────────

const PersonChip = React.memo(function PersonChip({
  username,
  u,
}: {
  username: string
  u: MockUser
}) {
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const { runDeferredMutation, requireOnline } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [following, setFollowing] = useState(false)

  async function handleFollow() {
    if (!user) {
      requireAuth()
      return
    }
    if (!requireOnline()) return
    const targetUserId = await fetchUserIdByUsername(username)
    if (!targetUserId) return
    const next = !following
    setFollowing(next)
    try {
      await runDeferredMutation({ kind: 'follow', targetUserId, targetState: next })
    } catch {
      setFollowing(!next)
    }
  }

  return (
    <View style={styles.personChip}>
      <TouchableOpacity
        onPress={() => router.push(routes.userProfile(username))}
        activeOpacity={0.8}
        style={styles.personChipInner}
        accessibilityRole="button"
        accessibilityLabel={`View @${username}'s profile`}
      >
        <Avatar initials={u.initials} bg={u.avatarBg} color={u.avatarColor} size={52} />
        <Text style={styles.personChipUsername} numberOfLines={1}>
          @{username}
        </Text>
        <Text style={styles.personChipFollowers}>{u.followers}</Text>
      </TouchableOpacity>
      <Chip
        label={following ? 'Following' : 'Follow'}
        selected={following}
        variant="active"
        onPress={() => { void handleFollow() }}
        style={styles.followChip}
      />
    </View>
  )
})

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    discoveryPage: { paddingBottom: spacing[6] },
    cardGrid: {
      paddingHorizontal: spacing[4],
      paddingTop: spacing[4],
      gap: spacing[3],
    },
    cardRow: {
      flexDirection: 'row',
      gap: spacing[3],
    },
    card: {
      overflow: 'hidden',
    },
    cardImage: {
      borderRadius: radius.md,
      marginBottom: spacing[2],
    },
    cardName: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize['2xl'],
      color: c.text,
      marginBottom: spacing.px3,
      lineHeight: lineHeight.tight,
    },
    cardCuisine: {
      fontSize: fontSize.sm,
      color: c.text3,
    },
    trendingTagsRow: {
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    trendingRow: {
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing.px2,
    },
    recentSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.35,
      borderBottomColor: c.border,
    },
    searchRowMain: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
    },
    recentSearchText: { flex: 1, fontSize: fontSize.md, color: c.text },
    collectionRow: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    collectionName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.text },
    collectionNote: {
      fontSize: fontSize.sm,
      color: c.text3,
      marginTop: spacing.px3,
      lineHeight: lineHeight.tight,
    },
    peopleChipsRow: {
      paddingHorizontal: spacing[4],
      gap: spacing.px10,
      paddingBottom: spacing[4],
    },
    personChip: { width: 82, alignItems: 'center' },
    personChipInner: { alignItems: 'center', gap: spacing.px6 },
    personChipUsername: {
      fontSize: fontSize.sm,
      color: c.text,
      maxWidth: 84,
      textAlign: 'center',
    },
    personChipFollowers: { fontSize: fontSize.xs, color: c.text3, textAlign: 'center' },
    followChip: { marginTop: spacing[2] },
    trendingDishCard: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      borderRadius: radius.md,
      borderWidth: 0.5,
      borderColor: c.border,
      gap: spacing.px3,
      minWidth: 96,
      maxWidth: 144,
    },
    trendingDishName: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: c.text,
    },
    trendingDishCuisine: {
      fontSize: fontSize.xs,
      color: c.text3,
    },
    trendingDishSaveCount: {
      fontSize: fontSize.xs,
      color: c.text3,
    },
  })
}
