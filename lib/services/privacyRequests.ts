import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export type PrivacyRequestType = 'export' | 'deletion' | 'correction' | 'access'

export async function submitPrivacyRequest(
  userId: string,
  requestType: PrivacyRequestType
): Promise<void> {
  const payload: Json = {
    source: 'settings_privacy_data',
  }
  const { error } = await supabase.from('privacy_requests').insert({
    user_id: userId,
    request_type: requestType,
    request_payload: payload,
  })
  if (error) throw error
}
