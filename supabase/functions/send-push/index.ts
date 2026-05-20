import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401 })

    const admin = createClient(supabaseUrl, serviceKey)
    const payload = await req.json().catch(() => null)
    const { type, postId, followedId, commentId, conversationId, messageId } = payload ?? {}
    const actorId = user.id

    if (!['like', 'comment', 'follow', 'comment_reply', 'message'].includes(type)) {
      return new Response('Bad request', { status: 400 })
    }

    const { data: actor } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', actorId)
      .single()
    if (!actor) return new Response('OK', { status: 200 })

    let recipientId: string | null = null
    if (type === 'like' || type === 'comment') {
      if (!postId || typeof postId !== 'string') {
        return new Response('Bad request', { status: 400 })
      }
      if (type === 'like') {
        const { data: like } = await admin
          .from('likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', actorId)
          .maybeSingle()
        if (!like) return new Response('OK', { status: 200 })
      }
      const { data: post } = await admin
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single()
      recipientId = (post as any)?.user_id ?? null
    } else if (type === 'follow') {
      if (!followedId || typeof followedId !== 'string') {
        return new Response('Bad request', { status: 400 })
      }
      const { data: follow } = await admin
        .from('follows')
        .select('id')
        .eq('follower_id', actorId)
        .eq('following_id', followedId)
        .maybeSingle()
      if (!follow) return new Response('OK', { status: 200 })
      recipientId = followedId ?? null
    } else if (type === 'comment_reply') {
      if (!commentId || typeof commentId !== 'string') {
        return new Response('Bad request', { status: 400 })
      }
      const { data: parentComment } = await admin
        .from('comments')
        .select('user_id')
        .eq('id', commentId)
        .single()
      recipientId = (parentComment as any)?.user_id ?? null
    } else if (type === 'message') {
      if (
        !conversationId ||
        typeof conversationId !== 'string' ||
        !messageId ||
        typeof messageId !== 'string'
      ) {
        return new Response('Bad request', { status: 400 })
      }
      const { data: message } = await admin
        .from('messages')
        .select('id, sender_id, conversation_id')
        .eq('id', messageId)
        .eq('conversation_id', conversationId)
        .eq('sender_id', actorId)
        .single()
      if (!message) return new Response('OK', { status: 200 })

      const { data: participant } = await admin
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('request_status', 'active')
        .neq('user_id', actorId)
        .limit(1)
        .maybeSingle()
      recipientId = (participant as any)?.user_id ?? null
    }

    if (!recipientId || recipientId === actorId) return new Response('OK', { status: 200 })

    const { data: settings } = await admin
      .from('user_settings')
      .select('notif_likes, notif_comments, notif_followers, notif_mentions, notif_messages')
      .eq('id', recipientId)
      .maybeSingle()

    const notificationAllowed =
      type === 'like'
        ? ((settings as any)?.notif_likes ?? true)
        : type === 'comment'
          ? ((settings as any)?.notif_comments ?? true)
          : type === 'comment_reply'
            ? ((settings as any)?.notif_comments ?? true)
            : type === 'follow'
              ? ((settings as any)?.notif_followers ?? true)
              : type === 'message'
                ? ((settings as any)?.notif_messages ?? true)
                : true

    if (!notificationAllowed) return new Response('OK', { status: 200 })

    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', recipientId)

    if (!tokens?.length) return new Response('OK', { status: 200 })

    const actorName = (actor as any).full_name ?? `@${(actor as any).username}`
    let body = ''
    if (type === 'like') body = `${actorName} liked your post`
    else if (type === 'comment') body = `${actorName} commented on your post`
    else if (type === 'follow') body = `${actorName} started following you`
    else if (type === 'comment_reply') body = `${actorName} replied to your comment`
    else if (type === 'message') body = 'You have a new message'

    const messages = (tokens as { token: string }[]).map(({ token }) => ({
      to: token,
      title: 'Rekkus',
      body,
      data: { type, postId, commentId, conversationId },
      sound: 'default',
    }))

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    })

    return new Response('OK', { status: 200 })
  } catch {
    return new Response('Internal error', { status: 500 })
  }
})
