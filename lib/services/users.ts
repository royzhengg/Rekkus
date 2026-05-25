import { analytics } from '@/lib/analytics'
import { notify } from '@/lib/services/notifications'
import { supabase } from '@/lib/supabase'

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

export async function fetchFollowers(userId: string, limit = 50): Promise<FollowListUser[]> {
  const { data } = await supabase.from('follows')
    .select('users!follows_follower_id_fkey ( id, username, full_name, avatar_url )')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data?.map((row) => row.users).filter(Boolean) ?? []
}

export async function fetchFollowing(userId: string, limit = 50): Promise<FollowListUser[]> {
  const { data } = await supabase.from('follows')
    .select('users!follows_following_id_fkey ( id, username, full_name, avatar_url )')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data?.map((row) => row.users).filter(Boolean) ?? []
}

export function updateLastSeen(userId: string): void {
  void supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
}
