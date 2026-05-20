import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import * as DocumentPicker from 'expo-document-picker'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Keyframe,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { SPRING_SNAPPY, PRESS_SCALE_ICON, DUR_FAST, EMOJI_STAGGER_MS } from '@/lib/animations'
import { IconButton } from '@/components/ui/IconButton'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { isEnabled } from '@/lib/featureFlags'
import {
  fetchConversationMessages,
  fetchConversationParticipant,
  fetchConversationAllParticipants,
  fetchSharedMedia,
  markConversationRead,
  sendRichMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  fetchMessageReactions,
  subscribeToConversationMessages,
  subscribeToReactions,
  subscribeToTypingIndicators,
  broadcastTyping,
  pinMessage,
  unpinMessage,
  searchConversationMessages,
  fetchDirectConversations,
  forwardMessage,
  type ConversationSummary,
  type ConversationParticipant,
  type DirectMessage,
  type MessageReaction,
  type MessageType,
} from '@/lib/services/messaging'
import { uploadAttachment, computeFileHash } from '@/lib/services/messageAttachments'
import { validatePickedMessageAttachment } from '@/lib/services/media'
import { fetchGifs, hasGifProvider, type GifResult } from '@/lib/services/gifs'
import { blockUser, submitContentReport } from '@/lib/services/moderation'
import { avatarPalette } from '@/lib/utils/format'
import {
  ArrowLeft,
  CameraIcon,
  CloseIcon,
  CopyIcon,
  DotsIcon,
  ForwardIcon,
  GalleryIcon,
  InfoIcon,
  MapPinIcon,
  MessageIcon,
  PaperclipIcon,
  PinIcon,
  PlusIcon,
  ReplyIcon,
  SearchIcon,
  SendIcon,
  TrashIcon,
  UsersIcon,
  VideoIcon,
} from '@/components/icons'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { supabase } from '@/lib/supabase'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

// iOS-style action card entrance: fade + subtle upward translate, no overshoot
const actionCardEntry = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: 8 }, { scale: 0.97 }] },
  to:   { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(200).delay(90)

function messageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function dateLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function activeStatusLabel(lastSeenAt: string | null | undefined): string | null {
  if (!lastSeenAt) return null
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  if (diff < 5 * 60 * 1000) return 'Active now'
  const h = Math.floor(diff / 3_600_000)
  if (h < 24) return `Active ${h}h ago`
  return null
}

function richTypePreview(msg: DirectMessage): string {
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
    case 'system': return (msg.attachment_metadata as any)?.event ?? 'System'
    default: return msg.body ?? ''
  }
}

type MessageListItem =
  | { type: 'date_separator'; date: string; id: string }
  | { type: 'message'; message: DirectMessage; id: string }

function buildMessageItems(messages: DirectMessage[]): MessageListItem[] {
  const items: MessageListItem[] = []
  let lastDate = ''
  for (const message of messages) {
    const date = dateLabel(message.created_at)
    if (date !== lastDate) {
      items.push({ type: 'date_separator', date, id: `sep_${message.id}` })
      lastDate = date
    }
    items.push({ type: 'message', message, id: message.id })
  }
  return items
}

// ─── Typing dots ─────────────────────────────────────────────────────────────

