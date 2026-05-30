import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, MessageIcon, UsersIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { Skeleton } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { routes } from '@/lib/routes'
import {
  fetchArchivedConversations,
  type ConversationSummary,
} from '@/lib/services/messaging'
import { avatarPalette } from '@/lib/utils/format'

function initials(username: string, name: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length > 1
      ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
      : (parts[0] ?? '').slice(0, 2).toUpperCase()
  }
  return username.slice(0, 2).toUpperCase()
}

function richPreview(item: ConversationSummary): string {
  const msg = item.last_message
  if (!msg) return 'No messages yet'
  switch (msg.message_type) {
    case 'image':
      return 'Photo'
    case 'video':
      return 'Video'
    case 'audio':
      return 'Voice note'
    case 'gif':
      return 'GIF'
    case 'sticker':
      return 'Sticker'
    case 'file':
      return 'File'
    case 'location':
      return 'Location'
    case 'post_share':
      return 'Shared a post'
    case 'place_share':
      return 'Shared a place'
    case 'system':
      return ''
    default:
      return msg.body ?? ''
  }
}

export default function ArchivedConversationsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { runDeferredMutation, syncEpoch } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setLoading(false)
        return
      }
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const rows = await fetchArchivedConversations(user.id)
      setConversations(rows)
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    },
    [user]
  )

  useEffect(() => {
    void load(false)
  }, [load])

  // Re-fetch after offline queue flush
  useEffect(() => { if (syncEpoch > 0) void load(false) }, [syncEpoch, load])

  const handleUnarchive = useCallback(
    async (conversationId: string) => {
      if (!user) return
      setConversations(prev => prev.filter(item => item.id !== conversationId))
      await runDeferredMutation({ kind: 'conversation_unarchive', conversationId })
    },
    [runDeferredMutation, user]
  )

  function renderItem({ item }: { item: ConversationSummary }) {
    const isGroup = item.conversation_type === 'group'
    const displayName = isGroup
      ? (item.name ?? 'Group')
      : (item.participant.full_name ?? `@${item.participant.username}`)
    const palette = avatarPalette(isGroup ? (item.name ?? 'G') : item.participant.username)
    const avatar = isGroup && item.avatar_url ? (
      <CachedImage source={{ uri: item.avatar_url }} style={styles.avatar} />
    ) : isGroup ? (
      <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
        <UsersIcon size={20} color={palette.color} />
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

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.72}
        onPress={() => router.push(routes.conversation(item.id))}
      >
        {avatar}
        <View style={styles.rowBody}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.preview} numberOfLines={1}>
            {richPreview(item)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.unarchiveBtn}
          onPress={() => handleUnarchive(item.id)}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Text style={styles.unarchiveText}>Unarchive</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>Archived chats</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={44} height={44} radius={radius.full} />
              <View style={{ flex: 1, gap: spacing[2] }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.text3}
            />
          }
          contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
          ListEmptyComponent={
            <View style={styles.center}>
              <MessageIcon size={36} color={colors.text3} />
              <Text style={styles.emptyTitle}>No archived chats</Text>
              <Text style={styles.emptyBody}>Archived conversations will appear here.</Text>
            </View>
          }
        />
      )}
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
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px10,
      paddingHorizontal: spacing.px36,
    },
    emptyContainer: { flex: 1 },
    emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text, textAlign: 'center' },
    emptyBody: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center', lineHeight: lineHeight.small },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: radius.avatar46,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
    rowBody: { flex: 1, minWidth: 0, gap: spacing.px2 },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
    preview: { fontSize: fontSize.bodySm, color: c.text3 },
    unarchiveBtn: {
      borderRadius: radius.sm4,
      borderWidth: 0.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px7,
    },
    unarchiveText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, color: c.text },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  })
}
