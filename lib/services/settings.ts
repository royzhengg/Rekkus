import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'

export type Settings = {
  notif_likes: boolean
  notif_comments: boolean
  notif_followers: boolean
  notif_mentions: boolean
  notif_messages: boolean
  private_account: boolean
  allow_comments: boolean
  allow_tags: boolean
  autoplay_videos: boolean
  show_activity_status: boolean
  theme_mode: 'light' | 'dark' | 'system'
}

export const DEFAULT_SETTINGS: Settings = {
  notif_likes: true,
  notif_comments: true,
  notif_followers: true,
  notif_mentions: true,
  notif_messages: true,
  private_account: false,
  allow_comments: true,
  allow_tags: true,
  autoplay_videos: true,
  show_activity_status: true,
  theme_mode: 'system',
}

function themeMode(value: unknown): Settings['theme_mode'] {
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_SETTINGS.theme_mode
}

export function normalizeSettings(value: unknown): Settings {
  if (!isRecord(value)) return DEFAULT_SETTINGS
  return {
    notif_likes: typeof value.notif_likes === 'boolean' ? value.notif_likes : DEFAULT_SETTINGS.notif_likes,
    notif_comments: typeof value.notif_comments === 'boolean' ? value.notif_comments : DEFAULT_SETTINGS.notif_comments,
    notif_followers: typeof value.notif_followers === 'boolean' ? value.notif_followers : DEFAULT_SETTINGS.notif_followers,
    notif_mentions: typeof value.notif_mentions === 'boolean' ? value.notif_mentions : DEFAULT_SETTINGS.notif_mentions,
    notif_messages: typeof value.notif_messages === 'boolean' ? value.notif_messages : DEFAULT_SETTINGS.notif_messages,
    private_account: typeof value.private_account === 'boolean' ? value.private_account : DEFAULT_SETTINGS.private_account,
    allow_comments: typeof value.allow_comments === 'boolean' ? value.allow_comments : DEFAULT_SETTINGS.allow_comments,
    allow_tags: typeof value.allow_tags === 'boolean' ? value.allow_tags : DEFAULT_SETTINGS.allow_tags,
    autoplay_videos: typeof value.autoplay_videos === 'boolean' ? value.autoplay_videos : DEFAULT_SETTINGS.autoplay_videos,
    show_activity_status: typeof value.show_activity_status === 'boolean' ? value.show_activity_status : DEFAULT_SETTINGS.show_activity_status,
    theme_mode: themeMode(value.theme_mode),
  }
}

export async function fetchSettings(userId: string): Promise<Settings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return normalizeSettings(data)
}

export async function updateSettingValue<K extends keyof Settings>(
  userId: string,
  key: K,
  value: Settings[K]
): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert({
    id: userId,
    [key]: value,
    updated_at: new Date().toISOString(),
  } as never, { onConflict: 'id' })
  if (error) throw error
}
