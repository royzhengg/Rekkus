import {
  fetchConversationMessages,
  sendDirectMessage,
  sendRichMessage,
  searchConversationMessages,
  deleteMessage,
} from '@/lib/services/messaging/messages'

// ── module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn()
const mockRpc = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: jest.fn(() => ({ subscribe: jest.fn(), unsubscribe: jest.fn() })),
    removeChannel: jest.fn(),
  },
}))

jest.mock('@/lib/services/notifications', () => ({
  notify: jest.fn(),
}))

jest.mock('@/lib/services/boundaryTelemetry', () => ({
  reportInvalidBoundary: jest.fn(),
}))

// ── row factories ─────────────────────────────────────────────────────────────

const messageRow = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  sender_id: 'user-1',
  body: 'Hello',
  message_type: 'text',
  attachment_url: null,
  attachment_metadata: null,
  reply_to_message_id: null,
  created_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
}

function makeQueryBuilder(returnValue: { data: unknown; error: unknown }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(returnValue),
    maybeSingle: jest.fn().mockResolvedValue(returnValue),
    single: jest.fn().mockResolvedValue(returnValue),
    update: jest.fn().mockResolvedValue(returnValue),
  }
  return builder
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('fetchConversationMessages', () => {
  it('returns parsed messages for a conversation', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [messageRow], error: null }))
    const result = await fetchConversationMessages('conv-1')
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('msg-1')
    expect(result[0]?.body).toBe('Hello')
    expect(mockFrom).toHaveBeenCalledWith('messages')
  })

  it('returns empty array when no messages exist', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))
    const result = await fetchConversationMessages('conv-1')
    expect(result).toHaveLength(0)
  })

  it('returns empty array when data is null', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: null, error: null }))
    const result = await fetchConversationMessages('conv-1')
    expect(result).toHaveLength(0)
  })
})

describe('sendDirectMessage', () => {
  it('calls send_direct_message RPC and returns parsed message', async () => {
    mockRpc.mockResolvedValue({ data: messageRow, error: null })
    const { message, error } = await sendDirectMessage('conv-1', 'user-1', 'Hello')
    expect(error).toBeNull()
    expect(message?.id).toBe('msg-1')
    expect(mockRpc).toHaveBeenCalledWith('send_direct_message', expect.objectContaining({
      p_conversation_id: 'conv-1',
      p_body: 'Hello',
      p_message_type: 'text',
    }))
  })

  it('returns error string when RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '23503', message: 'Foreign key violation' } })
    const { message, error } = await sendDirectMessage('conv-1', 'user-1', 'Hello')
    expect(message).toBeNull()
    expect(error).toBeTruthy()
  })
})

describe('sendRichMessage', () => {
  it('returns null message and null error when RPC returns null data without an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const { message, error } = await sendRichMessage('conv-1', 'user-1', 'text', 'hi')
    expect(message).toBeNull()
    expect(error).toBeNull()
  })

  it('returns mapped error string when RPC returns a postgres error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'messaging_blocked', code: '23000' } })
    const { message, error } = await sendRichMessage('conv-1', 'user-1', 'text', 'hi')
    expect(message).toBeNull()
    expect(error).toBe('Messaging is not available between these accounts.')
  })

  it('includes attachment metadata when provided', async () => {
    mockRpc.mockResolvedValue({ data: messageRow, error: null })
    const meta = { post_id: 'post-1' }
    await sendRichMessage('conv-1', 'user-1', 'post_share', null, null, meta)
    expect(mockRpc).toHaveBeenCalledWith('send_direct_message', expect.objectContaining({
      p_attachment_metadata: meta,
    }))
  })
})

describe('searchConversationMessages', () => {
  it('returns messages matching the query', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [messageRow], error: null }))
    const results = await searchConversationMessages('conv-1', 'Hello')
    expect(results).toHaveLength(1)
    expect(results[0]?.body).toBe('Hello')
  })

  it('returns empty array when no messages match', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))
    const results = await searchConversationMessages('conv-1', 'xyz')
    expect(results).toHaveLength(0)
  })
})

describe('deleteMessage', () => {
  it('returns null error on success', async () => {
    mockRpc.mockResolvedValue({ error: null })
    const { error } = await deleteMessage('msg-1')
    expect(error).toBeNull()
    expect(mockRpc).toHaveBeenCalledWith('delete_message', { p_message_id: 'msg-1' })
  })

  it('returns mapped error string on failure', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'PGRST301', message: 'Permission denied' } })
    const { error } = await deleteMessage('msg-1')
    expect(error).toBeTruthy()
  })
})
