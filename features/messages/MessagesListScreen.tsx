import { BlurView } from 'expo-blur'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, MessageIcon, PlusIcon, SearchIcon, PinIcon, CloseIcon, UsersIcon, BellIcon, MailIcon, BookmarkIcon, TrashIcon, DotsIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { IconButton } from '@/components/ui/IconButton'
import { RekkusActionSheet, type RekkusActionSheetOption } from '@/components/ui/RekkusActionSheet'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { spacing } from '@/constants/Spacing'
import { DUR_FAST } from '@/lib/animations'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { isEnabled } from '@/lib/featureFlags'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { routes } from '@/lib/routes'
import {
  fetchDirectConversations,
  fetchArchivedConversations,
  fetchMessageRequests,
  deleteDirectConversation,
  leaveGroup,
  MUTE_DURATIONS_MS,
  type ConversationSummary,
} from '@/lib/services/messaging'
import { subscribeToInboxMessages, removeChannel } from '@/lib/services/messaging'
import { avatarPalette } from '@/lib/utils/format'
import { makeStyles } from './MessagesListScreen.styles'

function initials(username: string, name: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length > 1
      ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
      : (parts[0] ?? '').slice(0, 2).toUpperCase()
  }
  return username.slice(0, 2).toUpperCase()
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return `${Math.floor(days / 7)}w`
}

function richPreview(item: ConversationSummary): string {
  const msg = item.last_message
  if (!msg) return 'No messages yet'
  switch (msg.message_type) {
    case 'image': return 'Photo'
    case 'video': return 'Video'
    case 'audio': return 'Voice note'
    case 'gif': return 'GIF'
    case 'sticker': return 'Sticker'
    case 'file': return 'File'
    case 'location': return 'Location'
    case 'post_share': return 'Shared a post'
    case 'place_share': return 'Shared a place'
    case 'system': return ''
    default: return msg.body ?? ''
  }
}

const ConversationRow = React.memo(function ConversationRow({
  item,
  onPress,
  onLongPress,
  onMute,
  onArchive,
  onTogglePin,
  onMarkUnread,
}: {
  item: ConversationSummary
  onPress: () => void
  onLongPress: (y: number) => void
  onMute: () => void
  onArchive: () => void
  onTogglePin: () => void
  onMarkUnread: () => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const swipeRef = useRef<SwipeableMethods>(null)

  const isGroup = item.conversation_type === 'group'
  const isMuted = item.muted_until ? new Date(item.muted_until) > new Date() : false
  const isPinned = !!item.pinned_at
  const isUnread = item.unread_count > 0

  const displayName = isGroup
    ? (item.name ?? 'Group')
    : (item.participant.full_name ?? `@${item.participant.username}`)

  const preview = richPreview(item)
  const palette = avatarPalette(isGroup ? (item.name ?? 'G') : item.participant.username)

  const avatarContent = isGroup && item.avatar_url ? (
    <CachedImage source={{ uri: item.avatar_url }} style={styles.avatar} />
  ) : isGroup ? (
    <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
      <UsersIcon size={22} color={palette.color} />
    </View>
  ) : item.participant.avatar_url ? (
    <CachedImage source={{ uri: item.participant.avatar_url }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
      <Text style={[styles.avatarText, { color: palette.color }]}>
        {initials(item.participant.username, item.participant.full_name)}
      </Text>
    </View>
  )

  function renderRightActions() {
    return (
      <View style={styles.swipeActions}>
        <TouchableOpacity style={[styles.swipeBtn, styles.swipePinBtn]} onPress={() => { swipeRef.current?.close(); onTogglePin() }} accessibilityRole="button">
          <Text style={styles.swipeBtnLabel}>{isPinned ? 'Unpin' : 'Pin'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.swipeBtn, styles.swipeMuteBtn]} onPress={() => { swipeRef.current?.close(); onMute() }} accessibilityRole="button">
          <Text style={styles.swipeBtnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.swipeBtn, styles.swipeArchiveBtn]} onPress={() => { swipeRef.current?.close(); onArchive() }} accessibilityRole="button">
          <Text style={styles.swipeBtnLabel}>Archive</Text>
        </TouchableOpacity>
      </View>
    )
  }

  function renderLeftActions() {
    return (
      <TouchableOpacity style={[styles.swipeBtn, styles.swipeMarkBtn]} onPress={() => { swipeRef.current?.close(); onMarkUnread() }} accessibilityRole="button">
        <Text style={styles.swipeBtnLabel}>Unread</Text>
      </TouchableOpacity>
    )
  }

  return (
    <ReanimatedSwipeable ref={swipeRef} renderRightActions={renderRightActions} renderLeftActions={renderLeftActions} overshootRight={false} overshootLeft={false}>
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress} onLongPress={e => onLongPress(e.nativeEvent.pageY)} delayLongPress={350}>
        <View style={styles.avatarWrapper}>
          {avatarContent}
          {isPinned ? (
            <View style={styles.pinBadge}>
              <PinIcon size={9} color={colors.bg} />
            </View>
          ) : null}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, isUnread && styles.nameUnread]} numberOfLines={1}>{displayName}</Text>
            <View style={styles.rowTopRight}>
              {isMuted ? <Text style={styles.mutedIcon}>🔇</Text> : null}
              <Text style={[styles.time, isUnread && styles.timeUnread]}>{relativeTime(item.updated_at)}</Text>
            </View>
          </View>
          <Text style={[styles.preview, isUnread && styles.previewUnread]} numberOfLines={1}>
            {preview}
          </Text>
        </View>
        {isUnread ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </ReanimatedSwipeable>
  )
})

