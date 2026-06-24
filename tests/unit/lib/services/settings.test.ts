import { DEFAULT_SETTINGS, normalizeSettings, updateSettingValue } from '@/lib/services/settings'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}))

const mockFrom = jest.mocked(supabase.from)
const mockRpc = jest.mocked(supabase.rpc)

describe('settings service', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('normalizes activity status with a visible default', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ show_activity_status: false }).show_activity_status).toBe(false)
    expect(normalizeSettings({ show_activity_status: 'nope' }).show_activity_status).toBe(true)
  })

  it('uses the privacy RPC for private-account changes', async () => {
    mockRpc.mockResolvedValue({ error: null, data: { private_account: true, approved_count: 0 } } as never)

    await updateSettingValue('user-1', 'private_account', true)

    expect(mockRpc).toHaveBeenCalledWith('set_account_privacy', { p_private: true })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('upserts ordinary settings so missing rows are repaired on first change', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ upsert } as never)

    await updateSettingValue('user-1', 'allow_comments', true)

    expect(mockFrom).toHaveBeenCalledWith('user_settings')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        allow_comments: true,
        updated_at: expect.any(String),
      }),
      { onConflict: 'id' }
    )
  })

  it('uses the activity visibility RPC so disabling clears last_seen_at', async () => {
    mockRpc.mockResolvedValue({ error: null, data: null } as never)

    await updateSettingValue('user-1', 'show_activity_status', false)

    expect(mockRpc).toHaveBeenCalledWith('set_activity_visibility', { p_show: false })
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
