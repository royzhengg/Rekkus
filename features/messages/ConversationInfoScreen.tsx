import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import {
  fetchConversationAllParticipants,
  fetchSharedMedia,
  fetchPinnedMessages,
  muteConversation,
  unmuteConversation,
  archiveConversation,
  pinConversation,
  unpinConversation,
  markConversationUnread,
  leaveGroup,
  deleteDirectConversation,
  removeGroupMember,
  promoteToAdmin,
  unpinMessage,
  type ConversationParticipant,
  type DirectMessage,
  type PinnedMessage,
  type MuteDuration,
} from '@/lib/services/messaging'
import { blockUser, submitContentReport } from '@/lib/services/moderation'
import { ArrowLeft, CloseIcon, UsersIcon } from '@/components/icons'
import { avatarPalette } from '@/lib/utils/format'
import { supabase } from '@/lib/supabase'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

type Tab = 'members' | 'media' | 'pinned'

export default function ConversationInfoScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const colors = useThemeColors()
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

  const isAdmin = myParticipant?.is_admin ?? false
  const otherParticipant = !isGroup ? participants.find(p => p.user_id !== user?.id) ?? null : null

  const load = useCallback(async () => {
    if (!conversationId || !user) return
    setLoading(true)
    try {
      const [allParticipants, media, pinned] = await Promise.all([
        fetchConversationAllParticipants(conversationId),
        fetchSharedMedia(conversationId),
        fetchPinnedMessages(conversationId),
      ])

      const { data: convRow } = await (supabase.from('conversations') as any)
        .select('conversation_type, name, avatar_url')
        .eq('id', conversationId)
        .maybeSingle()

      const { data: myRow } = await (supabase.from('conversation_participants') as any)
        .select('muted_until, pinned_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle()

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
  }, [conversationId, user?.id])

  useEffect(() => { load() }, [load])

  async function handleMute(duration: MuteDuration) {
    if (!conversationId || !user) return
    setMuteSheet(false)
    await muteConversation(conversationId, user.id, duration)
    setIsMuted(true)
    Alert.alert('Muted', 'Notifications for this conversation are muted.')
  }

  async function handleUnmute() {
    if (!conversationId || !user) return
    await unmuteConversation(conversationId, user.id)
    setIsMuted(false)
  }

  async function handleTogglePin() {
    if (!conversationId || !user) return
    if (isPinned) {
      await unpinConversation(conversationId, user.id)
      setIsPinned(false)
    } else {
      await pinConversation(conversationId, user.id)
      setIsPinned(true)
    }
  }

  async function handleMarkUnread() {
    if (!conversationId || !user) return
    await markConversationUnread(conversationId, user.id)
    router.back()
  }

  async function handleArchive() {
    if (!conversationId || !user) return
    Alert.alert('Archive conversation', 'This will hide the conversation from your inbox.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: async () => {
          await archiveConversation(conversationId, user.id)
          router.push('/messages' as any)
        },
      },
    ])
  }

  async function handleLeaveGroup() {
    if (!conversationId) return
    Alert.alert('Leave group', 'You will no longer receive messages from this group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const { error } = await leaveGroup(conversationId)
          if (error) Alert.alert('Error', error)
          else router.push('/messages' as any)
        },
      },
    ])
  }

  async function handleDeleteConversation() {
    if (!conversationId || !user) return
    Alert.alert('Delete conversation', 'This will remove the conversation from your inbox.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDirectConversation(conversationId, user.id)
          router.push('/messages' as any)
        },
      },
    ])
  }

  async function handleRemoveMember(participant: ConversationParticipant) {
    if (!conversationId) return
    Alert.alert('Remove member', `Remove @${participant.username} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await removeGroupMember(conversationId, participant.user_id)
          if (error) Alert.alert('Error', error)
          else setParticipants(prev => prev.filter(p => p.user_id !== participant.user_id))
        },
      },
    ])
  }

  async function handlePromoteAdmin(participant: ConversationParticipant) {
    if (!conversationId) return
    const { error } = await promoteToAdmin(conversationId, participant.user_id)
    if (error) Alert.alert('Error', error)
    else {
      setParticipants(prev =>
        prev.map(p => p.user_id === participant.user_id ? { ...p, is_admin: true } : p)
      )
    }
  }

  async function handleReportUser(participant: ConversationParticipant) {
    if (!user) return
    const reportError = await submitContentReport({
      reporterId: user.id,
      targetType: 'user',
      targetId: participant.user_id,
      reason: 'message_or_profile_issue',
      sourceSurface: 'message_thread',
    })
    Alert.alert(reportError ? 'Report failed' : 'Report received', reportError ?? 'Thanks. We will review this account.')
  }

  async function handleBlockUser(participant: ConversationParticipant) {
    if (!user) return
    Alert.alert('Block user', `Block @${participant.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          const error = await blockUser(user.id, participant.user_id, 'messaging')
          if (error) Alert.alert('Block failed', error)
          else router.push('/messages' as any)
        },
      },
    ])
  }

  async function handleUnpinMessage(pinned: PinnedMessage) {
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
            { text: 'Promote to admin', onPress: () => handlePromoteAdmin(p) },
            { text: 'Remove from group', style: 'destructive', onPress: () => handleRemoveMember(p) },
            { text: 'Cancel', style: 'cancel' },
          ])
        }}
        onPress={() => router.push({ pathname: '/user/[username]', params: { username: p.username } } as any)}
      >
        {p.avatar_url ? (
          <Image source={{ uri: p.avatar_url }} style={styles.memberAvatar} />
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
                { text: 'Report', onPress: () => handleReportUser(p) },
                { text: 'Block', style: 'destructive', onPress: () => handleBlockUser(p) },
                { text: 'Cancel', style: 'cancel' },
              ])
            }}
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
          <Image source={{ uri: item.attachment_url }} style={styles.mediaThumbImage} resizeMode="cover" />
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
        <TouchableOpacity style={styles.unpinBtn} onPress={() => handleUnpinMessage(item)}>
          <CloseIcon size={16} color={colors.text3} />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>Info</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text3} />
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
                    <Image source={{ uri: groupAvatar }} style={styles.profileAvatar} />
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
                  <Image source={{ uri: other.avatar_url }} style={styles.profileAvatar} />
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
          <View style={styles.tabs}>
            {(['members', 'media', 'pinned'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, tab === t && styles.tabActive]}
                onPress={() => setTab(t)}
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
            <TouchableOpacity style={styles.actionRow} onPress={handleTogglePin}>
              <Text style={styles.actionLabel}>{isPinned ? 'Unpin conversation' : 'Pin conversation'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={isMuted ? handleUnmute : () => setMuteSheet(true)}
            >
              <Text style={styles.actionLabel}>{isMuted ? 'Unmute notifications' : 'Mute notifications'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={handleMarkUnread}>
              <Text style={styles.actionLabel}>Mark as unread</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={handleArchive}>
              <Text style={styles.actionLabel}>Archive conversation</Text>
            </TouchableOpacity>

            {isGroup ? (
              <TouchableOpacity style={[styles.actionRow, styles.actionRowDestructive]} onPress={handleLeaveGroup}>
                <Text style={[styles.actionLabel, styles.actionLabelDestructive]}>Leave group</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.actionRow, styles.actionRowDestructive]} onPress={handleDeleteConversation}>
                <Text style={[styles.actionLabel, styles.actionLabelDestructive]}>Delete conversation</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* Mute duration sheet */}
      <Modal visible={muteSheet} transparent animationType="slide" onRequestClose={() => setMuteSheet(false)}>
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
              >
                <Text style={styles.muteOptionLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.muteCancelBtn} onPress={() => setMuteSheet(false)}>
              <Text style={styles.muteCancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { width: 36, alignItems: 'flex-start' },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text, textAlign: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { paddingBottom: spacing.px40 },

    // Profile / group header
    profileHeader: { alignItems: 'center', paddingTop: spacing.px28, paddingBottom: spacing[5], gap: spacing[2] },
    profileAvatar: { width: 80, height: 80, borderRadius: radius.round40 },
    profileAvatarText: { fontSize: fontSize['8xl'], fontWeight: fontWeight.bold },
    profileName: { fontSize: fontSize['2.5xl'], fontWeight: fontWeight.bold, color: c.text, textAlign: 'center' },
    profileSub: { fontSize: fontSize.base, color: c.text3 },

    // Tabs
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
      marginBottom: spacing[2],
    },
    tab: { flex: 1, paddingVertical: spacing[3], alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: c.text },
    tabLabel: { fontSize: fontSize.base, color: c.text3, fontWeight: fontWeight.medium },
    tabLabelActive: { color: c.text, fontWeight: fontWeight.semibold },

    // Members
    section: { paddingHorizontal: spacing[4] },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.px11,
      gap: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    memberAvatar: { width: 44, height: 44, borderRadius: radius.pill2 },
    memberText: { flex: 1 },
    memberName: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: c.text },
    memberUsername: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px1 },
    adminBadge: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: c.text2,
      borderWidth: 1,
      borderColor: c.border2,
      paddingHorizontal: spacing.px6,
      paddingVertical: spacing.px2,
      borderRadius: radius.xs,
    },
    youBadge: { fontSize: fontSize.xs, color: c.text3 },
    memberAction: { padding: spacing[1] },
    memberActionLabel: { fontSize: fontSize.md, color: c.text3 },

    // Media
    mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.px2, padding: spacing.px2 },
    mediaThumb: { width: '33.33%', aspectRatio: 1, position: 'relative' },
    mediaThumbImage: { width: '100%', height: '100%' },
    mediaThumbFallback: { backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    videoOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.overlay,
    },
    videoOverlayIcon: { fontSize: fontSize['3xl'], color: c.white },

    // Pinned messages
    pinnedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    pinnedContent: { flex: 1 },
    pinnedPreview: { fontSize: fontSize.md, color: c.text },
    pinnedDate: { fontSize: fontSize.sm, color: c.text3, marginTop: spacing.px2 },
    unpinBtn: { padding: spacing[2] },

    // Empty
    emptySection: { paddingVertical: spacing.px40, alignItems: 'center' },
    emptyLabel: { fontSize: fontSize.base, color: c.text3 },

    // Actions
    actionsSection: {
      marginTop: spacing[6],
      marginHorizontal: spacing[4],
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    sectionLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: c.text3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing[2],
      paddingHorizontal: spacing[4],
      paddingTop: spacing[1],
    },
    actionRow: {
      paddingVertical: spacing.px14,
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    actionRowDestructive: { borderBottomWidth: 0 },
    actionLabel: { fontSize: fontSize.lg, color: c.text },
    actionLabelDestructive: { color: c.actionDelete },

    // Mute sheet
    muteOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
    muteSheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: radius.pill,
      borderTopRightRadius: radius.pill,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[5],
      paddingBottom: spacing.px36,
    },
    muteTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: c.text, marginBottom: spacing[4] },
    muteOption: {
      paddingVertical: spacing.px14,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    muteOptionLabel: { fontSize: fontSize.lg, color: c.text },
    muteCancelBtn: { marginTop: spacing[3], alignItems: 'center' },
    muteCancelLabel: { fontSize: fontSize.lg, color: c.text3 },
  })
}
