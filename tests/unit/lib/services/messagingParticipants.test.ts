import { muteConversation, pinConversation } from '@/lib/services/messaging'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

const mockFrom = jest.mocked(supabase.from)

function failingUpdate() {
  return {
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: new Error('Network request failed') }),
      }),
    }),
  } as never
}

describe('conversation participant preferences', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('rejects failed mute writes so they can be queued or reported', async () => {
    mockFrom.mockReturnValue(failingUpdate())

    await expect(muteConversation('conversation-1', 'user-1')).rejects.toThrow('Network request failed')
  })

  it('rejects failed pin writes so they can be queued or reported', async () => {
    mockFrom.mockReturnValue(failingUpdate())

    await expect(pinConversation('conversation-1', 'user-1')).rejects.toThrow('Network request failed')
  })
})
