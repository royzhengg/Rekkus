import { useState, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export function useUnreadMessageCount(user: User | null): number {
  const [totalUnread, setTotalUnread] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  function isMissingRequestStateColumn(error: { message?: string; code?: string } | null): boolean {
    const message = error?.message ?? ''
    return error?.code === '42703' || message.includes('request_status')
  }

  async function fetchUnreadCount(userId: string) {
    let hasRequestState = true
    let { data: participantRows, error } = await (supabase.from('conversation_participants') as any)
      .select('conversation_id, last_read_at, request_status, conversations!inner(status)')
      .eq('user_id', userId)

    if (error && isMissingRequestStateColumn(error)) {
      hasRequestState = false
      const legacy = await (supabase.from('conversation_participants') as any)
        .select('conversation_id, last_read_at, conversations!inner(status)')
        .eq('user_id', userId)
      participantRows = legacy.data
      error = legacy.error
    }

    if (error) {
      setTotalUnread(0)
      return
    }

    const activeRows = (participantRows ?? []).filter((row: any) => {
      const conv = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
      if (conv?.status !== 'active') return false
      return !hasRequestState || (row.request_status ?? 'active') === 'active'
    })

    if (activeRows.length === 0) {
      setTotalUnread(0)
      return
    }

    const counts = await Promise.all(
      activeRows.map(async (row: any) => {
        let query = (supabase.from('messages') as any)
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', row.conversation_id)
          .neq('sender_id', userId)
          .is('deleted_at', null)

        if (row.last_read_at) {
          query = query.gt('created_at', row.last_read_at)
        }

        const { count } = await query
        return count ?? 0
      })
    )

    setTotalUnread(counts.reduce((sum, n) => sum + n, 0))
  }

  useEffect(() => {
    if (!user) {
      setTotalUnread(0)
      return
    }

    fetchUnreadCount(user.id)

    // Unique topic prevents Supabase returning a cached subscribed instance on
    // rapid remounts (React Strict Mode double-invocation). Wrapped in try/catch
    // so a subscription failure degrades gracefully instead of crashing the app.
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase
        .channel(`unread_messages:${user.id}:${Date.now()}`)
        .on(
          'postgres_changes' as any,
          { event: 'INSERT', schema: 'public', table: 'messages' },
          () => fetchUnreadCount(user.id)
        )
        .on(
          'postgres_changes' as any,
          { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${user.id}` },
          () => fetchUnreadCount(user.id)
        )
        .subscribe()
      channelRef.current = channel
    } catch {
      // Subscription setup failed; badge will show count from initial fetch only.
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [user?.id])

  return totalUnread
}
