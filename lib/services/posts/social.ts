import { analytics } from '@/lib/analytics'
import { notify } from '@/lib/services/notifications'
import { supabase } from '@/lib/supabase'
import type { PostReactionType, PostSocialState } from './types'

function isPostReactionType(value: unknown): value is PostReactionType {
  return value === 'helpful' || value === 'love' || value === 'thanks' || value === 'oh_no'
}

export async function likePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('likes').upsert(
    { post_id: postId, user_id: userId },
    { onConflict: 'user_id,post_id' }
  )
  if (error) throw error
  notify({ type: 'like', actorId: userId, postId })
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId)
  if (error) throw error
}

export async function togglePostLike(
  postId: string,
  userId: string,
  nextLiked?: boolean
): Promise<boolean> {
  const targetState = nextLiked ?? !(await fetchUserLikes(userId)).includes(postId)
  if (targetState) {
    await likePost(postId, userId)
    analytics.likePost(userId, postId)
  } else {
    await unlikePost(postId, userId)
  }
  return targetState
}

export async function savePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('saves').upsert(
    { post_id: postId, user_id: userId },
    { onConflict: 'user_id,post_id' }
  )
  if (error) throw error
}

export async function unsavePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('saves').delete().eq('post_id', postId).eq('user_id', userId)
  if (error) throw error
}

export async function togglePostSave(
  postId: string,
  userId: string,
  nextSaved?: boolean,
  cuisineType?: string | null
): Promise<boolean> {
  const targetState = nextSaved ?? !(await fetchUserSaves(userId)).includes(postId)
  if (targetState) {
    await savePost(postId, userId)
    analytics.savePost(userId, postId, cuisineType)
  } else {
    await unsavePost(postId, userId)
  }
  return targetState
}

export async function addPostReaction(
  postId: string,
  userId: string,
  reactionType: PostReactionType
): Promise<void> {
  const { error } = await supabase.from('post_reactions').insert({
    post_id: postId,
    user_id: userId,
    reaction_type: reactionType,
  })
  if (error) throw error
}

export async function removePostReaction(
  postId: string,
  userId: string,
  reactionType: PostReactionType
): Promise<void> {
  const { error } = await supabase.from('post_reactions')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)
    .eq('reaction_type', reactionType)
  if (error) throw error
}

export async function fetchPostLikes(postId: string): Promise<number> {
  const { count } = await supabase.from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)
  return count ?? 0
}

export async function fetchPostSocialState(
  postId: string,
  userId?: string,
  restaurantId?: string | null
): Promise<PostSocialState> {
  const [countRes, commentsRes, reactionsRes] = await Promise.all([
    supabase.from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId),
    supabase.from('comments')
      .select('id, content, created_at, parent_id, users(username, full_name)')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase.from('post_reactions')
      .select('reaction_type, user_id')
      .eq('post_id', postId),
  ])

  const reactionCounts: Record<string, number> = {}
  const myReactions: PostReactionType[] = []
  for (const reaction of reactionsRes.data ?? []) {
    if (!isPostReactionType(reaction.reaction_type)) continue
    reactionCounts[reaction.reaction_type] = (reactionCounts[reaction.reaction_type] ?? 0) + 1
    if (userId && reaction.user_id === userId) {
      myReactions.push(reaction.reaction_type)
    }
  }

  let liked = false
  let saved = false
  let locationSaved = false
  if (userId) {
    const [likeRes, saveRes] = await Promise.all([
      supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
      supabase.from('saves').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
    ])
    liked = !!likeRes.data
    saved = !!saveRes.data
    if (restaurantId) {
      const { data } = await supabase.from('saved_locations').select('id').eq('restaurant_id', restaurantId).eq('user_id', userId).maybeSingle()
      locationSaved = !!data
    }
  }

  return {
    likeCount: countRes.count ?? 0,
    comments: commentsRes.data ?? [],
    reactionCounts,
    myReactions,
    liked,
    saved,
    locationSaved,
  }
}

export async function fetchUserLikes(userId: string): Promise<string[]> {
  const { data } = await supabase.from('likes')
    .select('post_id')
    .eq('user_id', userId)
    .limit(500)
  return data?.map((r) => r.post_id) ?? []
}

export async function fetchUserSaves(userId: string): Promise<string[]> {
  const { data } = await supabase.from('saves')
    .select('post_id')
    .eq('user_id', userId)
    .limit(500)
  return data?.map((r) => r.post_id) ?? []
}
