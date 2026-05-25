import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { Avatar } from '@/components/Avatar'
import { ClockIcon, CloseIcon, PinIcon } from '@/components/icons'
import { Chip } from '@/components/ui/Chip'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { PlaceResult } from '@/lib/hooks/useSearch'
import { routes } from '@/lib/routes'
import type { Collection } from '@/lib/services/collections'
import type { MockUser } from '@/types/domain'
import { CHIPS } from './searchConstants'
import { PlaceRow, SectionHeader } from './searchShared'

interface DiscoveryPageProps {
  isFocused: boolean
  recentSearches: string[]
  onDismissSearch: (item: string) => void
  onSelectRecent: (item: string) => void
  activeChip: string
  trendingItems: Array<{ tag: string; count: string }>
  suggestedPeople: Array<[string, MockUser]>
  popularPlaces: PlaceResult[]
  staffPicks: Collection[]
  onChip: (chip: (typeof CHIPS)[number]) => void
  onTrending: (tag: string) => void
  onOpenNearby: () => void
  userId: string | undefined
}

export function DiscoveryPage({
  isFocused,
  recentSearches,
  onDismissSearch,
  onSelectRecent,
  activeChip,
  trendingItems,
  suggestedPeople,
  popularPlaces,
  staffPicks,
  onChip,
  onTrending,
  onOpenNearby,
  userId,
}: DiscoveryPageProps) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={styles.discoveryPage}>
      {isFocused && recentSearches.length > 0 && (
        <View>
          <SectionHeader title="Recent searches" />
          <View>
            {recentSearches.map(item => (
              <TouchableOpacity
                key={item}
                style={styles.recentSearchRow}
                onPress={() => onSelectRecent(item)}
                activeOpacity={0.75}
              >
                <ClockIcon size={14} />
                <Text style={styles.recentSearchText} numberOfLines={1}>
                  {item}
                </Text>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => onDismissSearch(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove recent search ${item}`}
                >
                  <CloseIcon />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <SectionHeader title="Quick starts" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickStartRow}
      >
        <Chip label="Nearby" leading={<PinIcon size={12} />} onPress={onOpenNearby} />
        {CHIPS.filter(chip =>
          ['ramen', 'brunch', 'date night', 'cheap'].includes(chip.query)
        ).map(chip => (
          <Chip
            key={chip.query}
            label={chip.label}
            leading={<Text style={styles.chipEmoji}>{chip.emoji}</Text>}
            selected={activeChip === chip.query}
            onPress={() => onChip(chip)}
          />
        ))}
      </ScrollView>

      <SectionHeader title="Trending now" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trendingRow}
      >
        {trendingItems.slice(0, 6).map(item => (
          <Chip
            key={item.tag}
            label={item.tag.replace(/^#/, '')}
            onPress={() => onTrending(item.tag)}
          />
        ))}
      </ScrollView>

      <SectionHeader title="Food spots people save" />
      <View>
        {popularPlaces.map(place => (
          <PlaceRow key={place.id} place={place} />
        ))}
      </View>

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
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [following, setFollowing] = useState(false)

  function handleFollow() {
    if (!user) {
      requireAuth()
      return
    }
    setFollowing(f => !f)
  }

  return (
    <View style={styles.personChip}>
      <TouchableOpacity
        onPress={() => router.push(routes.userProfile(username))}
        activeOpacity={0.8}
        style={styles.personChipInner}
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
        onPress={handleFollow}
        style={styles.followChip}
      />
    </View>
  )
})

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    discoveryPage: { paddingBottom: spacing[6] },
    quickStartRow: {
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[2],
    },
    trendingRow: {
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing.px2,
    },
    chipEmoji: { fontSize: fontSize.bodySm },
    recentSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.35,
      borderBottomColor: c.border,
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
  })
}
