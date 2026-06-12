import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, CheckIcon, CloseIcon, SearchIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Skeleton } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing, lineHeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { routes } from '@/lib/routes'
import {
  createGroupConversation,
  getOrCreateDirectConversation,
} from '@/lib/services/messaging'
import { fetchFollowedUsersBasic, searchUsersBasic } from '@/lib/services/users'
import { avatarPalette } from '@/lib/utils/format'

type Person = {
  user_id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  isFollowed: boolean
}

function initials(username: string, name: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length > 1
      ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
      : (parts[0] ?? '').slice(0, 2).toUpperCase()
  }
  return username.slice(0, 2).toUpperCase()
}

export default function NewConversationScreen() {
  const router = useRouter()
  const shareParams = useLocalSearchParams<{
    sharePostId?: string
    sharePostDbId?: string
    shareCaption?: string
    shareImageUrl?: string
    shareAuthor?: string
    shareLocation?: string
  }>()
  const { user } = useAuth()
  const { requireOnline } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const reduceMotion = useReducedMotion()

  const [groupName, setGroupName] = useState('')
  const [suggestions, setSuggestions] = useState<Person[]>([])
  const [searchResults, setSearchResults] = useState<Person[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [searching, setSearching] = useState(false)
  const [acting, setActing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [operationError, setOperationError] = useState<{ title: string; message: string } | null>(null)
  const searchRef = useRef<TextInput>(null)
  const followedIds = useRef<Set<string>>(new Set())

  // Load followed users as suggestions
  const loadSuggestions = useCallback(async () => {
    if (!user) return
    setLoadingSuggestions(true)
    const rows = await fetchFollowedUsersBasic(user.id)
    const people: Person[] = rows.map(r => ({ ...r, isFollowed: true }))

    followedIds.current = new Set(people.map(p => p.user_id))
    setSuggestions(people)
    setLoadingSuggestions(false)
  }, [user])

  useEffect(() => { void loadSuggestions() }, [loadSuggestions])

  // Search all users on the platform
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim() || !user) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const rows = await searchUsersBasic(query, user.id)
    const results: Person[] = rows.map(r => ({ ...r, isFollowed: followedIds.current.has(r.user_id) }))
    setSearchResults(results)
    setSearching(false)
  }, [user])

  function toggleSelect(person: Person) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(person.user_id)) {
        next.delete(person.user_id)
        setSelectedPeople(sp => sp.filter(p => p.user_id !== person.user_id))
      } else {
        next.add(person.user_id)
        setSelectedPeople(sp => [...sp, person])
      }
      return next
    })
  }

  async function handleStartDM() {
    if (!user || selected.size !== 1 || acting) return
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to start a conversation.' })
      return
    }
    setActing(true)
    setOperationError(null)
    const targetId = Array.from(selected)[0]
    if (!targetId) {
      setActing(false)
      return
    }
    const { conversationId, error } = await getOrCreateDirectConversation(user.id, targetId)
    setActing(false)
    if (error || !conversationId) {
      setOperationError({ title: 'Could not start conversation', message: error ?? 'Check your connection and try again.' })
      return
    }
    router.replace(routes.conversation(conversationId, shareParams))
  }

  async function handleCreateGroup() {
    const name = groupName.trim()
    if (!name || selected.size < 2 || !user || acting) return
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to create a group conversation.' })
      return
    }
    setActing(true)
    setOperationError(null)
    const { conversationId, error } = await createGroupConversation(name, Array.from(selected))
    setActing(false)
    if (error || !conversationId) {
      setOperationError({ title: 'Could not create group', message: error ?? 'Check your connection and try again.' })
      return
    }
    router.replace(routes.conversation(conversationId, shareParams))
  }

  const displayList = searchQuery.trim() ? searchResults : suggestions
  const selectedCount = selected.size

  // Header action: 1 selected = "Chat", 2+ selected = "Create" (requires group name)
  const headerActionLabel = selectedCount === 1 ? 'Chat' : 'Create'
  const canAct = selectedCount === 1
    ? !acting
    : selectedCount >= 2 && groupName.trim().length > 0 && !acting

  function renderItem({ item }: { item: Person }) {
    const isSelected = selected.has(item.user_id)
    const palette = avatarPalette(item.username)
    return (
      <TouchableOpacity
        style={styles.personRow}
        onPress={() => toggleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          {item.avatar_url ? (
            <CachedImage source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
              <Text style={[styles.avatarText, { color: palette.color }]}>
                {initials(item.username, item.full_name)}
              </Text>
            </View>
          )}
          {isSelected ? (
            <View style={styles.selectedBadge}>
              <CheckIcon size={11} color={colors.white} />
            </View>
          ) : null}
        </View>
        <View style={styles.personText}>
          <View style={styles.personNameRow}>
            <Text style={styles.personName} numberOfLines={1}>
              {item.full_name ?? `@${item.username}`}
            </Text>
            {!item.isFollowed ? (
              <View style={styles.requestBadge}>
                <Text style={styles.requestBadgeText}>Not followed</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.personUsername}>@{item.username}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected ? <CheckIcon size={13} color={colors.bg} /> : null}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>
          {selectedCount === 0 ? 'New Message' : selectedCount === 1 ? '1 selected' : `${selectedCount} selected`}
        </Text>
        {selectedCount > 0 ? (
          <TouchableOpacity
            style={[styles.actionBtn, !canAct && styles.actionBtnDisabled]}
            onPress={selectedCount === 1 ? handleStartDM : handleCreateGroup}
            disabled={!canAct}
            accessibilityRole="button"
          >
            {acting
              ? <ActivityIndicator size="small" color={colors.bg} />
              : <Text style={styles.actionBtnLabel}>{headerActionLabel}</Text>}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      {operationError ? (
        <ErrorMessage title={operationError.title} message={operationError.message} style={{ marginHorizontal: spacing[4] }} />
      ) : null}

      {/* Group name input — appears when 2+ selected */}
      {selectedCount >= 2 ? (
        <Animated.View {...(!reduceMotion ? { entering: FadeIn.duration(200) } : {})} style={styles.groupNameRow}>
          <TextInput
            style={styles.groupNameInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name"
            placeholderTextColor={colors.text3}
            maxLength={100}
            autoFocus
          />
        </Animated.View>
      ) : null}

      {/* Selected chips */}
      {selectedPeople.length > 0 ? (
        <View style={styles.chipsRow}>
          {selectedPeople.map(p => (
            <Animated.View key={p.user_id} {...(!reduceMotion ? { entering: FadeInRight.duration(180) } : {})}>
              <TouchableOpacity
                style={styles.chip}
                onPress={() => toggleSelect(p)}
              >
                <Text style={styles.chipLabel} numberOfLines={1}>
                  {p.full_name ?? p.username}
                </Text>
                <CloseIcon size={11} color={colors.text3} />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      ) : null}

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInner}>
          <SearchIcon size={14} color={colors.text3} />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Search people…"
            placeholderTextColor={colors.text3}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => { setSearchQuery(''); setSearchResults([]) }}
              accessibilityRole="button"
              accessibilityLabel="Clear people search"
            >
              <CloseIcon size={13} color={colors.text3} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Section label */}
      {!searchQuery.trim() && suggestions.length > 0 ? (
        <Text style={styles.sectionLabel}>Suggested</Text>
      ) : null}

      {/* List */}
      {loadingSuggestions && !searchQuery.trim() ? (
        <>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={44} height={44} radius={radius.full} />
              <View style={{ flex: 1, gap: spacing[2] }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={item => item.user_id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            searching ? (
              <ActivityIndicator color={colors.text3} style={{ marginTop: spacing[4] }} />
            ) : null
          }
          ListEmptyComponent={
            !searching ? (
              <View style={styles.center}>
                <Text style={styles.emptyLabel}>
                  {searchQuery.trim()
                    ? 'No users found.'
                    : 'Follow people to see suggestions, or search for anyone.'}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    topBar: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border2,
    },
    backBtn: { width: 36, alignItems: 'flex-start' },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text },
    actionBtn: {
      backgroundColor: c.accent,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: radius.pill,
      minWidth: 70,
      alignItems: 'center',
    },
    actionBtnDisabled: { opacity: 0.4 },
    actionBtnLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.white },

    groupNameRow: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    groupNameInput: {
      fontSize: fontSize.xl,
      color: c.text,
      paddingVertical: spacing[0],
    },

    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.px6,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px5,
      borderRadius: radius.lg2,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border2,
      maxWidth: 160,
    },
    chipLabel: { fontSize: fontSize.base, color: c.text, flexShrink: 1 },

    searchRow: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
    },
    searchInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.px10,
      height: 38,
    },
    searchInput: {
      flex: 1,
      fontSize: fontSize.md,
      color: c.text,
      paddingVertical: spacing[0],
    },

    sectionLabel: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.semibold,
      color: c.text3,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[1],
      paddingBottom: spacing.px6,
      textTransform: 'uppercase',
      letterSpacing: letterSpacing.wide,
    },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
    emptyLabel: { fontSize: fontSize.base, color: c.text3, textAlign: 'center', lineHeight: lineHeight.normal },

    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px11,
      gap: spacing[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    avatarWrap: { position: 'relative' },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: radius.avatar46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    selectedBadge: {
      position: 'absolute',
      bottom: -1,
      right: -1,
      width: 18,
      height: 18,
      borderRadius: radius.sm4,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.bg,
    },
    personText: { flex: 1, minWidth: 0 },
    personNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6 },
    personName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text, flexShrink: 1 },
    personUsername: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px1 },
    requestBadge: {
      paddingHorizontal: spacing.px6,
      paddingVertical: spacing.px2,
      borderRadius: radius.sm,
      backgroundColor: c.surface2,
    },
    requestBadgeText: { fontSize: fontSize.xs, color: c.text3, fontWeight: fontWeight.medium },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: radius.md3,
      borderWidth: 1.5,
      borderColor: c.border2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: c.accent, borderColor: c.accent },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  })
}