export default function MessagesListScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { requireOnline, runDeferredMutation, syncEpoch } = useConnectivity()
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [requestCount, setRequestCount] = useState(0)
  const [archivedCount, setArchivedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<TextInput>(null)
  const [actionSheetConv, setActionSheetConv] = useState<ConversationSummary | null>(null)
  const [longPressY, setLongPressY] = useState(Dimensions.get('window').height / 2)
  const [managementSheetVisible, setManagementSheetVisible] = useState(false)

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter(c => {
      const name = c.conversation_type === 'group'
        ? (c.name ?? '')
        : (c.participant.full_name ?? c.participant.username)
      return name.toLowerCase().includes(q) || c.participant?.username?.toLowerCase().includes(q)
    })
  }, [conversations, searchQuery])

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) { setLoading(false); return }
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const [rows, requests, archived] = await Promise.all([
          fetchDirectConversations(user.id),
          fetchMessageRequests(user.id),
          fetchArchivedConversations(user.id),
        ])
        setConversations(rows)
        setRequestCount(requests.length)
        setArchivedCount(archived.length)
      } catch {
        setError('Messages could not be loaded right now.')
      } finally {
        if (isRefresh) setRefreshing(false)
        else setLoading(false)
      }
    },
    [user]
  )

  useEffect(() => {
    if (!user) requireAuth()
  }, [user, requireAuth])

  // Reload on every focus so coming back from a conversation refreshes the list
  useFocusEffect(
    useCallback(() => {
      if (isEnabled('directMessages')) void load(false)
      else setLoading(false)
    }, [load])
  )

  // Realtime: refresh list when any new message arrives
  useEffect(() => {
    if (!user || !isEnabled('directMessages')) return
    const channel = subscribeToInboxMessages(user.id, () => { void load(false) })
    return () => { removeChannel(channel) }
  }, [user, load])

  // Re-fetch after offline queue flush so deferred prefs are reflected
  useEffect(() => {
    if (syncEpoch > 0 && isEnabled('directMessages')) void load(false)
  }, [syncEpoch, load])

  async function handleMute(conversationId: string, currentlyMuted: boolean) {
    if (!user) return
    const mutedUntil = new Date(Date.now() + MUTE_DURATIONS_MS['8h']).toISOString()
    setConversations(prev =>
      prev.map(c => c.id === conversationId
        ? { ...c, muted_until: currentlyMuted ? null : mutedUntil }
        : c)
    )
    await runDeferredMutation(currentlyMuted
      ? { kind: 'conversation_unmute', conversationId }
      : { kind: 'conversation_mute', conversationId, mutedUntil }
    )
  }

  async function handleArchive(conversationId: string) {
    if (!user) return
    Alert.alert('Archive conversation', 'This will hide it from your inbox.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: () => { void (async () => {
          setConversations(prev => prev.filter(c => c.id !== conversationId))
          setArchivedCount(count => count + 1)
          await runDeferredMutation({ kind: 'conversation_archive', conversationId })
        })() },
      },
    ])
  }

  async function handleTogglePin(conversationId: string, currently: boolean) {
    if (!user) return
    setConversations(prev => prev.map(c => c.id === conversationId
      ? { ...c, pinned_at: currently ? null : new Date().toISOString() }
      : c))
    await runDeferredMutation(currently
      ? { kind: 'conversation_unpin', conversationId }
      : { kind: 'conversation_pin', conversationId }
    )
  }

  async function handleMarkUnread(conversationId: string) {
    if (!user) return
    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unread_count: 1 } : c))
    await runDeferredMutation({ kind: 'conversation_unread', conversationId })
  }

  function buildConvOptions(conv: ConversationSummary): RekkusActionSheetOption[] {
    const isPinned = !!conv.pinned_at
    const isMuted = conv.muted_until ? new Date(conv.muted_until) > new Date() : false
    const isUnread = conv.unread_count > 0
    const isGroup = conv.conversation_type === 'group'
    const sz = 18
    const opts: RekkusActionSheetOption[] = [
      { value: 'pin', label: isPinned ? 'Unpin' : 'Pin', icon: <PinIcon size={sz} color={colors.text} /> },
      { value: 'mute', label: isMuted ? 'Unmute' : 'Mute', icon: <BellIcon size={sz} /> },
      ...(!isUnread ? [{ value: 'unread', label: 'Mark as unread', icon: <MailIcon size={sz} color={colors.text} /> }] : []),
      { value: 'archive', label: 'Archive', icon: <BookmarkIcon size={sz} /> },
      { value: 'delete', label: isGroup ? 'Leave group' : 'Delete', icon: <TrashIcon size={sz} color={colors.actionDelete} />, destructive: true },
    ]
    return opts
  }

  function buildManagementOptions(): RekkusActionSheetOption[] {
    const sz = 18
    const requestLabel = requestCount > 0
      ? `Message requests (${requestCount})`
      : 'Message requests'
    const archiveLabel = archivedCount > 0
      ? `Archived chats (${archivedCount})`
      : 'Archived chats'
    return [
      { value: 'requests', label: requestLabel, icon: <MailIcon size={sz} color={colors.text} /> },
      { value: 'archived', label: archiveLabel, icon: <BookmarkIcon size={sz} /> },
    ]
  }

  function handleManagementAction(value: string) {
    setManagementSheetVisible(false)

    if (value === 'requests') router.push('/messages/requests')

    else if (value === 'archived') router.push('/messages/archived')
  }

  async function handleConvAction(value: string) {
    if (!actionSheetConv || !user) return
    const conv = actionSheetConv
    setActionSheetConv(null)
    if (value === 'pin') void handleTogglePin(conv.id, !!conv.pinned_at)
    else if (value === 'mute') void handleMute(conv.id, !!conv.muted_until && new Date(conv.muted_until) > new Date())
    else if (value === 'unread') void handleMarkUnread(conv.id)
    else if (value === 'archive') void handleArchive(conv.id)
    else if (value === 'delete') {
      if (!requireOnline()) {
        setOperationError('Reconnect to leave or delete a conversation.')
        return
      }
      Alert.alert(
        conv.conversation_type === 'group' ? 'Leave group?' : 'Delete conversation?',
        conv.conversation_type === 'group'
          ? 'You will no longer receive messages from this group.'
          : 'This will permanently delete the conversation for you.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: conv.conversation_type === 'group' ? 'Leave' : 'Delete',
            style: 'destructive',
            onPress: () => { void (async () => {
              if (conv.conversation_type === 'group') await leaveGroup(conv.id)
              else await deleteDirectConversation(conv.id, user.id)
              setConversations(prev => prev.filter(c => c.id !== conv.id))
            })() },
          },
        ]
      )
    }
  }

  if (!isEnabled('directMessages')) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <ArrowLeft />
          </TouchableOpacity>
          <Text style={styles.title}>Messages</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <MessageIcon size={34} color={colors.text3} />
          <Text style={styles.emptyTitle}>Messaging is paused</Text>
          <Text style={styles.emptyBody}>Private messages will return after the release checks pass.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.headerActions}>
          <IconButton

            onPress={() => router.push('/messages/new')}
            accessibilityLabel="New message"
            size={40}
            variant="plain"
          >
            <PlusIcon size={20} color={colors.text} />
          </IconButton>
          <IconButton
            onPress={() => setManagementSheetVisible(true)}
            accessibilityLabel="Message options"
            size={40}
            variant="plain"
          >
            <DotsIcon size={20} />
          </IconButton>
        </View>
      </View>

      {operationError ? <ErrorMessage message={operationError} style={{ marginHorizontal: spacing[4] }} /> : null}

      {/* Persistent search bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBarInner}>
          <SearchIcon size={14} color={colors.text3} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations"
            placeholderTextColor={colors.text3}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear message search"
            >
              <CloseIcon size={13} color={colors.text3} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Skeleton width={52} height={52} />
          <SkeletonText lines={3} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ErrorMessage title="Could not load messages" message={error} />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.text3} />
          }
          ListHeaderComponent={
            requestCount > 0 ? (
              <TouchableOpacity
                style={styles.requestNudge}
                onPress={() => router.push('/messages/requests')}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <View style={styles.requestDot} />
                <Text style={styles.requestNudgeText}>
                  {requestCount === 1 ? '1 message request' : `${requestCount} message requests`}
                </Text>
                <Text style={styles.requestNudgeArrow}>›</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerList}>
              <MessageIcon size={36} color={colors.text3} />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No conversations match' : 'No messages yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {searchQuery ? 'Try a different search.' : 'Tap + to start a conversation.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ConversationRow
              item={item}

              onPress={() => router.push(routes.conversation(item.id))}
              onLongPress={y => { setLongPressY(y); setActionSheetConv(item) }}
              onMute={() => handleMute(item.id, !!item.muted_until && new Date(item.muted_until) > new Date())}
              onArchive={() => handleArchive(item.id)}
              onTogglePin={() => handleTogglePin(item.id, !!item.pinned_at)}
              onMarkUnread={() => handleMarkUnread(item.id)}
            />
          )}
        />
      )}
      <Modal
        visible={!!actionSheetConv}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setActionSheetConv(null)}
      >
        {actionSheetConv ? (() => {
          const SCREEN_H = Dimensions.get('window').height
          const SCREEN_W = Dimensions.get('window').width
          const CARD_W   = 240
          const ITEM_H   = 50
          const opts     = buildConvOptions(actionSheetConv)
          const cardH    = opts.length * ITEM_H
          const spaceBelow = SCREEN_H - longPressY
          const cardTop  = spaceBelow >= cardH + 24
            ? longPressY - 10
            : Math.max(60, longPressY - cardH - 10)
          const cardLeft = (SCREEN_W - CARD_W) / 2
          return (
            <>
              <Animated.View {...(!reduceMotion ? { entering: FadeIn.duration(DUR_FAST) } : {})} style={StyleSheet.absoluteFill}>
                {Platform.OS === 'ios' ? (
                  <BlurView
                    intensity={22}
                    tint="dark"
                    style={[StyleSheet.absoluteFill, styles.convContextBackdrop]}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.convContextBackdrop]} />
                )}
              </Animated.View>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setActionSheetConv(null)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              >
                <Animated.View
                  {...(!reduceMotion ? { entering: ZoomIn.springify().damping(18).stiffness(350) } : {})}
                  style={[styles.convContextCard, { top: cardTop, left: cardLeft, width: CARD_W }]}
                >
                  <TouchableOpacity activeOpacity={1} onPress={() => {}} accessibilityRole="button" accessibilityLabel="Conversation actions">
                    {opts.map((opt, i) => (
                      <React.Fragment key={opt.value}>
                        {i > 0 ? <View style={styles.convContextDivider} /> : null}
                        <TouchableOpacity
                          style={styles.convContextRow}
                          onPress={() => handleConvAction(opt.value)}
                          activeOpacity={0.65}
                          accessibilityRole="button"
                        >
                          {opt.icon != null ? <View style={styles.convContextRowIcon}>{opt.icon}</View> : null}
                          <Text style={[styles.convContextLabel, opt.destructive && styles.convContextDestructiveLabel]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    ))}
                  </TouchableOpacity>
                </Animated.View>
              </TouchableOpacity>
            </>
          )
        })() : null}
      </Modal>
      <RekkusActionSheet
        visible={managementSheetVisible}
        title="Messages"
        options={buildManagementOptions()}
        onSelect={handleManagementAction}
        onDismiss={() => setManagementSheetVisible(false)}
      />
    </SafeAreaView>
  )
}
