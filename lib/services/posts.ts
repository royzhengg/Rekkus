import { supabase } from '@/lib/supabase'

export async function likePost(postId: string, userId: string): Promise<void> {
  await (supabase.from('likes') as any).insert({ post_id: postId, user_id: userId })
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  await (supabase.from('likes') as any).delete().eq('post_id', postId).eq('user_id', userId)
}

export async function savePost(postId: string, userId: string): Promise<void> {
  await (supabase.from('saves') as any).insert({ post_id: postId, user_id: userId })
}

export async function unsavePost(postId: string, userId: string): Promise<void> {
  await (supabase.from('saves') as any).delete().eq('post_id', postId).eq('user_id', userId)
}

export async function fetchPostLikes(postId: string): Promise<number> {
  const { count } = await (supabase.from('likes') as any)
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)
  return count ?? 0
}

export async function fetchUserLikes(userId: string): Promise<string[]> {
  const { data } = await (supabase.from('likes') as any)
    .select('post_id')
    .eq('user_id', userId)
    .limit(500)
  return data?.map((r: any) => r.post_id) ?? []
}

export async function fetchUserSaves(userId: string): Promise<string[]> {
  const { data } = await (supabase.from('saves') as any)
    .select('post_id')
    .eq('user_id', userId)
    .limit(500)
  return data?.map((r: any) => r.post_id) ?? []
}
