import type { ProfileInfo } from '@/lib/services/users'
import { supabase } from '@/lib/supabase'
import type { UserId } from '@/lib/types/branded'

export async function blockUser(blockedId: UserId): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_blocked_id: blockedId })
  if (error) throw error
}

export async function updateUserProfile(
  userId: UserId,
  updates: Partial<ProfileInfo>
): Promise<void> {
  const { error } = await supabase.from('users').upsert({
    id: userId,
    ...updates,
    updated_at: new Date().toISOString(),
  } as never)
  if (error) throw error
  void supabase.rpc('record_profile_audit_event', {
    p_event_type: 'profile_updated',
    p_context: { changed_fields: Object.keys(updates) },
  })
}
