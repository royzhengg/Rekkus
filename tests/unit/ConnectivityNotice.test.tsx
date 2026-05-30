import { render } from '@testing-library/react-native'
import { ConnectivityNotice } from '@/components/ui/ConnectivityNotice'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: jest.fn(),
}))

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => ({
    ratingBg: '#FFF3DB',
    ratingText: '#5F4500',
    chipCategorySageBg: '#E6F0E6',
    chipCategorySageText: '#29432A',
  }),
}))

const mockedConnectivity = jest.mocked(useConnectivity)

describe('ConnectivityNotice', () => {
  it('announces queued work while offline', () => {
    mockedConnectivity.mockReturnValue({
      state: 'offline',
      pendingCount: 2,
      syncState: 'idle',
      syncEpoch: 0,
      isSyncing: false,
      runDeferredMutation: async () => ({ queued: false }),
      requireOnline: () => false,
    })

    const screen = render(<ConnectivityNotice />)

    expect(screen.getByText('Offline. 2 changes waiting to sync.')).toBeTruthy()
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'alert' })).toBeTruthy()
  })

  it('reports syncing and completion after reconnect', () => {
    mockedConnectivity.mockReturnValue({
      state: 'online',
      pendingCount: 1,
      syncState: 'syncing',
      syncEpoch: 0,
      isSyncing: true,
      runDeferredMutation: async () => ({ queued: false }),
      requireOnline: () => true,
    })
    const syncing = render(<ConnectivityNotice />)
    expect(syncing.getByText('Syncing 1 pending change...')).toBeTruthy()
    syncing.unmount()

    mockedConnectivity.mockReturnValue({
      state: 'online',
      pendingCount: 0,
      syncState: 'synced',
      syncEpoch: 1,
      isSyncing: false,
      runDeferredMutation: async () => ({ queued: false }),
      requireOnline: () => true,
    })
    const synced = render(<ConnectivityNotice />)
    expect(synced.getByText('Your pending changes are synced.')).toBeTruthy()
  })
})
