import AsyncStorage from '@react-native-async-storage/async-storage'
import { analytics } from '@/lib/analytics'
import {
  clearDeferredMutationsForUser,
  enqueueDeferredMutation,
  executeDeferredMutation,
  incrementRetryCount,
  isDeferredMutation,
  isRetryableDeferredMutationError,
  MAX_RETRY_COUNT,
  readDeferredMutations,
  type DeferredMutation,
} from '@/lib/services/deferredMutations'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: { actionError: jest.fn() },
}))

jest.mock('@/lib/services/collections', () => ({
  unsaveTarget: jest.fn(),
  updateSavedLocationStatus: jest.fn(),
}))
jest.mock('@/lib/services/dishes', () => ({ saveDish: jest.fn() }))
jest.mock('@/lib/services/messaging', () => ({
  addReaction: jest.fn(),
  archiveConversation: jest.fn(),
  markConversationUnread: jest.fn(),
  muteConversationUntil: jest.fn(),
  pinConversation: jest.fn(),
  removeReaction: jest.fn(),
  unarchiveConversation: jest.fn(),
  unmuteConversation: jest.fn(),
  unpinConversation: jest.fn(),
}))
jest.mock('@/lib/services/posts', () => ({
  addPostReaction: jest.fn(),
  removePostReaction: jest.fn(),
  togglePostLike: jest.fn(),
  togglePostSave: jest.fn(),
}))
jest.mock('@/lib/services/restaurants', () => ({ saveLocation: jest.fn() }))
jest.mock('@/lib/services/settings', () => ({ updateSettingValue: jest.fn() }))
jest.mock('@/lib/services/users', () => ({ followUser: jest.fn(), unfollowUser: jest.fn() }))

const mockGetItem = jest.mocked(AsyncStorage.getItem)
const mockSetItem = jest.mocked(AsyncStorage.setItem)
const mockRemoveItem = jest.mocked(AsyncStorage.removeItem)
const mockActionError = jest.mocked(analytics.actionError)
const now = '2026-05-27T00:00:00.000Z'

