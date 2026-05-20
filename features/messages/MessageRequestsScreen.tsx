import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import {
  fetchMessageRequests,
  acceptMessageRequest,
  declineMessageRequest,
  type ConversationSummary,
} from '@/lib/services/messaging'
import { ArrowLeft } from '@/components/icons'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

function richTypePreview(msg: { message_type: string; body: string | null }): string {
  switch (msg.message_type) {
    case 'image': return '📷 Photo'
    case 'video': return '🎥 Video'
    case 'audio': return '🎵 Voice note'
    case 'gif': return 'GIF'
    case 'file': return '📎 File'
    case 'location': return '📍 Location'
    case 'post_share': return 'Shared a post'
    case 'place_share': return 'Shared a place'
    default: return msg.body ?? ''
  }
}

export default function MessageRequestsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [requests, setRequests] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const data = await fetchMessageRequests(user.id)
    setRequests(data)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function handleAccept(conversationId: string) {
    await acceptMessageRequest(conversationId)
    setRequests(prev => prev.filter(r => r.id !== conversationId))
    router.push({ pathname: '/messages/[conversationId]', params: { conversationId } } as any)
  }

  async function handleDecline(conversationId: string) {
    Alert.alert('Decline request', 'This conversation will be blocked.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          await declineMessageRequest(conversationId)
          setRequests(prev => prev.filter(r => r.id !== conversationId))
        },
      },
    ])
  }

  function renderItem({ item }: { item: ConversationSummary }) {
    const preview = item.last_message ? richTypePreview(item.last_message) : 'No messages yet'
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.rowMain}
          onPress={() => router.push({ pathname: '/messages/[conversationId]', params: { conversationId: item.id } } as any)}
          activeOpacity={0.7}
        >
          {item.participant.avatar_url ? (
            <Image source={{ uri: item.participant.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(item.participant.full_name ?? item.participant.username).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.rowText}>
            <Text style={styles.username}>{item.participant.full_name ?? `@${item.participant.username}`}</Text>
            <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.id)}>
            <Text style={styles.acceptLabel}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(item.id)}>
            <Text style={styles.declineLabel}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>Message requests</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text3} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={requests.length === 0 ? styles.emptyContainer : undefined}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No message requests</Text>
              <Text style={styles.emptyBody}>When someone you do not follow messages you, their request appears here.</Text>
            </View>
          }
          ListHeaderComponent={
            requests.length > 0 ? (
              <Text style={styles.description}>
                These are from people or groups outside your follows. Accept to move them into your inbox.
              </Text>
            ) : null
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
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.px10, paddingHorizontal: spacing.px36 },
    emptyContainer: { flex: 1 },
    emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text, textAlign: 'center' },
    emptyBody: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center', lineHeight: lineHeight.small },
    description: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      lineHeight: lineHeight.compact,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
    avatar: { width: 46, height: 46, borderRadius: radius.avatar46 },
    avatarFallback: { backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: fontSize['2xl'], fontWeight: fontWeight.semibold, color: c.text3 },
    rowText: { flex: 1, gap: spacing.px2 },
    username: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
    preview: { fontSize: fontSize.bodySm, color: c.text3 },
    actions: { flexDirection: 'row', gap: spacing[2], marginLeft: spacing[3] },
    acceptBtn: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px6,
      borderRadius: radius.sm3,
      backgroundColor: c.text,
    },
    acceptLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: c.bg },
    declineBtn: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px6,
      borderRadius: radius.sm3,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    declineLabel: { fontSize: fontSize.base, color: c.text },
  })
}
