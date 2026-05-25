import { useRouter } from 'expo-router'
import React, { useCallback, useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { CloseIcon, MessageIcon, PinIcon, VideoIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Skeleton } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import type { useThemeColors } from '@/lib/contexts/ThemeContext'
import { routes } from '@/lib/routes'
import type { DirectMessage, MessageReaction } from '@/lib/services/messaging'
import { MessageBubble, buildMessageItems, richTypePreview, type MessageListItem } from './MessageBubble'
import { TypingDots } from './TypingDots'
import type { MutableRefObject, RefObject} from 'react';

interface MessageListProps {
  messages: DirectMessage[]
  searchResults: DirectMessage[]
  searchMode: boolean
  searchQuery: string
  listRef: RefObject<FlatList | null>
  isAtBottom: MutableRefObject<boolean>
  reactions: Map<string, MessageReaction[]>
  currentUserId: string
  colors: ReturnType<typeof useThemeColors>
  isGroup: boolean
  revealedTimeId: string | null
  replyingTo: DirectMessage | null
  typingUsernames: string[]
  loading: boolean
  error: string | null
  searching: boolean
  pinnedMessage: DirectMessage | null
  sharedMedia: DirectMessage[]
  conversationId: string
  onUnpin: () => void
  onLongPressMessage: (msg: DirectMessage, pageY: number) => void
  onReact: (msgId: string, emoji: string) => void
  onReply: (msg: DirectMessage) => void
  onRevealTime: (id: string | null) => void
  onPressPlaceShare: (meta: Record<string, unknown>) => void
  onPressPostShare: (meta: Record<string, unknown>) => void
  getSenderName: (senderId: string) => string
  scrollToEnd: () => void
}

export function MessageList({
  messages,
  searchResults,
  searchMode,
  searchQuery,
  listRef,
  isAtBottom,
  reactions,
  currentUserId,
  colors,
  isGroup,
  revealedTimeId,
  replyingTo: _replyingTo,
  typingUsernames,
  loading,
  error,
  searching,
  pinnedMessage,
  sharedMedia,
  conversationId,
  onUnpin,
  onLongPressMessage,
  onReact,
  onReply,
  onRevealTime,
  onPressPlaceShare,
  onPressPostShare,
  getSenderName,
  scrollToEnd,
}: MessageListProps) {
  const router = useRouter()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const reactionsByMessage = useCallback(
    (messageId: string) => reactions.get(messageId) ?? [],
    [reactions]
  )

  const listData = useMemo(() => buildMessageItems(messages), [messages])

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
      const isMine = message.sender_id === currentUserId
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
          currentUserId={currentUserId}
          colors={colors}
          onLongPress={(msg, y) => onLongPressMessage(msg, y)}
          onReact={onReact}
          onReply={msg => onReply(msg)}
          replyContext={replyCtx}
          showTime={revealedTimeId === message.id}
          onPress={() => onRevealTime(revealedTimeId === message.id ? null : message.id)}
          getSenderName={getSenderName}
          isGroup={isGroup}
          showSenderName={showSenderName}
          onPressPlaceShare={onPressPlaceShare}
          onPressPostShare={onPressPostShare}
        />
      )
    },
    [messages, listData, currentUserId, reactionsByMessage, colors, styles, revealedTimeId, getSenderName, isGroup, onLongPressMessage, onReact, onReply, onRevealTime, onPressPlaceShare, onPressPostShare]
  )

  return (
    <>
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
          <TouchableOpacity
            onPress={onUnpin}
            accessibilityRole="button"
            accessibilityLabel="Unpin message"
          >
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
                onPress={() => router.push(routes.conversationInfo(conversationId))}
              >
                {m.attachment_url ? (
                  <CachedImage source={{ uri: m.attachment_url }} style={styles.mediaThumbImg} />
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
              onPress={() => router.push(routes.conversationInfo(conversationId))}
            >
              <Text style={styles.mediaSeeAllText}>See all</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.skeletonMessages}>
          <View style={styles.skeletonRow}>
            <Skeleton width={32} height={32} radius={radius.full} />
            <Skeleton width="55%" height={40} radius={radius.md} />
          </View>
          <View style={[styles.skeletonRow, { justifyContent: 'flex-end' }]}>
            <Skeleton width="65%" height={32} radius={radius.md} />
          </View>
          <View style={styles.skeletonRow}>
            <Skeleton width={32} height={32} radius={radius.full} />
            <Skeleton width="45%" height={52} radius={radius.md} />
          </View>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ErrorMessage title="Could not open conversation" message={error} />
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
                const isMine = message.sender_id === currentUserId
                return (
                  <MessageBubble
                    message={message}
                    isMine={isMine}
                    reactions={reactionsByMessage(message.id)}
                    currentUserId={currentUserId}
                    colors={colors}
                    onLongPress={(msg, y) => onLongPressMessage(msg, y)}
                    onReact={onReact}
                    onReply={msg => onReply(msg)}
                    replyContext={null}
                    showTime={revealedTimeId === message.id}
                    onPress={() => onRevealTime(revealedTimeId === message.id ? null : message.id)}
                    getSenderName={getSenderName}
                    onPressPlaceShare={onPressPlaceShare}
                    onPressPostShare={onPressPostShare}
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
        </>
      )}
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.px10, paddingHorizontal: spacing.px36 },
    emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text, textAlign: 'center' },
    emptyBody: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center' },
    messageContent: { flexGrow: 1, paddingHorizontal: spacing.px14, paddingTop: spacing.px10, paddingBottom: spacing.px6, gap: spacing.px2 },
    emptyThread: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.px10, paddingHorizontal: spacing.px36 },
    dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing[3], gap: spacing[2] },
    dateSeparatorLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border2 },
    dateSeparatorText: { fontSize: fontSize.sm, color: c.text3, paddingHorizontal: spacing[1] },
    typingBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.px6, paddingHorizontal: spacing[4], paddingVertical: spacing.px2 },
    typingText: { fontSize: fontSize.bodySm, color: c.text3 },
    pinnedBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing.px14, paddingVertical: spacing[2], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, backgroundColor: c.surface },
    pinnedText: { flex: 1, fontSize: fontSize.bodySm, color: c.text2 },
    mediaStrip: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    mediaStripContent: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: spacing.px6, flexDirection: 'row', alignItems: 'center' },
    mediaThumb: { width: 56, height: 56, borderRadius: radius.sm3, overflow: 'hidden', position: 'relative' },
    mediaThumbImg: { width: 56, height: 56 },
    mediaThumbOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center' },
    mediaSeeAll: { paddingHorizontal: spacing.px10, paddingVertical: spacing.px6, borderRadius: radius.sm3, backgroundColor: c.surface },
    mediaSeeAllText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2 },
    skeletonMessages: { flex: 1, paddingTop: spacing[4] },
    skeletonRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing[4], paddingVertical: spacing[2], gap: spacing[3] },
  })
}
