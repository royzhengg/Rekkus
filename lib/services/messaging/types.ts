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
  message?: DirectMessage | undefined
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
