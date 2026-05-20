import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { DUR_FAST } from '@/lib/animations'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import {
  fetchDirectConversations,
  fetchArchivedConversations,
  fetchMessageRequests,
  muteConversation,
  archiveConversation,
  pinConversation,
  unpinConversation,
  markConversationUnread,
  deleteDirectConversation,
  leaveGroup,
  type ConversationSummary,
  type MuteDuration,
} from '@/lib/services/messaging'
import { RekkusActionSheet, type RekkusActionSheetOption } from '@/components/ui/RekkusActionSheet'
import { IconButton } from '@/components/ui/IconButton'
import { isEnabled } from '@/lib/featureFlags'
import { ArrowLeft, MessageIcon, PlusIcon, SearchIcon, PinIcon, CloseIcon, UsersIcon, BellIcon, MailIcon, BookmarkIcon, TrashIcon, DotsIcon } from '@/components/icons'
import { avatarPalette } from '@/lib/utils/format'
import { supabase } from '@/lib/supabase'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

function initials(username: string, name: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
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
    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
  ) : isGroup ? (
    <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
      <UsersIcon size={22} color={palette.color} />
    </View>
  ) : item.participant.avatar_url ? (
    <Image source={{ uri: item.participant.avatar_url }} style={styles.avatar} />
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
        <TouchableOpacity style={[styles.swipeBtn, styles.swipePinBtn]} onPress={() => { swipeRef.current?.close(); onTogglePin() }}>
          <Text style={styles.swipeBtnLabel}>{isPinned ? 'Unpin' : 'Pin'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.swipeBtn, styles.swipeMuteBtn]} onPress={() => { swipeRef.current?.close(); onMute() }}>
          <Text style={styles.swipeBtnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.swipeBtn, styles.swipeArchiveBtn]} onPress={() => { swipeRef.current?.close(); onArchive() }}>
          <Text style={styles.swipeBtnLabel}>Archive</Text>
        </TouchableOpacity>
      </View>
    )
  }

  function renderLeftActions() {
    return (
      <TouchableOpacity style={[styles.swipeBtn, styles.swipeMarkBtn]} onPress={() => { swipeRef.current?.close(); onMarkUnread() }}>
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
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [requestCount, setRequestCount] = useState(0)
  const [archivedCount, setArchivedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    [user?.id]
  )

  useEffect(() => {
    if (!user) requireAuth()
  }, [user])

  // Reload on every focus so coming back from a conversation refreshes the list
  useFocusEffect(
    useCallback(() => {
      if (isEnabled('directMessages')) load(false)
      else setLoading(false)
    }, [load])
  )

  // Realtime: refresh list when any new message arrives
  useEffect(() => {
    if (!user || !isEnabled('directMessages')) return
    const channel = supabase
      .channel(`inbox_messages:${user?.id}:${Date.now()}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => { load(false) }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, load])


  async function handleMute(conversationId: string, _duration: MuteDuration = '8h') {
    if (!user) return
    await muteConversation(conversationId, user.id, '8h')
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, muted_until: new Date(Date.now() + 8 * 3600 * 1000).toISOString() } : c)
    )
  }

  async function handleArchive(conversationId: string) {
    if (!user) return
    Alert.alert('Archive conversation', 'This will hide it from your inbox.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: async () => {
          await archiveConversation(conversationId, user.id)
          setConversations(prev => prev.filter(c => c.id !== conversationId))
          setArchivedCount(count => count + 1)
        },
      },
    ])
  }

  async function handleTogglePin(conversationId: string, currently: boolean) {
    if (!user) return
    if (currently) {
      await unpinConversation(conversationId, user.id)
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, pinned_at: null } : c))
    } else {
      await pinConversation(conversationId, user.id)
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, pinned_at: new Date().toISOString() } : c))
    }
  }

  async function handleMarkUnread(conversationId: string) {
    if (!user) return
    await markConversationUnread(conversationId, user.id)
    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unread_count: 1 } : c))
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
    if (value === 'requests') router.push('/messages/requests' as any)
    else if (value === 'archived') router.push('/messages/archived' as any)
  }

  async function handleConvAction(value: string) {
    if (!actionSheetConv || !user) return
    const conv = actionSheetConv
    setActionSheetConv(null)
    if (value === 'pin') handleTogglePin(conv.id, !!conv.pinned_at)
    else if (value === 'mute') handleMute(conv.id)
    else if (value === 'unread') handleMarkUnread(conv.id)
    else if (value === 'archive') handleArchive(conv.id)
    else if (value === 'delete') {
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
            onPress: async () => {
              if (conv.conversation_type === 'group') await leaveGroup(conv.id)
              else await deleteDirectConversation(conv.id, user.id)
              setConversations(prev => prev.filter(c => c.id !== conv.id))
            },
          },
        ]
      )
    }
  }

  if (!isEnabled('directMessages')) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.headerActions}>
          <IconButton
            onPress={() => router.push('/messages/new' as any)}
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
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <CloseIcon size={13} color={colors.text3} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text3} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Could not load messages</Text>
          <Text style={styles.emptyBody}>{error}</Text>
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
                onPress={() => router.push('/messages/requests' as any)}
                activeOpacity={0.75}
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
              onPress={() => router.push(`/messages/${item.id}` as any)}
              onLongPress={y => { setLongPressY(y); setActionSheetConv(item) }}
              onMute={() => handleMute(item.id)}
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
              <Animated.View entering={FadeIn.duration(DUR_FAST)} style={StyleSheet.absoluteFill}>
                <BlurView
                  intensity={Platform.OS === 'ios' ? 22 : 0}
                  tint="dark"
                  style={[StyleSheet.absoluteFill, styles.convContextBackdrop]}
                />
              </Animated.View>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setActionSheetConv(null)}
              >
                <Animated.View
                  entering={ZoomIn.springify().damping(18).stiffness(350)}
                  style={[styles.convContextCard, { top: cardTop, left: cardLeft, width: CARD_W }]}
                >
                  <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                    {opts.map((opt, i) => (
                      <React.Fragment key={opt.value}>
                        {i > 0 ? <View style={styles.convContextDivider} /> : null}
                        <TouchableOpacity
                          style={styles.convContextRow}
                          onPress={() => handleConvAction(opt.value)}
                          activeOpacity={0.65}
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

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingRight: spacing.px10,
    },
    backBtn: { width: 36, alignItems: 'flex-start' },
    title: { flex: 1, fontSize: fontSize['2.5xl'], fontWeight: fontWeight.bold, color: c.text },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    searchBarWrap: {
      paddingHorizontal: spacing.px14,
      paddingBottom: spacing.px10,
    },
    searchBarInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing[3],
      height: 38,
    },
    searchInput: {
      flex: 1,
      fontSize: fontSize.md,
      color: c.text,
      paddingVertical: spacing[0],
    },

    requestNudge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginHorizontal: spacing[4],
      marginBottom: spacing.px6,
      paddingVertical: spacing.px5,
      gap: spacing.px7,
    },
    requestDot: {
      width: 7,
      height: 7,
      borderRadius: radius.dotLg,
      backgroundColor: c.accent,
    },
    requestNudgeText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.text2 },
    requestNudgeArrow: { fontSize: fontSize.xl, color: c.text3, lineHeight: lineHeight.compact },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.px10, paddingHorizontal: spacing.px36 },
    centerList: { minHeight: 460, alignItems: 'center', justifyContent: 'center', gap: spacing.px10, paddingHorizontal: spacing.px36 },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: c.text, textAlign: 'center' },
    emptyBody: { fontSize: fontSize.base, color: c.text3, textAlign: 'center', lineHeight: lineHeight.body },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px11,
      backgroundColor: c.bg,
    },
    avatarWrapper: { position: 'relative' },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: radius.round27,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
    pinBadge: {
      position: 'absolute',
      bottom: -1,
      right: -1,
      width: 18,
      height: 18,
      borderRadius: radius.sm4,
      backgroundColor: c.text3,
      borderWidth: 2,
      borderColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6 },
    rowTopRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexShrink: 0 },
    name: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    nameUnread: { fontWeight: fontWeight.bold },
    mutedIcon: { fontSize: fontSize.sm },
    time: { fontSize: fontSize.bodySm, color: c.text3 },
    timeUnread: { color: c.accent, fontWeight: fontWeight.semibold },
    preview: { marginTop: spacing.px2, fontSize: fontSize.base, color: c.text3, lineHeight: lineHeight.small },
    previewUnread: { color: c.text2, fontWeight: fontWeight.medium },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: radius.md,
      paddingHorizontal: spacing.px5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent,
    },
    badgeText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.white },

    convContextBackdrop: {
      backgroundColor: c.overlay,
    },
    convContextCard: {
      position: 'absolute',
      backgroundColor: c.bg,
      borderRadius: radius.lg2,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 6 },
      elevation: 12,
    },
    convContextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.px18,
      paddingVertical: spacing.px13,
      gap: spacing.px14,
    },
    convContextRowIcon: { width: 22, alignItems: 'center' },
    convContextLabel: { fontSize: fontSize.xl, fontWeight: fontWeight.regular, color: c.text },
    convContextDestructiveLabel: { color: c.actionDelete },
    convContextDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginHorizontal: spacing[4],
    },

    swipeActions: { flexDirection: 'row' },
    swipeBtn: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing[5], minWidth: 72 },
    swipeBtnLabel: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.white },
    swipePinBtn: { backgroundColor: c.actionInfo },
    swipeMuteBtn: { backgroundColor: c.actionMute },
    swipeArchiveBtn: { backgroundColor: c.actionDelete },
    swipeMarkBtn: { backgroundColor: c.actionSuccess, minWidth: 72, paddingHorizontal: spacing[5] },
  })
}
