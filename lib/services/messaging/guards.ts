import { isRecord } from '../../utils/safeJson'
import type { ConversationParticipant, DirectMessage, MessageReaction, MessageType, PinnedMessage } from './types'

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

export function isMessageType(value: unknown): value is MessageType {
  return (
    value === 'text' || value === 'image' || value === 'video' || value === 'audio' ||
    value === 'gif' || value === 'sticker' || value === 'file' || value === 'location' ||
    value === 'post_share' || value === 'place_share' || value === 'system'
  )
}

export function parseDirectMessage(value: unknown): DirectMessage | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.conversation_id !== 'string' ||
    typeof value.sender_id !== 'string' ||
    !nullableString(value.body) ||
    !isMessageType(value.message_type) ||
    !nullableString(value.attachment_url) ||
    !nullableString(value.reply_to_message_id) ||
    typeof value.created_at !== 'string' ||
    !nullableString(value.deleted_at)
  ) return null
  const metadata = isRecord(value.attachment_metadata) ? value.attachment_metadata : null
  return {
    id: value.id,
    conversation_id: value.conversation_id,
    sender_id: value.sender_id,
    body: value.body,
    message_type: value.message_type,
    attachment_url: value.attachment_url,
    attachment_metadata: metadata,
    reply_to_message_id: value.reply_to_message_id,
    created_at: value.created_at,
    deleted_at: value.deleted_at,
  }
}

export function parseDirectMessageList(value: unknown): DirectMessage[] {
  return Array.isArray(value)
    ? value.map(parseDirectMessage).filter((message): message is DirectMessage => message !== null)
    : []
}

export function parseMessageReaction(value: unknown): MessageReaction | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.message_id !== 'string' ||
    typeof value.user_id !== 'string' ||
    typeof value.emoji !== 'string' ||
    typeof value.created_at !== 'string'
  ) return null
  return {
    id: value.id,
    message_id: value.message_id,
    user_id: value.user_id,
    emoji: value.emoji,
    created_at: value.created_at,
  }
}

export function parsePinnedMessage(value: unknown): PinnedMessage | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.conversation_id !== 'string' ||
    typeof value.message_id !== 'string' ||
    !nullableString(value.pinned_by) ||
    typeof value.pinned_at !== 'string'
  ) return null
  return {
    id: value.id,
    conversation_id: value.conversation_id,
    message_id: value.message_id,
    pinned_by: value.pinned_by,
    pinned_at: value.pinned_at,
  }
}

export function parseConversationParticipant(value: unknown): ConversationParticipant | null {
  if (!isRecord(value) || typeof value.user_id !== 'string') return null
  const users = isRecord(value.users) ? value.users : null
  if (!users || typeof users.username !== 'string') return null
  return {
    user_id: value.user_id,
    username: users.username,
    full_name: nullableString(users.full_name) ? users.full_name : null,
    avatar_url: nullableString(users.avatar_url) ? users.avatar_url : null,
    is_admin: typeof value.is_admin === 'boolean' ? value.is_admin : false,
    last_seen_at: null,
  }
}
