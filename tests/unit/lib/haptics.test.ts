import * as Haptics from 'expo-haptics'
import { haptic } from '@/lib/haptics'

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
  },
  impactAsync: jest.fn(() => Promise.resolve()),
}))

const impactAsync = jest.mocked(Haptics.impactAsync)

describe('semantic haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses light feedback for like and save confirmations', async () => {
    await haptic.confirmLike()
    await haptic.confirmSave()

    expect(impactAsync).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Light)
    expect(impactAsync).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Light)
  })

  it('uses medium feedback for a completed publication', async () => {
    await haptic.confirmPublish()

    expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
  })
})
