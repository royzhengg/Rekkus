import { supabase } from '@/lib/supabase'
import type { UserId } from '@/lib/types/branded'
import type { User } from '@/lib/types/user'

export type FollowRelationshipState = 'none' | 'requested' | 'incoming_request' | 'following' | 'blocked'

export async function getUserProfile(id: UserId): Promise<User | null> {
  const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle()
  return data ?? null
}

export async function getFollowState(
  _viewerId: UserId,
  targetId: UserId
): Promise<FollowRelationshipState> {
  const { data, error } = await supabase.rpc('follow_relationship_state', {
    p_target_id: targetId,
  })
  if (error) throw error
  return data === 'requested' || data === 'incoming_request' || data === 'following' || data === 'blocked'
    ? data
    : 'none'
}

export async function listFollowers(
  userId: UserId,
  limit = 50
): Promise<User[]> {
  const { data } = await supabase
    .from('follows')
    .select('users!follows_follower_id_fkey(*)')
    .eq('following_id', userId)
    .limit(limit)
  return (data ?? []).flatMap(r => (r.users ? [r.users as User] : []))
}

export async function listFollowing(
  userId: UserId,
  limit = 50
): Promise<User[]> {
  const { data } = await supabase
    .from('follows')
    .select('users!follows_following_id_fkey(*)')
    .eq('follower_id', userId)
    .limit(limit)
  return (data ?? []).flatMap(r => (r.users ? [r.users as User] : []))
}
