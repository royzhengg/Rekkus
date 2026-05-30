import { notify } from '@/lib/services/notifications'
import { supabase } from '@/lib/supabase'
import { reportInvalidBoundary } from '../boundaryTelemetry'
import { mapMessagingError } from './errors'
import {
  isMessageType,
  parseDirectMessage,
  parseDirectMessageList,
  parseMessageReaction,
  parsePinnedMessage,
} from './guards'
import type { DirectMessage, MessageReaction, MessageType, PinnedMessage } from './types'

function parseMessagesWithSignal(value: unknown, boundary: string): DirectMessage[] {
  const messages = parseDirectMessageList(value)
  if (Array.isArray(value) && messages.length !== value.length) {
    reportInvalidBoundary(boundary)
  }
  return messages
}

export async function fetchConversationMessages(conversationId: string): Promise<DirectMessage[]> {
  const { data } = await supabase.from('messages')
    .select(
      'id, conversation_id, sender_id, body, message_type, attachment_url, attachment_metadata, reply_to_message_id, created_at, deleted_at'
    )
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(200)

  return parseMessagesWithSignal(data, 'message_row_invalid')
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
  const { data, error } = await supabase.rpc('send_direct_message', {
    p_conversation_id: conversationId,
    ...(body ? { p_body: body } : {}),
    p_message_type: messageType,
    ...(attachmentUrl ? { p_attachment_url: attachmentUrl } : {}),
    ...(attachmentMetadata ? { p_attachment_metadata: attachmentMetadata as never } : {}),
    ...(replyToMessageId ? { p_reply_to_message_id: replyToMessageId } : {}),
  })

  if (error || !data) return { message: null, error: mapMessagingError(error) }

  const message = parseDirectMessage(data)
  if (!message) {
    reportInvalidBoundary('send_message_result_invalid')
    return { message: null, error: 'Message could not be sent.' }
  }

  if (messageType === 'text') {
    notify({ type: 'message', actorId: senderId, conversationId, messageId: message.id })
  }

  return { message, error: null }
}

export async function deleteMessage(messageId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('delete_message', { p_message_id: messageId })
  if (error) return { error: mapMessagingError(error) }
  return { error: null }
}

export async function forwardMessage(
  sourceMessageId: string,
  targetConversationId: string,
  senderId: string
): Promise<{ message: DirectMessage | null; error: string | null }> {
  const { data: source } = await supabase.from('messages')
    .select('body, message_type, attachment_url, attachment_metadata')
    .eq('id', sourceMessageId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!source) return { message: null, error: 'Message not found.' }

  return sendRichMessage(
    targetConversationId,
    senderId,
    isMessageType(source.message_type) ? source.message_type : 'text',
    source.body ?? null,
    source.attachment_url ?? null,
    typeof source.attachment_metadata === 'object' && source.attachment_metadata !== null && !Array.isArray(source.attachment_metadata)
      ? source.attachment_metadata
      : null
  )
}

export async function searchConversationMessages(
  conversationId: string,
  query: string
): Promise<DirectMessage[]> {
  const { data } = await supabase.from('messages')
    .select(
      'id, conversation_id, sender_id, body, message_type, attachment_url, attachment_metadata, reply_to_message_id, created_at, deleted_at'
    )
    .eq('conversation_id', conversationId)
    .eq('message_type', 'text')
    .is('deleted_at', null)
    .ilike('body', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(50)
  return parseMessagesWithSignal(data, 'message_search_row_invalid')
}

export async function fetchSharedMedia(conversationId: string): Promise<DirectMessage[]> {
  const { data } = await supabase.from('messages')
    .select(
      'id, conversation_id, sender_id, body, message_type, attachment_url, attachment_metadata, reply_to_message_id, created_at, deleted_at'
    )
    .eq('conversation_id', conversationId)
    .in('message_type', ['image', 'video'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  return parseMessagesWithSignal(data, 'shared_media_row_invalid')
}

export async function addReaction(messageId: string, emoji: string): Promise<void> {
  const { error } = await supabase.from('message_reactions').upsert(
    { message_id: messageId, emoji } as never,
    { onConflict: 'message_id,user_id' }
  )
  if (error) throw error
}

export async function removeReaction(messageId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function fetchMessageReactions(conversationId: string): Promise<MessageReaction[]> {
  const { data } = await supabase.from('message_reactions')
    .select('id, message_id, user_id, emoji, created_at, messages!inner(conversation_id)')
    .eq('messages.conversation_id', conversationId)

  return (data ?? []).map((r) => ({
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
      payload => {
        const reaction = parseMessageReaction(payload.new)
        if (reaction) {
          onChange({ eventType: 'INSERT', reaction })
        } else {
          reportInvalidBoundary('reaction_realtime_payload_invalid')
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'message_reactions' },
      payload => {
        const reaction = parseMessageReaction(payload.old)
        if (reaction) {
          onChange({ eventType: 'DELETE', reaction })
        } else {
          reportInvalidBoundary('reaction_realtime_payload_invalid')
        }
      }
    )
    .subscribe()
}

export async function pinMessage(messageId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('pin_message', { p_message_id: messageId })
  if (error) return { error: mapMessagingError(error) }
  return { error: null }
}

export async function unpinMessage(messageId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('unpin_message', { p_message_id: messageId })
  if (error) return { error: mapMessagingError(error) }
  return { error: null }
}

export async function fetchPinnedMessages(conversationId: string): Promise<PinnedMessage[]> {
  const { data } = await supabase.from('conversation_pinned_messages')
    .select('id, conversation_id, message_id, pinned_by, pinned_at')
    .eq('conversation_id', conversationId)
    .order('pinned_at', { ascending: false })

  if (!data || data.length === 0) return []

  const pinned = data.map(parsePinnedMessage).filter((item): item is PinnedMessage => item !== null)
  if (pinned.length !== data.length) {
    reportInvalidBoundary('pinned_message_row_invalid')
  }
  const messageIds = pinned.map(p => p.message_id)
  const { data: messages } = await supabase.from('messages')
    .select('id, conversation_id, sender_id, body, message_type, attachment_url, attachment_metadata, reply_to_message_id, created_at, deleted_at')
    .in('id', messageIds)

  const messageMap = new Map<string, DirectMessage>(parseMessagesWithSignal(messages, 'pinned_message_content_invalid').map(m => [m.id, m]))

  return pinned.map(p => ({
    id: p.id,
    conversation_id: p.conversation_id,
    message_id: p.message_id,
    pinned_by: p.pinned_by,
    pinned_at: p.pinned_at,
    message: messageMap.get(p.message_id),
  }))
}

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
      payload => {
        const message = parseDirectMessage(payload.new)
        if (message) {
          onMessage(message)
        } else {
          reportInvalidBoundary('message_realtime_payload_invalid')
        }
      }
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
  setTimeout(() => channel.track({ typing: false }), 2000)
}

export function removeChannel(channel: ReturnType<typeof supabase.channel>): void {
  void supabase.removeChannel(channel)
}

export function subscribeToInboxMessages(userId: string, onNewMessage: () => void) {
  return supabase
    .channel(`inbox_messages:${userId}:${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      onNewMessage
    )
    .subscribe()
}
