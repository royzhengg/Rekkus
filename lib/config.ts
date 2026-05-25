export type AppEnvironment = 'development' | 'staging' | 'beta' | 'production'
export type DataMode = 'mock' | 'mixed' | 'live'

const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development'
const dataMode = process.env.EXPO_PUBLIC_DATA_MODE ?? 'mixed'
const sentryEnabled = process.env.EXPO_PUBLIC_SENTRY_ENABLED ?? ''

export const APP_ENV: AppEnvironment =
  appEnv === 'staging' || appEnv === 'beta' || appEnv === 'production' ? appEnv : 'development'

export const DATA_MODE: DataMode =
  dataMode === 'mock' || dataMode === 'live' || dataMode === 'mixed' ? dataMode : 'mixed'

export const IS_LIVE_DATA = DATA_MODE === 'live'
export const ALLOW_MOCK_DATA = DATA_MODE === 'mock' || DATA_MODE === 'mixed'

export const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? ''
export const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? ''
export const GIPHY_IOS_API_KEY = process.env.EXPO_PUBLIC_GIPHY_IOS_API_KEY ?? ''
export const GIPHY_ANDROID_API_KEY = process.env.EXPO_PUBLIC_GIPHY_ANDROID_API_KEY ?? ''
export const EXPO_PROJECT_ID = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ?? ''
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? ''
export const SENTRY_ENABLED = sentryEnabled === '1' || sentryEnabled.toLowerCase() === 'true'
