jest.mock('@/lib/utils/locationResolver', () => ({
  resolveFromAliasCache: jest.fn().mockReturnValue(null),
}))

import { applySearchSynonymRows, resetSearchSynonymsForTest } from '@/lib/utils/cuisineSynonyms'
import { parseSearchQuery } from '@/lib/utils/queryParser'

describe('parseSearchQuery', () => {
  beforeEach(() => {
    resetSearchSynonymsForTest()
  })

  it('recognizes hydrated cuisine phrase synonyms as dish intent', () => {
    applySearchSynonymRows([{ term: 'bubble tea', canonical: 'taiwanese', type: 'cuisine' }])

    const parsed = parseSearchQuery('bubble tea')

    expect(parsed.intent).toBe('dish')
    expect(parsed.dishTerms).toEqual(['bubble tea'])
    expect(parsed.detectedPhrases).toEqual(['bubble tea'])
  })

  it('recognizes hydrated occasion and dietary phrases', () => {
    applySearchSynonymRows([
      { term: 'date spot', canonical: 'date_night', type: 'occasion' },
      { term: 'no dairy', canonical: 'dairy_free', type: 'dietary' },
    ])

    const parsed = parseSearchQuery('date spot no dairy')

    expect(parsed.intent).toBe('mixed')
    expect(parsed.occasionTerms).toEqual(['date_night'])
    expect(parsed.dietaryTerms).toEqual(['dairy_free'])
    expect(parsed.detectedPhrases).toEqual(['date spot', 'no dairy'])
  })
})
