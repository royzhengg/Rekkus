import { useRouter } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { isEnabled } from '@/lib/featureFlags'
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription'
import { routes } from '@/lib/routes'
import {
  fetchConversationMessages,
  fetchConversationParticipant,
  fetchConversationAllParticipants,
  fetchSharedMedia,
  fetchConversationMeta,
  fetchMessageReactions,
  markConversationRead,
  searchConversationMessages,
  subscribeToConversationMessages,
  subscribeToReactions,
  subscribeToTypingIndicators,
  broadcastTyping,
  unpinMessage,
  removeChannel,
  type ConversationParticipant,
  type DirectMessage,
  type MessageReaction,
} from '@/lib/services/messaging'
import { blockUser, submitContentReport } from '@/lib/services/moderation'
import { getActivityStatus } from '@/lib/utils/activityStatus'
import { avatarPalette } from '@/lib/utils/format'

type ConversationOperationError = { title: string; message: string }

export interface UseConversationResult {
  // data
  participant: ConversationParticipant | null
  participants: ConversationParticipant[]
  messages: DirectMessage[]
  reactions: Map<string, MessageReaction[]>
  sharedMedia: DirectMessage[]
  pinnedMessage: DirectMessage | null
  isGroup: boolean
  conversationName: string | null
  typingUsernames: string[]
  // async state
  loading: boolean
  error: string | null
  // search
  searchMode: boolean
  searchQuery: string
  searchResults: DirectMessage[]
  searching: boolean
  // ui overlays
  replyingTo: DirectMessage | null
  revealedTimeId: string | null
  safetySheet: boolean
  notice: { title: string; subtitle?: string } | null
  operationError: ConversationOperationError | null
  // derived
  headerTitle: string
  headerSubtitle: string | null
  participantPalette: { bg: string; color: string }
  // actions
  load: () => Promise<void>
  handleSearch: (query: string) => Promise<void>
  handleTyping: () => void
  handleReact: (messageId: string, emoji: string) => void
  handleMessageSent: (msg: DirectMessage) => void
  handleMessageDeleted: (msgId: string) => void
  handleUnpin: () => void
  handleSafetyAction: (value: string) => Promise<void>
  getSenderName: (senderId: string) => string
  // setters for UI state owned by the hook but driven by screen events
  setReplyingTo: (msg: DirectMessage | null) => void
  setRevealedTimeId: (id: string | null) => void
  setSafetySheet: (open: boolean) => void
  setSearchMode: (on: boolean) => void
  setSearchQuery: (q: string) => void
  setSearchResults: (results: DirectMessage[]) => void
  setOperationError: (err: ConversationOperationError | null) => void
  setPinnedMessage: (msg: DirectMessage | null) => void
  setMessages: React.Dispatch<React.SetStateAction<DirectMessage[]>>
  setNotice: (notice: { title: string; subtitle?: string } | null) => void
  // refs exposed for realtime typing channel
  typingChannelRef: React.MutableRefObject<ReturnType<typeof subscribeToTypingIndicators> | null>
}

