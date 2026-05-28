import { canUseIosTabBarMaterial } from '@/lib/utils/iosTabMaterial'

describe('canUseIosTabBarMaterial', () => {
  it('permits only flagged iOS development or staging evaluation', () => {
    expect(canUseIosTabBarMaterial('ios', 'development', true)).toBe(true)
    expect(canUseIosTabBarMaterial('ios', 'staging', true)).toBe(true)
    expect(canUseIosTabBarMaterial('ios', 'beta', true)).toBe(false)
    expect(canUseIosTabBarMaterial('ios', 'production', true)).toBe(false)
    expect(canUseIosTabBarMaterial('android', 'staging', true)).toBe(false)
    expect(canUseIosTabBarMaterial('ios', 'staging', false)).toBe(false)
  })
})
