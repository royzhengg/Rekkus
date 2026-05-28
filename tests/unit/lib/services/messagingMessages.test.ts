import { addReaction, removeReaction } from '@/lib/services/messaging'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}))

const mockFrom = jest.mocked(supabase.from)
const mockGetUser = jest.mocked(supabase.auth.getUser)

describe('message reactions', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('rejects failed reaction writes so transport failures remain retryable', async () => {
    mockFrom.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: new Error('Network request failed') }),
    } as never)

    await expect(addReaction('message-1', 'heart')).rejects.toThrow('Network request failed')
  })

  it('rejects failed reaction removals so transport failures remain retryable', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null } as never)
    mockFrom.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: new Error('Network request failed') }),
        }),
      }),
    } as never)

    await expect(removeReaction('message-1')).rejects.toThrow('Network request failed')
  })
})