function TypingDots({ colors }: { colors: ReturnType<typeof useThemeColors> }) {
  const dot1 = useSharedValue(0)
  const dot2 = useSharedValue(0)
  const dot3 = useSharedValue(0)

  useEffect(() => {
    const bounce = (sv: typeof dot1, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-5, { duration: 280 }),
            withTiming(0, { duration: 280 }),
            withTiming(0, { duration: 200 }),
          ),
          -1
        )
      )
    }
    bounce(dot1, 0)
    bounce(dot2, 130)
    bounce(dot3, 260)
  }, [])

  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }))
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }))
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }))

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.px5, paddingVertical: spacing.px6, paddingHorizontal: spacing[1] }}>
      <Animated.View style={[{ width: 7, height: 7, borderRadius: radius.dotLg, backgroundColor: colors.text3 }, s1]} />
      <Animated.View style={[{ width: 7, height: 7, borderRadius: radius.dotLg, backgroundColor: colors.text3 }, s2]} />
      <Animated.View style={[{ width: 7, height: 7, borderRadius: radius.dotLg, backgroundColor: colors.text3 }, s3]} />
    </View>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isMine,
  reactions,
  currentUserId,
  colors,
  onLongPress,
  onReact,
  onReply,
  replyContext,
  showTime,
  onPress,
  getSenderName,
  isGroup,
  showSenderName,
  onPressPlaceShare,
  onPressPostShare,
}: {
  message: DirectMessage
  isMine: boolean
  reactions: MessageReaction[]
  currentUserId: string
  colors: ReturnType<typeof useThemeColors>
  onLongPress: (msg: DirectMessage, pageY: number) => void
  onReact: (msgId: string, emoji: string) => void
  onReply: (msg: DirectMessage) => void
  replyContext: DirectMessage | null
  showTime: boolean
  onPress: () => void
  getSenderName: (senderId: string) => string
  isGroup?: boolean
  showSenderName?: boolean
  onPressPlaceShare?: (meta: Record<string, unknown>) => void
  onPressPostShare?: (meta: Record<string, unknown>) => void
}) {
  const styles = useMemo(() => makeStyles(colors), [colors])

  const reactionGroups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const r of reactions) {
      const users = map.get(r.emoji) ?? []
      users.push(r.user_id)
      map.set(r.emoji, users)
    }
    return Array.from(map.entries())
  }, [reactions])

  function renderContent() {
    if (message.deleted_at) {
      return <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine, { fontStyle: 'italic', opacity: 0.55 }]}>Message deleted</Text>
    }

    switch (message.message_type) {
      case 'image':
        return message.attachment_url ? (
          <Image source={{ uri: message.attachment_url }} style={styles.attachmentImage} resizeMode="cover" />
        ) : null

      case 'gif':
        return message.attachment_url ? (
          <Image source={{ uri: message.attachment_url }} style={styles.attachmentImage} resizeMode="contain" />
        ) : null

      case 'video':
        return (
          <View style={styles.videoThumb}>
            {message.attachment_url ? (
              <Image source={{ uri: message.attachment_url }} style={styles.attachmentImage} resizeMode="cover" />
            ) : null}
            <View style={styles.playOverlay}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          </View>
        )

      case 'audio':
        return (
          <View style={styles.audioBar}>
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>Voice note</Text>
          </View>
        )

      case 'location': {
        const meta = message.attachment_metadata as any
        return (
          <TouchableOpacity
            onPress={() => {
              if (meta?.lat && meta?.lng) {
                const q = `${meta.lat},${meta.lng}`
                const url = Platform.OS === 'ios' ? `maps://?ll=${q}` : `geo:${q}`
                Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${q}`))
              }
            }}
            style={styles.locationCard}
            activeOpacity={0.75}
          >
            <View style={[styles.locationIconBg, { backgroundColor: isMine ? 'rgba(255,255,255,0.18)' /* check:tokens-ignore */ : colors.accent + '22' }]}>
              <MapPinIcon size={18} color={isMine ? colors.white : colors.accent} />
            </View>
            <View style={styles.locationCardText}>
              <Text style={[styles.locationCardTitle, isMine && { color: colors.white }]}>
                {meta?.label ?? 'Shared location'}
              </Text>
              <Text style={[styles.locationCardSub, isMine && { color: 'rgba(255,255,255,0.6)' /* check:tokens-ignore */ }]}>
                Tap for directions
              </Text>
            </View>
          </TouchableOpacity>
        )
      }

      case 'post_share': {
        const meta = message.attachment_metadata as any
        return (
          <TouchableOpacity
            style={styles.shareCard}
            onPress={() => onPressPostShare?.(meta)}
            activeOpacity={0.75}
          >
            {meta?.thumbnail_url || meta?.image_url ? (
              <Image
                source={{ uri: meta.thumbnail_url ?? meta.image_url }}
                style={styles.shareCardImage}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.shareCardText}>
              <Text style={[styles.shareCardLabel, isMine && { color: 'rgba(255,255,255,0.62)' /* check:tokens-ignore */ }]}>Post</Text>
              {meta?.caption ? (
                <Text style={[styles.shareCardTitle, isMine && { color: colors.white }]} numberOfLines={2}>
                  {meta.caption}
                </Text>
              ) : null}
              <Text style={[styles.shareCardMeta, isMine && { color: 'rgba(255,255,255,0.65)' /* check:tokens-ignore */ }]} numberOfLines={1}>
                {[meta?.creator ? `@${meta.creator}` : null, meta?.location].filter(Boolean).join(' · ') || 'View in Rekkus'}
              </Text>
            </View>
          </TouchableOpacity>
        )
      }

      case 'place_share': {
        const meta = message.attachment_metadata as any
        return (
          <TouchableOpacity
            onPress={() => onPressPlaceShare?.(meta)}
            style={styles.locationCard}
            activeOpacity={0.75}
          >
            <View style={[styles.locationIconBg, { backgroundColor: isMine ? 'rgba(255,255,255,0.18)' /* check:tokens-ignore */ : colors.accent + '22' }]}>
              <MapPinIcon size={18} color={isMine ? colors.white : colors.accent} />
            </View>
            <View style={styles.locationCardText}>
              <Text style={[styles.shareCardLabel, isMine && { color: 'rgba(255,255,255,0.55)' /* check:tokens-ignore */ }]}>Place</Text>
              {meta?.name ? (
                <Text style={[styles.locationCardTitle, isMine && { color: colors.white }]} numberOfLines={1}>
                  {meta.name}
                </Text>
              ) : null}
              {meta?.address ? (
                <Text style={[styles.locationCardSub, isMine && { color: 'rgba(255,255,255,0.6)' /* check:tokens-ignore */ }]} numberOfLines={1}>
                  {meta.address}
                </Text>
              ) : null}
              <Text style={[styles.locationCardSub, { marginTop: spacing.px3, fontWeight: fontWeight.medium }, isMine && { color: 'rgba(255,255,255,0.7)' /* check:tokens-ignore */ }]}>
                View in Rekkus →
              </Text>
            </View>
          </TouchableOpacity>
        )
      }

      case 'file': {
        const meta = message.attachment_metadata as any
        return (
          <View style={styles.fileCard}>
            <PaperclipIcon size={16} color={isMine ? colors.bg : colors.text2} />
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{meta?.filename ?? 'File'}</Text>
          </View>
        )
      }

      case 'system': {
        const meta = message.attachment_metadata as any
        const event = meta?.event ?? ''
        let systemText = ''
        if (event === 'group_created') systemText = `Group created: ${meta?.name ?? ''}`
        else if (event === 'member_added') systemText = 'A member was added'
        else if (event === 'member_left') systemText = 'A member left'
        return <Text style={styles.systemText}>{systemText}</Text>
      }

      default:
        return message.body ? (
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{message.body}</Text>
        ) : null
    }
  }

  if (message.message_type === 'system') {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.systemRow}>
        {renderContent()}
      </Animated.View>
    )
  }

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[styles.messageRow, isMine && styles.messageRowMine]}
    >
      {isGroup && !isMine && showSenderName ? (
        <Text style={styles.groupSenderName}>{getSenderName(message.sender_id)}</Text>
      ) : null}
      <TouchableOpacity
        style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
        onPress={onPress}
        onLongPress={e => onLongPress(message, e.nativeEvent.pageY)}
        delayLongPress={350}
        activeOpacity={0.85}
      >
        {replyContext ? (
          <TouchableOpacity
            style={[styles.replyQuote, isMine && styles.replyQuoteMine]}
            onPress={() => onReply(replyContext)}
            activeOpacity={0.7}
          >
            <Text style={[styles.replyQuoteSender, isMine && { color: 'rgba(255,255,255,0.9)' /* check:tokens-ignore */ }]}>
              {getSenderName(replyContext.sender_id)}
            </Text>
            <Text style={[styles.replyQuoteText, isMine && { color: 'rgba(255,255,255,0.7)' /* check:tokens-ignore */ }]} numberOfLines={1}>
              {replyContext.body ?? richTypePreview(replyContext)}
            </Text>
          </TouchableOpacity>
        ) : null}
        {renderContent()}
        {showTime ? (
          <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
            {messageTime(message.created_at)}
          </Text>
        ) : null}
      </TouchableOpacity>
      {reactionGroups.length > 0 ? (
        <View style={[styles.reactionsRow, isMine && styles.reactionsRowMine]}>
          {reactionGroups.map(([emoji, users]) => {
            const myReaction = users.includes(currentUserId)
            return (
              <TouchableOpacity
                key={emoji}
                style={[styles.reactionPill, myReaction && styles.reactionPillActive]}
                onPress={() => onReact(message.id, emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={styles.reactionCount}>{users.length}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      ) : null}
    </Animated.View>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

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
  const styles = useMemo(() => makeStyles(colors), [colors])
  const listRef = useRef<FlatList>(null)
  const isAtBottom = useRef(true)
  const inputRef = useRef<TextInput>(null)
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentInitialShareRef = useRef<string | null>(null)

  const [participant, setParticipant] = useState<ConversationParticipant | null>(null)
  const [participants, setParticipants] = useState<ConversationParticipant[]>([])
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [reactions, setReactions] = useState<Map<string, MessageReaction[]>>(new Map())
  const [sharedMedia, setSharedMedia] = useState<DirectMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typingUsernames, setTypingUsernames] = useState<string[]>([])
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<DirectMessage | null>(null)
  const [safetySheet, setSafetySheet] = useState(false)
  const [messageSheet, setMessageSheet] = useState(false)
  const [pinnedMessage, setPinnedMessage] = useState<DirectMessage | null>(null)
  const [isGroup, setIsGroup] = useState(false)
  const [conversationName, setConversationName] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DirectMessage[]>([])
  const [searching, setSearching] = useState(false)
  const [revealedTimeId, setRevealedTimeId] = useState<string | null>(null)
  const [longPressY, setLongPressY] = useState(Dimensions.get('window').height / 2)
  const [attachmentTrayOpen, setAttachmentTrayOpen] = useState(false)
  const [locationSheet, setLocationSheet] = useState(false)
  const [gifPickerVisible, setGifPickerVisible] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState<GifResult[]>([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState<string | null>(null)
  const [savedPlacePickerVisible, setSavedPlacePickerVisible] = useState(false)
  const [savedPlaces, setSavedPlaces] = useState<any[]>([])
  const [loadingSavedPlaces, setLoadingSavedPlaces] = useState(false)
  const [notice, setNotice] = useState<{ title: string; subtitle?: string } | null>(null)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [forwardPickerVisible, setForwardPickerVisible] = useState(false)
  const [forwardSourceMessage, setForwardSourceMessage] = useState<DirectMessage | null>(null)
  const [forwardTargets, setForwardTargets] = useState<ConversationSummary[]>([])
  const [loadingForwardTargets, setLoadingForwardTargets] = useState(false)
  const [forwardingConversationId, setForwardingConversationId] = useState<string | null>(null)

  // Send button scale animation
  const sendScale = useSharedValue(1)
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }))

  const reactionsByMessage = useCallback(
    (messageId: string) => reactions.get(messageId) ?? [],
    [reactions]
  )

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: true }))
  }, [])

  const markRead = useCallback(
    async (rows: DirectMessage[]) => {
      if (!conversationId || !user) return
      const last = rows[rows.length - 1]
      await markConversationRead(conversationId, user.id, last?.id)
    },
    [conversationId, user?.id]
  )

  const load = useCallback(async () => {
    if (!conversationId || !user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [nextParticipant, allParticipants, nextMessages, media] = await Promise.all([
        fetchConversationParticipant(conversationId, user.id),
        fetchConversationAllParticipants(conversationId),
        fetchConversationMessages(conversationId),
        fetchSharedMedia(conversationId),
      ])

      const { data: convRow } = await (supabase.from('conversations') as any)
        .select('conversation_type, name, pinned_message_id')
        .eq('id', conversationId)
        .maybeSingle()

      setIsGroup(convRow?.conversation_type === 'group')
      setConversationName(convRow?.name ?? null)
      setParticipant(nextParticipant)
      setParticipants(allParticipants)
      setMessages(nextMessages)
      setSharedMedia(media)

      if (convRow?.pinned_message_id) {
        const pinned = nextMessages.find(m => m.id === convRow.pinned_message_id) ?? null
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
  }, [conversationId, markRead, scrollToEnd, user?.id])

  useEffect(() => {
    if (!user) requireAuth()
  }, [user])

  useFocusEffect(
    useCallback(() => {
      if (isEnabled('directMessages')) load()
      else setLoading(false)
    }, [load])
  )

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

    sendRichMessage(conversationId, user.id, 'post_share', null, shareImageUrl || null, metadata)
      .then(({ message, error }) => {
        if (error || !message) {
          sentInitialShareRef.current = null
          setNotice({ title: 'Could not share post', subtitle: error ?? 'Messaging is not available right now.' })
          return
        }
        setMessages(current => current.some(row => row.id === message.id) ? current : [...current, message])
        scrollToEnd()
        ;(router as any).setParams?.({
          sharePostId: undefined,
          sharePostDbId: undefined,
          shareCaption: undefined,
          shareImageUrl: undefined,
          shareAuthor: undefined,
          shareLocation: undefined,
        })
      })
  }, [
    conversationId,
    router,
    scrollToEnd,
    shareAuthor,
    shareCaption,
    shareImageUrl,
    shareLocation,
    sharePostDbId,
    sharePostId,
    user?.id,
  ])

  // Message realtime subscription
  useEffect(() => {
    if (!conversationId || !user || !isEnabled('directMessages')) return
    const channel = subscribeToConversationMessages(conversationId, message => {
      setMessages(current => {
        if (current.some(row => row.id === message.id)) return current
        const next = [...current, message]
        markRead(next)
        return next
      })
      scrollToEnd()
    })
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, markRead, scrollToEnd, user?.id])

  // Reaction realtime subscription
  useEffect(() => {
    if (!conversationId || !isEnabled('directMessages')) return
    const channel = subscribeToReactions(conversationId, ({ eventType, reaction }) => {
      setReactions(prev => {
        const next = new Map(prev)
        const existing = next.get(reaction.message_id) ?? []
        if (eventType === 'INSERT') {
          next.set(reaction.message_id, [...existing, reaction])
        } else {
          next.set(reaction.message_id, existing.filter(r => r.id !== reaction.id))
        }
        return next
      })
    })
    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Typing indicators
  useEffect(() => {
    if (!conversationId || !user || !isEnabled('directMessages')) return
    const channel = subscribeToTypingIndicators(conversationId, user.id, typingIds => {
      const names = typingIds
        .map(uid => participants.find(p => p.user_id === uid)?.username ?? null)
        .filter(Boolean) as string[]
      setTypingUsernames(names)
    })
    typingChannelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, user?.id, participants])

  // Update last_seen_at on foreground
  useEffect(() => {
    if (!user) return
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        ;(supabase.from('users') as any)
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', user.id)
          .then(() => {})
      }
    })
    return () => subscription.remove()
  }, [user?.id])

  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (!query.trim() || !conversationId) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const results = await searchConversationMessages(conversationId, query)
    setSearchResults(results)
    setSearching(false)
  }

  function handleInputChange(text: string) {
    setInput(text)
    if (typingChannelRef.current) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      broadcastTyping(typingChannelRef.current)
    }
  }

  async function handleSend() {
    if (!conversationId || !user || sending) return
    const text = input.trim()
    if (!text) return
    setAttachmentTrayOpen(false)
    setSending(true)
    setInput('')
    const replyId = replyingTo?.id ?? null
    setReplyingTo(null)

    const { message, error: sendError } = await sendRichMessage(conversationId, user.id, 'text', text, null, null, replyId)
    if (sendError || !message) {
      setInput(text)
      setNotice({ title: 'Message not sent', subtitle: sendError ?? 'Messaging is not available right now.' })
    } else {
      setMessages(current => current.some(row => row.id === message.id) ? current : [...current, message])
      scrollToEnd()
    }
    setSending(false)
  }

  async function handlePickMedia() {
    setAttachmentTrayOpen(false)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Enable photo library access in Settings.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: 60,
      allowsEditing: false,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const { uri, mimeType, error } = validatePickedMessageAttachment(asset)
    if (!uri || !mimeType) {
      setNotice({ title: 'Unsupported media', subtitle: error ?? 'File not supported.' })
      return
    }
    if (asset.type === 'video' || asset.mimeType?.startsWith('video/')) {
      await sendMedia(uri, mimeType, 'video')
      return
    }
    await sendMedia(uri, mimeType, 'image')
  }

  async function handleCamera() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Enable camera access in Settings.')
        return
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      if (result.canceled || !result.assets[0]) return
      const { uri, mimeType, error } = validatePickedMessageAttachment(result.assets[0])
      if (!uri || !mimeType) {
        setNotice({ title: 'Unsupported image', subtitle: error ?? 'File not supported.' })
        return
      }
      await sendMedia(uri, mimeType, 'image')
    } catch (e: any) {
      const msg = e?.message ?? ''
      if (msg.includes('not available') || msg.includes('simulator') || msg.includes('Camera')) {
        setNotice({ title: 'Camera unavailable', subtitle: 'Camera is not available on this device.' })
      } else {
        setNotice({ title: 'Camera error', subtitle: 'Could not open camera. Please try again.' })
      }
    }
  }

  async function handlePickFile() {
    setAttachmentTrayOpen(false)
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    await sendMedia(asset.uri, asset.mimeType ?? 'application/octet-stream', 'file')
  }

  async function handleShareLocation() {
    setAttachmentTrayOpen(false)
    setLocationSheet(true)
  }

  async function openGifPicker() {
    setAttachmentTrayOpen(false)
    setGifPickerVisible(true)
    setGifQuery('')
    await loadGifs('')
  }

  async function loadGifs(query: string) {
    setGifLoading(true)
    setGifError(null)
    const { gifs, error } = await fetchGifs(query)
    setGifResults(gifs)
    setGifError(error)
    setGifLoading(false)
  }

  async function handleGifSearch(query: string) {
    setGifQuery(query)
    await loadGifs(query)
  }

  async function handleSelectGif(gif: GifResult) {
    if (!conversationId || !user) return
    setGifPickerVisible(false)
    setSending(true)
    const { message, error } = await sendRichMessage(
      conversationId,
      user.id,
      'gif',
      null,
      gif.url,
      { title: gif.title, preview_url: gif.previewUrl, provider: 'giphy' },
      replyingTo?.id ?? null
    )
    if (error || !message) {
      setNotice({ title: 'Could not send GIF', subtitle: error ?? 'GIFs are not available right now.' })
    } else {
      setMessages(current => current.some(r => r.id === message.id) ? current : [...current, message])
      setReplyingTo(null)
      scrollToEnd()
    }
    setSending(false)
  }

  async function doShareCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Enable location access in Settings.')
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      if (!conversationId || !user) return
      const { message, error } = await sendRichMessage(conversationId, user.id, 'location', null, null, {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        label: 'My location',
      })
      if (error) {
        setNotice({ title: 'Could not share location', subtitle: error })
      } else if (message) {
        setMessages(current => current.some(r => r.id === message.id) ? current : [...current, message])
        scrollToEnd()
      }
    } catch {
      setNotice({ title: 'Location error', subtitle: 'Could not get your current location. Please try again.' })
    }
  }

  async function handleLocationSheetSelect(value: string) {
    setLocationSheet(false)
    if (value === 'current_location') {
      await doShareCurrentLocation()
    } else if (value === 'saved_place') {
      setSavedPlacePickerVisible(true)
      setLoadingSavedPlaces(true)
      const { data } = await (supabase.from('saved_locations') as any)
        .select('id, restaurant_id, save_status, restaurants(name, address, latitude, longitude, google_place_id)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setSavedPlaces(data ?? [])
      setLoadingSavedPlaces(false)
    }
  }

  async function handleSavedPlaceSelect(place: any) {
    setSavedPlacePickerVisible(false)
    if (!conversationId || !user || !place.restaurants) return
    const { name, address, latitude, longitude, google_place_id } = place.restaurants
    const { message, error } = await sendRichMessage(conversationId, user.id, 'place_share', null, null, {
      name,
      address,
      lat: latitude,
      lng: longitude,
      restaurant_id: place.restaurant_id,
      google_place_id,
    })
    if (error) {
      setNotice({ title: 'Could not share place', subtitle: error })
    } else if (message) {
      setMessages(current => current.some(r => r.id === message.id) ? current : [...current, message])
      scrollToEnd()
    }
  }

  async function sendMedia(uri: string, mimeType: string, msgType: MessageType) {
    if (!conversationId || !user) return
    setAttachmentTrayOpen(false)
    setSending(true)
    try {
      if (msgType === 'image' || msgType === 'video') {
        // Moderation check — fail open so service errors never block legitimate sends.
        // Only an explicit `safe: false` from the Edge Function blocks the message.
        try {
          const hash = await computeFileHash(uri)
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
          const { data: { session } } = await supabase.auth.getSession()
          if (session && supabaseUrl) {
            const res = await fetch(`${supabaseUrl}/functions/v1/moderate-content`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ messageType: msgType, mediaHash: hash, conversationId }),
            })
            if (res.ok) {
              const result = await res.json()
              if (result.safe === false) {
                setNotice({ title: 'Could not send', subtitle: 'This content could not be sent.' })
                return
              }
            }
          }
        } catch {
          // Moderation service unavailable — allow send rather than blocking the user
        }
      }

      const { url, error: uploadError } = await uploadAttachment(conversationId, user.id, uri, mimeType)
      if (uploadError) {
        setNotice({ title: 'Upload failed', subtitle: uploadError })
        return
      }

      const meta = msgType === 'file'
        ? { filename: uri.split('/').pop() ?? 'file', mimeType }
        : undefined

      const { message: sentMessage, error: richError } = await sendRichMessage(
        conversationId, user.id, msgType, null, url, meta ?? null, replyingTo?.id ?? null
      )
      if (richError || !sentMessage) {
        setNotice({ title: 'Could not send', subtitle: richError ?? 'Messaging is not available right now.' })
      } else {
        setMessages(current => current.some(r => r.id === sentMessage.id) ? current : [...current, sentMessage])
        scrollToEnd()
      }
      setReplyingTo(null)
    } finally {
      setSending(false)
    }
  }

  async function handleLongPressMessage(message: DirectMessage, pageY: number) {
    setSelectedMessage(message)
    setLongPressY(pageY)
    setMessageSheet(true)
  }

  async function handleMessageAction(value: string) {
    setMessageSheet(false)
    if (!selectedMessage || !conversationId || !user) return

    if (value === 'reply') {
      setReplyingTo(selectedMessage)
      inputRef.current?.focus()
    } else if (value.startsWith('react_')) {
      const emoji = value.slice(6)
      const myReactions = reactions.get(selectedMessage.id)?.filter(r => r.user_id === user.id) ?? []
      const existingWithEmoji = myReactions.find(r => r.emoji === emoji)
      if (existingWithEmoji) {
        await removeReaction(selectedMessage.id)
      } else {
        await addReaction(selectedMessage.id, emoji)
      }
    } else if (value === 'delete' && selectedMessage.sender_id === user.id) {
      setDeleteConfirmVisible(true)
      return
    } else if (value === 'copy' && selectedMessage.body) {
      await Clipboard.setStringAsync(selectedMessage.body)
    } else if (value === 'forward') {
      setForwardSourceMessage(selectedMessage)
      setLoadingForwardTargets(true)
      setForwardPickerVisible(true)
      try {
        const conversations = await fetchDirectConversations(user.id)
        setForwardTargets(conversations.filter(item => item.id !== conversationId))
      } catch {
        setForwardTargets([])
      } finally {
        setLoadingForwardTargets(false)
      }
      return
    } else if (value === 'pin') {
      await pinMessage(selectedMessage.id)
      setPinnedMessage(selectedMessage)
    } else if (value === 'report') {
      const reportError = await submitContentReport({
        reporterId: user.id,
        targetType: 'message',
        targetId: selectedMessage.id,
        reason: 'message_or_profile_issue',
        sourceSurface: 'message_thread',
      })
      setNotice({
        title: reportError ? 'Report failed' : 'Report received',
        subtitle: reportError ?? 'Thanks. We will review this message.',
      })
    }
    setSelectedMessage(null)
  }

  const handlePressPlaceShare = useCallback((meta: Record<string, unknown>) => {
    const restaurantId = (meta.restaurant_id ?? meta.google_place_id) as string | undefined
    if (!restaurantId) return
    router.push({
      pathname: '/restaurants/[restaurantId]',
      params: {
        restaurantId,
        placeId: (meta.google_place_id as string | undefined) ?? 'none',
        name: (meta.name as string | undefined) ?? '',
        address: (meta.address as string | undefined) ?? '',
        lat: String(meta.lat ?? ''),
        lng: String(meta.lng ?? ''),
      },
    } as any)
  }, [router])

  const handlePressPostShare = useCallback((meta: Record<string, unknown>) => {
    const postId = (meta.post_id ?? meta.app_post_id) as string | undefined
    if (!postId) {
      setNotice({ title: 'Post unavailable', subtitle: 'This shared post could not be opened.' })
      return
    }
    router.push({ pathname: '/posts/[postId]', params: { postId } } as any)
  }, [router])

  async function handleSafetyAction(value: string) {
    if (!user || !participant?.user_id) return
    if (value === 'report_user') {
      const reportError = await submitContentReport({
        reporterId: user.id,
        targetType: 'user',
        targetId: participant.user_id,
        reason: 'message_or_profile_issue',
        sourceSurface: 'message_thread',
      })
      setNotice({
        title: reportError ? 'Report failed' : 'Report received',
        subtitle: reportError ?? 'Thanks. We will review this account.',
      })
    }
    if (value === 'block_user') {
      const blockError = await blockUser(user.id, participant.user_id, 'messaging')
      setNotice({
        title: blockError ? 'Block failed' : 'User blocked',
        subtitle: blockError ?? 'You will no longer be able to exchange messages.',
      })
      if (!blockError) router.back()
    }
    if (value === 'conversation_info') {
      router.push({ pathname: '/messages/info', params: { conversationId } } as any)
    }
    setSafetySheet(false)
  }

  async function confirmDeleteSelectedMessage() {
    if (!selectedMessage) return
    const messageToDelete = selectedMessage
    const { error: delError } = await deleteMessage(messageToDelete.id)
    if (delError) {
      setNotice({ title: 'Could not delete message', subtitle: delError })
      return
    }
    setMessages(current =>
      current.map(m => m.id === messageToDelete.id ? { ...m, deleted_at: new Date().toISOString() } : m)
    )
    setSelectedMessage(null)
  }

  async function handleForwardToConversation(targetConversationId: string) {
    if (!forwardSourceMessage || !user) return
    setForwardingConversationId(targetConversationId)
    const { error } = await forwardMessage(forwardSourceMessage.id, targetConversationId, user.id)
    setForwardingConversationId(null)
    setForwardPickerVisible(false)
    if (error) {
      setNotice({ title: 'Could not forward', subtitle: error })
      return
    }
    setForwardSourceMessage(null)
    setNotice({ title: 'Message forwarded', subtitle: 'Sent to the selected conversation.' })
  }

  function handleReact(messageId: string, emoji: string) {
    const myReactions = reactions.get(messageId)?.filter(r => r.user_id === user?.id) ?? []
    const existingWithEmoji = myReactions.find(r => r.emoji === emoji)
    if (existingWithEmoji) {
      removeReaction(messageId)
    } else {
      addReaction(messageId, emoji)
    }
  }

  const messageActions = useMemo(() => {
    if (!selectedMessage || !user) return []
    const isMine = selectedMessage.sender_id === user.id
    const actions: { label: string; value: string }[] = [
      { label: 'Reply', value: 'reply' },
    ]
    if (selectedMessage.body) actions.push({ label: 'Copy', value: 'copy' })
    actions.push({ label: 'Forward', value: 'forward' })
    actions.push({ label: 'Pin', value: 'pin' })
    if (isMine) actions.push({ label: 'Delete', value: 'delete' })
    else actions.push({ label: 'Report', value: 'report' })
    return actions
  }, [selectedMessage, user])

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

  const listData = useMemo(() => buildMessageItems(messages), [messages])

  const participantPalette = useMemo(() =>
    avatarPalette(participant?.username ?? 'U'),
    [participant?.username]
  )

  const getSenderName = useCallback((senderId: string) => {
    if (senderId === user?.id) return 'You'
    return participants.find(p => p.user_id === senderId)?.username
      ?? participant?.username
      ?? 'Someone'
  }, [user?.id, participants, participant?.username])

  const renderItem = useCallback(
    ({ item, index }: { item: MessageListItem; index: number }) => {
      if (item.type === 'date_separator') {
        return (
          <View style={styles.dateSeparator}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>{item.date}</Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )
      }
      const { message } = item
      const isMine = message.sender_id === user?.id
      const replyCtx = message.reply_to_message_id
        ? messages.find(m => m.id === message.reply_to_message_id) ?? null
        : null
      const prevItem = listData[index - 1]
      const prevSenderId = prevItem?.type === 'message' ? prevItem.message.sender_id : null
      const showSenderName = isGroup && !isMine && prevSenderId !== message.sender_id
      return (
        <MessageBubble
          message={message}
          isMine={isMine}
          reactions={reactionsByMessage(message.id)}
          currentUserId={user?.id ?? ''}
          colors={colors}
          onLongPress={(msg, y) => handleLongPressMessage(msg, y)}
          onReact={handleReact}
          onReply={msg => { setReplyingTo(msg); inputRef.current?.focus() }}
          replyContext={replyCtx}
          showTime={revealedTimeId === message.id}
          onPress={() => setRevealedTimeId(prev => prev === message.id ? null : message.id)}
          getSenderName={getSenderName}
          isGroup={isGroup}
          showSenderName={showSenderName}
          onPressPlaceShare={handlePressPlaceShare}
          onPressPostShare={handlePressPostShare}
        />
      )
    },
    [messages, listData, user?.id, reactionsByMessage, colors, revealedTimeId, getSenderName, isGroup, handlePressPlaceShare, handlePressPostShare]
  )

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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => {
            if (searchMode) { setSearchMode(false); setSearchQuery(''); setSearchResults([]) }
            else router.back()
          }}>
            <ArrowLeft />
          </TouchableOpacity>

          {searchMode ? (
            <>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearch}
                placeholder="Search messages…"
                placeholderTextColor={colors.text3}
                autoFocus
                returnKeyType="search"
              />
              <IconButton
                accessibilityLabel="Close message search"
                onPress={() => { setSearchMode(false); setSearchQuery(''); setSearchResults([]) }}
                size={36}
                variant="plain"
              >
                <CloseIcon size={18} color={colors.text3} />
              </IconButton>
            </>
          ) : (
            <>
              {/* Avatar in header */}
              <TouchableOpacity
                style={styles.headerAvatarBtn}
                onPress={() => router.push({ pathname: '/messages/info', params: { conversationId } } as any)}
              >
                <View style={styles.headerAvatarContainer}>
                  {isGroup ? (
                    <View style={[styles.headerAvatar, { backgroundColor: colors.surface2 }]}>
                      <UsersIcon size={20} color={colors.text2} />
                    </View>
                  ) : participant?.avatar_url ? (
                    <Image source={{ uri: participant.avatar_url }} style={styles.headerAvatar} />
                  ) : (
                    <View style={[styles.headerAvatar, { backgroundColor: participantPalette.bg }]}>
                      <Text style={[styles.headerAvatarText, { color: participantPalette.color }]}>
                        {(participant?.full_name ?? participant?.username ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {!isGroup && activeStatusLabel(participant?.last_seen_at) === 'Active now' ? (
                    <View style={styles.onlineDot} />
                  ) : null}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerText}
                onPress={() => router.push({ pathname: '/messages/info', params: { conversationId } } as any)}
              >
                {headerTitle ? (
                  <Text style={styles.title} numberOfLines={1}>{headerTitle}</Text>
                ) : (
                  <View style={styles.titleSkeleton} />
                )}
                {headerSubtitle ? (
                  <Text style={styles.subtitle} numberOfLines={1}>{headerSubtitle}</Text>
                ) : null}
              </TouchableOpacity>

              <View style={styles.headerActions}>
                <IconButton accessibilityLabel="Search messages" onPress={() => setSearchMode(true)} size={36} variant="plain">
                  <SearchIcon size={18} color={colors.text2} />
                </IconButton>
                <IconButton accessibilityLabel="Open conversation options" onPress={() => setSafetySheet(true)} size={36} variant="plain">
                  <DotsIcon />
                </IconButton>
              </View>
            </>
          )}
        </View>

        {/* Pinned message banner */}
        {pinnedMessage ? (
          <TouchableOpacity style={styles.pinnedBanner} onPress={() => {
            const idx = listData.findIndex(item => item.type === 'message' && item.id === pinnedMessage.id)
            if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, animated: true })
          }}>
            <PinIcon size={12} color={colors.accent} />
            <Text style={styles.pinnedText} numberOfLines={1}>
              {pinnedMessage.body ?? richTypePreview(pinnedMessage)}
            </Text>
            <TouchableOpacity onPress={() => { unpinMessage(conversationId!); setPinnedMessage(null) }}>
              <CloseIcon size={14} color={colors.text3} />
            </TouchableOpacity>
          </TouchableOpacity>
        ) : null}

        {/* Shared media strip */}
        {sharedMedia.length > 0 && !searchMode ? (
          <View style={styles.mediaStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaStripContent}>
              {sharedMedia.slice(0, 8).map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.mediaThumb}
                  activeOpacity={0.8}
                  onPress={() => router.push({ pathname: '/messages/info', params: { conversationId } } as any)}
                >
                  {m.attachment_url ? (
                    <Image source={{ uri: m.attachment_url }} style={styles.mediaThumbImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.mediaThumbImg, { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }]}>
                      <VideoIcon size={16} color={colors.text3} />
                    </View>
                  )}
                  {m.message_type === 'video' ? (
                    <View style={styles.mediaThumbOverlay}>
                      <Text style={{ color: colors.white, fontSize: fontSize.xs }}>▶</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.mediaSeeAll}
                onPress={() => router.push({ pathname: '/messages/info', params: { conversationId } } as any)}
              >
                <Text style={styles.mediaSeeAllText}>See all</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text3} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Could not open conversation</Text>
            <Text style={styles.emptyBody}>{error}</Text>
          </View>
        ) : (
          <>
            {searchMode ? (
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.messageContent}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  searching ? <ActivityIndicator color={colors.text3} style={{ marginTop: spacing[5] }} /> : null
                }
                ListEmptyComponent={
                  searchQuery.trim() && !searching ? (
                    <View style={styles.center}>
                      <Text style={styles.emptyTitle}>No messages found</Text>
                      <Text style={styles.emptyBody}>Try a different search term.</Text>
                    </View>
                  ) : null
                }
                renderItem={({ item: message }) => {
                  const isMine = message.sender_id === user?.id
                  return (
                    <MessageBubble
                      message={message}
                      isMine={isMine}
                      reactions={reactionsByMessage(message.id)}
                      currentUserId={user?.id ?? ''}
                      colors={colors}
                      onLongPress={(msg, y) => handleLongPressMessage(msg, y)}
                      onReact={handleReact}
                      onReply={msg => { setReplyingTo(msg); inputRef.current?.focus() }}
                      replyContext={null}
                      showTime={revealedTimeId === message.id}
                      onPress={() => setRevealedTimeId(prev => prev === message.id ? null : message.id)}
                      getSenderName={getSenderName}
                      onPressPlaceShare={handlePressPlaceShare}
                      onPressPostShare={handlePressPostShare}
                    />
                  )
                }}
              />
            ) : (
              <FlatList
                ref={listRef}
                data={listData}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.messageContent}
                onScroll={(e) => {
                  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
                  isAtBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80
                }}
                scrollEventThrottle={100}
                onContentSizeChange={() => { if (isAtBottom.current) scrollToEnd() }}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.emptyThread}>
                    <MessageIcon size={32} color={colors.text3} />
                    <Text style={styles.emptyTitle}>Start the conversation</Text>
                    <Text style={styles.emptyBody}>Keep it useful, kind, and food-focused.</Text>
                  </View>
                }
              />
            )}

            {/* Typing indicator */}
            {typingUsernames.length > 0 ? (
              <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.typingBar}>
                <TypingDots colors={colors} />
                <Text style={styles.typingText}>
                  {typingUsernames.join(', ')} {typingUsernames.length === 1 ? 'is' : 'are'} typing
                </Text>
              </Animated.View>
            ) : null}

            {/* Reply context */}
            {replyingTo ? (
              <Animated.View entering={FadeInDown.duration(180)} style={styles.replyBar}>
                <View style={styles.replyBarAccent} />
                <View style={styles.replyBarContent}>
                  <Text style={styles.replyBarLabel}>Replying to</Text>
                  <Text style={styles.replyBarText} numberOfLines={1}>
                    {replyingTo.body ?? richTypePreview(replyingTo)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <CloseIcon size={16} color={colors.text3} />
                </TouchableOpacity>
              </Animated.View>
            ) : null}

            {/* Input area */}
            <View style={styles.inputArea}>
              {attachmentTrayOpen ? (
                <Animated.View entering={FadeInDown.duration(150)} style={styles.attachmentTray}>
                  <TouchableOpacity style={styles.trayAction} onPress={handlePickMedia} activeOpacity={0.74}>
                    <View style={styles.trayIconWrap}>
                      <GalleryIcon size={21} color={colors.accent} />
                    </View>
                    <Text style={styles.trayActionLabel}>Media</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.trayAction} onPress={openGifPicker} activeOpacity={0.74}>
                    <View style={styles.trayIconWrap}>
                      <Text style={styles.gifTrayIcon}>GIF</Text>
                    </View>
                    <Text style={styles.trayActionLabel}>GIF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.trayAction} onPress={handleShareLocation} activeOpacity={0.74}>
                    <View style={styles.trayIconWrap}>
                      <MapPinIcon size={21} color={colors.accent} />
                    </View>
                    <Text style={styles.trayActionLabel}>Location</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.trayAction} onPress={handlePickFile} activeOpacity={0.74}>
                    <View style={styles.trayIconWrap}>
                      <PaperclipIcon size={21} color={colors.accent} />
                    </View>
                    <Text style={styles.trayActionLabel}>File</Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : null}
              <View style={styles.composeRow}>
                <TouchableOpacity
                  style={[styles.attachBtn, attachmentTrayOpen && styles.attachBtnActive]}
                  onPress={() => setAttachmentTrayOpen(open => !open)}
                  activeOpacity={0.7}
                >
                  <PlusIcon size={20} color={colors.text2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachBtn} onPress={handleCamera} activeOpacity={0.7}>
                  <CameraIcon size={20} color={colors.text2} />
                </TouchableOpacity>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={input}
                  onChangeText={handleInputChange}
                  placeholder="Message"
                  placeholderTextColor={colors.text3}
                  multiline
                  maxLength={2000}
                  returnKeyType="default"
                  onFocus={() => { setAttachmentTrayOpen(false); scrollToEnd() }}
                />
                <Animated.View style={sendAnimStyle}>
                  <TouchableOpacity
                    style={[styles.sendBtn, input.trim() ? styles.sendBtnActive : styles.sendBtnInactive]}
                    onPress={handleSend}
                    onPressIn={() => { if (input.trim()) sendScale.value = withSpring(PRESS_SCALE_ICON, SPRING_SNAPPY) }}
                    onPressOut={() => { sendScale.value = withSpring(1, SPRING_SNAPPY) }}
                    disabled={!input.trim() || sending}
                    activeOpacity={1}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color={input.trim() ? colors.white : colors.text3} />
                      : <SendIcon active={!!input.trim()} color={input.trim() ? colors.white : undefined} />}
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <RekkusActionSheet
        visible={locationSheet}
        title="Share location"
        options={[
          { label: 'Current location', value: 'current_location', icon: <MapPinIcon size={18} color={colors.text} /> },
          { label: 'Share a saved place', value: 'saved_place', icon: <GalleryIcon size={18} color={colors.text} /> },
        ]}
        onSelect={handleLocationSheetSelect}
        onDismiss={() => setLocationSheet(false)}
      />

      <Modal
        visible={gifPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGifPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity style={styles.pickerDismiss} onPress={() => setGifPickerVisible(false)} />
          <View style={styles.gifSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>GIFs</Text>
              <TouchableOpacity onPress={() => setGifPickerVisible(false)}>
                <CloseIcon size={18} color={colors.text3} />
              </TouchableOpacity>
            </View>
            <View style={styles.gifSearchWrap}>
              <SearchIcon size={14} color={colors.text3} />
              <TextInput
                style={styles.gifSearchInput}
                value={gifQuery}
                onChangeText={handleGifSearch}
                placeholder="Search GIFs"
                placeholderTextColor={colors.text3}
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
            {!hasGifProvider() ? (
              <View style={styles.gifState}>
                <Text style={styles.emptyTitle}>GIFs need setup</Text>
                <Text style={styles.emptyBody}>Add the platform GIPHY key to enable GIF search.</Text>
              </View>
            ) : gifLoading ? (
              <ActivityIndicator color={colors.text3} style={{ marginVertical: spacing.px28 }} />
            ) : gifError ? (
              <View style={styles.gifState}>
                <Text style={styles.emptyTitle}>Could not load GIFs</Text>
                <Text style={styles.emptyBody}>{gifError}</Text>
              </View>
            ) : (
              <FlatList
                data={gifResults}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={styles.gifGridRow}
                contentContainerStyle={styles.gifGrid}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.gifState}>
                    <Text style={styles.emptyTitle}>No GIFs found</Text>
                    <Text style={styles.emptyBody}>Try another search.</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.gifTile}
                    onPress={() => handleSelectGif(item)}
                    activeOpacity={0.82}
                  >
                    <Image source={{ uri: item.previewUrl }} style={styles.gifTileImage} resizeMode="cover" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Saved place picker */}
      <Modal
        visible={savedPlacePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSavedPlacePickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity style={styles.pickerDismiss} onPress={() => setSavedPlacePickerVisible(false)} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Share a place</Text>
              <TouchableOpacity onPress={() => setSavedPlacePickerVisible(false)}>
                <CloseIcon size={18} color={colors.text3} />
              </TouchableOpacity>
            </View>
            {loadingSavedPlaces ? (
              <ActivityIndicator color={colors.text3} style={{ marginVertical: spacing[8] }} />
            ) : savedPlaces.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing[8] }}>
                <Text style={{ color: colors.text3, fontSize: fontSize.md }}>No saved places yet</Text>
              </View>
            ) : (
              <FlatList
                data={savedPlaces}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: spacing[8] }}
                renderItem={({ item }) => {
                  const r = item.restaurants
                  if (!r) return null
                  return (
                    <TouchableOpacity
                      style={styles.placeRow}
                      onPress={() => handleSavedPlaceSelect(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.placeRowIcon, { backgroundColor: colors.accent + '18' }]}>
                        <MapPinIcon size={16} color={colors.accent} />
                      </View>
                      <View style={styles.placeRowText}>
                        <Text style={styles.placeRowName} numberOfLines={1}>{r.name}</Text>
                        {r.address ? (
                          <Text style={styles.placeRowAddr} numberOfLines={1}>{r.address}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  )
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Forward conversation picker */}
      <Modal
        visible={forwardPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setForwardPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity style={styles.pickerDismiss} onPress={() => setForwardPickerVisible(false)} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Forward to</Text>
                <Text style={styles.pickerSubtitle}>Choose a recent conversation.</Text>
              </View>
              <TouchableOpacity onPress={() => setForwardPickerVisible(false)}>
                <CloseIcon size={18} color={colors.text3} />
              </TouchableOpacity>
            </View>
            {loadingForwardTargets ? (
              <ActivityIndicator color={colors.text3} style={{ marginVertical: spacing[8] }} />
            ) : forwardTargets.length === 0 ? (
              <View style={styles.forwardEmpty}>
                <MessageIcon size={24} color={colors.text3} />
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptyBody}>Start a conversation first, then forward messages here.</Text>
              </View>
            ) : (
              <FlatList
                data={forwardTargets}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: spacing[8] }}
                renderItem={({ item }) => {
                  const targetName = item.conversation_type === 'group'
                    ? item.name ?? 'Group'
                    : item.participant?.full_name ?? `@${item.participant?.username ?? 'user'}`
                  const targetSubtitle = item.conversation_type === 'group'
                    ? `${item.participants.length + 1} members`
                    : `@${item.participant?.username ?? 'user'}`
                  const palette = avatarPalette(targetName)
                  return (
                    <TouchableOpacity
                      style={styles.forwardRow}
                      onPress={() => handleForwardToConversation(item.id)}
                      activeOpacity={0.75}
                      disabled={forwardingConversationId != null}
                    >
                      <View style={[styles.forwardAvatar, { backgroundColor: palette.bg }]}>
                        <Text style={[styles.forwardAvatarText, { color: palette.color }]}>
                          {targetName.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.forwardText}>
                        <Text style={styles.forwardName} numberOfLines={1}>{targetName}</Text>
                        <Text style={styles.forwardMeta} numberOfLines={1}>{targetSubtitle}</Text>
                      </View>
                      {forwardingConversationId === item.id ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <ForwardIcon size={16} color={colors.text3} />
                      )}
                    </TouchableOpacity>
                  )
                }}
              />
            )}
          </View>
        </View>
      </Modal>

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
        visible={deleteConfirmVisible}
        title="Delete message?"
        subtitle="This permanently removes the message content for everyone in this conversation."
        options={[
          { label: 'Keep message', value: 'cancel' },
          { label: 'Delete message', value: 'delete', destructive: true },
        ]}
        onSelect={value => {
          if (value === 'delete') confirmDeleteSelectedMessage()
        }}
        onDismiss={() => setDeleteConfirmVisible(false)}
      />

      <RekkusActionSheet
        visible={notice != null}
        title={notice?.title}
        subtitle={notice?.subtitle}
        options={[{ label: 'OK', value: 'ok', accentColor: colors.accent }]}
        onSelect={() => {}}
        onDismiss={() => setNotice(null)}
      />

      {/* Floating reaction overlay — Apple/Instagram style */}
      <Modal
        visible={messageSheet}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => { setMessageSheet(false); setSelectedMessage(null) }}
      >
        {(() => {
          const SCREEN_HEIGHT = Dimensions.get('window').height
          const EMOJI_ROW_H = 56
          const ACTION_ITEM_H = 44
          const actionCardH = messageActions.length * ACTION_ITEM_H
          const emojiRowTop = Math.max(60, longPressY - 90)
          const spaceBelow = SCREEN_HEIGHT - (emojiRowTop + EMOJI_ROW_H)
          const actionCardTop = spaceBelow >= actionCardH + 16
            ? emojiRowTop + EMOJI_ROW_H + 8
            : Math.max(60, emojiRowTop - actionCardH - 8)

          const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥']
          const myReactionEmojis = new Set(
            selectedMessage
              ? (reactions.get(selectedMessage.id) ?? []).filter(r => r.user_id === user?.id).map(r => r.emoji)
              : []
          )

          const ACTION_ICONS: Record<string, React.ReactNode> = {
            reply:   <ReplyIcon size={15} color={colors.text} />,
            copy:    <CopyIcon size={15} color={colors.text} />,
            forward: <ForwardIcon size={15} color={colors.text} />,
            pin:     <PinIcon size={15} color={colors.text} />,
            delete:  <TrashIcon size={15} color={colors.actionDelete} />,
            report:  <InfoIcon size={15} color={colors.warning} />,
          }

          return (
            <>
              {/* Blurred backdrop — frosted glass on iOS, dim overlay on Android */}
              <Animated.View entering={FadeIn.duration(DUR_FAST)} style={StyleSheet.absoluteFill}>
                <BlurView
                  intensity={Platform.OS === 'ios' ? 22 : 0}
                  tint="dark"
                  style={[StyleSheet.absoluteFill, styles.contextBackdrop]}
                />
              </Animated.View>

              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => { setMessageSheet(false); setSelectedMessage(null) }}
              >
                {/* Emoji reaction row — each emoji springs in individually (Instagram stagger) */}
                <View style={[styles.reactionRow, { top: emojiRowTop }]}>
                  {REACTION_EMOJIS.map((emoji, i) => {
                    const selected = myReactionEmojis.has(emoji)
                    return (
                      <Animated.View
                        key={emoji}
                        entering={ZoomIn.springify().damping(11).stiffness(255).delay(i * EMOJI_STAGGER_MS)}
                      >
                        <TouchableOpacity
                          style={[styles.reactionBtn, selected && styles.reactionBtnActive]}
                          onPress={() => {
                            if (selectedMessage) handleReact(selectedMessage.id, emoji)
                            setMessageSheet(false)
                            setSelectedMessage(null)
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.contextReactionEmoji}>{emoji}</Text>
                          {selected ? (
                            <View style={[styles.reactionSelectedDot, { backgroundColor: colors.accent }]} />
                          ) : null}
                        </TouchableOpacity>
                      </Animated.View>
                    )
                  })}
                </View>

                {/* Action card — iOS-style fade + slide-up, no bounce */}
                <Animated.View
                  entering={actionCardEntry}
                  style={[styles.contextActionCard, { top: actionCardTop }]}
                >
                  <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                    {messageActions.map((action, i) => (
                      <React.Fragment key={action.value}>
                        {i > 0 ? <View style={styles.contextActionDivider} /> : null}
                        <TouchableOpacity
                          style={styles.contextActionRow}
                          onPress={() => handleMessageAction(action.value)}
                          activeOpacity={0.65}
                        >
                          <View style={styles.contextActionIcon}>
                            {ACTION_ICONS[action.value] ?? null}
                          </View>
                          <Text style={[
                            styles.contextActionLabel,
                            action.value === 'delete' && { color: colors.actionDelete },
                            action.value === 'report' && { color: colors.warning },
                          ]}>
                            {action.label}
                          </Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    ))}
                  </TouchableOpacity>
                </Animated.View>
              </TouchableOpacity>
            </>
          )
        })()}
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    // Header
    topBar: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[3],
      gap: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border2,
    },
    backBtn: { width: 36, alignItems: 'flex-start', justifyContent: 'center' },
    headerAvatarBtn: { marginRight: spacing[1] },
    headerAvatarContainer: { position: 'relative' },
    headerAvatar: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatarText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    onlineDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: radius.sm,
      backgroundColor: c.success,
      borderWidth: 2,
      borderColor: c.bg,
    },
    titleSkeleton: {
      height: 14,
      width: 100,
      borderRadius: radius.sm2,
      backgroundColor: c.surface2,
    },
    headerText: { flex: 1, minWidth: 0 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
    subtitle: { marginTop: spacing.px1, fontSize: fontSize.bodySm, color: c.text3 },
    searchInput: {
      flex: 1,
      height: 36,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.px14,
      backgroundColor: c.surface,
      color: c.text,
      fontSize: fontSize.md,
    },

    // Pinned banner
    pinnedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    pinnedText: { flex: 1, fontSize: fontSize.bodySm, color: c.text2 },

    // Shared media strip
    mediaStrip: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    mediaStripContent: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      gap: spacing.px6,
      flexDirection: 'row',
      alignItems: 'center',
    },
    mediaThumb: {
      width: 56,
      height: 56,
      borderRadius: radius.sm3,
      overflow: 'hidden',
      position: 'relative',
    },
    mediaThumbImg: { width: 56, height: 56 },
    mediaThumbOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: c.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mediaSeeAll: {
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px6,
      borderRadius: radius.sm3,
      backgroundColor: c.surface,
    },
    mediaSeeAllText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2 },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.px10, paddingHorizontal: spacing.px36 },
    emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text, textAlign: 'center' },
    emptyBody: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center', lineHeight: lineHeight.small },
    messageContent: { flexGrow: 1, paddingHorizontal: spacing.px14, paddingTop: spacing.px10, paddingBottom: spacing.px6, gap: spacing.px2 },
    emptyThread: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.px10, paddingHorizontal: spacing.px36 },

    // Date separator
    dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing[3], gap: spacing[2] },
    dateSeparatorLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border2 },
    dateSeparatorText: { fontSize: fontSize.sm, color: c.text3, paddingHorizontal: spacing[1] },

    // Typing indicator
    typingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px2,
    },
    typingText: { fontSize: fontSize.bodySm, color: c.text3 },

    // Reply bar
    replyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[2],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    replyBarAccent: {
      width: 3,
      alignSelf: 'stretch',
      borderRadius: radius.xxs,
      backgroundColor: c.accent,
    },
    replyBarContent: { flex: 1, minWidth: 0 },
    replyBarLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.accent },
    replyBarText: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px1 },

    // Input area
    inputArea: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.bg,
      paddingVertical: spacing[2],
      paddingBottom: spacing.px10,
    },
    composeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.px6,
      paddingHorizontal: spacing.px10,
    },
    attachBtn: {
      width: 36,
      height: 40,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachBtnActive: {
      backgroundColor: c.surface,
    },
    attachmentTray: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.px14,
      paddingTop: spacing.px2,
      paddingBottom: spacing.px10,
    },
    trayAction: {
      alignItems: 'center',
      gap: spacing.px5,
      minWidth: 64,
    },
    trayIconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.pill2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    trayActionLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.text3,
    },
    gifTrayIcon: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.extrabold,
      color: c.accent,
      letterSpacing: 0,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.px14,
      paddingTop: spacing.px10,
      paddingBottom: spacing.px10,
      backgroundColor: c.surface,
      color: c.text,
      fontSize: fontSize.md,
      lineHeight: lineHeight.body,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnActive: {
      backgroundColor: c.accent,
    },
    sendBtnInactive: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border2,
    },

    // Message rows
    messageRow: { flexDirection: 'column', alignItems: 'flex-start', marginVertical: spacing.px2 },
    messageRowMine: { alignItems: 'flex-end' },
    groupSenderName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text3, marginBottom: spacing.px2, marginLeft: spacing[3] },
    systemRow: { alignItems: 'center', paddingVertical: spacing[1] },
    systemText: { fontSize: fontSize.sm, color: c.text3, fontStyle: 'italic' },

    bubble: { maxWidth: '78%', borderRadius: radius.xl, paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: spacing[1] },
    bubbleMine: { backgroundColor: c.accent },
    bubbleTheirs: { backgroundColor: c.surface },
    bubbleText: { fontSize: fontSize.md, lineHeight: lineHeight.normal, color: c.text },
    bubbleTextMine: { color: c.white },
    bubbleTime: { fontSize: fontSize.xs, color: c.text3, alignSelf: 'flex-end', marginTop: spacing.px2 },
    bubbleTimeMine: { color: 'rgba(255,255,255,0.6)' }, // check:tokens-ignore

    // Reply quote inside bubble
    replyQuote: {
      borderLeftWidth: 2.5,
      borderLeftColor: c.text3,
      paddingLeft: spacing[2],
      marginBottom: spacing[1],
      opacity: 0.75,
    },
    replyQuoteMine: { borderLeftColor: 'rgba(255,255,255,0.6)' }, // check:tokens-ignore
    replyQuoteSender: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.accent, marginBottom: spacing.px1 },
    replyQuoteText: { fontSize: fontSize.bodySm, color: c.text2 },

    // Attachments
    attachmentImage: { width: 200, height: 200, borderRadius: radius.md3 },
    videoThumb: { width: 200, height: 150, borderRadius: radius.md3, overflow: 'hidden', position: 'relative' },
    playOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.overlay,
    },
    playIcon: { fontSize: fontSize['10xl'], color: c.white },
    audioBar: { paddingVertical: spacing[1] },
    locationCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.px10, minWidth: 180 },
    locationIconBg: { width: 38, height: 38, borderRadius: radius.xl2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    locationCardText: { flex: 1, minWidth: 0 },
    locationCardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
    locationCardSub: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px1 },
    shareCard: {
      minWidth: 210,
      maxWidth: 252,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px10,
    },
    shareCardImage: {
      width: 54,
      height: 68,
      borderRadius: radius.sm3,
      backgroundColor: c.surface2,
      flexShrink: 0,
    },
    shareCardText: { flex: 1, minWidth: 0, gap: spacing.px2 },
    shareCardLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold, color: c.text3 },
    shareCardTitle: { fontSize: fontSize.md, lineHeight: lineHeight.small, fontWeight: fontWeight.extrabold, color: c.text },
    shareCardMeta: { fontSize: fontSize.sm, color: c.text3, fontWeight: fontWeight.semibold },
    fileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6 },

    // Floating reaction overlay
    contextBackdrop: {
      backgroundColor: c.overlay,
    },
    reactionRow: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      backgroundColor: c.bg,
      borderRadius: radius.round40,
      paddingVertical: spacing.px6,
      paddingHorizontal: spacing.px6,
      gap: spacing[0],
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 6 },
      elevation: 12,
    },
    reactionBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.pill2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionBtnActive: {
      backgroundColor: c.accent + '22',
    },
    contextReactionEmoji: {
      fontSize: fontSize.iconLg,
    },
    reactionSelectedDot: {
      position: 'absolute',
      bottom: 4,
      width: 6,
      height: 6,
      borderRadius: radius.tiny,
    },
    contextActionCard: {
      position: 'absolute',
      left: 44,
      right: 44,
      backgroundColor: c.bg,
      borderRadius: radius.lg,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 6 },
      elevation: 12,
    },
    contextActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px11,
    },
    contextActionIcon: {
      width: 28,
      alignItems: 'center',
    },
    contextActionLabel: {
      fontSize: fontSize.lg,
      color: c.text,
      fontWeight: fontWeight.regular,
      flex: 1,
    },
    contextActionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginHorizontal: spacing[4],
    },

    // Saved place picker modal
    pickerOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    pickerDismiss: { flex: 1 },
    pickerSheet: { backgroundColor: c.bg, borderTopLeftRadius: radius.pill, borderTopRightRadius: radius.pill, maxHeight: '70%' },
    gifSheet: { backgroundColor: c.bg, borderTopLeftRadius: radius.pill, borderTopRightRadius: radius.pill, height: '68%' },
    pickerHandle: { width: 36, height: 4, borderRadius: radius.xxs, backgroundColor: c.border2, alignSelf: 'center', marginTop: spacing.px10, marginBottom: spacing[2] },
    pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
    pickerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text },
    pickerSubtitle: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    gifSearchWrap: {
      height: 40,
      marginHorizontal: spacing[4],
      marginBottom: spacing[3],
      borderRadius: radius.md3,
      paddingHorizontal: spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: c.surface,
    },
    gifSearchInput: {
      flex: 1,
      fontSize: fontSize.md,
      color: c.text,
      paddingVertical: spacing[0],
    },
    gifGrid: { paddingHorizontal: spacing[3], paddingBottom: spacing.px26, gap: spacing[2] },
    gifGridRow: { gap: spacing[2] },
    gifTile: {
      flex: 1,
      height: 126,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: c.surface,
      marginBottom: spacing[2],
    },
    gifTileImage: { width: '100%', height: '100%' },
    gifState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.px28, paddingVertical: spacing.px36, gap: spacing[2] },
    placeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
    placeRowIcon: { width: 36, height: 36, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
    placeRowText: { flex: 1, minWidth: 0 },
    placeRowName: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.text },
    placeRowAddr: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    forwardEmpty: { alignItems: 'center', paddingHorizontal: spacing.px28, paddingVertical: spacing.px34, gap: spacing[2] },
    forwardRow: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border2,
    },
    forwardAvatar: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    forwardAvatarText: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold },
    forwardText: { flex: 1, minWidth: 0 },
    forwardName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
    forwardMeta: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },

    // Reactions
    reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing.px2, marginLeft: spacing[1] },
    reactionsRowMine: { marginLeft: spacing[0], marginRight: spacing[1] },
    reactionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px3,
      paddingHorizontal: spacing.px7,
      paddingVertical: spacing.px3,
      borderRadius: radius.md3,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    reactionPillActive: { borderColor: c.text, borderWidth: 1.5 },
    reactionEmoji: { fontSize: fontSize.base },
    reactionCount: { fontSize: fontSize.sm, color: c.text3, fontWeight: fontWeight.medium },
  })
}
