import { analytics } from '@/lib/analytics'
import { notify } from '@/lib/services/notifications'
import { supabase } from '@/lib/supabase'

type SupabaseChannel = ReturnType<typeof supabase.channel>

export type ProfileInfo = {
  username: string
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  suburb: string | null
  city: string | null
  country: string | null
}

export type PublicProfileShell = {
  id: string
  username: string
  full_name: string | null
  post_count: number
}

export type FollowRelationshipState = 'none' | 'requested' | 'incoming_request' | 'following' | 'blocked'

export type FollowRequest = {
  id: string
  requester_id: string
  target_id: string
  status: 'pending' | 'approved' | 'declined' | 'cancelled'
  created_at: string
  requester: FollowListUser
}

export type ProfileVisibilityState = {
  private_account: boolean
  can_view_content: boolean
}

export async function fetchProfile(userId: string): Promise<ProfileInfo | null> {
  const { data } = await supabase.from('users')
    .select('username, full_name, bio, avatar_url, suburb, city, country')
    .eq('id', userId)
    .single()
  return data ?? null
}

export async function updateProfile(userId: string, updates: Partial<ProfileInfo>): Promise<void> {
  const { error } = await supabase.from('users').upsert({
    id: userId,
    ...updates,
    updated_at: new Date().toISOString(),
  } as never)
  if (error) throw error
  void supabase.rpc('record_profile_audit_event', {
    p_event_type: 'profile_updated',
    p_context: { changed_fields: Object.keys(updates) },
  })
}

export async function updateAvatar(userId: string, avatarUrl: string): Promise<void> {
  await updateProfile(userId, { avatar_url: avatarUrl })
}

export async function fetchUserIdByUsername(username: string): Promise<string | null> {
  const { data } = await supabase.from('users')
    .select('id')
    .eq('username', username)
    .single()
  return data?.id ?? null
}

export async function fetchPublicProfileShell(username: string): Promise<PublicProfileShell | null> {
  const { data, error } = await supabase.from('users')
    .select('id, username, full_name, post_count')
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchProfileVisibilityState(targetUserId: string): Promise<ProfileVisibilityState> {
  const { data, error } = await supabase.rpc('profile_visibility_state', { p_target_id: targetUserId })
  if (error) throw error
  const first = Array.isArray(data) ? data[0] : null
  return {
    private_account: first?.private_account === true,
    can_view_content: first?.can_view_content === true,
  }
}

export async function fetchIsFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase.from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  return !!data
}

export async function fetchFollowRelationshipState(targetUserId: string): Promise<FollowRelationshipState> {
  const { data, error } = await supabase.rpc('follow_relationship_state', { p_target_id: targetUserId })
  if (error) throw error
  return data === 'requested' || data === 'incoming_request' || data === 'following' || data === 'blocked'
    ? data
    : 'none'
}

export async function followUser(followerId: string, followingId: string): Promise<FollowRelationshipState> {
  const { data, error } = await supabase.rpc('request_follow', { p_target_id: followingId })
  if (error) throw error
  const state: FollowRelationshipState = data === 'requested' ? 'requested' : 'following'
  analytics.followRequestStateChanged(followerId, state === 'requested' ? 'sent' : 'approved_immediate')
  if (state === 'following') {
    analytics.follow(followerId, followingId)
    notify({ type: 'follow', actorId: followerId, followedId: followingId })
  } else {
    notify({ type: 'follow_request', actorId: followerId, targetId: followingId })
  }
  return state
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase.from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (error) throw error
  await supabase.rpc('cancel_follow_request', { p_target_id: followingId })
}

export async function fetchFollowedUsernames(userId: string): Promise<string[]> {
  const { data } = await supabase.from('follows')
    .select('users!follows_following_id_fkey ( username )')
    .eq('follower_id', userId)
  return data?.map((r) => r.users?.username).filter(Boolean) ?? []
}

export type FollowedUserBasic = {
  user_id: string
  username: string
  full_name: string | null
  avatar_url: string | null
}

export async function fetchFollowedUsersBasic(userId: string): Promise<FollowedUserBasic[]> {
  const { data } = await supabase.from('follows')
    .select('following_id, users!follows_following_id_fkey(username, full_name, avatar_url)')
    .eq('follower_id', userId)
    .limit(200)
  return (data ?? []).map((row) => ({
    user_id: row.following_id,
    username: row.users?.username ?? 'unknown',
    full_name: row.users?.full_name ?? null,
    avatar_url: row.users?.avatar_url ?? null,
  }))
}

export async function searchUsersBasic(
  query: string,
  excludeUserId: string
): Promise<FollowedUserBasic[]> {
  const q = `%${query.trim()}%`
  const { data } = await supabase.from('users')
    .select('id, username, full_name, avatar_url')
    .or(`username.ilike.${q},full_name.ilike.${q}`)
    .neq('id', excludeUserId)
    .limit(30)
  return (data ?? []).map((row) => ({
    user_id: row.id,
    username: row.username ?? 'unknown',
    full_name: row.full_name ?? null,
    avatar_url: row.avatar_url ?? null,
  }))
}

export async function fetchFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followersRes, followingRes] = await Promise.all([
    supabase.from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId),
    supabase.from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId),
  ])
  if (followersRes.error) throw followersRes.error
  if (followingRes.error) throw followingRes.error
  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  }
}

export type FollowListUser = {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
}

