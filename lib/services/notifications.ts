import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { analytics } from '@/lib/analytics'
import { EXPO_PROJECT_ID, SUPABASE_URL } from '@/lib/config'
import { isEnabled } from '@/lib/featureFlags'
import { supabase } from '@/lib/supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerPushToken(userId: string, options: { requestPermission?: boolean } = {}): Promise<void> {
  if (!isEnabled('notifications')) return
  if (!Device.isDevice) return

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted' && options.requestPermission === true) {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return

  try {
    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
    const projectId =
      extra?.eas?.projectId ??
      EXPO_PROJECT_ID
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {}
    )
    const platform = Platform.OS === 'ios' ? 'ios' : 'android'
    await supabase.from('push_tokens').upsert(
      { user_id: userId, token, platform },
      { onConflict: 'user_id,token' }
    )
  } catch {
    analytics.actionError(userId, 'register_push_token', 'provider_error')
    // push token unavailable — EAS project ID not yet configured
  }
}

export function requestPushPermissionAndRegister(userId: string): Promise<void> {
  return registerPushToken(userId, { requestPermission: true })
}

export type NotifyPayload =
  | { type: 'like'; actorId: string; postId: string }
  | { type: 'comment'; actorId: string; postId: string }
  | { type: 'follow'; actorId: string; followedId: string }
  | { type: 'comment_reply'; actorId: string; commentId: string }
  | { type: 'message'; actorId: string; conversationId: string; messageId: string }

export function notify(payload: NotifyPayload): void {
  const supabaseUrl = SUPABASE_URL
  if (!supabaseUrl) return
  void (async () => {
    const { data } = await supabase.auth.getSession()
    const session = data.session
    if (!session) return
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      analytics.actionError(null, 'send_push', 'network_error')
    })
  })()
}
