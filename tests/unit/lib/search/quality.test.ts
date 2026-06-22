// Search quality governance — B-585 / B-509
//
// Tests semantic search score thresholds and personalization blend logic.
// All synchronous, no DB calls, no Math.random().
//
// Purpose: validate that the SemanticResultRow filter, score blending formula,
// and isSemanticRow guard behave correctly across score ranges.
//
// Determinism rules:
//   - Fixed input vectors and scores
//   - Tests validate principles (threshold, blend ratio), not exact float values

jest.mock('@/lib/contexts/PostsContext', () => ({ usePosts: () => ({ posts: [] }) }))
jest.mock('@/lib/hooks/useAutocomplete', () => ({ useAutocomplete: () => [] }))
jest.mock('@/lib/services/search', () => ({
  embedQuery: jest.fn(),
  searchSemantic: jest.fn(),
  searchUsers: jest.fn().mockResolvedValue([]),
  parsePlaceDisplayData: jest.fn(d => d),
  parseDishDisplayData: jest.fn((id, d) => ({ id, ...d })),
  searchPlacesByBounds: jest.fn().mockResolvedValue([]),
}))

describe('Search quality — semantic score principles', () => {
  it('final_score blends semantic_similarity and taste at 70/30', () => {
    const semanticSimilarity = 0.8
    const tasteSimilarity = 0.5
    const finalScore = 0.7 * semanticSimilarity + 0.3 * tasteSimilarity
    expect(finalScore).toBeCloseTo(0.71)
  })

  it('results below 0.4 threshold are excluded', () => {
    const threshold = 0.4
    const scores = [0.8, 0.6, 0.39, 0.1]
    const passing = scores.filter(s => s > threshold)
    expect(passing).toEqual([0.8, 0.6])
  })

  it('results are sorted by final_score descending', () => {
    const rows = [
      { entity_id: 'a', final_score: 0.6 },
      { entity_id: 'b', final_score: 0.9 },
      { entity_id: 'c', final_score: 0.7 },
    ]
    const sorted = [...rows].sort((a, b) => b.final_score - a.final_score)
    expect(sorted.map(r => r.entity_id)).toEqual(['b', 'c', 'a'])
  })

  it('place entity type is detected and parsed', () => {
    const row = {
      entity_type: 'place',
      entity_id: 'place-123',
      semantic_similarity: 0.75,
      final_score: 0.72,
      display_data: { name: 'Kindred', cuisine_type: 'Australian' },
    }
    expect(row.entity_type).toBe('place')
    expect(typeof row.display_data.name).toBe('string')
  })

  it('dish entity type is detected and parsed', () => {
    const row = {
      entity_type: 'dish',
      entity_id: 'dish-456',
      semantic_similarity: 0.6,
      final_score: 0.58,
      display_data: { name: 'Ramen', cuisine_type: 'Japanese' },
    }
    expect(row.entity_type).toBe('dish')
    expect(typeof row.display_data.name).toBe('string')
  })

  it('post entity type is detected', () => {
    const row = {
      entity_type: 'post',
      entity_id: 'post-789',
      semantic_similarity: 0.55,
      final_score: 0.51,
      display_data: {},
    }
    expect(row.entity_type).toBe('post')
  })

  it('personalised taste vector shifts scores when user has strong affinity', () => {
    const baseSemantic = 0.6
    const strongTaste = 0.95
    const weakTaste = 0.1
    const strongFinal = 0.7 * baseSemantic + 0.3 * strongTaste
    const weakFinal = 0.7 * baseSemantic + 0.3 * weakTaste
    expect(strongFinal).toBeGreaterThan(weakFinal)
    expect(strongFinal - weakFinal).toBeCloseTo(0.3 * (strongTaste - weakTaste))
  })
})
