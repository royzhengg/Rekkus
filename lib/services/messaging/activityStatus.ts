import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'
import type { ConversationParticipant } from './types'

function isActivityStatusRow(value: unknown): value is { id: string; show_activity_status: boolean } {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.show_activity_status === 'boolean'
}

export async function applyActivityStatusPreferences(
  participants: ConversationParticipant[]
): Promise<ConversationParticipant[]> {
  const userIds = Array.from(new Set(participants.map(participant => participant.user_id).filter(Boolean)))
  if (userIds.length === 0) return participants

  const { data, error } = await supabase.from('user_settings')
    .select('id, show_activity_status')
    .in('id', userIds)
    .limit(userIds.length)

  if (error) return participants

  const visibleByUserId = new Map(
    (data ?? [])
      .filter(isActivityStatusRow)
      .map(row => [row.id, row.show_activity_status] as const)
  )

  return participants.map(participant => {
    if (visibleByUserId.get(participant.user_id) === false) {
      return { ...participant, last_seen_at: null }
    }
    return participant
  })
}
