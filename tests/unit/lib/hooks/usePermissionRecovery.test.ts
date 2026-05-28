import { act, renderHook } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { usePermissionRecovery } from '@/lib/hooks/usePermissionRecovery'

jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native')
  return { ...rn, Linking: { openSettings: jest.fn() } }
})

const mockOpenSettings = jest.mocked(Linking.openSettings)

describe('usePermissionRecovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not surface recovery sheet when permission is granted', async () => {
    const { result } = renderHook(() => usePermissionRecovery())

    await act(async () => {
      await result.current.request(
        () => Promise.resolve({ granted: true, canAskAgain: true }),
        'Enable access in Settings.'
      )
    })

    expect(result.current.recoveryVisible).toBe(false)
    expect(result.current.recoveryMessage).toBe('')
  })

  it('does not surface recovery sheet when denied but canAskAgain is true (Android first denial)', async () => {
    const { result } = renderHook(() => usePermissionRecovery())

    await act(async () => {
      await result.current.request(
        () => Promise.resolve({ granted: false, canAskAgain: true }),
        'Enable access in Settings.'
      )
    })

    // Android first denial — system will re-prompt; no settings sheet yet
    expect(result.current.recoveryVisible).toBe(false)
  })

  it('surfaces recovery sheet when denied and canAskAgain is false (permanent denial)', async () => {
    const { result } = renderHook(() => usePermissionRecovery())

    await act(async () => {
      await result.current.request(
        () => Promise.resolve({ granted: false, canAskAgain: false }),
        'Camera access is needed. Enable it in Settings.'
      )
    })

    expect(result.current.recoveryVisible).toBe(true)
    expect(result.current.recoveryMessage).toBe('Camera access is needed. Enable it in Settings.')
  })

  it('returns the permission result regardless of state', async () => {
    const { result } = renderHook(() => usePermissionRecovery())
    let returned: { granted: boolean; canAskAgain: boolean } | undefined

    await act(async () => {
      returned = await result.current.request(
        () => Promise.resolve({ granted: false, canAskAgain: false }),
        'Enable in Settings.'
      )
    })

    expect(returned).toEqual({ granted: false, canAskAgain: false })
  })

  it('dismissRecovery clears recovery state', async () => {
    const { result } = renderHook(() => usePermissionRecovery())

    await act(async () => {
      await result.current.request(
        () => Promise.resolve({ granted: false, canAskAgain: false }),
        'Enable in Settings.'
      )
    })

    act(() => { result.current.dismissRecovery() })

    expect(result.current.recoveryVisible).toBe(false)
    expect(result.current.recoveryMessage).toBe('')
  })

  it('openSettings calls Linking.openSettings and clears recovery state', async () => {
    const { result } = renderHook(() => usePermissionRecovery())

    await act(async () => {
      await result.current.request(
        () => Promise.resolve({ granted: false, canAskAgain: false }),
        'Enable in Settings.'
      )
    })

    act(() => { result.current.openSettings() })

    expect(mockOpenSettings).toHaveBeenCalledTimes(1)
    expect(result.current.recoveryVisible).toBe(false)
    expect(result.current.recoveryMessage).toBe('')
  })
})
