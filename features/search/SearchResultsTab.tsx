import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import Animated from 'react-native-reanimated'
import { Avatar } from '@/components/Avatar'
import { ImagePlaceholder, VideoIcon } from '@/components/icons'
import { PostRatingStrip } from '@/components/RatingDisplay'
import { CachedImage } from '@/components/ui/CachedImage'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { imgColors } from '@/constants/Colors'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { usePressScale } from '@/lib/hooks/usePressScale'
import type { PersonResult, PlaceResult } from '@/lib/hooks/useSearch'
import { routes } from '@/lib/routes'
import { fetchUserIdByUsername } from '@/lib/services/users'
import type { Post } from '@/types/domain'
import { RESULT_TABS, type ResultTab } from './searchConstants'
import { PlaceRow, SectionHeader } from './searchShared'

interface SearchResultsTabProps {
  resultTab: ResultTab
  onTabChange: (tab: ResultTab) => void
  topPlaces: PlaceResult[]
  topPosts: Post[]
  topPeople: PersonResult[]
  postResults: Post[]
  peopleResults: PersonResult[]
  placeResults: PlaceResult[]
  placeDistances: Map<string, number | undefined>
  visiblePostCount: number
  onShowMorePosts: () => void
  expansionLabel: string | null | undefined
  searchMode: 'search' | 'aroundMe'
  radiusKm: number
  locationLabel: string | null | undefined
  query: string
  user: { id: string } | null | undefined
  searchSessionId: string
  activeTabEmpty: boolean
}

