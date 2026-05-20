import { supabase } from '@/lib/supabase'
import { notify } from '@/lib/services/notifications'
import { analytics } from '@/lib/analytics'
import { submitContentReport } from '@/lib/services/moderation'

export type Comment = {
  id: string
  content: string
  created_at: string
  parent_id: string | null
  users: { username: string; full_name: string | null } | null
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data } = await (supabase.from('comments') as any)
    .select('id, content, created_at, parent_id, users(username, full_name)')
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(500)
  return data ?? []
}

export async function fetchPostComments(postId: string): Promise<Comment[]> {
  return fetchComments(postId)
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_comment', { p_comment_id: commentId })
  if (error) throw error
}

export async function deleteOwnComment(commentId: string): Promise<void> {
  await deleteComment(commentId)
}

export async function addComment(postId: string, userId: string, content: string): Promise<void> {
  const { error } = await (supabase.from('comments') as any).insert({ post_id: postId, user_id: userId, content })
  if (error) throw error
  notify({ type: 'comment', actorId: userId, postId })
  analytics.commentPost(userId, postId)
}

export async function addPostComment(
  postId: string,
  userId: string,
  content: string,
  parentId?: string | null
): Promise<void> {
  if (parentId) {
    await addReply(postId, userId, content, parentId)
    return
  }
  await addComment(postId, userId, content)
}

export async function addReply(
  postId: string,
  userId: string,
  content: string,
  parentCommentId: string
): Promise<void> {
  const { error } = await (supabase.from('comments') as any).insert({
    post_id: postId,
    user_id: userId,
    content,
    parent_id: parentCommentId,
  })
  if (error) throw error
  notify({ type: 'comment_reply', actorId: userId, commentId: parentCommentId })
  analytics.commentPost(userId, postId)
}

export async function reportComment(
  commentId: string,
  reporterId: string,
  sourceSurface = 'post_detail_comment'
): Promise<string | null> {
  return submitContentReport({
    reporterId,
    targetType: 'comment',
    targetId: commentId,
    reason: 'inappropriate_or_spam',
    sourceSurface,
  })
}
