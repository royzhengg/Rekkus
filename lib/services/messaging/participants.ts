import { supabase } from '@/lib/supabase'
import { mapMessagingError } from './errors'
import { parseConversationParticipant } from './guards'
import type { ConversationParticipant, MuteDuration } from './types'

export async function fetchConversationParticipant(
  conversationId: string,
  currentUserId: string
): Promise<ConversationParticipant | null> {
  const { data } = await supabase.from('conversation_participants')
    .select(
      'user_id, is_admin, users!conversation_participants_user_id_fkey(username, full_name, avatar_url, last_seen_at)'
    )
    .eq('conversation_id', conversationId)
    .neq('user_id', currentUserId)
    .limit(1)
    .maybeSingle()

  return parseConversationParticipant(data)
}

export async function fetchConversationAllParticipants(
  conversationId: string
): Promise<ConversationParticipant[]> {
  const { data } = await supabase.from('conversation_participants')
    .select(
      'user_id, is_admin, users!conversation_participants_user_id_fkey(username, full_name, avatar_url, last_seen_at)'
    )
    .eq('conversation_id', conversationId)

  return (data ?? []).map(parseConversationParticipant).filter((participant): participant is ConversationParticipant => participant !== null)
}

export async function muteConversation(
  conversationId: string,
  userId: string,
  duration: MuteDuration = '8h'
): Promise<void> {
  const durations: Record<MuteDuration, number> = {
    '1h': 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    forever: 100 * 365 * 24 * 60 * 60 * 1000,
  }
  const mutedUntil = new Date(Date.now() + durations[duration]).toISOString()
  const { error } = await supabase.from('conversation_participants')
    .update({ muted_until: mutedUntil })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function unmuteConversation(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('conversation_participants')
    .update({ muted_until: null })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function archiveConversation(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('conversation_participants')
    .update({ archived_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function unarchiveConversation(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('conversation_participants')
    .update({ archived_at: null })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function pinConversation(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('conversation_participants')
    .update({ pinned_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function unpinConversation(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('conversation_participants')
    .update({ pinned_at: null })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function addGroupMember(
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('conversation_participants')
    .insert({ conversation_id: conversationId, user_id: userId, is_admin: false })
  if (error) return { error: 'Could not add member.' }
  return { error: null }
}

export async function removeGroupMember(
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('conversation_participants')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) return { error: 'Could not remove member.' }
  return { error: null }
}

export async function promoteToAdmin(
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('conversation_participants')
    .update({ is_admin: true })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) return { error: 'Could not promote member.' }
  return { error: null }
}

export async function updateGroupInfo(
  conversationId: string,
  name?: string | null,
  avatarUrl?: string | null
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl

  const { error } = await supabase.from('conversations')
    .update(updates as never)
    .eq('id', conversationId)
  if (error) return { error: 'Could not update group.' }
  return { error: null }
}

export async function leaveGroup(conversationId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('leave_group', {
    p_conversation_id: conversationId,
  })
  if (error) return { error: mapMessagingError(error) }
  return { error: null }
}

export async function deleteDirectConversation(
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> {
  await archiveConversation(conversationId, userId)
  return { error: null }
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
  messageId?: string
): Promise<void> {
  await supabase.from('conversation_participants')
    .update({
      last_read_at: new Date().toISOString(),
      ...(messageId ? { last_read_message_id: messageId } : {}),
    })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

export async function markConversationUnread(
  conversationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase.from('conversation_participants')
    .update({ last_read_at: null, last_read_message_id: null })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) throw error
}

type ConversationMetaRow = {
  conversation_type: string | null
  name: string | null
  avatar_url: string | null
  pinned_message_id: string | null
}

export async function fetchConversationMeta(conversationId: string): Promise<ConversationMetaRow | null> {
  const { data } = await supabase.from('conversations')
    .select('conversation_type, name, avatar_url, pinned_message_id')
    .eq('id', conversationId)
    .maybeSingle()
  if (!data) return null
  return {
    conversation_type: typeof data.conversation_type === 'string' ? data.conversation_type : null,
    name: typeof data.name === 'string' ? data.name : null,
    avatar_url: typeof data.avatar_url === 'string' ? data.avatar_url : null,
    pinned_message_id: typeof data.pinned_message_id === 'string' ? data.pinned_message_id : null,
  }
}

type ParticipantPrefsRow = {
  muted_until: string | null
  pinned_at: string | null
}

export async function fetchMyParticipantPrefs(
  conversationId: string,
  userId: string
): Promise<ParticipantPrefsRow | null> {
  const { data } = await supabase.from('conversation_participants')
    .select('muted_until, pinned_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  return {
    muted_until: typeof data.muted_until === 'string' ? data.muted_until : null,
    pinned_at: typeof data.pinned_at === 'string' ? data.pinned_at : null,
  }
}