export function SearchResultsTab({
  resultTab,
  onTabChange,
  topPlaces,
  topPosts,
  topPeople,
  postResults,
  peopleResults,
  placeResults,
  placeDistances,
  visiblePostCount,
  onShowMorePosts,
  expansionLabel,
  searchMode,
  radiusKm,
  locationLabel,
  query,
  user,
  searchSessionId,
  activeTabEmpty,
}: SearchResultsTabProps) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const SEARCH_POST_LIMIT = 20

  return (
    <View style={styles.resultsPage}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.resultTabs}
        accessibilityRole="tablist"
      >
        {RESULT_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.resultTab, resultTab === tab.key && styles.resultTabActive]}
            onPress={() => onTabChange(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: resultTab === tab.key }}
          >
            <Text
              style={[
                styles.resultTabText,
                resultTab === tab.key && styles.resultTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {searchMode === 'aroundMe' && (
        <View style={styles.expansionNotice}>
          <Text style={styles.expansionNoticeText}>
            Showing places within {radiusKm} km
            {locationLabel ? ` of ${locationLabel}` : ''}
          </Text>
        </View>
      )}
      {!!expansionLabel && (
        <View style={styles.expansionNotice}>
          <Text style={styles.expansionNoticeText}>{expansionLabel}</Text>
        </View>
      )}

      {activeTabEmpty && (
        <EmptyState title="No food finds in this tab yet" subtitle="Try Top, Nearby, or a more specific dish." />
      )}

      {resultTab === 'top' && (
        <>
          {topPlaces.length > 0 && (
            <View>
              <SectionHeader title="Places" count={placeResults.length} />
              <View>
                {topPlaces.map((p, index) => (
                  <PlaceRow
                    key={p.id}
                    place={p}
                    distanceKm={placeDistances.get(p.id)}
                    user={user}
                    query={query}
                    position={index + 1}
                    searchSessionId={searchSessionId}
                  />
                ))}
              </View>
            </View>
          )}
          {topPosts.length > 0 && (
            <View>
              <SectionHeader title="Dishes" count={postResults.length} />
              <View>
                {topPosts.map((p, index) => (
                  <PostCompactRow
                    key={p.id}
                    post={p}
                    position={index + 1}
                    query={query}
                    searchSessionId={searchSessionId}
                    user={user}
                  />
                ))}
              </View>
            </View>
          )}
          {topPeople.length > 0 && (
            <View>
              <SectionHeader title="People" count={peopleResults.length} />
              <View>
                {topPeople.map(p => (
                  <PersonRow key={p.username} person={p} />
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {resultTab === 'people' && peopleResults.length > 0 && (
        <View>
          <SectionHeader title="People" count={peopleResults.length} />
          <View>
            {peopleResults.map(p => (
              <PersonRow key={p.username} person={p} />
            ))}
          </View>
        </View>
      )}

      {resultTab === 'dishes' && postResults.length > 0 && (
        <View>
          <SectionHeader title="Dishes" count={postResults.length} />
          <View>
            {postResults.slice(0, visiblePostCount).map((p, index) => (
              <PostCompactRow
                key={p.id}
                post={p}
                position={index + 1}
                query={query}
                searchSessionId={searchSessionId}
                user={user}
              />
            ))}
            {postResults.length > visiblePostCount && (
              <TouchableOpacity style={styles.showMore} onPress={onShowMorePosts} accessibilityRole="button">
                <Text style={styles.showMoreText}>
                  Show{' '}
                  {Math.min(SEARCH_POST_LIMIT, postResults.length - visiblePostCount)} more
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {resultTab === 'places' && placeResults.length > 0 && (
        <View>
          <SectionHeader title="Places" count={placeResults.length} />
          <View>
            {placeResults.map((p, index) => (
              <PlaceRow
                key={p.id}
                place={p}
                distanceKm={placeDistances.get(p.id)}
                user={user}
                query={query}
                position={index + 1}
                searchSessionId={searchSessionId}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

// ─── PersonRow ────────────────────────────────────────────────────────────────

const PersonRow = React.memo(function PersonRow({ person }: { person: PersonResult }) {
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const { runDeferredMutation, requireOnline } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [following, setFollowing] = useState(false)
  const press = usePressScale()

  async function handleFollow() {
    if (!user) {
      requireAuth()
      return
    }
    if (!requireOnline()) return
    const targetUserId = await fetchUserIdByUsername(person.username)
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
    <Animated.View style={press.animatedStyle}>
      <TouchableOpacity
        style={styles.personRow}
        onPress={() =>
          router.push(routes.userProfile(person.username))
        }
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={`View @${person.username}'s profile`}
      >
        <Avatar
          initials={person.initials}
          bg={person.avatarBg}
          color={person.avatarColor}
          size={40}
        />
        <View style={styles.personInfo}>
          <Text style={styles.personUsername}>@{person.username}</Text>
          <Text style={styles.personName} numberOfLines={1}>
            {person.displayName}
          </Text>
        </View>
        {person.followers !== '—' && (
          <Text style={styles.personFollowers}>{person.followers} followers</Text>
        )}
        <Chip
          label={following ? 'Following' : 'Follow'}
          selected={following}
          variant="active"
          onPress={() => { void handleFollow() }}
        />
      </TouchableOpacity>
    </Animated.View>
  )
})

// ─── PostCompactRow ───────────────────────────────────────────────────────────

const PostCompactRow = React.memo(function PostCompactRow({
  post,
  position,
  query,
  searchSessionId,
  user,
}: {
  post: Post
  position?: number | undefined
  query?: string | undefined
  searchSessionId?: string | undefined
  user?: { id: string } | null | undefined
}) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const press = usePressScale()

  return (
    <Animated.View style={press.animatedStyle}>
      <TouchableOpacity
        style={styles.postRow}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        activeOpacity={1}
        onPress={() => {
          if (post.dbId && query && searchSessionId && position != null) {
            analytics.searchResultClick(
              user?.id ?? null,
              'post',
              post.dbId,
              query,
              position,
              searchSessionId
            )
          }
          router.push(routes.postDetail(String(post.dbId || post.id)))
        }}
      >
        <View style={[styles.postThumb, { backgroundColor: imgColors[post.imgKey] }]}>
          {post.imageUrl ? (
            <CachedImage
              source={{ uri: post.imageUrl }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
          ) : post.videoUrl ? (
            <View style={styles.videoFallback}>
              <VideoIcon size={18} color={colors.accent} />
            </View>
          ) : (
            <ImagePlaceholder size={18} />
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
    </Animated.View>
  )
})

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    resultsPage: { paddingBottom: spacing[6] },
    resultTabs: {
      gap: spacing.px6,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[3],
      paddingBottom: spacing.px2,
    },
    resultTab: {
      minHeight: 32,
      justifyContent: 'center',
      paddingHorizontal: spacing.px14,
      borderRadius: radius.lg2,
      backgroundColor: c.surface,
    },
    resultTabActive: { backgroundColor: `${c.accent}16` },
    resultTabText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.text2 },
    resultTabTextActive: { color: c.accent },
    expansionNotice: {
      marginHorizontal: spacing[4],
      marginTop: spacing.px14,
      marginBottom: spacing.px2,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    expansionNoticeText: {
      fontSize: fontSize.bodySm,
      color: c.text2,
      lineHeight: lineHeight.compact,
    },
    showMore: { paddingHorizontal: spacing[4], paddingVertical: spacing.px14 },
    showMoreText: { fontSize: fontSize.base, color: c.accent },
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px11,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    personInfo: { flex: 1 },
    personUsername: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    personName: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px1 },
    personFollowers: { fontSize: fontSize.sm, color: c.text3 },
    postRow: {
      flexDirection: 'row',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px11,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    postThumb: {
      width: 60,
      height: 60,
      borderRadius: radius.sm3,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    videoFallback: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface2,
    },
    postRowContent: { flex: 1 },
    postRowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.px3,
    },
    postRowCreator: { fontSize: fontSize.sm, color: c.text3 },
    postRowLikes: { fontSize: fontSize.sm, color: c.text3 },
    postRowTitle: {
      fontSize: fontSize.base,
      color: c.text,
      lineHeight: lineHeight.small,
      marginBottom: spacing[1],
    },
  })
}
