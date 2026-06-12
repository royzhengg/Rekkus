import 'react-native-url-polyfill/auto'
import 'expo-sqlite/localStorage/install'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config'
import type { DatabaseWithExtensions } from '@/types/database.extensions'

function requiredConfig(value: string, key: string): string {
  if (!value) throw new Error(`Missing required public configuration: ${key}`)
  return value
}

export const supabase = createClient<DatabaseWithExtensions>(
  requiredConfig(SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL'),
  requiredConfig(SUPABASE_ANON_KEY, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
