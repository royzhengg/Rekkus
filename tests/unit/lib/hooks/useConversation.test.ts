import { act, renderHook } from '@testing-library/react-native'
import { useConversation } from '@/lib/hooks/useConversation'
import {
  fetchConversationMessages,
  fetchConversationParticipant,
  fetchConversationAllParticipants,
  fetchSharedMedia,
  fetchConversationMeta,
  fetchMessageReactions,
  markConversationRead,
  searchConversationMessages,
} from '@/lib/services/messaging'
import { blockUser, submitContentReport } from '@/lib/services/moderation'

// ── module mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() },
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/lib/featureFlags', () => ({ isEnabled: () => true }))
jest.mock('@/lib/contexts/AuthGateContext', () => ({ useAuthGate: () => ({ requireAuth: jest.fn() }) }))
jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: () => ({ requireOnline: mockRequireOnline, runDeferredMutation: mockRunDeferredMutation }),
}))
jest.mock('@/lib/hooks/useRealtimeSubscription', () => ({ useRealtimeSubscription: jest.fn() }))

jest.mock('@/lib/services/messaging', () => ({
  fetchConversationMessages: jest.fn(),
  fetchConversationParticipant: jest.fn(),
  fetchConversationAllParticipants: jest.fn(),
  fetchSharedMedia: jest.fn(),
  fetchConversationMeta: jest.fn(),
  fetchMessageReactions: jest.fn(),
  markConversationRead: jest.fn(),
  searchConversationMessages: jest.fn(),
  subscribeToConversationMessages: jest.fn(() => ({ unsubscribe: jest.fn() })),
  subscribeToReactions: jest.fn(() => ({ unsubscribe: jest.fn() })),
  subscribeToTypingIndicators: jest.fn(() => ({ unsubscribe: jest.fn() })),
  broadcastTyping: jest.fn(),
  unpinMessage: jest.fn(),
  removeChannel: jest.fn(),
  submitContentReport: jest.fn(),
}))

jest.mock('@/lib/services/moderation', () => ({
  blockUser: jest.fn(),
  submitContentReport: jest.fn(),
}))

// ── mock refs ─────────────────────────────────────────────────────────────────

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockRequireOnline = jest.fn(() => true)
const mockRunDeferredMutation = jest.fn(() => Promise.resolve())

const mockFetchMessages = jest.mocked(fetchConversationMessages)
const mockFetchParticipant = jest.mocked(fetchConversationParticipant)
const mockFetchAllParticipants = jest.mocked(fetchConversationAllParticipants)
const mockFetchSharedMedia = jest.mocked(fetchSharedMedia)
const mockFetchMeta = jest.mocked(fetchConversationMeta)
const mockFetchReactions = jest.mocked(fetchMessageReactions)
const mockMarkRead = jest.mocked(markConversationRead)
const mockSearchMessages = jest.mocked(searchConversationMessages)
const mockBlockUser = jest.mocked(blockUser)
const _mockSubmitReport = jest.mocked(submitContentReport)

const participant = { user_id: 'user-2', username: 'alice', full_name: 'Alice', avatar_url: null, last_seen_at: null }
const message = { id: 'msg-1', conversation_id: 'conv-1', sender_id: 'user-2', content: 'Hello', created_at: '2026-01-01', deleted_at: null }

