import { ensureVocabularyLoaded, _resetVocabCacheForTest } from '@/lib/search/vocabularyCache'
import { fetchDistinctCuisineTypes } from '@/lib/services/search'
import { isDynamicFoodToken } from '@/lib/utils/cuisineSynonyms'
import { classifySearchIntent } from '@/lib/utils/searchIntent'

jest.mock('@/lib/services/search', () => ({
  fetchDistinctCuisineTypes: jest.fn(),
}))

const mockFetch = fetchDistinctCuisineTypes as jest.MockedFunction<typeof fetchDistinctCuisineTypes>

describe('ensureVocabularyLoaded', () => {
  beforeEach(() => {
    _resetVocabCacheForTest()
    mockFetch.mockReset()
  })

  it('loads cuisine types from DB and registers them as dynamic tokens', async () => {
    mockFetch.mockResolvedValue(['Japanese Omakase', 'Korean BBQ'])
    await ensureVocabularyLoaded()
    expect(isDynamicFoodToken('omakase')).toBe(true)
    expect(isDynamicFoodToken('korean')).toBe(true)
    expect(isDynamicFoodToken('bbq')).toBe(true)
  })

  it('does not re-fetch within TTL', async () => {
    mockFetch.mockResolvedValue(['XenonCuisineA'])
    await ensureVocabularyLoaded()
    await ensureVocabularyLoaded()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('re-fetches after TTL expires', async () => {
    mockFetch.mockResolvedValue(['XenonCuisineB'])
    await ensureVocabularyLoaded()
    _resetVocabCacheForTest({ expireNow: true })
    mockFetch.mockResolvedValue(['XenonCuisineC'])
    await ensureVocabularyLoaded()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(isDynamicFoodToken('xenoncuisinec')).toBe(true)
  })

  it('does not throw when DB fetch fails — logs warning and continues with static lists', async () => {
    mockFetch.mockRejectedValue(new Error('DB unreachable'))
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(ensureVocabularyLoaded()).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[search]'),
      expect.any(Error)
    )
    warnSpy.mockRestore()
  })

  it('static food terms still work after a failed load', async () => {
    mockFetch.mockRejectedValue(new Error('DB unreachable'))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    await ensureVocabularyLoaded()
    // ramen is in FOOD_TERMS — static lists must still classify correctly
    expect(classifySearchIntent('ramen').kind).toBe('food_dish')
  })
})
