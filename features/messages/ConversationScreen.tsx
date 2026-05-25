import { useFocusEffect, useLocalSearchParams, useRouter  } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MessageIcon } from '@/components/icons'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { isEnabled } from '@/lib/featureFlags'
import { routes } from '@/lib/routes'
import {
  fetchConversationMessages,
  fetchConversationParticipant,
  fetchConversationAllParticipants,
  fetchSharedMedia,
  markConversationRead,
  sendRichMessage,
  addReaction,
  removeReaction,
  fetchMessageReactions,
  subscribeToConversationMessages,
  subscribeToReactions,
  subscribeToTypingIndicators,
  broadcastTyping,
  unpinMessage,
  searchConversationMessages,
  type ConversationParticipant,
  type DirectMessage,
  type MessageReaction,
  fetchConversationMeta,
  removeChannel,
} from '@/lib/services/messaging'
import { blockUser, submitContentReport } from '@/lib/services/moderation'
import { updateLastSeen } from '@/lib/services/users'
import { avatarPalette } from '@/lib/utils/format'
import { ConversationHeader } from './ConversationHeader'
import { MessageActions, type MessageActionsHandle } from './MessageActions'
import { activeStatusLabel } from './MessageBubble'
import { MessageInput, type MessageInputHandle } from './MessageInput'
import { MessageList } from './MessageList'
import type {
  FlatList} from 'react-native';

type RouterWithSetParams = {
  setParams?: (params: Record<string, string | undefined>) => void
}

type OperationError = { title: string; message: string }