function defaults() {
  mockFetchMessages.mockResolvedValue([message] as never)
  mockFetchParticipant.mockResolvedValue(participant as never)
  mockFetchAllParticipants.mockResolvedValue([participant] as never)
  mockFetchSharedMedia.mockResolvedValue([] as never)
  mockFetchMeta.mockResolvedValue({ conversation_type: 'direct', name: null, status: 'active', updated_at: '', created_at: '', pinned_message_id: null } as never)
  mockFetchReactions.mockResolvedValue([] as never)
  mockMarkRead.mockResolvedValue(undefined as never)
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    defaults()
  })

  it('starts in loading state', () => {
    mockFetchMessages.mockResolvedValue(new Promise(() => {}))  // never resolves
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    expect(result.current.loading).toBe(true)
    expect(result.current.messages).toHaveLength(0)
  })

  it('load() populates messages, participant and clears loading', async () => {
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    await act(async () => { await result.current.load() })

    expect(result.current.loading).toBe(false)
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]?.id).toBe('msg-1')
    expect(result.current.participant?.username).toBe('alice')
  })

  it('load() sets error on fetch failure', async () => {
    mockFetchMessages.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    await act(async () => { await result.current.load() })

    expect(result.current.error).toMatch(/could not be loaded/)
    expect(result.current.loading).toBe(false)
  })

  it('load() does nothing when conversationId is undefined', async () => {
    const { result } = renderHook(() =>
      useConversation(undefined, 'user-1', {})
    )
    await act(async () => { await result.current.load() })

    expect(mockFetchMessages).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  it('marks conversation read after loading messages', async () => {
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    await act(async () => { await result.current.load() })

    expect(mockMarkRead).toHaveBeenCalledWith('conv-1', 'user-1', 'msg-1')
  })

  it('handleSearch returns matching messages', async () => {
    mockSearchMessages.mockResolvedValue([message] as never)
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    await act(async () => { await result.current.handleSearch('hello') })

    expect(result.current.searchResults).toHaveLength(1)
    expect(result.current.searching).toBe(false)
  })

  it('handleSearch clears results for empty query', async () => {
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    await act(async () => { result.current.setSearchResults([message as never]) })
    await act(async () => { await result.current.handleSearch('') })

    expect(result.current.searchResults).toHaveLength(0)
    expect(mockSearchMessages).not.toHaveBeenCalled()
  })

  it('handleMessageSent appends a new message', () => {
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    act(() => { result.current.handleMessageSent(message as never) })
    expect(result.current.messages).toContain(message)
  })

  it('handleMessageSent deduplicates by id', () => {
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    act(() => {
      result.current.handleMessageSent(message as never)
      result.current.handleMessageSent(message as never)
    })
    expect(result.current.messages.filter(m => m.id === 'msg-1')).toHaveLength(1)
  })

  it('handleMessageDeleted soft-deletes by setting deleted_at', () => {
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    act(() => { result.current.handleMessageSent(message as never) })
    act(() => { result.current.handleMessageDeleted('msg-1') })
    expect(result.current.messages.find(m => m.id === 'msg-1')?.deleted_at).toBeTruthy()
  })

  it('handleSafetyAction navigates to conversation info', async () => {
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    await act(async () => { await result.current.handleSafetyAction('conversation_info') })
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: { conversationId: 'conv-1' } }))
  })

  it('handleSafetyAction blocks user and navigates back on success', async () => {
    mockBlockUser.mockResolvedValue(null as never)
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    await act(async () => { await result.current.load() })
    await act(async () => { await result.current.handleSafetyAction('block_user') })
    expect(mockBlockUser).toHaveBeenCalledWith('user-1', 'user-2', 'messaging')
    expect(mockBack).toHaveBeenCalled()
  })

  it('handleSafetyAction sets operationError when block fails', async () => {
    mockBlockUser.mockResolvedValue('Block service unavailable' as never)
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    await act(async () => { await result.current.load() })
    await act(async () => { await result.current.handleSafetyAction('block_user') })
    expect(result.current.operationError?.title).toBe('Block failed')
  })

  it('does not call block/report when offline', async () => {
    mockRequireOnline.mockReturnValue(false)
    const { result } = renderHook(() =>
      useConversation('conv-1', 'user-1', {})
    )
    await act(async () => { await result.current.load() })
    await act(async () => { await result.current.handleSafetyAction('block_user') })
    expect(mockBlockUser).not.toHaveBeenCalled()
    expect(result.current.operationError?.title).toBe('You are offline')
  })
})
