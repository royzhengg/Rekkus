export type NotificationType = 'like' | 'comment' | 'follow' | 'comment_reply' | 'message'

export type NotifyPayload = {
  type: NotificationType
  postId?: string
  followedId?: string
  commentId?: string
  conversationId?: string
  messageId?: string
}

export type EmbedTable = 'posts' | 'places' | 'dishes'
export type PostTextRow = { id: string; must_order?: string | null; caption?: string | null; cuisine_type?: string | null }
export type PlaceTextRow = { id: string; name?: string | null; cuisine_type?: string | null; suburb?: string | null; city?: string | null }
export type DishTextRow = { id: string; name?: string | null; cuisine_type?: string | null }

export type ModerateContentPayload = {
  messageType: string
  body?: string
  mediaHash?: string
  conversationId: string
}

export type ProcessPostMediaPayload = { mediaIds: string[] }
export type FeatureFlagOverrideRow = { flag_name: string; enabled: boolean; expires_at: string | null }
export type NotificationActorRow = { username: string; full_name: string | null }
export type NotificationUserIdRow = { user_id: string | null }
export type PushTokenRow = { token: string }
export type NotificationSettingsRow = {
  notif_likes: boolean | null
  notif_comments: boolean | null
  notif_followers: boolean | null
  notif_mentions: boolean | null
  notif_messages: boolean | null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseNotifyPayload(value: unknown): NotifyPayload | null {
  if (!isRecord(value)) return null
  const type = value.type
  if (
    type !== 'like' &&
    type !== 'comment' &&
    type !== 'follow' &&
    type !== 'comment_reply' &&
    type !== 'message'
  ) return null

  const payload: NotifyPayload = { type }
  if (typeof value.postId === 'string') payload.postId = value.postId
  if (typeof value.followedId === 'string') payload.followedId = value.followedId
  if (typeof value.commentId === 'string') payload.commentId = value.commentId
  if (typeof value.conversationId === 'string') payload.conversationId = value.conversationId
  if (typeof value.messageId === 'string') payload.messageId = value.messageId
  return payload
}

export function embedTable(value: unknown): EmbedTable | null {
  return value === 'posts' || value === 'places' || value === 'dishes' ? value : null
}

export function isPostTextRow(value: unknown): value is PostTextRow {
  return isRecord(value) && typeof value.id === 'string'
}

export function isPlaceTextRow(value: unknown): value is PlaceTextRow {
  return isRecord(value) && typeof value.id === 'string'
}

export function isDishTextRow(value: unknown): value is DishTextRow {
  return isRecord(value) && typeof value.id === 'string'
}

export function postToText(post: PostTextRow): string {
  return [post.must_order, post.caption, post.cuisine_type]
    .filter(Boolean)
    .join(' ')
    .trim()
}

export function placeToText(r: PlaceTextRow): string {
  return [r.name, r.cuisine_type, r.suburb, r.city]
    .filter(Boolean)
    .join(' ')
    .trim()
}

export function dishToText(d: DishTextRow): string {
  return [d.name, d.cuisine_type]
    .filter(Boolean)
    .join(' ')
    .trim()
}

export function parseModerateContentPayload(value: unknown): ModerateContentPayload | null {
  if (!isRecord(value)) return null
  if (typeof value.messageType !== 'string') return null
  if (typeof value.conversationId !== 'string' || value.conversationId.length === 0) return null

  const payload: ModerateContentPayload = {
    messageType: value.messageType,
    conversationId: value.conversationId,
  }
  if (typeof value.body === 'string') payload.body = value.body
  if (typeof value.mediaHash === 'string') payload.mediaHash = value.mediaHash
  return payload
}

export function parseProcessPostMediaPayload(value: unknown): ProcessPostMediaPayload | null {
  if (!isRecord(value) || !Array.isArray(value.mediaIds)) return null
  const mediaIds = value.mediaIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  return mediaIds.length === value.mediaIds.length ? { mediaIds } : null
}

export function isFeatureFlagOverrideRow(value: unknown): value is FeatureFlagOverrideRow {
  return (
    isRecord(value) &&
    typeof value.flag_name === 'string' &&
    typeof value.enabled === 'boolean' &&
    (value.expires_at === null || typeof value.expires_at === 'string')
  )
}

export function isNotificationActorRow(value: unknown): value is NotificationActorRow {
  return isRecord(value) && typeof value.username === 'string' && (value.full_name === null || typeof value.full_name === 'string')
}

export function isNotificationUserIdRow(value: unknown): value is NotificationUserIdRow {
  return isRecord(value) && (value.user_id === null || typeof value.user_id === 'string')
}

export function isPushTokenRow(value: unknown): value is PushTokenRow {
  return isRecord(value) && typeof value.token === 'string' && value.token.length > 0
}

export function isNotificationSettingsRow(value: unknown): value is NotificationSettingsRow {
  if (!isRecord(value)) return false
  return ['notif_likes', 'notif_comments', 'notif_followers', 'notif_mentions', 'notif_messages']
    .every(key => value[key] === null || typeof value[key] === 'boolean')
}