function parseFollowRequest(value: unknown): FollowRequest | null {
  if (!isRecord(value)) return null
  const requester = parseFollowListUser(value.users)
  if (
    typeof value.id !== 'string' ||
    typeof value.requester_id !== 'string' ||
    typeof value.target_id !== 'string' ||
    typeof value.created_at !== 'string' ||
    value.status !== 'pending' ||
    requester === null
  ) return null
  return {
    id: value.id,
    requester_id: value.requester_id,
    target_id: value.target_id,
    status: value.status,
    created_at: value.created_at,
    requester,
  }
}

export async function fetchIncomingFollowRequests(limit = 50): Promise<FollowRequest[]> {
  const { data, error } = await supabase.from('follow_requests')
    .select('id, requester_id, target_id, status, created_at, users!follow_requests_requester_id_fkey ( id, username, full_name, avatar_url )')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit)
    .overrideTypes<unknown[], { merge: false }>()
  if (error) throw error
  return (data ?? []).map(parseFollowRequest).filter((row): row is FollowRequest => row !== null)
}

export async function approveFollowRequest(requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('approve_follow_request', { p_request_id: requestId })
  if (error) throw error
  const requesterId = typeof data === 'string' ? data : ''
  analytics.followRequestStateChanged(requesterId || null, 'approved')
  if (requesterId) notify({ type: 'follow_request_approved', actorId: '', requesterId })
  return requesterId
}

export async function declineFollowRequest(requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('decline_follow_request', { p_request_id: requestId })
  if (error) throw error
  const requesterId = typeof data === 'string' ? data : ''
  analytics.followRequestStateChanged(requesterId || null, 'declined')
  return requesterId
}

type BulkApprovalResult = {
  approvedRequesterIds: string[]
  approvedCount: number
}

function parseBulkApprovalResult(value: unknown): BulkApprovalResult {
  if (!isRecord(value)) return { approvedRequesterIds: [], approvedCount: 0 }
  const ids = Array.isArray(value.approved_requester_ids)
    ? value.approved_requester_ids.filter((id): id is string => typeof id === 'string')
    : []
  const count = typeof value.approved_count === 'number' ? value.approved_count : ids.length
  return { approvedRequesterIds: ids, approvedCount: count }
}

export async function approveAllFollowRequests(): Promise<BulkApprovalResult> {
  const { data, error } = await supabase.rpc('approve_all_follow_requests')
  if (error) throw error
  const result = parseBulkApprovalResult(data)
  analytics.followRequestStateChanged(null, 'approved_bulk')
  return result
}

export async function declineAllFollowRequests(): Promise<number> {
  const { data, error } = await supabase.rpc('decline_all_follow_requests')
  if (error) throw error
  analytics.followRequestStateChanged(null, 'declined_bulk')
  return typeof data === 'number' ? data : 0
}

export type FollowChange = {
  eventType: 'INSERT' | 'DELETE'
  followerId: string
  followingId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseFollowListUser(value: unknown): FollowListUser | null {
  if (!isRecord(value)) return null
  const id = value.id
  const username = value.username
  if (typeof id !== 'string' || typeof username !== 'string') return null
  return {
    id,
    username,
    full_name: typeof value.full_name === 'string' ? value.full_name : null,
    avatar_url: typeof value.avatar_url === 'string' ? value.avatar_url : null,
  }
}

function parseFollowChange(eventType: FollowChange['eventType'], value: unknown): FollowChange | null {
  if (!isRecord(value)) return null
  const followerId = value.follower_id
  const followingId = value.following_id
  if (typeof followerId !== 'string' || typeof followingId !== 'string') return null
  return { eventType, followerId, followingId }
}

export async function fetchFollowers(userId: string, limit = 50): Promise<FollowListUser[]> {
  const { data, error } = await supabase.from('follows')
    .select('users!follows_follower_id_fkey ( id, username, full_name, avatar_url )')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? [])
    .map(row => parseFollowListUser(row.users))
    .filter((row): row is FollowListUser => row !== null)
}

export async function fetchFollowing(userId: string, limit = 50): Promise<FollowListUser[]> {
  const { data, error } = await supabase.from('follows')
    .select('users!follows_following_id_fkey ( id, username, full_name, avatar_url )')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? [])
    .map(row => parseFollowListUser(row.users))
    .filter((row): row is FollowListUser => row !== null)
}

export function subscribeToFollowChanges(
  userId: string,
  onChange: (change: FollowChange) => void
): SupabaseChannel {
  const handleInsert = (value: unknown) => {
    const change = parseFollowChange('INSERT', value)
    if (change) onChange(change)
  }
  const handleDelete = (value: unknown) => {
    const change = parseFollowChange('DELETE', value)
    if (change) onChange(change)
  }

  return supabase
    .channel(`follows:${userId}:${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'follows', filter: `follower_id=eq.${userId}` },
      payload => handleInsert(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'follows', filter: `follower_id=eq.${userId}` },
      payload => handleDelete(payload.old)
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
      payload => handleInsert(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
      payload => handleDelete(payload.old)
    )
    .subscribe()
}

export function removeFollowChannel(channel: SupabaseChannel): void {
  void supabase.removeChannel(channel)
}

export async function updateLastSeen(userId: string): Promise<void> {
  await supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
}

export function mapRowToFollowListUser(row: unknown): { id: string; username: string; full_name: string | null; avatar_url: string | null } | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (typeof r['id'] !== 'string' || typeof r['username'] !== 'string') return null
  return {
    id: r['id'],
    username: r['username'],
    full_name: typeof r['full_name'] === 'string' ? r['full_name'] : null,
    avatar_url: typeof r['avatar_url'] === 'string' ? r['avatar_url'] : null,
  }
}
