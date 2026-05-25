import { supabase } from '@/lib/supabase'

export type AlertItem = {
  id: string
  type: 'like' | 'comment' | 'follow' | 'comment_reply'
  actorUsername: string
  actorName: string | null
  postId?: string
  createdAt: string
}

type AlertActor = { username: string | null; full_name: string | null }
type AlertRow = {
  id: string
  created_at: string | null
  post_id?: string | null
  actor: AlertActor | AlertActor[] | null
}

function rowActor(actor: AlertActor | AlertActor[] | null): AlertActor | null {
  return Array.isArray(actor) ? actor[0] ?? null : actor
}

function alertDate(value: string | null): string {
  return value ?? new Date().toISOString()
}

export function mapAlertRow(type: AlertItem['type'], row: AlertRow): AlertItem {
  const actor = rowActor(row.actor)
  return {
    id: `${type === 'comment_reply' ? 'reply' : type}-${row.id}`,
    type,
    actorUsername: actor?.username ?? 'unknown',
    actorName: actor?.full_name ?? null,
    ...(typeof row.post_id === 'string' ? { postId: row.post_id } : {}),
    createdAt: alertDate(row.created_at),
  }
}

export async function fetchAlerts(userId: string): Promise<AlertItem[]> {
  const { data: myPosts, error: postsError } = await supabase
    .from('posts')
    .select('id')
    .eq('user_id', userId)
    .limit(100)
  if (postsError) throw postsError

  const postIds = (myPosts ?? []).map(post => post.id)
  const items: AlertItem[] = []

  if (postIds.length > 0) {
    const [likesResult, commentsResult] = await Promise.all([
      supabase
        .from('likes')
        .select('id, created_at, user_id, post_id, actor:users!likes_user_id_fkey(username, full_name)')
        .in('post_id', postIds)
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('comments')
        .select('id, created_at, user_id, post_id, parent_id, actor:users!comments_user_id_fkey(username, full_name)')
        .in('post_id', postIds)
        .neq('user_id', userId)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    if (likesResult.error) throw likesResult.error
    if (commentsResult.error) throw commentsResult.error

    for (const row of likesResult.data ?? []) {
      items.push(mapAlertRow('like', row))
    }

    for (const row of commentsResult.data ?? []) {
      items.push(mapAlertRow('comment', row))
    }
  }

  const { data: myComments, error: commentsError } = await supabase
    .from('comments')
    .select('id')
    .eq('user_id', userId)
    .is('parent_id', null)
    .limit(100)
  if (commentsError) throw commentsError

  const commentIds = (myComments ?? []).map(comment => comment.id)
  if (commentIds.length > 0) {
    const { data: replies, error } = await supabase
      .from('comments')
      .select('id, created_at, user_id, post_id, parent_id, actor:users!comments_user_id_fkey(username, full_name)')
      .in('parent_id', commentIds)
      .neq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error

    for (const row of replies ?? []) {
      items.push(mapAlertRow('comment_reply', row))
    }
  }

  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('id, created_at, follower_id, actor:users!follows_follower_id_fkey(username, full_name)')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (followsError) throw followsError

  for (const row of follows ?? []) {
    items.push(mapAlertRow('follow', row))
  }

  return items.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}
