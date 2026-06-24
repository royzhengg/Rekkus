import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'

type SupabaseChannel = ReturnType<typeof supabase.channel>

export type AlertType =
  | 'like'
  | 'comment'
  | 'comment_reply'
  | 'follow'
  | 'follow_request_pending'
  | 'follow_request_approved'

export type AlertFilter = 'activity' | 'requests'

export type AlertActor = {
  id: string
  username: string
  fullName: string | null
  avatarUrl: string | null
  privateAccount: boolean
}

export type AlertItem = {
  id: string
  type: AlertType
  actor: AlertActor | null
  postId?: string
  requestId?: string
  readAt: string | null
  createdAt: string
}

export type AlertsPage = {
  items: AlertItem[]
  pendingRequestCount: number
  unreadCount: number
}

type SocialEventRow = {
  id: string
  actor_id: string | null
  event_type: string
  entity_type: string
  entity_id: string
  read_at: string | null
  created_at: string
  metadata: unknown
  actor: unknown
}

type LegacyAlertActor = { username: string | null; full_name: string | null }
type LegacyAlertRow = {
  id: string
  created_at: string | null
  post_id?: string | null
  actor: LegacyAlertActor | LegacyAlertActor[] | null
}

const REQUEST_EVENT_TYPES = ['follow_request_pending', 'follow_request_approved'] as const
const APPROVED_REQUEST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value
}

function parseActor(value: unknown, privateAccount: boolean): AlertActor | null {
  const actor = first(value)
  if (!isRecord(actor)) return null
  const id = actor.id
  const username = actor.username
  if (typeof id !== 'string' || typeof username !== 'string') return null
  return {
    id,
    username,
    fullName: typeof actor.full_name === 'string' ? actor.full_name : null,
    avatarUrl: typeof actor.avatar_url === 'string' ? actor.avatar_url : null,
    privateAccount,
  }
}

function eventToAlertType(value: string): AlertType | null {
  if (value === 'like_post') return 'like'
  if (value === 'comment_post') return 'comment'
  if (value === 'reply_comment') return 'comment_reply'
  if (value === 'follow') return 'follow'
  if (value === 'follow_request_pending') return 'follow_request_pending'
  if (value === 'follow_request_approved') return 'follow_request_approved'
  return null
}

export function mapAlertRow(
  type: 'like' | 'comment' | 'follow' | 'comment_reply',
  row: LegacyAlertRow
): {
  id: string
  type: 'like' | 'comment' | 'follow' | 'comment_reply'
  actorUsername: string
  actorName: string | null
  postId?: string
  createdAt: string
} {
  const actor = first(row.actor)
  const username = isRecord(actor) && typeof actor.username === 'string' ? actor.username : 'unknown'
  const fullName = isRecord(actor) && typeof actor.full_name === 'string' ? actor.full_name : null
  return {
    id: `${type === 'comment_reply' ? 'reply' : type}-${row.id}`,
    type,
    actorUsername: username,
    actorName: fullName,
    ...(typeof row.post_id === 'string' ? { postId: row.post_id } : {}),
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

function parseEventRow(row: unknown, privateByActorId: Map<string, boolean>): AlertItem | null {
  if (!isRecord(row)) return null
  const id = row.id
  const actorId = row.actor_id
  const eventType = row.event_type
  const entityType = row.entity_type
  const entityId = row.entity_id
  const createdAt = row.created_at
  const readAt = row.read_at
  if (
    typeof id !== 'string' ||
    (typeof actorId !== 'string' && actorId !== null) ||
    typeof eventType !== 'string' ||
    typeof entityType !== 'string' ||
    typeof entityId !== 'string' ||
    typeof createdAt !== 'string' ||
    (typeof readAt !== 'string' && readAt !== null)
  ) return null
  const type = eventToAlertType(eventType)
  if (!type) return null
  const actor = parseActor(row.actor, actorId ? privateByActorId.get(actorId) === true : false)
  return {
    id,
    type,
    actor,
    ...(entityType === 'post' ? { postId: entityId } : {}),
    ...(entityType === 'follow_request' ? { requestId: entityId } : {}),
    readAt,
    createdAt,
  }
}

function isVisibleForFilter(item: AlertItem, filter: AlertFilter): boolean {
  if (filter === 'activity') return true
  if (item.type === 'follow_request_pending') return true
  if (item.type !== 'follow_request_approved') return false
  return Date.now() - new Date(item.createdAt).getTime() <= APPROVED_REQUEST_WINDOW_MS
}

async function fetchActorPrivacy(actorIds: string[]): Promise<Map<string, boolean>> {
  if (actorIds.length === 0) return new Map()
  const { data } = await supabase
    .from('user_settings')
    .select('id, private_account')
    .in('id', actorIds)
  const result = new Map<string, boolean>()
  for (const row of data ?? []) {
    if (typeof row.id === 'string') result.set(row.id, row.private_account === true)
  }
  return result
}

async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('social_events')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function fetchPendingRequestCount(): Promise<number> {
  const { count, error } = await supabase
    .from('follow_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

export async function fetchAlertsPage(
  filter: AlertFilter = 'activity',
  limit = 50
): Promise<AlertsPage> {
  let query = supabase
    .from('social_events')
    .select('id, actor_id, event_type, entity_type, entity_id, read_at, created_at, metadata, actor:users!social_events_actor_id_fkey(id, username, full_name, avatar_url)')

  if (filter === 'requests') {
    query = query.in('event_type', REQUEST_EVENT_TYPES) as typeof query
  }

  const eventQuery = query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))
    .overrideTypes<SocialEventRow[], { merge: false }>()

  const [{ data, error }, pendingRequestCount, unreadCount] = await Promise.all([
    eventQuery,
    fetchPendingRequestCount(),
    fetchUnreadCount(),
  ])
  if (error) throw error

  const rows = data ?? []
  const actorIds = rows
    .map(row => row.actor_id)
    .filter((value): value is string => typeof value === 'string')
  const privateByActorId = await fetchActorPrivacy([...new Set(actorIds)])
  const items = rows
    .map(row => parseEventRow(row, privateByActorId))
    .filter((item): item is AlertItem => item !== null)
    .filter(item => isVisibleForFilter(item, filter))

  return { items, pendingRequestCount, unreadCount }
}

export async function fetchAlerts(userId: string): Promise<AlertItem[]> {
  void userId
  const page = await fetchAlertsPage('activity')
  return page.items
}

export async function markAllAlertsRead(): Promise<number> {
  const { data, error } = await supabase.rpc('mark_all_social_events_read')
  if (error) throw error
  return typeof data === 'number' ? data : 0
}

export function subscribeToAlertChanges(userId: string, onChange: () => void): SupabaseChannel {
  const channel = supabase.channel(`alerts:${userId}:${Date.now()}`)
  channel
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'social_events',
      filter: `target_user_id=eq.${userId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'follow_requests',
      filter: `target_id=eq.${userId}`,
    }, onChange)
    .subscribe()
  return channel
}

export function removeAlertSubscription(channel: SupabaseChannel): void {
  void supabase.removeChannel(channel)
}
