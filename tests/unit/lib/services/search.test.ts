import { reportInvalidBoundary } from '@/lib/services/boundaryTelemetry'
import { fetchPostsByCuisines } from '@/lib/services/posts'
import { resolveSearchExpansion, searchPlaces } from '@/lib/services/search'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/services/boundaryTelemetry', () => ({
  reportInvalidBoundary: jest.fn(),
}))

jest.mock('@/lib/services/posts', () => ({
  fetchPostsByCuisines: jest.fn().mockResolvedValue([]),
  mapRowToPost: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}))

const mockRpc = jest.mocked(supabase.rpc)
const mockFetchPostsByCuisines = jest.mocked(fetchPostsByCuisines)
const mockReportInvalidBoundary = jest.mocked(reportInvalidBoundary)

const validPlace = {
  id: 'rest-1',
  name: 'Ramen Bar',
  address: '1 Food Street',
  city: 'Sydney',
  cuisine_type: 'Japanese',
  google_place_id: 'google-1',
  latitude: -33.87,
  longitude: 151.21,
  google_rating: 4.5,
  google_review_count: 100,
}

describe('searchPlaces', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('normalises valid place rows and reports filtered provider rows', async () => {
    mockRpc.mockResolvedValue({ data: [validPlace, { id: 9 }], error: null } as never)

    await expect(searchPlaces('ramen', null)).resolves.toEqual([validPlace])
    expect(mockRpc).toHaveBeenCalledWith('search_restaurants_full_text', {
      query_text: 'ramen',
      max_results: 40,
    })
    expect(mockReportInvalidBoundary).toHaveBeenCalledWith('search_places_row_invalid')
  })

  it('uses bounding box lookup rather than text lookup for nearby requests', async () => {
    mockRpc.mockResolvedValue({ data: [validPlace], error: null } as never)
    const bounds = { min_lat: -34, max_lat: -33, min_lng: 151, max_lng: 152 }

    await searchPlaces('ramen', null, bounds)

    expect(mockRpc).toHaveBeenCalledWith('restaurants_in_bounding_box', {
      ...bounds,
      max_results: 50,
    })
  })
})

describe('resolveSearchExpansion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPostsByCuisines.mockResolvedValue([])
  })

  it('uses deterministic cuisine synonyms without an expansion RPC', async () => {
    const result = await resolveSearchExpansion({
      isAroundMe: false,
      strictPostCount: 0,
      strictPlaceCount: 1,
      words: ['ramen'],
      q: 'ramen',
    })

    expect(result.cuisines).toEqual([{ cuisine_type: 'japanese', match_count: 1 }])
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockFetchPostsByCuisines).toHaveBeenCalledWith(['japanese'], 20)
  })

  it('uses backend cuisine expansion when no deterministic synonym exists', async () => {
    mockRpc.mockResolvedValue({
      data: [{ cuisine_type: 'fusion', match_count: 2 }],
      error: null,
    } as never)

    const result = await resolveSearchExpansion({
      isAroundMe: false,
      strictPostCount: 0,
      strictPlaceCount: 1,
      words: ['chef'],
      q: 'chef',
    })

    expect(mockRpc).toHaveBeenCalledWith('expand_search_cuisines', {
      query_text: 'chef',
      max_cuisines: 3,
    })
    expect(result.cuisines).toEqual([{ cuisine_type: 'fusion', match_count: 2 }])
  })
})
