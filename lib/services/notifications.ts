import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
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

export async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      process.env.EXPO_PUBLIC_EXPO_PROJECT_ID
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {}
    )
    const platform = Platform.OS === 'ios' ? 'ios' : 'android'
    await (supabase.from('push_tokens') as any).upsert(
      { user_id: userId, token, platform },
      { onConflict: 'user_id,token' }
    )
  } catch {
    // push token unavailable — EAS project ID not yet configured
  }
}

export type NotifyPayload =
  | { type: 'like'; actorId: string; postId: string }
  | { type: 'comment'; actorId: string; postId: string }
  | { type: 'follow'; actorId: string; followedId: string }
  | { type: 'comment_reply'; actorId: string; commentId: string }
  | { type: 'message'; actorId: string; conversationId: string; messageId: string }

export function notify(payload: NotifyPayload): void {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return
  supabase.auth.getSession().then(({ data }) => {
    const session = data.session
    if (!session) return
    fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => {})
  })
}
