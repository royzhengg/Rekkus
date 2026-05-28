import { act, renderHook } from '@testing-library/react-native'
import { refreshFeatureFlagOverrides, useFeatureFlag } from '@/lib/featureFlags'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/analytics', () => ({
  analytics: { actionError: jest.fn() },
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}))

const invoke = jest.mocked(supabase.functions.invoke)

describe('useFeatureFlag', () => {
  it('rerenders persistent UI as runtime overrides enable and disable a flag', async () => {
    invoke
      .mockResolvedValueOnce({
        data: { overrides: [{ flag_name: 'iosTabBarMaterial', enabled: true, expires_at: null }] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { overrides: [{ flag_name: 'iosTabBarMaterial', enabled: false, expires_at: null }] },
        error: null,
      })

    const { result } = renderHook(() => useFeatureFlag('iosTabBarMaterial'))
    expect(result.current).toBe(false)

    await act(async () => {
      await refreshFeatureFlagOverrides(true)
    })
    expect(result.current).toBe(true)

    await act(async () => {
      await refreshFeatureFlagOverrides(true)
    })
    expect(result.current).toBe(false)
  })
})
