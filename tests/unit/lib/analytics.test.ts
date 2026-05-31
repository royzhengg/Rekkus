import { analytics, sanitizeAnalyticsMetadata } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

jest.mock('@/lib/utils/cooldown', () => ({
  isCoolingDown: jest.fn().mockReturnValue(false),
}))

const mockFrom = jest.mocked(supabase.from)
const mockInsert = jest.fn().mockResolvedValue({ error: null })

async function flushAnalytics(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function lastInsertedRow(): Record<string, unknown> {
  return mockInsert.mock.calls.at(-1)?.[0] as Record<string, unknown>
}

describe('analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFrom.mockReturnValue({ insert: mockInsert } as never)
  })

  it('sanitizes unsafe and non-allowlisted metadata', () => {
    expect(sanitizeAnalyticsMetadata({
      query: 'ramen',
      selected_query: 'password reset token',
      precise_location: '-33.8688,151.2093',
      ignored: 'not allowed',
      suggestion_queries: ['ramen'],
    })).toEqual({
      query: 'ramen',
      selected_query: '[redacted]',
    })
  })

  it('emits no-results shown with compact suggestion metadata', async () => {
    analytics.noResultsShown('user-1', 'xyzzy', ['ramen', 'dumplings'])
    await flushAnalytics()

    expect(lastInsertedRow()).toMatchObject({
      user_id: 'user-1',
      event_type: 'no_results_shown',
      event_version: 1,
      metadata: {
        query: 'xyzzy',
        suggestion_queries: 'ramen|dumplings',
      },
    })
  })

  it('emits no-results suggestion clicks with selected query and position', async () => {
    analytics.noResultsSuggestionClick(null, 'xyzzy', 'ramen', 2)
    await flushAnalytics()

    expect(lastInsertedRow()).toMatchObject({
      user_id: null,
      event_type: 'no_results_suggestion_click',
      event_version: 1,
      metadata: {
        query: 'xyzzy',
        selected_query: 'ramen',
        position: 2,
      },
    })
  })

  it('includes cuisine metadata on engagement events when provided', async () => {
    analytics.viewPost('user-1', 'post-1', 'Japanese')
    analytics.savePost('user-1', 'post-1', 'Japanese')
    analytics.viewPlace('user-1', 'restaurant-1', undefined, 'Japanese')
    analytics.savePlace('user-1', 'restaurant-1', 'Japanese')
    await flushAnalytics()

    expect(mockInsert.mock.calls.map(call => call[0])).toEqual([
      expect.objectContaining({ event_type: 'post_view', metadata: { cuisine_type: 'Japanese' } }),
      expect.objectContaining({ event_type: 'post_save', metadata: { cuisine_type: 'Japanese' } }),
      expect.objectContaining({ event_type: 'place_view', metadata: { cuisine_type: 'Japanese' } }),
      expect.objectContaining({ event_type: 'place_save', metadata: { cuisine_type: 'Japanese' } }),
    ])
  })

  it('omits cuisine metadata on engagement events when absent', async () => {
    analytics.viewPost('user-1', 'post-1')
    analytics.savePost('user-1', 'post-1')
    analytics.viewPlace('user-1', 'restaurant-1')
    analytics.savePlace('user-1', 'restaurant-1')
    await flushAnalytics()

    expect(mockInsert.mock.calls.map(call => call[0])).toEqual([
      expect.not.objectContaining({ metadata: expect.anything() }),
      expect.not.objectContaining({ metadata: expect.anything() }),
      expect.not.objectContaining({ metadata: expect.anything() }),
      expect.not.objectContaining({ metadata: expect.anything() }),
    ])
  })
})
