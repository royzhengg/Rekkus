import { getTopResultSectionOrder } from '@/features/search/topResultOrder'

describe('getTopResultSectionOrder', () => {
  it('promotes dish posts above places for dish or mixed intent callers', () => {
    expect(getTopResultSectionOrder(true)).toEqual(['posts', 'places', 'people'])
  })

  it('keeps the existing places-first order for non-dish intent callers', () => {
    expect(getTopResultSectionOrder(false)).toEqual(['places', 'posts', 'people'])
  })
})
