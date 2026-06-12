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

export async function fetchIsFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase.from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  return !!data
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase.from('follows').upsert(
    { follower_id: followerId, following_id: followingId },
    { onConflict: 'follower_id,following_id' }
  )
  if (error) throw error
  analytics.follow(followerId, followingId)
  notify({ type: 'follow', actorId: followerId, followedId: followingId })
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase.from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (error) throw error
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

export function updateLastSeen(userId: string): void {
  void supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
}
