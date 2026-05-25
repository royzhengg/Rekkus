import { parseLikes, avatarPalette } from '@/lib/utils/format'

describe('parseLikes', () => {
  it('converts k-suffix strings to thousands', () => {
    expect(parseLikes('1k')).toBe(1000)
    expect(parseLikes('1.2k')).toBe(1200)
    expect(parseLikes('5k')).toBe(5000)
    expect(parseLikes('0.8k')).toBe(800)
  })

  it('returns the numeric value for plain number strings', () => {
    expect(parseLikes('42')).toBe(42)
    expect(parseLikes('0')).toBe(0)
  })
})

describe('avatarPalette', () => {
  it('returns an object with bg and color string properties', () => {
    const palette = avatarPalette('royzheng')
    expect(typeof palette.bg).toBe('string')
    expect(typeof palette.color).toBe('string')
    expect(palette.bg).toMatch(/^#/)
    expect(palette.color).toMatch(/^#/)
  })

  it('is deterministic — same username always gives the same palette', () => {
    expect(avatarPalette('alice')).toEqual(avatarPalette('alice'))
    expect(avatarPalette('bob')).toEqual(avatarPalette('bob'))
  })

  it('can produce different palettes for different usernames', () => {
    // charCodes differ enough to land on different palette slots
    const a = avatarPalette('a')  // charCode 97 → slot 1
    const g = avatarPalette('G')  // charCode 71 → slot 5
    expect(a).not.toEqual(g)
  })
})
