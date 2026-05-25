import { supabase } from '@/lib/supabase'
import { isMissingRequestStateColumn, mapMessagingError } from './errors'
import { parseConversationParticipant, parseDirectMessage } from './guards'
import { isRecord } from '../../utils/safeJson'
import type { ConversationParticipant, ConversationSummary, DirectMessage } from './types'

type ConversationRow = {
  id: string
  updated_at: string | null
  created_at: string | null
  conversation_type: string | null
  status: string | null
  name: string | null
  avatar_url: string | null
  pinned_message_id: string | null
}

type ParticipantConversationRow = {
  conversation_id: string
  last_read_at: string | null
  muted_until: string | null
  pinned_at: string | null
  archived_at: string | null
  request_status?: string | null
  requested_by?: string | null
  requested_at?: string | null
  conversations: ConversationRow | ConversationRow[] | null
}

async function fetchParticipantConversationRows(
  currentUserId: string
): Promise<{ rows: ParticipantConversationRow[]; hasRequestState: boolean }> {
  const modernSelect =
    'conversation_id, last_read_at, muted_until, pinned_at, archived_at, request_status, requested_by, requested_at, conversations!inner(id, updated_at, created_at, conversation_type, status, name, avatar_url, pinned_message_id)'

  const modern = await supabase.from('conversation_participants')
    .select(modernSelect)
    .eq('user_id', currentUserId)

  if (!modern.error) {
    return { rows: (modern.data ?? []).filter(isParticipantConversationRow), hasRequestState: true }
  }

  if (!isMissingRequestStateColumn(modern.error)) {
    throw modern.error
  }

  const legacy = await supabase.from('conversation_participants')
    .select(
      'conversation_id, last_read_at, muted_until, pinned_at, archived_at, conversations!inner(id, updated_at, created_at, conversation_type, status, name, avatar_url, pinned_message_id)'
    )
    .eq('user_id', currentUserId)

  if (legacy.error) {
    throw legacy.error
  }

  return { rows: (legacy.data ?? []).filter(isParticipantConversationRow), hasRequestState: false }
}

function isParticipantConversationRow(value: unknown): value is ParticipantConversationRow {
  if (!isRecord(value)) return false
  return typeof value.conversation_id === 'string' && (
    value.conversations === null || typeof value.conversations === 'object'
  )
}

export async function getOrCreateDirectConversation(
  currentUserId: string,
  targetUserId: string
): Promise<{ conversationId: string | null; error: string | null }> {
  if (currentUserId === targetUserId) {
    return { conversationId: null, error: 'You cannot start a message thread with yourself.' }
  }

  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    target_user_id: targetUserId,
  })

  if (error || !data) {
    return { conversationId: null, error: mapMessagingError(error) }
  }

  return typeof data === 'string'
    ? { conversationId: data, error: null }
    : { conversationId: null, error: 'Could not start conversation.' }
}

export async function createGroupConversation(
  name: string,
  memberIds: string[],
  avatarUrl?: string | null
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_group_conversation', {
    p_name: name,
    p_member_ids: memberIds,
    ...(avatarUrl ? { p_avatar_url: avatarUrl } : {}),
  })

  if (error || !data) {
    return { conversationId: null, error: mapMessagingError(error) }
  }

  return typeof data === 'string'
    ? { conversationId: data, error: null }
    : { conversationId: null, error: 'Could not create group.' }
}

export async function fetchDirectConversations(
  currentUserId: string,
  includeArchived = false
): Promise<ConversationSummary[]> {
  const { rows: participantRows, hasRequestState } = await fetchParticipantConversationRows(currentUserId)

  const ownRows = (participantRows ?? []).filter((row) => {
    const conv = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
    if (!conv) return false
    if (conv.status === 'blocked' || conv.status === 'archived') return false
    if (!includeArchived && row.archived_at != null) return false
    if (!hasRequestState) return conv.status === 'active'
    const requestStatus = row.request_status ?? 'active'
    return requestStatus === 'active'
  })

  const conversationIds = ownRows.map((row) => row.conversation_id).filter(Boolean)
  if (conversationIds.length === 0) return []

  const [{ data: otherParticipantData }, { data: messageData }] = await Promise.all([
    supabase.from('conversation_participants')
      .select(
        'conversation_id, user_id, is_admin, users!conversation_participants_user_id_fkey(username, full_name, avatar_url, last_seen_at)'
      )
      .in('conversation_id', conversationIds)
      .neq('user_id', currentUserId),
    supabase.from('messages')
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
    const p = parseConversationParticipant(row)
    if (!p) continue
    const existing = participantsByConversation.get(row.conversation_id) ?? []
    existing.push(p)
    participantsByConversation.set(row.conversation_id, existing)
  }

  const lastMessageByConversation = new Map<string, DirectMessage>()
  for (const message of (messageData ?? [])) {
    const parsedMessage = parseDirectMessage(message)
    if (parsedMessage && !lastMessageByConversation.has(parsedMessage.conversation_id)) {
      lastMessageByConversation.set(parsedMessage.conversation_id, parsedMessage)
    }
  }

  const unreadCounts = await Promise.all(
    ownRows.map(async (row) => {
      let query = supabase.from('messages')
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
    .map((row) => {
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
        conversation_type: conversation?.conversation_type === 'group' ? 'group' : 'direct',
        status: conversation?.status ?? 'active',
        request_status: row.request_status === 'request' || row.request_status === 'declined' ? row.request_status : 'active',
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
      } satisfies ConversationSummary
    })
    .sort((a: ConversationSummary, b: ConversationSummary) => {
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

  const requestRows = (participantRows ?? []).filter((row) => {
    const conv = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
    if (!conv || row.archived_at != null) return false
    if (conv.status === 'blocked' || conv.status === 'archived') return false
    if (!hasRequestState) return conv.status === 'request'
    return (row.request_status ?? (conv.status === 'request' ? 'request' : 'active')) === 'request'
  })

  if (requestRows.length === 0) return []

  const conversationIds = requestRows.map((row) => row.conversation_id)

  const [otherParticipantsRes, messagesRes] = await Promise.all([
    supabase.from('conversation_participants')
      .select(
        'conversation_id, user_id, is_admin, users!conversation_participants_user_id_fkey(username, full_name, avatar_url, last_seen_at)'
      )
      .in('conversation_id', conversationIds)
      .neq('user_id', currentUserId),
    supabase.from('messages')
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
    const p = parseConversationParticipant(row)
    if (!p) continue
    const existing = participantsByConversation.get(row.conversation_id) ?? []
    existing.push(p)
    participantsByConversation.set(row.conversation_id, existing)
  }

  const lastMessageByConversation = new Map<string, DirectMessage>()
  for (const message of messagesRes.data ?? []) {
    const parsedMessage = parseDirectMessage(message)
    if (parsedMessage && !lastMessageByConversation.has(parsedMessage.conversation_id)) {
      lastMessageByConversation.set(parsedMessage.conversation_id, parsedMessage)
    }
  }

  return requestRows.map((row) => {
    const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
    const participants = participantsByConversation.get(row.conversation_id) ?? []
    return {
      id: row.conversation_id,
      conversation_type: conversation?.conversation_type === 'group' ? 'group' : 'direct',
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
    } satisfies ConversationSummary
  })
}

export async function acceptMessageRequest(conversationId: string): Promise<void> {
  await supabase.rpc('accept_message_request', { p_conversation_id: conversationId })
}

export async function declineMessageRequest(conversationId: string): Promise<void> {
  await supabase.rpc('decline_message_request', { p_conversation_id: conversationId })
}
