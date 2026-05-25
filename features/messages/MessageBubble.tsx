import React, { useMemo } from 'react'
import {
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { MapPinIcon, PaperclipIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import type { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { DirectMessage, MessageReaction } from '@/lib/services/messaging'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function metaString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key]
  return typeof value === 'string' ? value : undefined
}

function metaCoordinate(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

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

export function activeStatusLabel(lastSeenAt: string | null | undefined): string | null {
  if (!lastSeenAt) return null
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  if (diff < 5 * 60 * 1000) return 'Active now'
  const h = Math.floor(diff / 3_600_000)
  if (h < 24) return `Active ${h}h ago`
  return null
}

export function richTypePreview(msg: DirectMessage): string {
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
    case 'system': return metaString(msg.attachment_metadata ?? {}, 'event') ?? 'System'
    default: return msg.body ?? ''
  }
}

export type MessageListItem =
  | { type: 'date_separator'; date: string; id: string }
  | { type: 'message'; message: DirectMessage; id: string }

export function buildMessageItems(messages: DirectMessage[]): MessageListItem[] {
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

// ─── MessageBubble ────────────────────────────────────────────────────────────

export function MessageBubble({
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
          <CachedImage source={{ uri: message.attachment_url }} style={styles.attachmentImage} />
        ) : null

      case 'gif':
        return message.attachment_url ? (
          <CachedImage source={{ uri: message.attachment_url }} style={styles.attachmentImage} contentFit="contain" />
        ) : null

      case 'video':
        return (
          <View style={styles.videoThumb}>
            {message.attachment_url ? (
              <CachedImage source={{ uri: message.attachment_url }} style={styles.attachmentImage} />
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
        const meta = message.attachment_metadata ?? {}
        const lat = metaCoordinate(meta, 'lat')
        const lng = metaCoordinate(meta, 'lng')
        return (
          <TouchableOpacity
            onPress={() => {
              if (lat && lng) {
                const q = `${lat},${lng}`
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
                {metaString(meta, 'label') ?? 'Shared location'}
              </Text>
              <Text style={[styles.locationCardSub, isMine && { color: 'rgba(255,255,255,0.6)' /* check:tokens-ignore */ }]}>
                Tap for directions
              </Text>
            </View>
          </TouchableOpacity>
        )
      }

      case 'post_share': {
        const meta = message.attachment_metadata ?? {}
        const imageUrl = metaString(meta, 'thumbnail_url') ?? metaString(meta, 'image_url')
        const caption = metaString(meta, 'caption')
        const creator = metaString(meta, 'creator')
        const location = metaString(meta, 'location')
        return (
          <TouchableOpacity
            style={styles.shareCard}
            onPress={() => onPressPostShare?.(meta)}
            activeOpacity={0.75}
          >
            {imageUrl ? (
              <CachedImage
                source={{ uri: imageUrl }}
                style={styles.shareCardImage}
              />
            ) : null}
            <View style={styles.shareCardText}>
              <Text style={[styles.shareCardLabel, isMine && { color: 'rgba(255,255,255,0.62)' /* check:tokens-ignore */ }]}>Post</Text>
              {caption ? (
                <Text style={[styles.shareCardTitle, isMine && { color: colors.white }]} numberOfLines={2}>
                  {caption}
                </Text>
              ) : null}
              <Text style={[styles.shareCardMeta, isMine && { color: 'rgba(255,255,255,0.65)' /* check:tokens-ignore */ }]} numberOfLines={1}>
                {[creator ? `@${creator}` : null, location].filter(Boolean).join(' · ') || 'View in Rekkus'}
              </Text>
            </View>
          </TouchableOpacity>
        )
      }

      case 'place_share': {
        const meta = message.attachment_metadata ?? {}
        const name = metaString(meta, 'name')
        const address = metaString(meta, 'address')
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
              {name ? (
                <Text style={[styles.locationCardTitle, isMine && { color: colors.white }]} numberOfLines={1}>
                  {name}
                </Text>
              ) : null}
              {address ? (
                <Text style={[styles.locationCardSub, isMine && { color: 'rgba(255,255,255,0.6)' /* check:tokens-ignore */ }]} numberOfLines={1}>
                  {address}
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
        const meta = message.attachment_metadata ?? {}
        return (
          <View style={styles.fileCard}>
            <PaperclipIcon size={16} color={isMine ? colors.bg : colors.text2} />
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{metaString(meta, 'filename') ?? 'File'}</Text>
          </View>
        )
      }

      case 'system': {
        const meta = message.attachment_metadata ?? {}
        const event = metaString(meta, 'event') ?? ''
        let systemText = ''
        if (event === 'group_created') systemText = `Group created: ${metaString(meta, 'name') ?? ''}`
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

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
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
    replyQuote: { borderLeftWidth: 2.5, borderLeftColor: c.text3, paddingLeft: spacing[2], marginBottom: spacing[1], opacity: 0.75 },
    replyQuoteMine: { borderLeftColor: 'rgba(255,255,255,0.6)' }, // check:tokens-ignore
    replyQuoteSender: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.accent, marginBottom: spacing.px1 },
    replyQuoteText: { fontSize: fontSize.bodySm, color: c.text2 },
    attachmentImage: { width: 200, height: 200, borderRadius: radius.md3 },
    videoThumb: { width: 200, height: 150, borderRadius: radius.md3, overflow: 'hidden', position: 'relative' },
    playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: c.overlay },
    playIcon: { fontSize: fontSize['10xl'], color: c.white },
    audioBar: { paddingVertical: spacing[1] },
    locationCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.px10, minWidth: 180 },
    locationIconBg: { width: 38, height: 38, borderRadius: radius.xl2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    locationCardText: { flex: 1, minWidth: 0 },
    locationCardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
    locationCardSub: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px1 },
    shareCard: { minWidth: 210, maxWidth: 252, flexDirection: 'row', alignItems: 'center', gap: spacing.px10 },
    shareCardImage: { width: 54, height: 68, borderRadius: radius.sm3, backgroundColor: c.surface2, flexShrink: 0 },
    shareCardText: { flex: 1, minWidth: 0, gap: spacing.px2 },
    shareCardLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold, color: c.text3 },
    shareCardTitle: { fontSize: fontSize.md, lineHeight: lineHeight.small, fontWeight: fontWeight.extrabold, color: c.text },
    shareCardMeta: { fontSize: fontSize.sm, color: c.text3, fontWeight: fontWeight.semibold },
    fileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6 },
    reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing.px2, marginLeft: spacing[1] },
    reactionsRowMine: { marginLeft: spacing[0], marginRight: spacing[1] },
    reactionPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.px3, paddingHorizontal: spacing.px7, paddingVertical: spacing.px3, borderRadius: radius.md3, backgroundColor: c.surface, borderWidth: 0.5, borderColor: c.border },
    reactionPillActive: { borderColor: c.text, borderWidth: 1.5 },
    reactionEmoji: { fontSize: fontSize.base },
    reactionCount: { fontSize: fontSize.sm, color: c.text3, fontWeight: fontWeight.medium },
  })
}
