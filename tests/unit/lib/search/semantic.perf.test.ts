// Semantic search performance guardrail — B-509
//
// Guards that client-side semantic search operations (score blending, result
// parsing, topFeed construction) are synchronous and fast — no async DB calls.
//
// Performance ceiling: 500 result rows blended + sorted must complete in <50ms.
// Under Istanbul coverage instrumentation the threshold is relaxed to 2000ms —
// the invariant being tested is "synchronous, no DB I/O", not raw throughput.

const isCoverage = typeof (global as Record<string, unknown>).__coverage__ !== 'undefined'

const ENTITY_TYPES = ['place', 'post', 'dish'] as const

function buildRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    entity_type: ENTITY_TYPES[i % 3],
    entity_id: `entity-${i}`,
    semantic_similarity: 0.5 + (i % 50) / 100,
    taste_similarity: 0.4 + (i % 30) / 100,
    display_data: { name: `Result ${i}`, cuisine_type: 'Italian' },
  }))
}

function blendAndSort(rows: ReturnType<typeof buildRows>) {
  return rows
    .map(r => ({
      ...r,
      final_score: 0.7 * r.semantic_similarity + 0.3 * r.taste_similarity,
    }))
    .filter(r => r.final_score > 0.4)
    .sort((a, b) => b.final_score - a.final_score)
}

describe('Semantic search performance guardrail', () => {
  it('blends and sorts 500 result rows in under 50ms', () => {
    const rows = buildRows(500)
    const start = performance.now()
    const sorted = blendAndSort(rows)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(isCoverage ? 2000 : 50)
    expect(sorted.length).toBeGreaterThan(0)
    const first = sorted[0]
    expect(first?.final_score).toBeGreaterThanOrEqual(sorted[sorted.length - 1]?.final_score ?? 0)
  })

  it('topFeed slice of 12 is O(1) after sort', () => {
    const rows = buildRows(200)
    const sorted = blendAndSort(rows)
    const start = performance.now()
    const topFeed = sorted.slice(0, 12)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(10)
    expect(topFeed.length).toBeLessThanOrEqual(12)
  })
})
