import { buildSearchContext } from '@/lib/search/context'
import { resolveFromAliasCache, resolveSuburbQuery } from '@/lib/utils/locationResolver'

jest.mock('@/lib/dataSources/cuisines', () => ({ normalizeCuisine: jest.fn((x: string) => x) }))
jest.mock('@/lib/utils/locationResolver', () => ({
  resolveFromAliasCache: jest.fn(),
  resolveSuburbQuery: jest.fn(),
}))

const mockResolveFromAliasCache = jest.mocked(resolveFromAliasCache)
const mockResolveSuburbQuery = jest.mocked(resolveSuburbQuery)

describe('buildSearchContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveFromAliasCache.mockReturnValue(null)
    mockResolveSuburbQuery.mockResolvedValue(null)
  })

  it('represents an empty normal search as no active query', async () => {
    const context = await buildSearchContext({ query: '   ', userLocation: null })

    expect(context.hasQuery).toBe(false)
    expect(context.query).toBe('')
    expect(context.words).toEqual([])
    expect(context.mode).toBe('search')
    expect(context.bounds).toBeUndefined()
  })

  it('requires coordinates for around-me bounds', async () => {
    const withoutLocation = await buildSearchContext({
      query: '',
      userLocation: null,
      options: { mode: 'aroundMe', radiusKm: 5 },
    })
    const withLocation = await buildSearchContext({
      query: '',
      userLocation: { lat: -33.87, lng: 151.21 },
      options: { mode: 'aroundMe', radiusKm: 5 },
    })

    expect(withoutLocation.hasQuery).toBe(true)
    expect(withoutLocation.bounds).toBeUndefined()
    expect(withLocation.bounds?.min_lat).toBeLessThan(withLocation.bounds?.max_lat ?? 0)
    expect(withLocation.bounds?.min_lng).toBeLessThan(withLocation.bounds?.max_lng ?? 0)
  })

  it('preserves manual locality as explicit context metadata', async () => {
    const context = await buildSearchContext({
      query: 'pork',
      userLocation: { lat: -33.8, lng: 151.18 },
      options: { locationSource: 'manual' },
    })

    expect(context.locationSource).toBe('manual')
    expect(context.userLocation).toEqual({ lat: -33.8, lng: 151.18 })
  })

  it('keeps dish intent and provider fallback inputs together', async () => {
    const context = await buildSearchContext({ query: 'pork', userLocation: null })

    expect(context.intent).toBe('food_dish')
    expect(context.dishIntentActive).toBe(true)
    expect(context.dishQuery).toBe('pork')
    expect(context.placeQuery).toBe('pork')
    expect(context.locationSource).toBe('none')
  })

  it('resolves suburb filters through alias then DB', async () => {
    mockResolveFromAliasCache.mockReturnValueOnce(null)
    mockResolveSuburbQuery.mockResolvedValueOnce('Parramatta')

    const context = await buildSearchContext({ query: 'ramen near parra', userLocation: null })

    expect(mockResolveSuburbQuery).toHaveBeenCalledWith('parra')
    expect(context.suburbFilter).toBe('Parramatta')
  })
})
