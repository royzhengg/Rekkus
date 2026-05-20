import { supabase } from '@/lib/supabase'
import { notify } from '@/lib/services/notifications'

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'gif'
  | 'sticker'
  | 'file'
  | 'location'
  | 'post_share'
  | 'place_share'
  | 'system'

export type ConversationParticipant = {
  user_id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  is_admin?: boolean
  last_seen_at?: string | null
}

export type DirectMessage = {
  id: string
  conversation_id: string
  sender_id: string
  body: string | null
  message_type: MessageType
  attachment_url: string | null
  attachment_metadata: Record<string, unknown> | null
  reply_to_message_id: string | null
  created_at: string
  deleted_at: string | null
}

export type PinnedMessage = {
  id: string
  conversation_id: string
  message_id: string
  pinned_by: string | null
  pinned_at: string
  message?: DirectMessage
}

export type MuteDuration = '1h' | '8h' | '24h' | '1w' | 'forever'

export type MessageReaction = {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export type ConversationSummary = {
  id: string
  conversation_type: 'direct' | 'group'
  status: string
  request_status: 'active' | 'request' | 'declined'
  requested_by: string | null
  requested_at: string | null
  name: string | null
  avatar_url: string | null
  pinned_message_id: string | null
  updated_at: string
  last_read_at: string | null
  muted_until: string | null
  pinned_at: string | null
  archived_at: string | null
  unread_count: number
  participant: ConversationParticipant
  participants: ConversationParticipant[]
  last_message: DirectMessage | null
}

function mapMessagingError(error: { message?: string } | null): string | null {
  if (!error?.message) return null
  if (error.message.includes('messaging_blocked')) {
    return 'Messaging is not available between these accounts.'
  }
  if (error.message.includes('invalid_target')) {
    return 'You cannot start a message thread with this profile.'
  }
  if (error.message.includes('not_authenticated')) {
    return 'Please sign in to use messages.'
  }
  if (error.message.includes('invalid_message')) {
    return 'Messages must be between 1 and 2,000 characters.'
  }
  if (error.message.includes('not_participant')) {
    return 'You are not a participant in this conversation.'
  }
  if (error.message.includes('rate_limited')) {
    return 'You are sending messages too quickly. Please wait a moment.'
  }
  return 'Messaging is not available right now.'
}

function isMissingRequestStateColumn(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? ''
  return (
    error?.code === '42703' ||
    message.includes('request_status') ||
    message.includes('requested_by') ||
    message.includes('requested_at')
  )
}

type ParticipantConversationRow = {
  conversation_id: string
  last_read_at: string | null
  muted_until: string | null
  pinned_at: string | null
  archived_at: string | null
  request_status?: 'active' | 'request' | 'declined' | null
  requested_by?: string | null
  requested_at?: string | null
  conversations: any
}

async function fetchParticipantConversationRows(
  currentUserId: string
): Promise<{ rows: ParticipantConversationRow[]; hasRequestState: boolean }> {
  const modernSelect =
    'conversation_id, last_read_at, muted_until, pinned_at, archived_at, request_status, requested_by, requested_at, conversations!inner(id, updated_at, created_at, conversation_type, status, name, avatar_url, pinned_message_id)'

  const modern = await (supabase.from('conversation_participants') as any)
    .select(modernSelect)
    .eq('user_id', currentUserId)

  if (!modern.error) {
    return { rows: modern.data ?? [], hasRequestState: true }
  }

  if (!isMissingRequestStateColumn(modern.error)) {
    throw modern.error
  }

  const legacy = await (supabase.from('conversation_participants') as any)
    .select(
      'conversation_id, last_read_at, muted_until, pinned_at, archived_at, conversations!inner(id, updated_at, created_at, conversation_type, status, name, avatar_url, pinned_message_id)'
    )
    .eq('user_id', currentUserId)

  if (legacy.error) {
    throw legacy.error
  }

  return { rows: legacy.data ?? [], hasRequestState: false }
}

// ─── Conversation management ────────────────────────────────────────────────

export async function getOrCreateDirectConversation(
  currentUserId: string,
  targetUserId: string
): Promise<{ conversationId: string | null; error: string | null }> {
  if (currentUserId === targetUserId) {
    return { conversationId: null, error: 'You cannot start a message thread with yourself.' }
  }

  const { data, error } = await (supabase.rpc as any)('get_or_create_direct_conversation', {
    target_user_id: targetUserId,
  })

  if (error || !data) {
    return { conversationId: null, error: mapMessagingError(error) }
  }

  return { conversationId: data as string, error: null }
}

export async function createGroupConversation(
  name: string,
  memberIds: string[],
  avatarUrl?: string | null
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data, error } = await (supabase.rpc as any)('create_group_conversation', {
    p_name: name,
    p_member_ids: memberIds,
    p_avatar_url: avatarUrl ?? null,
  })

  if (error || !data) {
    return { conversationId: null, error: mapMessagingError(error) }
  }

  return { conversationId: data as string, error: null }
}