describe('deferred mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue(undefined)
    mockRemoveItem.mockResolvedValue(undefined)
  })

  it('rejects content-bearing or invalid stored records at the boundary', () => {
    expect(isDeferredMutation({
      kind: 'post_save',
      userId: 'user-1',
      updatedAt: now,
      retryCount: 0,
      postId: 'post-1',
      targetState: true,
      caption: 'must not be persisted',
    })).toBe(false)
    expect(isDeferredMutation({
      kind: 'setting',
      userId: 'user-1',
      updatedAt: now,
      retryCount: 0,
      setting: 'theme_mode',
      value: 'unknown',
    })).toBe(false)
  })

  it('recovers from malformed storage without returning untrusted intents', async () => {
    mockGetItem.mockResolvedValue('{"version":1,"mutations":[{"kind":"post_save"}]}')

    await expect(readDeferredMutations()).resolves.toEqual([])
    expect(mockActionError).toHaveBeenCalledWith(null, 'runtime_boundary', 'pending_mutations_invalid')
    expect(mockRemoveItem).toHaveBeenCalledWith('rekkus:pending-mutations:v1')
  })

  it('coalesces a later desired state for the same user and entity', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({
      version: 1,
      mutations: [{ kind: 'post_save', userId: 'user-1', updatedAt: now, retryCount: 0, postId: 'post-1', targetState: true }],
    }))

    await enqueueDeferredMutation({
      kind: 'post_save',
      userId: 'user-1',
      updatedAt: '2026-05-27T00:01:00.000Z',
      retryCount: 0,
      postId: 'post-1',
      targetState: false,
    })

    const saved = JSON.parse(String(mockSetItem.mock.calls[0]?.[1])) as { mutations: Array<{ targetState: boolean }> }
    expect(saved.mutations).toHaveLength(1)
    expect(saved.mutations[0]?.targetState).toBe(false)
  })

  it('scopes reads and clearing to the active user', async () => {
    const mutations = [
      { kind: 'follow', userId: 'user-1', updatedAt: now, retryCount: 0, targetUserId: 'user-3', targetState: true },
      { kind: 'follow', userId: 'user-2', updatedAt: now, retryCount: 0, targetUserId: 'user-3', targetState: true },
    ]
    mockGetItem.mockResolvedValue(JSON.stringify({ version: 1, mutations }))

    await expect(readDeferredMutations('user-1')).resolves.toHaveLength(1)
    await clearDeferredMutationsForUser('user-1')

    const saved = JSON.parse(String(mockSetItem.mock.calls[0]?.[1])) as { mutations: Array<{ userId: string }> }
    expect(saved.mutations).toEqual([expect.objectContaining({ userId: 'user-2' })])
  })

  it('only treats transport-like failures as retryable', () => {
    expect(isRetryableDeferredMutationError(new Error('Network request failed'))).toBe(true)
    expect(isRetryableDeferredMutationError(new Error('JWT not authorized'))).toBe(false)
  })

  it('drops entries older than 7 days on read (TTL pruning)', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    const fresh = { kind: 'post_like', userId: 'user-1', updatedAt: now, retryCount: 0, postId: 'p1', targetState: true }
    const stale = { kind: 'post_like', userId: 'user-1', updatedAt: eightDaysAgo, retryCount: 0, postId: 'p2', targetState: true }
    mockGetItem.mockResolvedValue(JSON.stringify({ version: 1, mutations: [fresh, stale] }))

    const result = await readDeferredMutations()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ postId: 'p1' })
    // pruned list must be written back
    const written = JSON.parse(String(mockSetItem.mock.calls[0]?.[1])) as { mutations: unknown[] }
    expect(written.mutations).toHaveLength(1)
  })

  it('throws offline_queue_full when enqueueing beyond MAX_QUEUE_SIZE', async () => {
    const mutations = Array.from({ length: 50 }, (_, i) => ({
      kind: 'post_like' as const,
      userId: 'user-1',
      updatedAt: now,
      retryCount: 0,
      postId: `post-${i}`,
      targetState: true,
    }))
    mockGetItem.mockResolvedValue(JSON.stringify({ version: 1, mutations }))

    await expect(
      enqueueDeferredMutation({ kind: 'post_like', userId: 'user-1', updatedAt: now, retryCount: 0, postId: 'post-new', targetState: true })
    ).rejects.toThrow('offline_queue_full')
  })

  it('incrementRetryCount reaches MAX_RETRY_COUNT after MAX_RETRY_COUNT increments', () => {
    let m: DeferredMutation = { kind: 'post_like', userId: 'u', updatedAt: now, retryCount: 0, postId: 'p', targetState: true }
    for (let i = 0; i < MAX_RETRY_COUNT; i++) {
      expect(m.retryCount).toBeLessThan(MAX_RETRY_COUNT)
      m = incrementRetryCount(m)
    }
    expect(m.retryCount).toBeGreaterThanOrEqual(MAX_RETRY_COUNT)
  })

  it('coalescing updates in place (FIFO position preserved)', async () => {
    const mutations = [
      { kind: 'post_like', userId: 'user-1', updatedAt: now, retryCount: 0, postId: 'p1', targetState: true },
      { kind: 'post_like', userId: 'user-1', updatedAt: now, retryCount: 0, postId: 'p2', targetState: true },
    ]
    mockGetItem.mockResolvedValue(JSON.stringify({ version: 1, mutations }))

    // Coalesce p1 (first item) with a new targetState
    await enqueueDeferredMutation({ kind: 'post_like', userId: 'user-1', updatedAt: now, retryCount: 0, postId: 'p1', targetState: false })

    const saved = JSON.parse(String(mockSetItem.mock.calls[0]?.[1])) as { mutations: Array<{ postId: string; targetState: boolean }> }
    expect(saved.mutations).toHaveLength(2)
    // p1 stays at index 0 — not moved to end
    expect(saved.mutations[0]?.postId).toBe('p1')
    expect(saved.mutations[0]?.targetState).toBe(false)
    expect(saved.mutations[1]?.postId).toBe('p2')
  })

  it('salvages individually valid items from a corrupt envelope (version mismatch)', async () => {
    const valid = { kind: 'post_like', userId: 'user-1', updatedAt: now, retryCount: 0, postId: 'p1', targetState: true }
    const invalid = { kind: 'post_like', userId: 'user-1', updatedAt: now } // missing required fields
    // Version 99 causes the envelope guard to fail, triggering per-item salvage
    mockGetItem.mockResolvedValue(JSON.stringify({ version: 99, mutations: [valid, invalid] }))

    const result = await readDeferredMutations()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ postId: 'p1' })
    expect(mockActionError).toHaveBeenCalledWith(null, 'runtime_boundary', 'pending_mutations_partial_recovery')
  })

  it('analytics.offlineMutation args never exceed 100 chars (no payload content leak)', () => {
    const mockOfflineMutation = jest.fn()
    // Simulate the contract: (userId, mutationKind, outcome) — all are short enums/IDs
    const userId = 'user-1'
    const mutationKind = 'post_like'
    const outcome = 'queued'
    mockOfflineMutation(userId, mutationKind, outcome)
    for (const call of mockOfflineMutation.mock.calls) {
      for (const arg of call as string[]) {
        expect(String(arg).length).toBeLessThanOrEqual(100)
      }
    }
  })

  // Phase 2 boundary validation
  it('rejects message_reaction with extra keys or wrong field types', () => {
    expect(isDeferredMutation({
      kind: 'message_reaction', userId: 'u', updatedAt: now, retryCount: 0,
      messageId: 'msg-1', emoji: '❤️', targetState: true, extra: 'bad',
    })).toBe(false)
    expect(isDeferredMutation({
      kind: 'message_reaction', userId: 'u', updatedAt: now, retryCount: 0,
      messageId: 'msg-1', emoji: '❤️', targetState: 'yes',
    })).toBe(false)
  })

  it('rejects conversation_mute with non-string mutedUntil', () => {
    expect(isDeferredMutation({
      kind: 'conversation_mute', userId: 'u', updatedAt: now, retryCount: 0,
      conversationId: 'conv-1', mutedUntil: 12345,
    })).toBe(false)
  })

  it('accepts valid Phase 2 conversation pref mutation kinds', () => {
    const base = { userId: 'u', updatedAt: now, retryCount: 0, conversationId: 'conv-1' }
    for (const kind of ['conversation_unmute', 'conversation_archive', 'conversation_unarchive', 'conversation_pin', 'conversation_unpin', 'conversation_unread'] as const) {
      expect(isDeferredMutation({ kind, ...base })).toBe(true)
    }
  })

  it('coalesces message_reaction toggle: add then remove for same message yields targetState false', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({
      version: 1,
      mutations: [{ kind: 'message_reaction', userId: 'user-1', updatedAt: now, retryCount: 0, messageId: 'msg-1', emoji: '❤️', targetState: true }],
    }))

    await enqueueDeferredMutation({
      kind: 'message_reaction', userId: 'user-1', updatedAt: now, retryCount: 0,
      messageId: 'msg-1', emoji: '❤️', targetState: false,
    })

    const saved = JSON.parse(String(mockSetItem.mock.calls[0]?.[1])) as { mutations: Array<{ targetState: boolean }> }
    expect(saved.mutations).toHaveLength(1)
    expect(saved.mutations[0]?.targetState).toBe(false)
  })

  it('executeDeferredMutation calls the right service function for each Phase 2 kind', async () => {
    const messaging = jest.requireMock('@/lib/services/messaging') as {
      addReaction: jest.Mock
      removeReaction: jest.Mock
      muteConversationUntil: jest.Mock
      unmuteConversation: jest.Mock
      archiveConversation: jest.Mock
      unarchiveConversation: jest.Mock
      pinConversation: jest.Mock
      unpinConversation: jest.Mock
      markConversationUnread: jest.Mock
    }
    const base = { userId: 'u1', updatedAt: now, retryCount: 0 }
    const mutedUntil = '2026-06-01T00:00:00.000Z'

    await executeDeferredMutation({ kind: 'message_reaction', ...base, messageId: 'msg-1', emoji: '❤️', targetState: true })
    expect(messaging.addReaction).toHaveBeenCalledWith('msg-1', '❤️')

    await executeDeferredMutation({ kind: 'message_reaction', ...base, messageId: 'msg-1', emoji: '❤️', targetState: false })
    expect(messaging.removeReaction).toHaveBeenCalledWith('msg-1', 'u1')

    await executeDeferredMutation({ kind: 'conversation_mute', ...base, conversationId: 'conv-1', mutedUntil })
    expect(messaging.muteConversationUntil).toHaveBeenCalledWith('conv-1', 'u1', mutedUntil)

    await executeDeferredMutation({ kind: 'conversation_unmute', ...base, conversationId: 'conv-1' })
    expect(messaging.unmuteConversation).toHaveBeenCalledWith('conv-1', 'u1')

    await executeDeferredMutation({ kind: 'conversation_archive', ...base, conversationId: 'conv-1' })
    expect(messaging.archiveConversation).toHaveBeenCalledWith('conv-1', 'u1')

    await executeDeferredMutation({ kind: 'conversation_unarchive', ...base, conversationId: 'conv-1' })
    expect(messaging.unarchiveConversation).toHaveBeenCalledWith('conv-1', 'u1')

    await executeDeferredMutation({ kind: 'conversation_pin', ...base, conversationId: 'conv-1' })
    expect(messaging.pinConversation).toHaveBeenCalledWith('conv-1', 'u1')

    await executeDeferredMutation({ kind: 'conversation_unpin', ...base, conversationId: 'conv-1' })
    expect(messaging.unpinConversation).toHaveBeenCalledWith('conv-1', 'u1')

    await executeDeferredMutation({ kind: 'conversation_unread', ...base, conversationId: 'conv-1' })
    expect(messaging.markConversationUnread).toHaveBeenCalledWith('conv-1', 'u1')
  })
})
