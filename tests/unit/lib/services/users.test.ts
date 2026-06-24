import {
  approveAllFollowRequests,
  approveFollowRequest,
  declineAllFollowRequests,
  fetchFollowRelationshipState,
  fetchFollowers,
  fetchFollowCounts,
  fetchFollowing,
  fetchIncomingFollowRequests,
  followUser,
  removeFollowChannel,
  subscribeToFollowChanges,
} from '@/lib/services/users'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}))

jest.mock('@/lib/analytics', () => ({
  analytics: { follow: jest.fn(), followRequestStateChanged: jest.fn() },
}))

jest.mock('@/lib/services/notifications', () => ({
  notify: jest.fn(),
}))

const mockFrom = jest.mocked(supabase.from)
const mockRpc = jest.mocked(supabase.rpc)
const mockChannel = jest.mocked(supabase.channel)
const mockRemoveChannel = jest.mocked(supabase.removeChannel)

type MockQueryBuilder = {
  select: jest.Mock
  eq: jest.Mock
  order: jest.Mock
  limit: jest.Mock
  overrideTypes?: jest.Mock
}

function queryBuilder(result: unknown): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockResolvedValue(result)
  return builder
}

function requestQueryBuilder(result: unknown) {
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
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockResolvedValue(result)
  return builder
}

