import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, CloseIcon, UsersIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { routes } from '@/lib/routes'
import {
  fetchConversationAllParticipants,
  fetchConversationMeta,
  fetchMyParticipantPrefs,
  fetchSharedMedia,
  fetchPinnedMessages,
  leaveGroup,
  deleteDirectConversation,
  MUTE_DURATIONS_MS,
  removeGroupMember,
  promoteToAdmin,
  unpinMessage,
  type ConversationParticipant,
  type DirectMessage,
  type PinnedMessage,
  type MuteDuration,
} from '@/lib/services/messaging'
import { blockUser, submitContentReport } from '@/lib/services/moderation'
import { avatarPalette } from '@/lib/utils/format'
import { makeStyles } from './ConversationInfoScreen.styles'

type Tab = 'members' | 'media' | 'pinned'

export default function ConversationInfoScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { requireOnline, runDeferredMutation, syncEpoch } = useConnectivity()
  const { showToast } = useToast()
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [tab, setTab] = useState<Tab>('members')
  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState<ConversationParticipant[]>([])
  const [sharedMedia, setSharedMedia] = useState<DirectMessage[]>([])
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([])
  const [isGroup, setIsGroup] = useState(false)
  const [conversationName, setConversationName] = useState<string | null>(null)
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null)
  const [myParticipant, setMyParticipant] = useState<ConversationParticipant | null>(null)
  const [muteSheet, setMuteSheet] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [operationError, setOperationError] = useState<{ title: string; message: string } | null>(null)

  const isAdmin = myParticipant?.is_admin ?? false
  const otherParticipant = !isGroup ? participants.find(p => p.user_id !== user?.id) ?? null : null

  const load = useCallback(async () => {
    if (!conversationId || !user) return
    setLoading(true)
    setOperationError(null)
    try {
      const [allParticipants, media, pinned] = await Promise.all([
        fetchConversationAllParticipants(conversationId),
        fetchSharedMedia(conversationId),
        fetchPinnedMessages(conversationId),
      ])

      const [convRow, myRow] = await Promise.all([
        fetchConversationMeta(conversationId),
        fetchMyParticipantPrefs(conversationId, user.id),
      ])

      setIsGroup(convRow?.conversation_type === 'group')
      setConversationName(convRow?.name ?? null)
      setGroupAvatar(convRow?.avatar_url ?? null)
      setParticipants(allParticipants)
      setSharedMedia(media)
      setPinnedMessages(pinned)
      setMyParticipant(allParticipants.find(p => p.user_id === user.id) ?? null)
      setIsMuted(myRow?.muted_until ? new Date(myRow.muted_until) > new Date() : false)
      setIsPinned(!!myRow?.pinned_at)
    } finally {
      setLoading(false)
    }
  }, [conversationId, user])

  useEffect(() => { void load() }, [load])

  // Re-fetch prefs after offline queue flush
  useEffect(() => { if (syncEpoch > 0) void load() }, [syncEpoch, load])

  async function handleMute(duration: MuteDuration) {
    if (!conversationId || !user) return
    setMuteSheet(false)
    const mutedUntil = new Date(Date.now() + MUTE_DURATIONS_MS[duration]).toISOString()
    setIsMuted(true)
    await runDeferredMutation({ kind: 'conversation_mute', conversationId, mutedUntil })
    showToast('Conversation muted')
  }

  async function handleUnmute() {
    if (!conversationId || !user) return
    setIsMuted(false)
    await runDeferredMutation({ kind: 'conversation_unmute', conversationId })
  }

  async function handleTogglePin() {
    if (!conversationId || !user) return
    const nowPinned = !isPinned
    setIsPinned(nowPinned)
    await runDeferredMutation(nowPinned
      ? { kind: 'conversation_pin', conversationId }
      : { kind: 'conversation_unpin', conversationId }
    )
  }

  async function handleMarkUnread() {
    if (!conversationId || !user) return
    await runDeferredMutation({ kind: 'conversation_unread', conversationId })
    router.back()
  }

  async function handleArchive() {
    if (!conversationId || !user) return
    Alert.alert('Archive conversation', 'This will hide the conversation from your inbox.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: () => { void (async () => {
          await runDeferredMutation({ kind: 'conversation_archive', conversationId })
          router.push('/messages')
        })() },
      },
    ])
  }

  async function handleLeaveGroup() {
    if (!conversationId) return
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to leave this group.' })
      return
    }
    Alert.alert('Leave group', 'You will no longer receive messages from this group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => { void (async () => {
          const { error } = await leaveGroup(conversationId)
          if (error) setOperationError({ title: 'Could not leave group', message: error })
          else router.push('/messages')
        })() },
      },
    ])
  }

  async function handleDeleteConversation() {
    if (!conversationId || !user) return
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to delete this conversation.' })
      return
    }
    Alert.alert('Delete conversation', 'This will remove the conversation from your inbox.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { void (async () => {
          await deleteDirectConversation(conversationId, user.id)
          router.push('/messages')
        })() },
      },
    ])
  }

  async function handleRemoveMember(participant: ConversationParticipant) {
    if (!conversationId) return
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to manage group members.' })
      return
    }
    Alert.alert('Remove member', `Remove @${participant.username} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => { void (async () => {
          const { error } = await removeGroupMember(conversationId, participant.user_id)
          if (error) setOperationError({ title: 'Could not remove member', message: error })
          else setParticipants(prev => prev.filter(p => p.user_id !== participant.user_id))
        })() },
      },
    ])
  }

  async function handlePromoteAdmin(participant: ConversationParticipant) {
    if (!conversationId) return
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to manage group members.' })
      return
    }
    const { error } = await promoteToAdmin(conversationId, participant.user_id)
    if (error) setOperationError({ title: 'Could not promote member', message: error })
    else {
      setParticipants(prev =>
        prev.map(p => p.user_id === participant.user_id ? { ...p, is_admin: true } : p)
      )
    }
  }

  async function handleReportUser(participant: ConversationParticipant) {
    if (!user) return
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to report this account.' })
      return
    }
    const reportError = await submitContentReport({
      reporterId: user.id,
      targetType: 'user',
      targetId: participant.user_id,
      reason: 'message_or_profile_issue',
      sourceSurface: 'message_thread',
    })
    if (reportError) setOperationError({ title: 'Report failed', message: reportError })
    else showToast('Report received')
  }

  async function handleBlockUser(participant: ConversationParticipant) {
    if (!user) return
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to block this account.' })
      return
    }
    Alert.alert('Block user', `Block @${participant.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => { void (async () => {
          const error = await blockUser(user.id, participant.user_id, 'messaging')
          if (error) setOperationError({ title: 'Block failed', message: error })
          else router.push('/messages')
        })() },
      },
    ])
  }

  async function handleUnpinMessage(pinned: PinnedMessage) {
    if (!requireOnline()) {
      setOperationError({ title: 'You are offline', message: 'Reconnect to unpin this message.' })
      return
    }
    const { error } = await unpinMessage(pinned.message_id)
    if (!error) {
      setPinnedMessages(prev => prev.filter(p => p.message_id !== pinned.message_id))
    }
  }

  function renderMember(p: ConversationParticipant) {
    const isSelf = p.user_id === user?.id
    return (
      <TouchableOpacity
        key={p.user_id}
        style={styles.memberRow}
        onLongPress={() => {
          if (isSelf || !isAdmin) return
          Alert.alert(`@${p.username}`, undefined, [
            { text: 'Promote to admin', onPress: () => { void handlePromoteAdmin(p) } },
            { text: 'Remove from group', style: 'destructive', onPress: () => { void handleRemoveMember(p) } },
            { text: 'Cancel', style: 'cancel' },
          ])
        }}
        onPress={() => router.push(routes.userProfile(p.username))}
      >
        {p.avatar_url ? (
          <CachedImage source={{ uri: p.avatar_url }} style={styles.memberAvatar} />
        ) : (
          <View style={[styles.memberAvatar, { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: colors.text3 }}>{(p.full_name ?? p.username).charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.memberText}>
          <Text style={styles.memberName}>{p.full_name ?? `@${p.username}`}</Text>
          <Text style={styles.memberUsername}>@{p.username}</Text>
        </View>
        {p.is_admin ? <Text style={styles.adminBadge}>Admin</Text> : null}
        {isSelf ? <Text style={styles.youBadge}>You</Text> : null}
        {!isSelf && !isGroup ? (
          <TouchableOpacity
            style={styles.memberAction}
            onPress={() => {
              Alert.alert(`@${p.username}`, undefined, [
                { text: 'Report', onPress: () => { void handleReportUser(p) } },
                { text: 'Block', style: 'destructive', onPress: () => { void handleBlockUser(p) } },
                { text: 'Cancel', style: 'cancel' },
              ])
            }}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Text style={styles.memberActionLabel}>•••</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    )
  }

  function renderMediaItem({ item }: { item: DirectMessage }) {
    return (
      <TouchableOpacity style={styles.mediaThumb} activeOpacity={0.8}>
        {item.attachment_url ? (
          <CachedImage source={{ uri: item.attachment_url }} style={styles.mediaThumbImage} />
        ) : (
          <View style={[styles.mediaThumbImage, styles.mediaThumbFallback]}>
            <Text style={{ fontSize: fontSize['4xl'] }}>{item.message_type === 'video' ? '🎥' : '🖼'}</Text>
          </View>
        )}
        {item.message_type === 'video' ? (
          <View style={styles.videoOverlay}>
            <Text style={styles.videoOverlayIcon}>▶</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    )
  }

  function renderPinnedItem({ item }: { item: PinnedMessage }) {
    const msg = item.message
    const preview = msg
      ? (msg.body ?? (msg.message_type === 'image' ? '📷 Photo' : msg.message_type === 'video' ? '🎥 Video' : ''))
      : 'Message unavailable'

    return (
      <View style={styles.pinnedRow}>
        <View style={styles.pinnedContent}>
          <Text style={styles.pinnedPreview} numberOfLines={2}>{preview}</Text>
          <Text style={styles.pinnedDate}>
            {new Date(item.pinned_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.unpinBtn}
          onPress={() => handleUnpinMessage(item)}
          accessibilityRole="button"
          accessibilityLabel="Unpin message"
        >
          <CloseIcon size={16} color={colors.text3} />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>Info</Text>
        <View style={{ width: 36 }} />
      </View>
      {operationError ? (
        <ErrorMessage title={operationError.title} message={operationError.message} style={{ marginHorizontal: spacing[4] }} />
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <Skeleton width={80} height={80} radius={40} />
          <SkeletonText lines={3} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Profile / group header */}
          {(() => {
            if (isGroup) {
              const palette = avatarPalette(conversationName ?? 'G')
              return (
                <View style={styles.profileHeader}>
                  {groupAvatar ? (
                    <CachedImage source={{ uri: groupAvatar }} style={styles.profileAvatar} />
                  ) : (
                    <View style={[styles.profileAvatar, { backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }]}>
                      <UsersIcon size={36} color={palette.color} />
                    </View>
                  )}
                  <Text style={styles.profileName}>{conversationName ?? 'Group'}</Text>
                  <Text style={styles.profileSub}>{participants.length} members</Text>
                </View>
              )
            }
            const other = otherParticipant
            if (!other) return null
            const palette = avatarPalette(other.username)
            const displayName = other.full_name ?? `@${other.username}`
            return (
              <View style={styles.profileHeader}>
                {other.avatar_url ? (
                  <CachedImage source={{ uri: other.avatar_url }} style={styles.profileAvatar} />
                ) : (
                  <View style={[styles.profileAvatar, { backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={[styles.profileAvatarText, { color: palette.color }]}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileSub}>@{other.username}</Text>
              </View>
            )
          })()}

          {/* Tabs */}
          <View style={styles.tabs} accessibilityRole="tablist">
            {(['members', 'media', 'pinned'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, tab === t && styles.tabActive]}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
              >
                <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                  {t === 'members' ? 'Members' : t === 'media' ? 'Media' : 'Pinned'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          {tab === 'members' ? (
            <View style={styles.section}>
              {participants.map(p => renderMember(p))}
            </View>
          ) : tab === 'media' ? (
            sharedMedia.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyLabel}>No photos or videos yet</Text>
              </View>
            ) : (
              <View style={styles.mediaGrid}>
                {sharedMedia.map(item => renderMediaItem({ item }))}
              </View>
            )
          ) : (
            pinnedMessages.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyLabel}>No pinned messages</Text>
              </View>
            ) : (
              <View style={styles.section}>
                {pinnedMessages.map(item => (
                  <View key={item.id}>{renderPinnedItem({ item })}</View>
                ))}
              </View>
            )
          )}

          {/* Chat management actions */}
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.actionRow} onPress={handleTogglePin} accessibilityRole="button">
              <Text style={styles.actionLabel}>{isPinned ? 'Unpin conversation' : 'Pin conversation'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={isMuted ? handleUnmute : () => setMuteSheet(true)}
              accessibilityRole="button"
            >
              <Text style={styles.actionLabel}>{isMuted ? 'Unmute notifications' : 'Mute notifications'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={handleMarkUnread} accessibilityRole="button">
              <Text style={styles.actionLabel}>Mark as unread</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={handleArchive} accessibilityRole="button">
              <Text style={styles.actionLabel}>Archive conversation</Text>
            </TouchableOpacity>

            {isGroup ? (
              <TouchableOpacity style={[styles.actionRow, styles.actionRowDestructive]} onPress={handleLeaveGroup} accessibilityRole="button">
                <Text style={[styles.actionLabel, styles.actionLabelDestructive]}>Leave group</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.actionRow, styles.actionRowDestructive]} onPress={handleDeleteConversation} accessibilityRole="button">
                <Text style={[styles.actionLabel, styles.actionLabelDestructive]}>Delete conversation</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* Mute duration sheet */}
      <Modal visible={muteSheet} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setMuteSheet(false)}>
        <TouchableOpacity style={styles.muteOverlay} activeOpacity={1} onPress={() => setMuteSheet(false)}>
          <View style={styles.muteSheet}>
            <Text style={styles.muteTitle}>Mute notifications</Text>
            {([
              { label: '1 hour', value: '1h' },
              { label: '8 hours', value: '8h' },
              { label: '24 hours', value: '24h' },
              { label: '1 week', value: '1w' },
              { label: 'Until I unmute', value: 'forever' },
            ] as { label: string; value: MuteDuration }[]).map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={styles.muteOption}
                onPress={() => handleMute(opt.value)}
                accessibilityRole="button"
              >
                <Text style={styles.muteOptionLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.muteCancelBtn} onPress={() => setMuteSheet(false)} accessibilityRole="button">
              <Text style={styles.muteCancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}
