import { submitPrivacyRequest } from '@/lib/services/privacyRequests'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

const mockFrom = jest.mocked(supabase.from)

describe('privacy requests service', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('inserts a tracked privacy request with minimized payload', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert } as never)

    await submitPrivacyRequest('user-1', 'export')

    expect(mockFrom).toHaveBeenCalledWith('privacy_requests')
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      request_type: 'export',
      request_payload: { source: 'settings_privacy_data' },
    })
  })
})
