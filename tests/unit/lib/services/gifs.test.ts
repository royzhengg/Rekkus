/**
 * EXPO_PUBLIC_* env vars are inlined at Babel transform time by babel-preset-expo,
 * so tests mock the config boundary rather than relying on a developer's .env.
 *
 * This file verifies the no-provider fallback deterministically.
 */

jest.mock('@/lib/config', () => ({
  GIPHY_API_KEY: '',
  GIPHY_IOS_API_KEY: '',
  GIPHY_ANDROID_API_KEY: '',
}))
jest.mock('@/lib/services/boundaryTelemetry', () => ({
  reportInvalidBoundary: jest.fn(),
}))

import { hasGifProvider, fetchGifs } from '@/lib/services/gifs'

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('hasGifProvider', () => {
  it('returns false when no provider key is configured', () => {
    expect(hasGifProvider()).toBe(false)
  })
})

describe('fetchGifs — no API key configured (test environment default)', () => {
  it('returns empty gifs and a descriptive error', async () => {
    const result = await fetchGifs()
    expect(result.gifs).toEqual([])
    expect(result.error).toBeTruthy()
    expect(result.error).toContain('EXPO_PUBLIC_GIPHY')
  })

  it('returns the same error shape for a query when no key is set', async () => {
    const result = await fetchGifs('sushi')
    expect(result.gifs).toEqual([])
    expect(result.error).toBeTruthy()
  })
})

/**
 * The fetch / network-failure paths inside fetchGifs require a compiled-in API key.
 * They are covered by manual smoke-testing until gifs.ts is refactored to accept an
 * injected key (making it unit-testable without Babel env inlining). Tracked as
 * a follow-up in BACKLOG.md under ARCH-010.
 */
