import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export type AlertItem = {
  id: string
  type: 'like' | 'comment' | 'follow'
  actorUsername: string
  actorName: string | null
  postId?: string
  commentText?: string
  createdAt: string
}

export function useAlerts(user: User | null) {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!user) {
        setLoading(false)
        return
      }
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const { data: myPosts, error: postsError } = await (supabase.from('posts') as any)
        .select('id')
        .eq('user_id', user.id)

      if (postsError) {
        setError(postsError.message)
        if (isRefresh) setRefreshing(false)
        else setLoading(false)
        return
      }

      const postIds: string[] = myPosts?.map((p: any) => p.id) ?? []
      const items: AlertItem[] = []

      if (postIds.length > 0) {
        const [likesRes, commentsRes] = await Promise.all([
          (supabase.from('likes') as any)
            .select(
              'id, created_at, user_id, post_id, actor:users!likes_user_id_fkey(username, full_name)'
            )
            .in('post_id', postIds)
            .neq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50),
          (supabase.from('comments') as any)
            .select(
              'id, created_at, user_id, post_id, content, actor:users!comments_user_id_fkey(username, full_name)'
            )
            .in('post_id', postIds)
            .neq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50),
        ])

        for (const row of likesRes.data ?? []) {
          items.push({
            id: `like-${row.id}`,
            type: 'like',
            actorUsername: row.actor?.username ?? 'unknown',
            actorName: row.actor?.full_name ?? null,
            postId: row.post_id,
            createdAt: row.created_at,
          })
        }

        for (const row of commentsRes.data ?? []) {
          items.push({
            id: `comment-${row.id}`,
            type: 'comment',
            actorUsername: row.actor?.username ?? 'unknown',
            actorName: row.actor?.full_name ?? null,
            postId: row.post_id,
            commentText: row.content,
            createdAt: row.created_at,
          })
        }
      }

      const { data: followRows, error: followsError } = await (supabase.from('follows') as any)
        .select(
          'id, created_at, follower_id, actor:users!follows_follower_id_fkey(username, full_name)'
        )
        .eq('following_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (followsError) {
        setError(followsError.message)
      } else {
        for (const row of followRows ?? []) {
          items.push({
            id: `follow-${row.id}`,
            type: 'follow',
            actorUsername: row.actor?.username ?? 'unknown',
            actorName: row.actor?.full_name ?? null,
            createdAt: row.created_at,
          })
        }
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setAlerts(items)
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    },
    [user?.id]
  )

  useEffect(() => {
    load(false)
  }, [load])

  return { alerts, loading, refreshing, refresh: (isRefresh = true) => load(isRefresh), error }
}
