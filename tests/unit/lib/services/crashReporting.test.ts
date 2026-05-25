import * as Sentry from '@sentry/react-native'
import type { AppEnvironment } from '@/lib/config'
import { initializeCrashReporting, withCrashReporting } from '@/lib/services/crashReporting'

type MockCrashReportingConfig = {
  APP_ENV: AppEnvironment
  SENTRY_DSN: string
  SENTRY_ENABLED: boolean
}

jest.mock('@/lib/config', () => {
  const config: MockCrashReportingConfig = {
    APP_ENV: 'development',
    SENTRY_DSN: '',
    SENTRY_ENABLED: false,
  }

  return {
    get APP_ENV() {
      return config.APP_ENV
    },
    get SENTRY_DSN() {
      return config.SENTRY_DSN
    },
    get SENTRY_ENABLED() {
      return config.SENTRY_ENABLED
    },
    setCrashReportingTestConfig: (next: MockCrashReportingConfig) => {
      Object.assign(config, next)
    },
  }
})
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  init: jest.fn(),
  wrap: jest.fn((component: unknown) => component),
}))

const mockConfig = jest.requireMock('@/lib/config') as {
  setCrashReportingTestConfig: (next: MockCrashReportingConfig) => void
}

beforeEach(() => {
  jest.clearAllMocks()
  mockConfig.setCrashReportingTestConfig({
    APP_ENV: 'development',
    SENTRY_DSN: '',
    SENTRY_ENABLED: false,
  })
})

describe('crash reporting activation', () => {
  for (const appEnv of ['development', 'staging', 'beta'] as const) {
    it(`stays inert when ${appEnv} capture is disabled`, () => {
      mockConfig.setCrashReportingTestConfig({
        APP_ENV: appEnv,
        SENTRY_DSN: 'https://public@example.invalid/1',
        SENTRY_ENABLED: false,
      })
      const Root = () => null

      initializeCrashReporting()

      expect(withCrashReporting(Root)).toBe(Root)
      expect(Sentry.init).not.toHaveBeenCalled()
      expect(Sentry.wrap).not.toHaveBeenCalled()
    })
  }

  it('stays inert when capture is enabled without a DSN', () => {
    mockConfig.setCrashReportingTestConfig({
      APP_ENV: 'production',
      SENTRY_DSN: '',
      SENTRY_ENABLED: true,
    })
    const Root = () => null

    initializeCrashReporting()

    expect(withCrashReporting(Root)).toBe(Root)
    expect(Sentry.init).not.toHaveBeenCalled()
    expect(Sentry.wrap).not.toHaveBeenCalled()
  })

  it('initialises and wraps when capture is explicitly enabled with a DSN', () => {
    mockConfig.setCrashReportingTestConfig({
      APP_ENV: 'staging',
      SENTRY_DSN: 'https://public@example.invalid/1',
      SENTRY_ENABLED: true,
    })
    const Root = () => null

    initializeCrashReporting()
    withCrashReporting(Root)

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://public@example.invalid/1',
        enabled: true,
        environment: 'staging',
      })
    )
    expect(Sentry.wrap).toHaveBeenCalledWith(Root)
  })
})
