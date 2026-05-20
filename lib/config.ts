export type AppEnvironment = 'development' | 'staging' | 'beta' | 'production'
export type DataMode = 'mock' | 'mixed' | 'live'

const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development'
const dataMode = process.env.EXPO_PUBLIC_DATA_MODE ?? 'mixed'

export const APP_ENV: AppEnvironment =
  appEnv === 'staging' || appEnv === 'beta' || appEnv === 'production'
    ? appEnv
    : 'development'

export const DATA_MODE: DataMode =
  dataMode === 'mock' || dataMode === 'live' || dataMode === 'mixed' ? dataMode : 'mixed'

export const IS_LIVE_DATA = DATA_MODE === 'live'
export const ALLOW_MOCK_DATA = DATA_MODE === 'mock' || DATA_MODE === 'mixed'

export const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? ''