export function useConversation(
  conversationId: string | undefined,
  userId: string | undefined,
  opts: { onNewMessage?: () => void } = {}
): UseConversationResult {
  const router = useRouter()
  const { requireOnline, runDeferredMutation } = useConnectivity()
  const { onNewMessage } = opts

  const typingChannelRef = useRef<ReturnType<typeof subscribeToTypingIndicators> | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  const [operationError, setOperationError] = useState<ConversationOperationError | null>(null)

  const markRead = useCallback(async (rows: DirectMessage[]) => {
    if (!conversationId || !userId) return
    const last = rows[rows.length - 1]
    await markConversationRead(conversationId, userId, last?.id)
  }, [conversationId, userId])

  const load = useCallback(async () => {
    if (!conversationId || !userId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    setOperationError(null)
    try {
      const [nextParticipant, allParticipants, nextMessages, media] = await Promise.all([
        fetchConversationParticipant(conversationId, userId),
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
    } catch {
      setError('This conversation could not be loaded right now.')
    } finally {
      setLoading(false)
    }
  }, [conversationId, markRead, userId])

  useRealtimeSubscription(
    !!conversationId && !!userId && isEnabled('directMessages'),
    () => subscribeToConversationMessages(conversationId ?? '', message => {
      setMessages(current => {
        if (current.some(row => row.id === message.id)) return current
        const next = [...current, message]
        void markRead(next)
        return next
      })
      onNewMessage?.()
    }),
    [conversationId, userId],
    removeChannel
  )

  useRealtimeSubscription(
    !!conversationId && isEnabled('directMessages'),
    () => subscribeToReactions(conversationId ?? '', ({ eventType, reaction }) => {
      setReactions(prev => {
        const next = new Map(prev)
        const existing = next.get(reaction.message_id) ?? []
        next.set(
          reaction.message_id,
          eventType === 'INSERT' ? [...existing, reaction] : existing.filter(r => r.id !== reaction.id)
        )
        return next
      })
    }),
    [conversationId],
    removeChannel
  )

  useRealtimeSubscription(
    !!conversationId && !!userId && isEnabled('directMessages'),
    () => {
      const channel = subscribeToTypingIndicators(conversationId ?? '', userId ?? '', typingIds => {
        const names = typingIds
          .map(uid => participants.find(p => p.user_id === uid)?.username ?? null)
          .filter(Boolean) as string[]
        setTypingUsernames(names)
      })
      typingChannelRef.current = channel
      return channel
    },
    [conversationId, userId, participants],
    removeChannel
  )

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
    const myReactions = reactions.get(messageId)?.filter(r => r.user_id === userId) ?? []
    const existing = myReactions.find(r => r.emoji === emoji)
    void runDeferredMutation({ kind: 'message_reaction', messageId, emoji, targetState: !existing }).catch(() => {
      // reaction failures are transient; UI reverts on next sync listener notification
    })
  }, [reactions, runDeferredMutation, userId])

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
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to unpin this message.' })
      return
    }
    void unpinMessage(conversationId)
    setPinnedMessage(null)
  }, [conversationId, requireOnline])

  const handleSafetyAction = useCallback(async (value: string) => {
    if (!userId || !participant?.user_id) {
      if (value === 'conversation_info') {
        router.push(routes.conversationInfo(conversationId ?? ''))
      }
      setSafetySheet(false)
      return
    }
    if ((value === 'report_user' || value === 'block_user') && !requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to report or block this account.' })
      setSafetySheet(false)
      return
    }
    if (value === 'report_user') {
      const reportError = await submitContentReport({
        reporterId: userId,
        targetType: 'user',
        targetId: participant.user_id,
        reason: 'message_or_profile_issue',
        sourceSurface: 'message_thread',
      })
      if (reportError) setOperationError({ title: 'Report failed', message: reportError })
      else setNotice({ title: 'Report received', subtitle: 'Thanks. We will review this account.' })
    }
    if (value === 'block_user') {
      const blockError = await blockUser(userId, participant.user_id, 'messaging')
      if (blockError) setOperationError({ title: 'Block failed', message: blockError })
      else setNotice({ title: 'User blocked', subtitle: 'You will no longer be able to exchange messages.' })
      if (!blockError) router.back()
    }
    if (value === 'conversation_info') {
      router.push(routes.conversationInfo(conversationId ?? ''))
    }
    setSafetySheet(false)
  }, [userId, participant?.user_id, conversationId, requireOnline, router])

  const headerTitle = useMemo(() => {
    if (loading && !participant && !isGroup) return ''
    if (isGroup) return conversationName ?? 'Group'
    return participant?.full_name ?? (participant ? `@${participant.username}` : 'Direct Message')
  }, [loading, isGroup, conversationName, participant])

  const headerSubtitle = useMemo(() => {
    if (isGroup) return `${participants.length} members`
    if (!participant) return null
    const status = getActivityStatus(participant.last_seen_at)
    return status.kind === 'inactive' || !status.label ? `@${participant.username}` : status.label
  }, [isGroup, participants.length, participant])

  const participantPalette = useMemo(
    () => avatarPalette(participant?.username ?? 'U'),
    [participant?.username]
  )

  const getSenderName = useCallback((senderId: string): string => {
    if (senderId === userId) return 'You'
    return participants.find(p => p.user_id === senderId)?.username
      ?? participant?.username
      ?? 'Someone'
  }, [userId, participants, participant?.username])

  return {
    participant, participants, messages, reactions, sharedMedia,
    pinnedMessage, isGroup, conversationName, typingUsernames,
    loading, error,
    searchMode, searchQuery, searchResults, searching,
    replyingTo, revealedTimeId, safetySheet, notice, operationError,
    headerTitle, headerSubtitle, participantPalette,
    load, handleSearch, handleTyping, handleReact,
    handleMessageSent, handleMessageDeleted, handleUnpin, handleSafetyAction,
    getSenderName,
    setReplyingTo, setRevealedTimeId, setSafetySheet, setSearchMode,
    setSearchQuery, setSearchResults, setOperationError, setPinnedMessage,
    setMessages, setNotice,
    typingChannelRef,
  }
}