describe('users follow list services', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns followers from bounded query rows', async () => {
    const builder = queryBuilder({
      data: [{ users: { id: 'u1', username: 'sarah', full_name: 'Sarah Lee', avatar_url: null } }],
      error: null,
    })
    mockFrom.mockReturnValue(builder as never)

    await expect(fetchFollowers('target-1')).resolves.toEqual([
      { id: 'u1', username: 'sarah', full_name: 'Sarah Lee', avatar_url: null },
    ])
    expect(builder.eq).toHaveBeenCalledWith('following_id', 'target-1')
    expect(builder.limit).toHaveBeenCalledWith(50)
  })

  it('returns following from bounded query rows', async () => {
    const builder = queryBuilder({
      data: [{ users: { id: 'u2', username: 'roy', full_name: null, avatar_url: 'https://example.com/a.jpg' } }],
      error: null,
    })
    mockFrom.mockReturnValue(builder as never)

    await expect(fetchFollowing('target-1')).resolves.toEqual([
      { id: 'u2', username: 'roy', full_name: null, avatar_url: 'https://example.com/a.jpg' },
    ])
    expect(builder.eq).toHaveBeenCalledWith('follower_id', 'target-1')
    expect(builder.limit).toHaveBeenCalledWith(50)
  })

  it('throws follower list query errors', async () => {
    const error = new Error('nope')
    mockFrom.mockReturnValue(queryBuilder({ data: null, error }) as never)

    await expect(fetchFollowers('target-1')).rejects.toThrow('nope')
    await expect(fetchFollowing('target-1')).rejects.toThrow('nope')
  })

  it('throws follow count query errors', async () => {
    const error = new Error('count failed')
    mockFrom
      .mockReturnValueOnce(countBuilder({ count: null, error }) as never)
      .mockReturnValueOnce(countBuilder({ count: 1, error: null }) as never)

    await expect(fetchFollowCounts('target-1')).rejects.toThrow('count failed')
  })

  it('subscribes to follower and following changes for a user', () => {
    const on = jest.fn()
    const subscribe = jest.fn()
    const channel = { on, subscribe }
    on.mockReturnValue(channel)
    subscribe.mockReturnValue(channel)
    mockChannel.mockReturnValue(channel as never)

    const onChange = jest.fn()
    const returned = subscribeToFollowChanges('target-1', onChange)

    expect(returned).toBe(channel)
    expect(mockChannel).toHaveBeenCalledWith(expect.stringContaining('follows:target-1:'))
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ event: 'INSERT', table: 'follows', filter: 'follower_id=eq.target-1' }),
      expect.any(Function)
    )
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ event: 'DELETE', table: 'follows', filter: 'following_id=eq.target-1' }),
      expect.any(Function)
    )

    const insertHandler = on.mock.calls[0]?.[2]
    insertHandler({ new: { follower_id: 'target-1', following_id: 'other-1' } })
    expect(onChange).toHaveBeenCalledWith({
      eventType: 'INSERT',
      followerId: 'target-1',
      followingId: 'other-1',
    })
  })

  it('removes follow realtime channels', () => {
    const channel = { id: 'channel-1' }
    removeFollowChannel(channel as never)

    expect(mockRemoveChannel).toHaveBeenCalledWith(channel)
  })

  it('returns relationship state from the central RPC', async () => {
    mockRpc.mockResolvedValue({ data: 'requested', error: null } as never)

    await expect(fetchFollowRelationshipState('target-1')).resolves.toBe('requested')

    expect(mockRpc).toHaveBeenCalledWith('follow_relationship_state', { p_target_id: 'target-1' })
  })

  it('requests private follows without inserting an approved follow row locally', async () => {
    const notify = jest.requireMock('@/lib/services/notifications') as { notify: jest.Mock }
    const analytics = jest.requireMock('@/lib/analytics') as {
      analytics: { followRequestStateChanged: jest.Mock; follow: jest.Mock }
    }
    mockRpc.mockResolvedValue({ data: 'requested', error: null } as never)

    await expect(followUser('user-1', 'target-1')).resolves.toBe('requested')

    expect(mockRpc).toHaveBeenCalledWith('request_follow', { p_target_id: 'target-1' })
    expect(analytics.analytics.followRequestStateChanged).toHaveBeenCalledWith('user-1', 'sent')
    expect(analytics.analytics.follow).not.toHaveBeenCalled()
    expect(notify.notify).toHaveBeenCalledWith({ type: 'follow_request', actorId: 'user-1', targetId: 'target-1' })
  })

  it('notifies requester when a follow request is approved', async () => {
    const notify = jest.requireMock('@/lib/services/notifications') as { notify: jest.Mock }
    mockRpc.mockResolvedValue({ data: 'requester-1', error: null } as never)

    await expect(approveFollowRequest('request-1')).resolves.toBe('requester-1')

    expect(mockRpc).toHaveBeenCalledWith('approve_follow_request', { p_request_id: 'request-1' })
    expect(notify.notify).toHaveBeenCalledWith({
      type: 'follow_request_approved',
      actorId: '',
      requesterId: 'requester-1',
    })
  })

  it('approves all pending incoming requests through the bulk RPC', async () => {
    const analytics = jest.requireMock('@/lib/analytics') as {
      analytics: { followRequestStateChanged: jest.Mock; follow: jest.Mock }
    }
    mockRpc.mockResolvedValue({
      data: { approved_count: 2, approved_requester_ids: ['requester-1', 'requester-2'] },
      error: null,
    } as never)

    await expect(approveAllFollowRequests()).resolves.toEqual({
      approvedCount: 2,
      approvedRequesterIds: ['requester-1', 'requester-2'],
    })

    expect(mockRpc).toHaveBeenCalledWith('approve_all_follow_requests')
    expect(analytics.analytics.followRequestStateChanged).toHaveBeenCalledWith(null, 'approved_bulk')
  })

  it('declines all pending incoming requests through the bulk RPC', async () => {
    const analytics = jest.requireMock('@/lib/analytics') as {
      analytics: { followRequestStateChanged: jest.Mock; follow: jest.Mock }
    }
    mockRpc.mockResolvedValue({ data: 3, error: null } as never)

    await expect(declineAllFollowRequests()).resolves.toBe(3)

    expect(mockRpc).toHaveBeenCalledWith('decline_all_follow_requests')
    expect(analytics.analytics.followRequestStateChanged).toHaveBeenCalledWith(null, 'declined_bulk')
  })

  it('loads incoming pending requests through the follow request table', async () => {
    const builder = requestQueryBuilder({
      data: [{
        id: 'request-1',
        requester_id: 'requester-1',
        target_id: 'target-1',
        status: 'pending',
        created_at: '2026-06-23T00:00:00.000Z',
        users: { id: 'requester-1', username: 'roy', full_name: null, avatar_url: null },
      }],
      error: null,
    })
    mockFrom.mockReturnValue(builder as never)

    await expect(fetchIncomingFollowRequests()).resolves.toEqual([{
      id: 'request-1',
      requester_id: 'requester-1',
      target_id: 'target-1',
      status: 'pending',
      created_at: '2026-06-23T00:00:00.000Z',
      requester: { id: 'requester-1', username: 'roy', full_name: null, avatar_url: null },
    }])
    expect(mockFrom).toHaveBeenCalledWith('follow_requests')
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending')
    expect(builder.limit).toHaveBeenCalledWith(50)
  })
})
