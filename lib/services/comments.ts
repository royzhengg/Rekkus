import { supabase } from '@/lib/supabase'

export type Comment = {
  id: string
  content: string
  created_at: string
  users: { username: string; full_name: string | null } | null
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data } = await (supabase.from('comments') as any)
    .select('id, content, created_at, users(username, full_name)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(200)
  return data ?? []
}

export async function addComment(postId: string, userId: string, content: string): Promise<void> {
  await (supabase.from('comments') as any).insert({ post_id: postId, user_id: userId, content })
}
