import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Avatar } from '@/components/Avatar'
import { ProvenanceChip } from '@/components/discovery'
import { SaveIcon, ClockIcon, CloseIcon } from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { getImgColor } from '@/constants/Colors'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontFamily, fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
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
import { shortPlaceLocation } from './searchConstants'

const DEFAULT_PLACEHOLDER_COLOR = getImgColor('warm')
const PLACE_PLACEHOLDER_COLORS: string[] = [
  getImgColor('warm'),
  getImgColor('green'),
  getImgColor('blue'),
  getImgColor('pink'),
  getImgColor('clay'),
  getImgColor('sage'),
]

function cardBgForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
  return PLACE_PLACEHOLDER_COLORS[Math.abs(h) % PLACE_PLACEHOLDER_COLORS.length] ?? DEFAULT_PLACEHOLDER_COLOR
}

export function SearchRows({
  items,
  mode,
  onSelect,
  onSave,
  onUnsave,
  onDismiss,
  userId,
}: {
  items: string[]
  mode: 'saved' | 'recent'
  onSelect: (item: string) => void
  onSave: (item: string) => void
  onUnsave: (item: string) => void
  onDismiss: (item: string) => void
  userId: string | undefined
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View>
      {items.map(item => (
        <View key={item} style={styles.recentSearchRow}>
          <TouchableOpacity
            style={styles.searchRowMain}
            onPress={() => onSelect(item)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={mode === 'saved' ? `Search saved query ${item}` : `Search for ${item}`}
          >
            {mode === 'saved' ? <SaveIcon filled size={15} activeColor={colors.accent} /> : <ClockIcon size={14} />}
            <Text style={styles.recentSearchText} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
              {item}
            </Text>
          </TouchableOpacity>
          {mode === 'saved' ? (
            <IconButton size={spacing.px44} variant="plain" onPress={() => onUnsave(item)} accessibilityLabel={`Unsave search ${item}`}>
              <SaveIcon filled size={18} activeColor={colors.accent} />
            </IconButton>
          ) : (
            <>
              {!!userId && (
                <IconButton size={spacing.px44} variant="plain" onPress={() => onSave(item)} accessibilityLabel={`Save search ${item}`}>
                  <SaveIcon size={18} inactiveColor={colors.text2} />
                </IconButton>
              )}
              <IconButton size={spacing.px44} variant="plain" onPress={() => onDismiss(item)} accessibilityLabel={`Remove recent search ${item}`}>
                <CloseIcon />
              </IconButton>
            </>
          )}
        </View>
      ))}
    </View>
  )
}

export const PlaceCardGrid = React.memo(function PlaceCardGrid({
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
  for (let i = 0; i < places.length; i += 2) rows.push(places.slice(i, i + 2))

  return (
    <View style={styles.cardGrid}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.cardRow}>
          {row.map(place => {
            const location = shortPlaceLocation(place)
            const cuisine = place.cuisine_type?.replace(/_/g, ' ')
            return (
              <TouchableOpacity
                key={place.id}
                style={[styles.placeCard, { width: cardWidth }]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={place.name}
                onPress={() => {
                  analytics.viewPlace(userId ?? null, place.id)
                  router.push(routes.placeDetail({ placeId: place.id }))
                }}
              >
                <View style={[styles.cardImage, { height: cardImageHeight, backgroundColor: cardBgForId(place.id) }]} />
                <ProvenanceChip colors={colors} provenance="LOCAL" />
                <Text style={styles.cardFood} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                  {cuisine ?? 'Worth saving'}
                </Text>
                <Text style={styles.cardName} numberOfLines={2} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                  {place.name}
                </Text>
                {!!location && (
                  <Text style={styles.cardCuisine} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                    {location}
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      ))}
    </View>
  )
})

export const TrendingDishCard = React.memo(function TrendingDishCard({
  dish,
  userId,
  onTrendingDish,
}: {
  dish: DishResult
  userId?: string | undefined
  onTrendingDish: (dishName: string) => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <TouchableOpacity
      style={styles.trendingDishCard}
      onPress={() => {
        analytics.viewDish(userId ?? null, dish.id)
        onTrendingDish(dish.name)
      }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Search for ${dish.name}`}
    >
      <ProvenanceChip colors={colors} provenance="TRENDING" />
      <Text style={styles.trendingDishName} numberOfLines={2} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
        {dish.name}
      </Text>
      {!!dish.cuisine_type && (
        <Text style={styles.trendingDishCuisine} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
          {dish.cuisine_type}
        </Text>
      )}
      {dish.save_count > 0 && (
        <Text style={styles.trendingDishSaveCount} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
          {dish.save_count} saves
        </Text>
      )}
    </TouchableOpacity>
  )
})

export const CollectionRow = React.memo(function CollectionRow({
  collection,
  userId,
}: {
  collection: Collection
  userId: string | undefined
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <TouchableOpacity
      style={styles.collectionRow}
      activeOpacity={0.75}
      onPress={() =>
        analytics.collectionInteraction(userId ?? null, 'staff_pick_selected', collection.id, {
          collection_visibility: collection.visibility,
        })
      }
      accessibilityRole="button"
      accessibilityLabel={collection.name}
    >
      <Text style={styles.collectionName} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
        {collection.name}
      </Text>
      {!!collection.curator_note && (
        <Text style={styles.collectionNote} numberOfLines={2} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
          {collection.curator_note}
        </Text>
      )}
    </TouchableOpacity>
  )
})

export const PersonChip = React.memo(function PersonChip({ username, u }: { username: string; u: MockUser }) {
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
        <Text style={styles.personChipUsername} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          @{username}
        </Text>
        <Text style={styles.personChipFollowers} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          {u.followers}
        </Text>
      </TouchableOpacity>
      <Chip label={following ? 'Following' : 'Follow'} selected={following} variant="active" onPress={() => { void handleFollow() }} style={styles.followChip} />
    </View>
  )
})

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    cardGrid: {
      paddingHorizontal: spacing[4],
      gap: spacing[3],
    },
    cardRow: {
      flexDirection: 'row',
      gap: spacing[3],
    },
    placeCard: {
      overflow: 'hidden',
      gap: spacing[2],
      paddingBottom: spacing[2],
    },
    cardImage: {
      borderRadius: radius.lg,
    },
    cardFood: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize['2xl'],
      color: c.text,
      lineHeight: lineHeight.title,
      textTransform: 'capitalize',
    },
    cardName: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: c.text,
      lineHeight: lineHeight.normal,
    },
    cardCuisine: {
      fontSize: fontSize.sm,
      color: c.text3,
    },
    recentSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      borderBottomWidth: spacing.hairline,
      borderBottomColor: c.border,
    },
    searchRowMain: {
      flex: 1,
      minHeight: spacing.px44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
    },
    recentSearchText: { flex: 1, fontSize: fontSize.md, color: c.text },
    collectionRow: {
      marginHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: spacing.hairline,
      borderBottomColor: c.border,
    },
    collectionName: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: c.text,
    },
    collectionNote: {
      fontSize: fontSize.sm,
      color: c.text3,
      marginTop: spacing.px3,
      lineHeight: lineHeight.tight,
    },
    personChip: { width: spacing.px60 + spacing.px22, alignItems: 'center' },
    personChipInner: { alignItems: 'center', gap: spacing.px6 },
    personChipUsername: {
      fontSize: fontSize.sm,
      color: c.text,
      maxWidth: spacing.px60 + spacing.px22,
      textAlign: 'center',
    },
    personChipFollowers: { fontSize: fontSize.xs, color: c.text3, textAlign: 'center' },
    followChip: { marginTop: spacing[2] },
    trendingDishCard: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      borderRadius: radius.md,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      gap: spacing.px6,
      minWidth: spacing.px60 + spacing.px60,
      maxWidth: spacing.px60 + spacing.px60 + spacing[6],
    },
    trendingDishName: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize['2xl'],
      color: c.text,
      lineHeight: lineHeight.title,
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
