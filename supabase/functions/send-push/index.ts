import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  isNotificationActorRow,
  isNotificationCommentRow,
  isNotificationSettingsRow,
  isNotificationUserIdRow,
  isPushTokenRow,
  parseNotifyPayload,
} from '../_shared/guards.ts'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}


Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = requireEnv('SUPABASE_ANON_KEY')

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401 })

    const admin = createClient(supabaseUrl, serviceKey)
    const payload = parseNotifyPayload(await req.json().catch(() => null))
    if (!payload) return new Response('Bad request', { status: 400 })
    const { type, postId, followedId, targetId, requesterId, commentId, conversationId, messageId } = payload

    // For service-role calls (pg_net from DB triggers), user.id is the service account, not the actor.
    // In that case, the payload carries actorId directly. Client calls use user.id as before.
    const actorId = (payload.actorId && user.app_metadata?.role === 'service_role')
      ? payload.actorId
      : user.id

    const { data: actorData } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', actorId)
      .maybeSingle()
    const actor = isNotificationActorRow(actorData) ? actorData : null

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
      const { data: postData, error: postError } = await admin
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single()
      if (postError) return new Response('OK', { status: 200 })
      recipientId = isNotificationUserIdRow(postData) ? postData.user_id : null
      if (recipientId) {
        const { data: canView } = await admin.rpc('can_view_user_content', {
          viewer_id: actorId,
          target_id: recipientId,
        })
        if (canView !== true) return new Response('OK', { status: 200 })
      }
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
    } else if (type === 'follow_request') {
      if (!targetId || typeof targetId !== 'string') {
        return new Response('Bad request', { status: 400 })
      }
      const { data: request } = await admin
        .from('follow_requests')
        .select('id')
        .eq('requester_id', actorId)
        .eq('target_id', targetId)
        .eq('status', 'pending')
        .maybeSingle()
      if (!request) return new Response('OK', { status: 200 })
      recipientId = targetId
    } else if (type === 'follow_request_approved') {
      if (!requesterId || typeof requesterId !== 'string') {
        return new Response('Bad request', { status: 400 })
      }
      const { data: follow } = await admin
        .from('follows')
        .select('id')
        .eq('follower_id', requesterId)
        .eq('following_id', actorId)
        .maybeSingle()
      if (!follow) return new Response('OK', { status: 200 })
      recipientId = requesterId
    } else if (type === 'comment_reply') {
      if (!commentId || typeof commentId !== 'string') {
        return new Response('Bad request', { status: 400 })
      }
      const { data: parentCommentData, error: parentCommentError } = await admin
        .from('comments')
        .select('user_id, post_id')
        .eq('id', commentId)
        .single()
      if (parentCommentError) return new Response('OK', { status: 200 })
      const parentComment = isNotificationCommentRow(parentCommentData) ? parentCommentData : null
      recipientId = parentComment?.user_id ?? null
      if (parentComment?.post_id && recipientId) {
        const { data: postData } = await admin
          .from('posts')
          .select('user_id')
          .eq('id', parentComment.post_id)
          .single()
        const postOwnerId = isNotificationUserIdRow(postData) ? postData.user_id : null
        if (postOwnerId) {
          const [{ data: actorCanView }, { data: recipientCanView }] = await Promise.all([
            admin.rpc('can_view_user_content', { viewer_id: actorId, target_id: postOwnerId }),
            admin.rpc('can_view_user_content', { viewer_id: recipientId, target_id: postOwnerId }),
          ])
          if (actorCanView !== true || recipientCanView !== true) return new Response('OK', { status: 200 })
        }
      }
    } else if (type === 'mention') {
      const { mentionedUserId } = payload
      if (!mentionedUserId || typeof mentionedUserId !== 'string') return new Response('OK', { status: 200 })
      recipientId = mentionedUserId
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

      const { data: participantData, error: participantError } = await admin
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('request_status', 'active')
        .neq('user_id', actorId)
        .limit(1)
        .maybeSingle()
      if (participantError) return new Response('OK', { status: 200 })
      recipientId = isNotificationUserIdRow(participantData) ? participantData.user_id : null
    }

    if (!recipientId || recipientId === actorId) return new Response('OK', { status: 200 })

    const { data: settingsData, error: settingsError } = await admin
      .from('user_settings')
      .select('notif_likes, notif_comments, notif_followers, notif_mentions, notif_messages')
      .eq('id', recipientId)
      .maybeSingle()
    if (settingsError) return new Response('OK', { status: 200 })
    const settings = isNotificationSettingsRow(settingsData) ? settingsData : null

    const notificationAllowed =
      type === 'like'
        ? (settings?.notif_likes ?? true)
        : type === 'comment'
          ? (settings?.notif_comments ?? true)
          : type === 'comment_reply'
            ? (settings?.notif_comments ?? true)
            : type === 'follow'
              ? (settings?.notif_followers ?? true)
              : type === 'follow_request' || type === 'follow_request_approved'
                ? (settings?.notif_followers ?? true)
                : type === 'message'
                  ? (settings?.notif_messages ?? true)
                  : type === 'mention'
                    ? (settings?.notif_mentions ?? true)
                    : true

    if (!notificationAllowed) return new Response('OK', { status: 200 })

    const { data: tokensData, error: tokensError } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', recipientId)
    if (tokensError) return new Response('OK', { status: 200 })
    const tokens = (tokensData ?? []).filter(isPushTokenRow)

    if (!tokens?.length) return new Response('OK', { status: 200 })

    const actorLabel = actor ? (actor.full_name ?? `@${actor.username}`) : 'Someone'
    let body = ''
    if (type === 'like') body = `${actorLabel} liked your post`
    else if (type === 'comment') body = `${actorLabel} commented on your post`
    else if (type === 'follow') body = `${actorLabel} started following you`
    else if (type === 'follow_request') body = `${actorLabel} requested to follow you`
    else if (type === 'follow_request_approved') body = `${actorLabel} approved your follow request`
    else if (type === 'comment_reply') body = `${actorLabel} replied to your comment`
    else if (type === 'message') body = 'You have a new message'
    else if (type === 'mention') {
      body = payload.entityType === 'comment'
        ? `${actorLabel} mentioned you in a comment`
        : `${actorLabel} mentioned you in a post`
    }

    const messages = tokens.map(({ token }) => ({
      to: token,
      title: 'Rekkus',
      body,
      data: {
        type,
        postId,
        commentId,
        conversationId,
        entityId: payload.entityId,
        entityType: payload.entityType,
        notificationId: payload.notificationId,
      },
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
