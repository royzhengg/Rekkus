import * as Sentry from '@sentry/react-native'
import { APP_ENV, SENTRY_DSN, SENTRY_ENABLED } from '@/lib/config'
import type React from 'react'

let initialized = false

export function initializeCrashReporting(): void {
  if (initialized || !SENTRY_ENABLED || !SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: true,
    environment: APP_ENV,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    attachStacktrace: true,
    sendDefaultPii: false,
  })
  initialized = true
}

export function captureCrash(error: unknown): void {
  if (!initialized) return
  Sentry.captureException(error)
}

export function withCrashReporting<T extends React.ComponentType<unknown>>(component: T): T {
  if (!SENTRY_ENABLED || !SENTRY_DSN) return component

  return Sentry.wrap(component) as T
}
