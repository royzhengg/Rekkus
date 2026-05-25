"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SENTRY_ENABLED = exports.SENTRY_DSN = exports.SUPABASE_ANON_KEY = exports.SUPABASE_URL = exports.EXPO_PROJECT_ID = exports.GIPHY_ANDROID_API_KEY = exports.GIPHY_IOS_API_KEY = exports.GIPHY_API_KEY = exports.GOOGLE_PLACES_KEY = exports.ALLOW_MOCK_DATA = exports.IS_LIVE_DATA = exports.DATA_MODE = exports.APP_ENV = void 0;
const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const dataMode = process.env.EXPO_PUBLIC_DATA_MODE ?? 'mixed';
const sentryEnabled = process.env.EXPO_PUBLIC_SENTRY_ENABLED ?? '';
exports.APP_ENV = appEnv === 'staging' || appEnv === 'beta' || appEnv === 'production'
    ? appEnv
    : 'development';
exports.DATA_MODE = dataMode === 'mock' || dataMode === 'live' || dataMode === 'mixed' ? dataMode : 'mixed';
exports.IS_LIVE_DATA = exports.DATA_MODE === 'live';
exports.ALLOW_MOCK_DATA = exports.DATA_MODE === 'mock' || exports.DATA_MODE === 'mixed';
exports.GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';
exports.GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '';
exports.GIPHY_IOS_API_KEY = process.env.EXPO_PUBLIC_GIPHY_IOS_API_KEY ?? '';
exports.GIPHY_ANDROID_API_KEY = process.env.EXPO_PUBLIC_GIPHY_ANDROID_API_KEY ?? '';
exports.EXPO_PROJECT_ID = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ?? '';
exports.SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
exports.SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
exports.SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
exports.SENTRY_ENABLED = sentryEnabled === '1' || sentryEnabled.toLowerCase() === 'true' || exports.APP_ENV === 'beta' || exports.APP_ENV === 'production';