export async function fetchDirectConversations(
  currentUserId: string,
  includeArchived = false
): Promise<ConversationSummary[]> {
  const { rows: participantRows, hasRequestState } = await fetchParticipantConversationRows(currentUserId)

  const ownRows = (participantRows ?? []).filter((row: any) => {
    const conv = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
    if (!conv) return false
    if (conv.status === 'blocked' || conv.status === 'archived') return false
    if (!includeArchived && row.archived_at != null) return false
    if (!hasRequestState) return conv.status === 'active'
    const requestStatus = row.request_status ?? 'active'
    return requestStatus === 'active'
  })

  const conversationIds = ownRows.map((row: any) => row.conversation_id).filter(Boolean)
  if (conversationIds.length === 0) return []

  const [{ data: otherParticipantData }, { data: messageData }] = await Promise.all([
    (supabase.from('conversation_participants') as any)
      .select(
        'conversation_id, user_id, is_admin, users!conversation_participants_user_id_fkey(username, full_name, avatar_url, last_seen_at)'
      )
      .in('conversation_id', conversationIds)
      .neq('user_id', currentUserId),
    (supabase.from('messages') as any)
      .select(
        'id, conversation_id, sender_id, body, message_type, attachment_url, attachment_metadata, reply_to_message_id, created_at, deleted_at'
      )
      .in('conversation_id', conversationIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(Math.max(conversationIds.length * 20, 20)),
  ])

  const participantsByConversation = new Map<string, ConversationParticipant[]>()
  for (const row of (otherParticipantData ?? [])) {
    const p: ConversationParticipant = {
      user_id: row.user_id,
      username: row.users?.username ?? 'unknown',
      full_name: row.users?.full_name ?? null,
      avatar_url: row.users?.avatar_url ?? null,
      is_admin: row.is_admin ?? false,
      last_seen_at: row.users?.last_seen_at ?? null,
    }
    const existing = participantsByConversation.get(row.conversation_id) ?? []
    existing.push(p)
    participantsByConversation.set(row.conversation_id, existing)
  }

  const lastMessageByConversation = new Map<string, DirectMessage>()
  for (const message of (messageData ?? [])) {
    if (!lastMessageByConversation.has(message.conversation_id)) {
      lastMessageByConversation.set(message.conversation_id, message)
    }
  }

  const unreadCounts = await Promise.all(
    ownRows.map(async (row: any) => {
      let query = (supabase.from('messages') as any)
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', row.conversation_id)
        .neq('sender_id', currentUserId)
        .is('deleted_at', null)

      if (row.last_read_at) {
        query = query.gt('created_at', row.last_read_at)
      }

      const { count } = await query
      return [row.conversation_id, count ?? 0] as const
    })
  )
  const unreadByConversation = new Map(unreadCounts)

  const summaries: ConversationSummary[] = ownRows
    .map((row: any) => {
      const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
      const participants = participantsByConversation.get(row.conversation_id) ?? []
      const primaryParticipant = participants[0] ?? {
        user_id: '',
        username: 'unknown',
        full_name: null,
        avatar_url: null,
      }

      return {
        id: row.conversation_id,
        conversation_type: conversation?.conversation_type ?? 'direct',
        status: conversation?.status ?? 'active',
        request_status: row.request_status ?? 'active',
        requested_by: row.requested_by ?? null,
        requested_at: row.requested_at ?? null,
        name: conversation?.name ?? null,
        avatar_url: conversation?.avatar_url ?? null,
        pinned_message_id: conversation?.pinned_message_id ?? null,
        updated_at: conversation?.updated_at ?? conversation?.created_at ?? '',
        last_read_at: row.last_read_at,
        muted_until: row.muted_until ?? null,
        pinned_at: row.pinned_at ?? null,
        archived_at: row.archived_at ?? null,
        unread_count: unreadByConversation.get(row.conversation_id) ?? 0,
        participant: primaryParticipant,
        participants,
        last_message: lastMessageByConversation.get(row.conversation_id) ?? null,
      }
    })
    .sort((a: ConversationSummary, b: ConversationSummary) => {
      // Pinned conversations float to top
      if (a.pinned_at && !b.pinned_at) return -1
      if (!a.pinned_at && b.pinned_at) return 1
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  return summaries
}

export async function fetchArchivedConversations(
  currentUserId: string
): Promise<ConversationSummary[]> {
  const conversations = await fetchDirectConversations(currentUserId, true)
  return conversations.filter(conversation => conversation.archived_at != null)
}

export async function fetchMessageRequests(currentUserId: string): Promise<ConversationSummary[]> {
  const { rows: participantRows, hasRequestState } = await fetchParticipantConversationRows(currentUserId)

  const requestRows = (participantRows ?? []).filter((row: any) => {
    const conv = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
    if (!conv || row.archived_at != null) return false
    if (conv.status === 'blocked' || conv.status === 'archived') return false
    if (!hasRequestState) return conv.status === 'request'
    return (row.request_status ?? (conv.status === 'request' ? 'request' : 'active')) === 'request'
  })

  if (requestRows.length === 0) return []

  const conversationIds = requestRows.map((row: any) => row.conversation_id)

  const [otherParticipantsRes, messagesRes] = await Promise.all([
    (supabase.from('conversation_participants') as any)
      .select(
        'conversation_id, user_id, is_admin, users!conversation_participants_user_id_fkey(username, full_name, avatar_url, last_seen_at)'
      )
      .in('conversation_id', conversationIds)
      .neq('user_id', currentUserId),
    (supabase.from('messages') as any)
      .select(
        'id, conversation_id, sender_id, body, message_type, attachment_url, attachment_metadata, reply_to_message_id, created_at, deleted_at'
      )
      .in('conversation_id', conversationIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(conversationIds.length * 5),
  ])

  const participantsByConversation = new Map<string, ConversationParticipant[]>()
  for (const row of otherParticipantsRes.data ?? []) {
    const p: ConversationParticipant = {
      user_id: row.user_id,
      username: row.users?.username ?? 'unknown',
      full_name: row.users?.full_name ?? null,
      avatar_url: row.users?.avatar_url ?? null,
      is_admin: row.is_admin ?? false,
    }
    const existing = participantsByConversation.get(row.conversation_id) ?? []
    existing.push(p)
    participantsByConversation.set(row.conversation_id, existing)
  }

  const lastMessageByConversation = new Map<string, DirectMessage>()
  for (const message of messagesRes.data ?? []) {
    if (!lastMessageByConversation.has(message.conversation_id)) {
      lastMessageByConversation.set(message.conversation_id, message)
    }
  }

  return requestRows.map((row: any) => {
    const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
    const participants = participantsByConversation.get(row.conversation_id) ?? []
    return {
      id: row.conversation_id,
      conversation_type: conversation?.conversation_type ?? 'direct',
      status: conversation?.status ?? 'request',
      request_status: 'request',
      requested_by: row.requested_by ?? null,
      requested_at: row.requested_at ?? null,
      name: conversation?.name ?? null,
      avatar_url: conversation?.avatar_url ?? null,
      pinned_message_id: null,
      updated_at: conversation?.updated_at ?? '',
      last_read_at: row.last_read_at,
      muted_until: null,
      pinned_at: null,
      archived_at: null,
      unread_count: 0,
      participant: participants[0] ?? { user_id: '', username: 'unknown', full_name: null, avatar_url: null },
      participants,
      last_message: lastMessageByConversation.get(row.conversation_id) ?? null,
    }
  })
}

export async function acceptMessageRequest(conversationId: string): Promise<void> {
  await (supabase.rpc as any)('accept_message_request', { p_conversation_id: conversationId })
}

export async function declineMessageRequest(conversationId: string): Promise<void> {
  await (supabase.rpc as any)('decline_message_request', { p_conversation_id: conversationId })
}

// ─── Conversation participant info ──────────────────────────────────────────

export async function fetchConversationParticipant(
  conversationId: string,
  currentUserId: string
): Promise<ConversationParticipant | null> {
  const { data } = await (supabase.from('conversation_participants') as any)
    .select(
      'user_id, is_admin, users!conversation_participants_user_id_fkey(username, full_name, avatar_url, last_seen_at)'
    )
    .eq('conversation_id', conversationId)
    .neq('user_id', currentUserId)
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    user_id: data.user_id,
    username: data.users?.username ?? 'unknown',
    full_name: data.users?.full_name ?? null,
    avatar_url: data.users?.avatar_url ?? null,
    is_admin: data.is_admin ?? false,
    last_seen_at: data.users?.last_seen_at ?? null,
  }
}

export async function fetchConversationAllParticipants(
  conversationId: string
): Promise<ConversationParticipant[]> {
  const { data } = await (supabase.from('conversation_participants') as any)
    .select(
      'user_id, is_admin, users!conversation_participants_user_id_fkey(username, full_name, avatar_url, last_seen_at)'
    )
    .eq('conversation_id', conversationId)

  return (data ?? []).map((row: any) => ({
    user_id: row.user_id,
    username: row.users?.username ?? 'unknown',
    full_name: row.users?.full_name ?? null,
    avatar_url: row.users?.avatar_url ?? null,
    is_admin: row.is_admin ?? false,
    last_seen_at: row.users?.last_seen_at ?? null,
  }))
}

// ─── Messages ───────────────────────────────────────────────────────────────

export async function fetchConversationMessages(conversationId: string): Promise<DirectMessage[]> {
  const { data } = await (supabase.from('messages') as any)
    .select(
      'id, conversation_id, sender_id, body, message_type, attachment_url, attachment_metadata, reply_to_message_id, created_at, deleted_at'
    )
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(200)

  return data ?? []
}

export async function sendDirectMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<{ message: DirectMessage | null; error: string | null }> {
  return sendRichMessage(conversationId, senderId, 'text', body)
}

export async function sendRichMessage(
  conversationId: string,
  senderId: string,
  messageType: MessageType,
  body?: string | null,
  attachmentUrl?: string | null,
  attachmentMetadata?: Record<string, unknown> | null,
  replyToMessageId?: string | null
): Promise<{ message: DirectMessage | null; error: string | null }> {
  const { data, error } = await (supabase.rpc as any)('send_direct_message', {
    p_conversation_id: conversationId,
    p_body: body ?? null,
    p_message_type: messageType,
    p_attachment_url: attachmentUrl ?? null,
    p_attachment_metadata: attachmentMetadata ?? null,
    p_reply_to_message_id: replyToMessageId ?? null,
  })

  if (error || !data) return { message: null, error: mapMessagingError(error) }

  const message = data as DirectMessage

  if (messageType === 'text') {
    notify({ type: 'message', actorId: senderId, conversationId, messageId: message.id })
  }

  return { message, error: null }
}

export async function deleteMessage(messageId: string): Promise<{ error: string | null }> {
  const { error } = await (supabase.rpc as any)('delete_message', { p_message_id: messageId })
  if (error) return { error: mapMessagingError(error) }
  return { error: null }
}

export async function forwardMessage(
  sourceMessageId: string,
  targetConversationId: string,
  senderId: string
): Promise<{ message: DirectMessage | null; error: string | null }> {
  const { data: source } = await (supabase.from('messages') as any)
    .select('body, message_type, attachment_url, attachment_metadata')
    .eq('id', sourceMessageId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!source) return { message: null, error: 'Message not found.' }

  return sendRichMessage(
    targetConversationId,
    senderId,
    source.message_type,
    source.body,
    source.attachment_url,
    source.attachment_metadata
  )
}

export async function searchConversationMessages(
  conversationId: string,
  query: string
): Promise<DirectMessage[]> {
  const { data } = await (supabase.from('messages') as any)
    .select(
      'id, conversation_id, sender_id, body, message_type, attachment_url, attachment_metadata, reply_to_message_id, created_at, deleted_at'
    )
    .eq('conversation_id', conversationId)
    .eq('message_type', 'text')
    .is('deleted_at', null)
    .ilike('body', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function fetchSharedMedia(conversationId: string): Promise<DirectMessage[]> {
  const { data } = await (supabase.from('messages') as any)
    .select(
      'id, conversation_id, sender_id, body, message_type, attachment_url, attachment_metadata, reply_to_message_id, created_at, deleted_at'
    )
    .eq('conversation_id', conversationId)
    .in('message_type', ['image', 'video'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  return data ?? []
}

// ─── Reactions ──────────────────────────────────────────────────────────────

export async function addReaction(messageId: string, emoji: string): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('message_reactions') as any).upsert(
    { message_id: messageId, emoji },
    { onConflict: 'message_id,user_id' }
  )
  if (error) return { error: 'Could not add reaction.' }
  return { error: null }
}

export async function removeReaction(messageId: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await (supabase.from('message_reactions') as any)
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', user.id)

  if (error) return { error: 'Could not remove reaction.' }
  return { error: null }
}

export async function fetchMessageReactions(conversationId: string): Promise<MessageReaction[]> {
  // Get all reactions for messages in this conversation via a join
  const { data } = await (supabase.from('message_reactions') as any)
    .select('id, message_id, user_id, emoji, created_at, messages!inner(conversation_id)')
    .eq('messages.conversation_id', conversationId)

  return (data ?? []).map((r: any) => ({
    id: r.id,
    message_id: r.message_id,
    user_id: r.user_id,
    emoji: r.emoji,
    created_at: r.created_at,
  }))
}

export function subscribeToReactions(
  conversationId: string,
  onChange: (payload: { eventType: 'INSERT' | 'DELETE'; reaction: MessageReaction }) => void
) {
  return supabase
    .channel(`reactions:${conversationId}:${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'message_reactions' },
      payload =>
        onChange({ eventType: 'INSERT', reaction: payload.new as MessageReaction })
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'message_reactions' },
      payload =>
        onChange({ eventType: 'DELETE', reaction: payload.old as MessageReaction })
    )
    .subscribe()
}

// ─── Pinned messages (multiple) ──────────────────────────────────────────────

export async function pinMessage(messageId: string): Promise<{ error: string | null }> {
  const { error } = await (supabase.rpc as any)('pin_message', { p_message_id: messageId })
  if (error) return { error: mapMessagingError(error) }
  return { error: null }
}

export async function unpinMessage(messageId: string): Promise<{ error: string | null }> {
  const { error } = await (supabase.rpc as any)('unpin_message', { p_message_id: messageId })
  if (error) return { error: mapMessagingError(error) }
  return { error: null }
}

export async function fetchPinnedMessages(conversationId: string): Promise<PinnedMessage[]> {
  const { data } = await (supabase.from('conversation_pinned_messages') as any)
    .select('id, conversation_id, message_id, pinned_by, pinned_at')
    .eq('conversation_id', conversationId)
    .order('pinned_at', { ascending: false })

  if (!data || data.length === 0) return []

  const messageIds = data.map((p: any) => p.message_id)
  const { data: messages } = await (supabase.from('messages') as any)
    .select('id, conversation_id, sender_id, body, message_type, attachment_url, attachment_metadata, reply_to_message_id, created_at, deleted_at')
    .in('id', messageIds)

  const messageMap = new Map<string, DirectMessage>((messages ?? []).map((m: DirectMessage) => [m.id, m]))

  return data.map((p: any) => ({
    id: p.id,
    conversation_id: p.conversation_id,
    message_id: p.message_id,
    pinned_by: p.pinned_by,
    pinned_at: p.pinned_at,
    message: messageMap.get(p.message_id),
  }))
}

// ─── Inbox management ────────────────────────────────────────────────────────

export async function muteConversation(
  conversationId: string,
  userId: string,
  duration: MuteDuration = '8h'
): Promise<void> {
  const durations: Record<MuteDuration, number> = {
    '1h': 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    forever: 100 * 365 * 24 * 60 * 60 * 1000,
  }
  const mutedUntil = new Date(Date.now() + durations[duration]).toISOString()
  await (supabase.from('conversation_participants') as any)
    .update({ muted_until: mutedUntil })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

export async function unmuteConversation(conversationId: string, userId: string): Promise<void> {
  await (supabase.from('conversation_participants') as any)
    .update({ muted_until: null })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

export async function archiveConversation(conversationId: string, userId: string): Promise<void> {
  await (supabase.from('conversation_participants') as any)
    .update({ archived_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

export async function unarchiveConversation(conversationId: string, userId: string): Promise<void> {
  await (supabase.from('conversation_participants') as any)
    .update({ archived_at: null })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

export async function pinConversation(conversationId: string, userId: string): Promise<void> {
  await (supabase.from('conversation_participants') as any)
    .update({ pinned_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

export async function unpinConversation(conversationId: string, userId: string): Promise<void> {
  await (supabase.from('conversation_participants') as any)
    .update({ pinned_at: null })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

// ─── Group management ────────────────────────────────────────────────────────

export async function addGroupMember(
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('conversation_participants') as any)
    .insert({ conversation_id: conversationId, user_id: userId, is_admin: false })
  if (error) return { error: 'Could not add member.' }
  return { error: null }
}

export async function removeGroupMember(
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('conversation_participants') as any)
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) return { error: 'Could not remove member.' }
  return { error: null }
}

export async function promoteToAdmin(
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('conversation_participants') as any)
    .update({ is_admin: true })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) return { error: 'Could not promote member.' }
  return { error: null }
}

export async function updateGroupInfo(
  conversationId: string,
  name?: string | null,
  avatarUrl?: string | null
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl

  const { error } = await (supabase.from('conversations') as any)
    .update(updates)
    .eq('id', conversationId)
  if (error) return { error: 'Could not update group.' }
  return { error: null }
}

export async function leaveGroup(conversationId: string): Promise<{ error: string | null }> {
  const { error } = await (supabase.rpc as any)('leave_group', {
    p_conversation_id: conversationId,
  })
  if (error) return { error: mapMessagingError(error) }
  return { error: null }
}

export async function deleteDirectConversation(
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> {
  // For 1:1: archive from the user's perspective (removes from their inbox)
  await archiveConversation(conversationId, userId)
  return { error: null }
}

// ─── Read state ──────────────────────────────────────────────────────────────

export async function markConversationRead(
  conversationId: string,
  userId: string,
  messageId?: string
): Promise<void> {
  await (supabase.from('conversation_participants') as any)
    .update({
      last_read_at: new Date().toISOString(),
      ...(messageId ? { last_read_message_id: messageId } : {}),
    })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

export async function markConversationUnread(
  conversationId: string,
  userId: string
): Promise<void> {
  // Set last_read_at to null so all messages appear unread
  await (supabase.from('conversation_participants') as any)
    .update({ last_read_at: null, last_read_message_id: null })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

// ─── Realtime subscriptions ───────────────────────────────────────────────────

export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: (message: DirectMessage) => void
) {
  return supabase
    .channel(`conversation:${conversationId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      payload => onMessage(payload.new as DirectMessage)
    )
    .subscribe()
}

export function subscribeToTypingIndicators(
  conversationId: string,
  currentUserId: string,
  onTyping: (typingUserIds: string[]) => void
) {
  const channel = supabase.channel(`presence:conversation:${conversationId}:${Date.now()}`, {
    config: { presence: { key: currentUserId } },
  })

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ typing: boolean }>()
      const typingIds = Object.entries(state)
        .filter(([uid, presences]) => uid !== currentUserId && presences.some(p => p.typing))
        .map(([uid]) => uid)
      onTyping(typingIds)
    })
    .subscribe()

  return channel
}

export async function broadcastTyping(channel: ReturnType<typeof supabase.channel>) {
  await channel.track({ typing: true })
  // Auto-clear after 2s
  setTimeout(() => channel.track({ typing: false }), 2000)
}
