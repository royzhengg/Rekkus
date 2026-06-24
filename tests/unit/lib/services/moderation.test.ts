import {
  BLOCKED_ACCOUNTS_LIMIT,
  fetchBlockedAccountCount,
  fetchBlockedAccounts,
  fetchBlockedUserIds,
  unblockUser,
} from '@/lib/services/moderation'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('@/lib/analytics', () => ({
  analytics: { abuseSignal: jest.fn() },
}))

const mockFrom = jest.mocked(supabase.from)

function blockedListBuilder(result: unknown) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    overrideTypes: jest.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.overrideTypes.mockResolvedValue(result)
  return builder
}

function countBuilder(result: unknown) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    limit: jest.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.limit.mockResolvedValue(result)
  return builder
}

function deleteBuilder(result: unknown) {
  const builder = {
    delete: jest.fn(),
    eq: jest.fn(),
  }
  builder.delete.mockReturnValue(builder)
  builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce(result)
  return builder
}

describe('moderation blocked accounts services', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches blocked account count separately from the list fetch', async () => {
    const builder = countBuilder({ count: 2, error: null })
    mockFrom.mockReturnValue(builder as never)

    await expect(fetchBlockedAccountCount('user-1')).resolves.toBe(2)

    expect(mockFrom).toHaveBeenCalledWith('user_blocks')
    expect(builder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(builder.eq).toHaveBeenCalledWith('blocker_id', 'user-1')
    expect(builder.limit).toHaveBeenCalledWith(1)
  })

  it('throws blocked account count query errors', async () => {
    mockFrom.mockReturnValue(countBuilder({ count: null, error: new Error('count failed') }) as never)

    await expect(fetchBlockedAccountCount('user-1')).rejects.toThrow('count failed')
  })

  it('fetches validated blocked accounts with deterministic ordering and cap', async () => {
    const builder = blockedListBuilder({
      data: [
        {
          blocked_id: 'blocked-1',
          created_at: '2026-06-24T00:00:00.000Z',
          users: { id: 'blocked-1', username: 'sarah', full_name: 'Sarah Lee', avatar_url: null },
        },
      ],
      error: null,
    })
    mockFrom.mockReturnValue(builder as never)

    await expect(fetchBlockedAccounts('user-1')).resolves.toEqual([
      {
        blockedUserId: 'blocked-1',
        username: 'sarah',
        fullName: 'Sarah Lee',
        avatarUrl: null,
        blockedAt: '2026-06-24T00:00:00.000Z',
      },
    ])

    expect(builder.eq).toHaveBeenCalledWith('blocker_id', 'user-1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(builder.order).toHaveBeenCalledWith('id', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(BLOCKED_ACCOUNTS_LIMIT)
  })

  it('maps missing joined users to deleted-account rows and drops malformed rows', async () => {
    const builder = blockedListBuilder({
      data: [
        { blocked_id: 'deleted-1', created_at: '2026-06-23T00:00:00.000Z', users: null },
        { blocked_id: 123, created_at: '2026-06-23T00:00:00.000Z', users: null },
      ],
      error: null,
    })
    mockFrom.mockReturnValue(builder as never)

    await expect(fetchBlockedAccounts('user-1')).resolves.toEqual([
      {
        blockedUserId: 'deleted-1',
        username: null,
        fullName: null,
        avatarUrl: null,
        blockedAt: '2026-06-23T00:00:00.000Z',
      },
    ])
  })

  it('throws blocked account list query errors', async () => {
    mockFrom.mockReturnValue(blockedListBuilder({ data: null, error: new Error('list failed') }) as never)

    await expect(fetchBlockedAccounts('user-1')).rejects.toThrow('list failed')
  })

  it('keeps blocked user id reads bounded and validated', async () => {
    const builder = blockedListBuilder({
      data: [{ blocked_id: 'blocked-1' }, { blocked_id: 5 }],
      error: null,
    })
    mockFrom.mockReturnValue(builder as never)

    await expect(fetchBlockedUserIds('user-1')).resolves.toEqual(['blocked-1'])
    expect(builder.limit).toHaveBeenCalledWith(BLOCKED_ACCOUNTS_LIMIT)
  })

  it('treats already-unblocked deletes as success', async () => {
    const builder = deleteBuilder({ data: [], error: null })
    mockFrom.mockReturnValue(builder as never)

    await expect(unblockUser('user-1', 'blocked-1')).resolves.toBeNull()
    expect(builder.eq).toHaveBeenCalledWith('blocker_id', 'user-1')
    expect(builder.eq).toHaveBeenCalledWith('blocked_id', 'blocked-1')
  })
})
