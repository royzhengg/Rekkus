import { BlurView } from 'expo-blur'
import * as Clipboard from 'expo-clipboard'
import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn, ZoomIn, Keyframe  } from 'react-native-reanimated'
import {
  CloseIcon,
  CopyIcon,
  ForwardIcon,
  InfoIcon,
  MessageIcon,
  PinIcon,
  ReplyIcon,
  TrashIcon,
} from '@/components/icons'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { elevation } from '@/constants/Elevation'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { EMOJI_STAGGER_MS, DUR_FAST } from '@/lib/animations'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import type { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import {
  deleteMessage,
  pinMessage,
  forwardMessage,
  fetchDirectConversations,
  type DirectMessage,
  type MessageReaction,
  type ConversationSummary,
  type ConversationParticipant,
} from '@/lib/services/messaging'
import { submitContentReport as submitReport } from '@/lib/services/moderation'
import { avatarPalette } from '@/lib/utils/format'

// iOS-style action card entrance: fade + subtle upward translate, no overshoot
const actionCardEntry = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: 8 }, { scale: 0.97 }] },
  to:   { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(200).delay(90)

export type MessageActionsHandle = {
  open: (msg: DirectMessage, pageY: number) => void
}

interface MessageActionsProps {
  conversationId: string
  currentUserId: string
  isGroup: boolean
  participants: ConversationParticipant[]
  reactions: Map<string, MessageReaction[]>
  colors: ReturnType<typeof useThemeColors>
  onReply: (msg: DirectMessage) => void
  onReact: (msgId: string, emoji: string) => void
  onMessageDeleted: (msgId: string) => void
  onMessagePinned: (msg: DirectMessage | null) => void
  onShowNotice: (notice: { title: string; subtitle?: string }) => void
  onShowError: (error: { title: string; message: string }) => void
}

export const MessageActions = forwardRef<MessageActionsHandle, MessageActionsProps>(function MessageActions(
  { conversationId, currentUserId, reactions, colors, onReply, onReact, onMessageDeleted, onMessagePinned, onShowNotice, onShowError },
  ref
) {
  const { requireOnline, runDeferredMutation } = useConnectivity()
  const { showToast } = useToast()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const reduceMotion = useReducedMotion()
  const [messageSheet, setMessageSheet] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<DirectMessage | null>(null)
  const [longPressY, setLongPressY] = useState(Dimensions.get('window').height / 2)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [forwardPickerVisible, setForwardPickerVisible] = useState(false)
  const [forwardSourceMessage, setForwardSourceMessage] = useState<DirectMessage | null>(null)
  const [forwardTargets, setForwardTargets] = useState<ConversationSummary[]>([])
  const [loadingForwardTargets, setLoadingForwardTargets] = useState(false)
  const [forwardingConversationId, setForwardingConversationId] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    open: (msg: DirectMessage, pageY: number) => {
      setSelectedMessage(msg)
      setLongPressY(pageY)
      setMessageSheet(true)
    },
  }))

  const messageActions = useMemo(() => {
    if (!selectedMessage) return []
    const isMine = selectedMessage.sender_id === currentUserId
    const actions: { label: string; value: string }[] = [
      { label: 'Reply', value: 'reply' },
    ]
    if (selectedMessage.body) actions.push({ label: 'Copy', value: 'copy' })
    actions.push({ label: 'Forward', value: 'forward' })
    actions.push({ label: 'Pin', value: 'pin' })
    if (isMine) actions.push({ label: 'Delete', value: 'delete' })
    else actions.push({ label: 'Report', value: 'report' })
    return actions
  }, [selectedMessage, currentUserId])

  async function handleMessageAction(value: string) {
    setMessageSheet(false)
    if (!selectedMessage) return

    if (value === 'reply') {
      onReply(selectedMessage)
    } else if (value.startsWith('react_')) {
      const emoji = value.slice(6)
      const myReactions = reactions.get(selectedMessage.id)?.filter(r => r.user_id === currentUserId) ?? []
      const existingWithEmoji = myReactions.find(r => r.emoji === emoji)
      await runDeferredMutation({ kind: 'message_reaction', messageId: selectedMessage.id, emoji, targetState: !existingWithEmoji })
    } else if (value === 'delete' && selectedMessage.sender_id === currentUserId) {
      setDeleteConfirmVisible(true)
      return
    } else if (value === 'copy' && selectedMessage.body) {
      await Clipboard.setStringAsync(selectedMessage.body)
      showToast('Copied to clipboard')
    } else if (value === 'forward') {
      if (!requireOnline()) {
        onShowError({ title: 'You are offline', message: 'Reconnect to forward this message.' })
        return
      }
      setForwardSourceMessage(selectedMessage)
      setLoadingForwardTargets(true)
      setForwardPickerVisible(true)
      try {
        const conversations = await fetchDirectConversations(currentUserId)
        setForwardTargets(conversations.filter(item => item.id !== conversationId))
      } catch {
        setForwardTargets([])
      } finally {
        setLoadingForwardTargets(false)
      }
      return
    } else if (value === 'pin') {
      if (!requireOnline()) {
        onShowError({ title: 'You are offline', message: 'Reconnect to pin this message.' })
        return
      }
      await pinMessage(selectedMessage.id)
      onMessagePinned(selectedMessage)
    } else if (value === 'report') {
      if (!requireOnline()) {
        onShowError({ title: 'You are offline', message: 'Reconnect to report this message.' })
        return
      }
      const reportError = await submitReport({
        reporterId: currentUserId,
        targetType: 'message',
        targetId: selectedMessage.id,
        reason: 'message_or_profile_issue',
        sourceSurface: 'message_thread',
      })
      if (reportError) onShowError({ title: 'Report failed', message: reportError })
      else onShowNotice({ title: 'Report received', subtitle: 'Thanks. We will review this message.' })
    }
    setSelectedMessage(null)
  }

  async function confirmDeleteSelectedMessage() {
    if (!selectedMessage) return
    if (!requireOnline()) {
      onShowError({ title: 'You are offline', message: 'Reconnect to delete this message.' })
      return
    }
    const messageToDelete = selectedMessage
    const { error: delError } = await deleteMessage(messageToDelete.id)
    if (delError) {
      onShowError({ title: 'Could not delete message', message: delError })
      return
    }
    onMessageDeleted(messageToDelete.id)
    setSelectedMessage(null)
  }

  async function handleForwardToConversation(targetConversationId: string) {
    if (!forwardSourceMessage) return
    if (!requireOnline()) {
      onShowError({ title: 'You are offline', message: 'Reconnect to forward this message.' })
      return
    }
    setForwardingConversationId(targetConversationId)
    const { error } = await forwardMessage(forwardSourceMessage.id, targetConversationId, currentUserId)
    setForwardingConversationId(null)
    setForwardPickerVisible(false)
    if (error) {
      onShowError({ title: 'Could not forward', message: error })
      return
    }
    setForwardSourceMessage(null)
    onShowNotice({ title: 'Message forwarded', subtitle: 'Sent to the selected conversation.' })
  }

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
      {/* Floating reaction overlay */}
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
              ? (reactions.get(selectedMessage.id) ?? []).filter(r => r.user_id === currentUserId).map(r => r.emoji)
              : []
          )

          return (
            <>
              <Animated.View {...(!reduceMotion ? { entering: FadeIn.duration(DUR_FAST) } : {})} style={StyleSheet.absoluteFill}>
                {Platform.OS === 'ios' ? (
                  <BlurView
                    intensity={22}
                    tint="dark"
                    style={[StyleSheet.absoluteFill, styles.contextBackdrop]}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.contextBackdrop]} />
                )}
              </Animated.View>

              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => { setMessageSheet(false); setSelectedMessage(null) }}
              >
                <View style={[styles.reactionRow, { top: emojiRowTop }]}>
                  {REACTION_EMOJIS.map((emoji, i) => {
                    const selected = myReactionEmojis.has(emoji)
                    return (
                      <Animated.View
                        key={emoji}
                        {...(!reduceMotion ? { entering: ZoomIn.springify().damping(11).stiffness(255).delay(i * EMOJI_STAGGER_MS) } : {})}
                      >
                        <TouchableOpacity
                          style={[styles.reactionBtn, selected && styles.reactionBtnActive]}
                          onPress={() => {
                            if (selectedMessage) onReact(selectedMessage.id, emoji)
                            setMessageSheet(false)
                            setSelectedMessage(null)
                          }}
                          activeOpacity={0.7}
                          accessibilityRole="button"
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

                <Animated.View
                  {...(!reduceMotion ? { entering: actionCardEntry } : {})}
                  style={[styles.contextActionCard, { top: actionCardTop }]}
                >
                  <TouchableOpacity activeOpacity={1} onPress={() => {}} accessibilityRole="button" accessibilityLabel="Message actions">
                    {messageActions.map((action, i) => (
                      <React.Fragment key={action.value}>
                        {i > 0 ? <View style={styles.contextActionDivider} /> : null}
                        <TouchableOpacity
                          style={styles.contextActionRow}
                          onPress={() => handleMessageAction(action.value)}
                          activeOpacity={0.65}
                          accessibilityRole="button"
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

      {/* Delete confirm sheet */}
      <RekkusActionSheet
        visible={deleteConfirmVisible}
        title="Delete message?"
        subtitle="This permanently removes the message content for everyone in this conversation."
        options={[
          { label: 'Keep message', value: 'cancel' },
          { label: 'Delete message', value: 'delete', destructive: true },
        ]}
        onSelect={value => {
          if (value === 'delete') void confirmDeleteSelectedMessage()
        }}
        onDismiss={() => setDeleteConfirmVisible(false)}
      />

      {/* Forward conversation picker */}
      <Modal
        visible={forwardPickerVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
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
              <TouchableOpacity
                onPress={() => setForwardPickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close forward picker"
              >
                <CloseIcon size={18} color={colors.text3} />
              </TouchableOpacity>
            </View>
            {loadingForwardTargets ? (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <View key={i} style={styles.skeletonRow}>
                    <Skeleton width={40} height={40} radius={radius.full} />
                    <View style={{ flex: 1, gap: spacing[2] }}>
                      <Skeleton width="60%" height={14} />
                      <Skeleton width="40%" height={12} />
                    </View>
                  </View>
                ))}
              </>
            ) : forwardTargets.length === 0 ? (
              <View style={styles.forwardEmpty}>
                <MessageIcon size={24} color={colors.text3} />
                <Text style={styles.forwardEmptyTitle}>No conversations yet</Text>
                <Text style={styles.forwardEmptyBody}>Start a conversation first, then forward messages here.</Text>
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
    </>
  )
})

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    contextBackdrop: { backgroundColor: c.overlay },
    reactionRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'center', backgroundColor: c.bg, borderRadius: radius.round40, paddingVertical: spacing.px6, paddingHorizontal: spacing.px6, gap: spacing[0], ...elevation.lg },
    reactionBtn: { width: 44, height: 44, borderRadius: radius.pill2, alignItems: 'center', justifyContent: 'center' },
    reactionBtnActive: { backgroundColor: c.accent + '22' },
    contextReactionEmoji: { fontSize: fontSize.iconLg },
    reactionSelectedDot: { position: 'absolute', bottom: 4, width: 6, height: 6, borderRadius: radius.tiny },
    contextActionCard: { position: 'absolute', left: 44, right: 44, backgroundColor: c.bg, borderRadius: radius.lg, overflow: 'hidden', ...elevation.lg },
    contextActionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing.px11 },
    contextActionIcon: { width: 28, alignItems: 'center' },
    contextActionLabel: { fontSize: fontSize.lg, color: c.text, fontWeight: fontWeight.regular, flex: 1 },
    contextActionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginHorizontal: spacing[4] },
    pickerOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    pickerDismiss: { flex: 1 },
    pickerSheet: { backgroundColor: c.bg, borderTopLeftRadius: radius.pill, borderTopRightRadius: radius.pill, maxHeight: '70%' },
    pickerHandle: { width: 36, height: 4, borderRadius: radius.xxs, backgroundColor: c.border2, alignSelf: 'center', marginTop: spacing.px10, marginBottom: spacing[2] },
    pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
    pickerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text },
    pickerSubtitle: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    forwardEmpty: { alignItems: 'center', paddingHorizontal: spacing.px28, paddingVertical: spacing.px34, gap: spacing[2] },
    forwardEmptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text, textAlign: 'center' },
    forwardEmptyBody: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center' },
    forwardRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing.px10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border2 },
    forwardAvatar: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    forwardAvatarText: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold },
    forwardText: { flex: 1, minWidth: 0 },
    forwardName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
    forwardMeta: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  })
}