function metaString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export default function ConversationScreen() {
  const {
    conversationId,
    sharePostId,
    sharePostDbId,
    shareCaption,
    shareImageUrl,
    shareAuthor,
    shareLocation,
  } = useLocalSearchParams<{
    conversationId: string
    sharePostId?: string
    sharePostDbId?: string
    shareCaption?: string
    shareImageUrl?: string
    shareAuthor?: string
    shareLocation?: string
  }>()
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()

  const listRef = useRef<FlatList>(null)
  const isAtBottom = useRef(true)
  const typingChannelRef = useRef<ReturnType<typeof subscribeToTypingIndicators> | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentInitialShareRef = useRef<string | null>(null)
  const actionsRef = useRef<MessageActionsHandle>(null)
  const messageInputRef = useRef<MessageInputHandle>(null)

  const [participant, setParticipant] = useState<ConversationParticipant | null>(null)
  const [participants, setParticipants] = useState<ConversationParticipant[]>([])
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [reactions, setReactions] = useState<Map<string, MessageReaction[]>>(new Map())
  const [sharedMedia, setSharedMedia] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typingUsernames, setTypingUsernames] = useState<string[]>([])
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null)
  const [pinnedMessage, setPinnedMessage] = useState<DirectMessage | null>(null)
  const [isGroup, setIsGroup] = useState(false)
  const [conversationName, setConversationName] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DirectMessage[]>([])
  const [searching, setSearching] = useState(false)
  const [revealedTimeId, setRevealedTimeId] = useState<string | null>(null)
  const [safetySheet, setSafetySheet] = useState(false)
  const [notice, setNotice] = useState<{ title: string; subtitle?: string } | null>(null)
  const [operationError, setOperationError] = useState<OperationError | null>(null)

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: true }))
  }, [])

  const markRead = useCallback(async (rows: DirectMessage[]) => {
    if (!conversationId || !user) return
    const last = rows[rows.length - 1]
    await markConversationRead(conversationId, user.id, last?.id)
  }, [conversationId, user])

  const load = useCallback(async () => {
    if (!conversationId || !user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    setOperationError(null)
    try {
      const [nextParticipant, allParticipants, nextMessages, media] = await Promise.all([
        fetchConversationParticipant(conversationId, user.id),
        fetchConversationAllParticipants(conversationId),
        fetchConversationMessages(conversationId),
        fetchSharedMedia(conversationId),
      ])
      const convRow = await fetchConversationMeta(conversationId)

      setIsGroup(convRow?.conversation_type === 'group')
      setConversationName(convRow?.name ?? null)
      setParticipant(nextParticipant)
      setParticipants(allParticipants)
      setMessages(nextMessages)
      setSharedMedia(media)

      if (convRow?.pinned_message_id) {
        const pinned = nextMessages.find((m: DirectMessage) => m.id === convRow.pinned_message_id) ?? null
        setPinnedMessage(pinned)
      }

      const allReactions = await fetchMessageReactions(conversationId)
      const map = new Map<string, MessageReaction[]>()
      for (const r of allReactions) {
        const existing = map.get(r.message_id) ?? []
        existing.push(r)
        map.set(r.message_id, existing)
      }
      setReactions(map)
      await markRead(nextMessages)
      scrollToEnd()
    } catch {
      setError('This conversation could not be loaded right now.')
    } finally {
      setLoading(false)
    }
  }, [conversationId, markRead, scrollToEnd, user])

  useEffect(() => { if (!user) requireAuth() }, [user, requireAuth])

  useFocusEffect(
    useCallback(() => {
      if (isEnabled('directMessages')) void load()
      else setLoading(false)
    }, [load])
  )

  // Send a shared post when the screen is opened with share params
  useEffect(() => {
    if (!conversationId || !user?.id || !sharePostId) return
    if (sentInitialShareRef.current === sharePostId) return
    sentInitialShareRef.current = sharePostId
    const metadata = {
      post_id: sharePostDbId || sharePostId,
      app_post_id: sharePostId,
      caption: shareCaption ?? '',
      creator: shareAuthor ?? '',
      location: shareLocation ?? '',
      thumbnail_url: shareImageUrl ?? '',
      image_url: shareImageUrl ?? '',
    }
    void sendRichMessage(conversationId, user.id, 'post_share', null, shareImageUrl || null, metadata)
      .then(({ message, error: sendError }) => {
        if (sendError || !message) {
          sentInitialShareRef.current = null
          setOperationError({ title: 'Could not share post', message: sendError ?? 'Messaging is not available right now.' })
          return
        }
        setMessages(current => current.some(row => row.id === message.id) ? current : [...current, message])
        scrollToEnd()
        const routeUpdater = router as unknown as RouterWithSetParams
        routeUpdater.setParams?.({
          sharePostId: undefined, sharePostDbId: undefined, shareCaption: undefined,
          shareImageUrl: undefined, shareAuthor: undefined, shareLocation: undefined,
        })
      })
  }, [conversationId, router, scrollToEnd, shareAuthor, shareCaption, shareImageUrl, shareLocation, sharePostDbId, sharePostId, user?.id])

  // Realtime: new messages
  useEffect(() => {
    if (!conversationId || !user || !isEnabled('directMessages')) return
    const channel = subscribeToConversationMessages(conversationId, message => {
      setMessages(current => {
        if (current.some(row => row.id === message.id)) return current
        const next = [...current, message]
        void markRead(next)
        return next
      })
      scrollToEnd()
    })
    return () => { removeChannel(channel) }
  }, [conversationId, markRead, scrollToEnd, user])

  // Realtime: reactions
  useEffect(() => {
    if (!conversationId || !isEnabled('directMessages')) return
    const channel = subscribeToReactions(conversationId, ({ eventType, reaction }) => {
      setReactions(prev => {
        const next = new Map(prev)
        const existing = next.get(reaction.message_id) ?? []
        next.set(
          reaction.message_id,
          eventType === 'INSERT' ? [...existing, reaction] : existing.filter(r => r.id !== reaction.id)
        )
        return next
      })
    })
    return () => { removeChannel(channel) }
  }, [conversationId])

  // Realtime: typing indicators
  useEffect(() => {
    if (!conversationId || !user || !isEnabled('directMessages')) return
    const channel = subscribeToTypingIndicators(conversationId, user.id, typingIds => {
      const names = typingIds
        .map(uid => participants.find(p => p.user_id === uid)?.username ?? null)
        .filter(Boolean) as string[]
      setTypingUsernames(names)
    })
    typingChannelRef.current = channel
    return () => { removeChannel(channel) }
  }, [conversationId, user, participants])

  // Update last_seen_at when app foregrounded
  useEffect(() => {
    if (!user) return
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        updateLastSeen(user.id)
      }
    })
    return () => subscription.remove()
  }, [user])

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim() || !conversationId) { setSearchResults([]); return }
    setSearching(true)
    const results = await searchConversationMessages(conversationId, query)
    setSearchResults(results)
    setSearching(false)
  }, [conversationId])

  const handleTyping = useCallback(() => {
    if (!typingChannelRef.current) return
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    void broadcastTyping(typingChannelRef.current)
  }, [])

  const handleReact = useCallback((messageId: string, emoji: string) => {
    const myReactions = reactions.get(messageId)?.filter(r => r.user_id === user?.id) ?? []
    const existing = myReactions.find(r => r.emoji === emoji)
    if (existing) void removeReaction(messageId)
    else void addReaction(messageId, emoji)
  }, [reactions, user?.id])

  const handleLongPressMessage = useCallback((msg: DirectMessage, pageY: number) => {
    actionsRef.current?.open(msg, pageY)
  }, [])

  const handleReply = useCallback((msg: DirectMessage) => {
    setReplyingTo(msg)
    messageInputRef.current?.focus()
  }, [])

  const handleMessageSent = useCallback((msg: DirectMessage) => {
    setMessages(current => current.some(row => row.id === msg.id) ? current : [...current, msg])
  }, [])

  const handleMessageDeleted = useCallback((msgId: string) => {
    setMessages(current =>
      current.map(m => m.id === msgId ? { ...m, deleted_at: new Date().toISOString() } : m)
    )
  }, [])

  const handleUnpin = useCallback(() => {
    if (!conversationId) return
    void unpinMessage(conversationId)
    setPinnedMessage(null)
  }, [conversationId])

  const handlePressPlaceShare = useCallback((meta: Record<string, unknown>) => {
    const restaurantId = metaString(meta, 'restaurant_id') ?? metaString(meta, 'google_place_id')
    if (!restaurantId) return
    const placeId = metaString(meta, 'google_place_id')
    router.push(routes.restaurantDetail({
      restaurantId,
      ...(placeId ? { placeId } : {}),
      name: metaString(meta, 'name') ?? '',
      address: metaString(meta, 'address') ?? '',
      lat: String(meta.lat ?? ''),
      lng: String(meta.lng ?? ''),
    }))
  }, [router])

  const handlePressPostShare = useCallback((meta: Record<string, unknown>) => {
    const postId = metaString(meta, 'post_id') ?? metaString(meta, 'app_post_id')
    if (!postId) {
      setOperationError({ title: 'Post unavailable', message: 'This shared post could not be opened.' })
      return
    }
    router.push(routes.postDetail(postId))
  }, [router])

  const handleSafetyAction = useCallback(async (value: string) => {
    if (!user || !participant?.user_id) return
    if (value === 'report_user') {
      const reportError = await submitContentReport({
        reporterId: user.id,
        targetType: 'user',
        targetId: participant.user_id,
        reason: 'message_or_profile_issue',
        sourceSurface: 'message_thread',
      })
      if (reportError) setOperationError({ title: 'Report failed', message: reportError })
      else setNotice({ title: 'Report received', subtitle: 'Thanks. We will review this account.' })
    }
    if (value === 'block_user') {
      const blockError = await blockUser(user.id, participant.user_id, 'messaging')
      if (blockError) setOperationError({ title: 'Block failed', message: blockError })
      else setNotice({ title: 'User blocked', subtitle: 'You will no longer be able to exchange messages.' })
      if (!blockError) router.back()
    }
    if (value === 'conversation_info') {
      router.push(routes.conversationInfo(conversationId))
    }
    setSafetySheet(false)
  }, [user, participant?.user_id, conversationId, router])

  const headerTitle = useMemo(() => {
    if (loading && !participant && !isGroup) return ''
    if (isGroup) return conversationName ?? 'Group'
    return participant?.full_name ?? (participant ? `@${participant.username}` : 'Direct Message')
  }, [loading, isGroup, conversationName, participant])

  const headerSubtitle = useMemo(() => {
    if (isGroup) return `${participants.length} members`
    if (!participant) return null
    const status = activeStatusLabel(participant?.last_seen_at)
    return status ?? `@${participant.username}`
  }, [isGroup, participants.length, participant])

  const participantPalette = useMemo(
    () => avatarPalette(participant?.username ?? 'U'),
    [participant?.username]
  )

  const getSenderName = useCallback((senderId: string) => {
    if (senderId === user?.id) return 'You'
    return participants.find(p => p.user_id === senderId)?.username
      ?? participant?.username
      ?? 'Someone'
  }, [user?.id, participants, participant?.username])

  if (!isEnabled('directMessages')) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.disabledScreen}>
          <MessageIcon size={34} color={colors.text3} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Messaging is paused</Text>
          <Text style={[styles.emptyBody, { color: colors.text3 }]}>Private messages will return after the release checks pass.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ConversationHeader
          conversationId={conversationId ?? ''}
          participant={participant}
          isGroup={isGroup}
          headerTitle={headerTitle}
          headerSubtitle={headerSubtitle}
          participantPalette={participantPalette}
          searchMode={searchMode}
          searchQuery={searchQuery}
          onSearch={handleSearch}
          onBack={() => {
            if (searchMode) { setSearchMode(false); setSearchQuery(''); setSearchResults([]) }
            else router.back()
          }}
          onToggleSearch={() => {
            if (searchMode) { setSearchMode(false); setSearchQuery(''); setSearchResults([]) }
            else setSearchMode(true)
          }}
          onOptions={() => setSafetySheet(true)}
          colors={colors}
        />

        <MessageList
          messages={messages}
          searchResults={searchResults}
          searchMode={searchMode}
          searchQuery={searchQuery}
          listRef={listRef}
          isAtBottom={isAtBottom}
          reactions={reactions}
          currentUserId={user?.id ?? ''}
          colors={colors}
          isGroup={isGroup}
          revealedTimeId={revealedTimeId}
          replyingTo={replyingTo}
          typingUsernames={typingUsernames}
          loading={loading}
          error={error}
          searching={searching}
          pinnedMessage={pinnedMessage}
          sharedMedia={sharedMedia}
          conversationId={conversationId ?? ''}
          onUnpin={handleUnpin}
          onLongPressMessage={handleLongPressMessage}
          onReact={handleReact}
          onReply={handleReply}
          onRevealTime={id => setRevealedTimeId(id)}
          onPressPlaceShare={handlePressPlaceShare}
          onPressPostShare={handlePressPostShare}
          getSenderName={getSenderName}
          scrollToEnd={scrollToEnd}
        />

        {operationError ? (
          <ErrorMessage title={operationError.title} message={operationError.message} style={{ marginHorizontal: spacing[4] }} />
        ) : null}

        <MessageInput
          ref={messageInputRef}
          conversationId={conversationId ?? ''}
          currentUserId={user?.id ?? ''}
          replyingTo={replyingTo}
          onClearReply={() => setReplyingTo(null)}
          onMessageSent={handleMessageSent}
          onScrollToEnd={scrollToEnd}
          onShowError={setOperationError}
          onTyping={handleTyping}
          colors={colors}
        />
      </KeyboardAvoidingView>

      <MessageActions
        ref={actionsRef}
        conversationId={conversationId ?? ''}
        currentUserId={user?.id ?? ''}
        isGroup={isGroup}
        participants={participants}
        reactions={reactions}
        colors={colors}
        onReply={handleReply}
        onReact={handleReact}
        onMessageDeleted={handleMessageDeleted}
        onMessagePinned={msg => setPinnedMessage(msg)}
        onShowNotice={setNotice}
        onShowError={setOperationError}
      />

      <RekkusActionSheet
        visible={safetySheet}
        title="Conversation options"
        options={[
          { label: 'Conversation info', value: 'conversation_info' },
          { label: 'Report account', value: 'report_user' },
          { label: 'Block account', value: 'block_user' },
        ]}
        onSelect={handleSafetyAction}
        onDismiss={() => setSafetySheet(false)}
      />

      <RekkusActionSheet
        visible={notice != null}
        title={notice?.title}
        subtitle={notice?.subtitle}
        options={[{ label: 'OK', value: 'ok', accentColor: colors.accent }]}
        onSelect={() => {}}
        onDismiss={() => setNotice(null)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  disabledScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingHorizontal: spacing.px36 },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  emptyBody: { fontSize: fontSize.bodySm, textAlign: 'center' },
})
