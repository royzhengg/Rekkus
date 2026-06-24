import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ProviderStateRecord } from '@/lib/services/auth/providerState'
import {
  clearPersistedProviderState,
  loadPersistedProviderState,
  persistProviderState,
} from '@/lib/services/auth/providerStorage'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

const mockGet = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
const mockSet = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>
const mockRemove = AsyncStorage.removeItem as jest.MockedFunction<typeof AsyncStorage.removeItem>

const VALID: ProviderStateRecord = { google: 'connected', apple: 'revoked' }

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue(null)
  mockSet.mockResolvedValue(undefined)
  mockRemove.mockResolvedValue(undefined)
})

describe('loadPersistedProviderState', () => {
  it('returns null when nothing stored', async () => {
    mockGet.mockResolvedValue(null)
    expect(await loadPersistedProviderState()).toBeNull()
  })

  it('returns valid record', async () => {
    mockGet.mockResolvedValue(JSON.stringify(VALID))
    expect(await loadPersistedProviderState()).toStrictEqual(VALID)
  })

  it('returns null and clears key on invalid JSON', async () => {
    mockGet.mockResolvedValue('not-json{{{')
    expect(await loadPersistedProviderState()).toBeNull()
    expect(mockRemove).toHaveBeenCalled()
  })

  it('returns null and clears key on wrong shape: { google: true, apple: "connected" }', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ google: true, apple: 'connected' }))
    expect(await loadPersistedProviderState()).toBeNull()
    expect(mockRemove).toHaveBeenCalled()
  })

  it('returns null and clears key on unknown provider in stored state', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ google: 'connected', apple: 'connected', facebook: 'revoked' }))
    expect(await loadPersistedProviderState()).toBeNull()
    expect(mockRemove).toHaveBeenCalled()
  })

  it('does not propagate AsyncStorage.getItem errors', async () => {
    mockGet.mockRejectedValue(new Error('storage unavailable'))
    expect(await loadPersistedProviderState()).toBeNull()
    expect(mockRemove).toHaveBeenCalled()
  })
})

describe('persistProviderState', () => {
  it('persists stable states', async () => {
    await persistProviderState(VALID)
    expect(mockSet).toHaveBeenCalledWith(
      expect.stringContaining('auth:provider_state'),
      expect.any(String)
    )
    const writtenJson = mockSet.mock.calls[0]![1] as string
    expect(JSON.parse(writtenJson)).toStrictEqual(VALID)
  })

  it('downgrades connecting to revoked before persisting', async () => {
    const state: ProviderStateRecord = { google: 'connecting', apple: 'connected' }
    await persistProviderState(state)
    const written = JSON.parse((mockSet.mock.calls[0]![1] as string))
    expect(written.google).toBe('revoked')
    expect(written.apple).toBe('connected')
  })

  it('does not propagate AsyncStorage.setItem errors', async () => {
    mockSet.mockRejectedValue(new Error('quota exceeded'))
    await expect(persistProviderState(VALID)).resolves.toBeUndefined()
  })

  it('round-trip: persist then load returns identical record', async () => {
    let stored: string | null = null
    mockSet.mockImplementation((_key, value) => {
      stored = value as string
      return Promise.resolve(undefined)
    })
    mockGet.mockImplementation(() => Promise.resolve(stored))

    await persistProviderState(VALID)
    const loaded = await loadPersistedProviderState()
    expect(loaded).toStrictEqual(VALID)
  })
})

describe('clearPersistedProviderState', () => {
  it('removes the storage key', async () => {
    await clearPersistedProviderState()
    expect(mockRemove).toHaveBeenCalled()
  })

  it('does not propagate removeItem errors', async () => {
    mockRemove.mockRejectedValue(new Error('storage unavailable'))
    await expect(clearPersistedProviderState()).resolves.toBeUndefined()
  })
})
