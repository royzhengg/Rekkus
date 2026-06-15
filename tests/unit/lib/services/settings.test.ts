import { DEFAULT_SETTINGS, normalizeSettings, updateSettingValue } from '@/lib/services/settings'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

const mockFrom = jest.mocked(supabase.from)

describe('settings service', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('normalizes activity status with a visible default', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ show_activity_status: false }).show_activity_status).toBe(false)
    expect(normalizeSettings({ show_activity_status: 'nope' }).show_activity_status).toBe(true)
  })

  it('upserts settings so missing rows are repaired on first change', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ upsert } as never)

    await updateSettingValue('user-1', 'show_activity_status', false)

    expect(mockFrom).toHaveBeenCalledWith('user_settings')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        show_activity_status: false,
        updated_at: expect.any(String),
      }),
      { onConflict: 'id' }
    )
  })
})
