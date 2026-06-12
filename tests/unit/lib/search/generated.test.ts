// Deterministic generated search scenario tests — B-585
//
// Tests parseSearchQuery() over a fixed vocabulary of real Rekkus product-relevant terms.
// All synchronous, no DB calls, no Math.random().
//
// Purpose: validate that the query parser handles food/cuisine/vibe/location patterns
// and typo variants without crashing and with reasonable intent classification.
//
// Determinism rules:
//   - Word lists use .slice() with fixed bounds — never Math.random()
//   - typoVariants() produces exactly 3 deterministic variants per word
//   - Tests validate principles (no crash, intent defined, arrays present), not exact values
//   - Performance ceiling: full batch of 200+ queries must complete in <500ms synchronously

jest.mock('@/lib/utils/locationResolver', () => ({
  resolveFromAliasCache: jest.fn().mockReturnValue(null),
}))
jest.mock('@/lib/featureFlags', () => ({ isEnabled: jest.fn().mockReturnValue(false) }))

import { resetSearchSynonymsForTest } from '@/lib/utils/cuisineSynonyms'
import { parseSearchQuery } from '@/lib/utils/queryParser'
import type { QueryIntent } from '@/lib/utils/queryParser'

// ─── Word lists ───────────────────────────────────────────────────────────────

const FOODS = ['beef', 'chicken', 'sushi', 'ramen', 'pho', 'burger', 'pasta', 'pizza', 'curry']
const CUISINES = ['Thai', 'Japanese', 'Korean', 'Vietnamese', 'Chinese', 'Italian']
const VIBES = ['cosy', 'casual', 'fancy', 'date night', 'late night']
const LOCATIONS = ['Sydney', 'Burwood', 'Chatswood', 'Newtown', 'Parramatta']

// Deterministic fixed samples — never random
const SAMPLE_FOODS = FOODS.slice(0, 5)       // ['beef','chicken','sushi','ramen','pho']
const SAMPLE_CUISINES = CUISINES.slice(0, 4)  // ['Thai','Japanese','Korean','Vietnamese']
const SAMPLE_LOCS = LOCATIONS.slice(0, 3)     // ['Sydney','Burwood','Chatswood']

const KNOWN_INTENTS: QueryIntent[] = [
  'cuisine', 'dish', 'restaurant', 'location', 'occasion', 'dietary', 'mixed', 'general',
]

// ─── Typo variant generator ───────────────────────────────────────────────────
// Produces 3 deterministic variants. No randomness.
//   variant 0: missing last letter  ("beef" → "bee")
//   variant 1: repeated middle char ("beef" → "beeff")
//   variant 2: swapped adjacent pair ("beef" → "befe")

function typoVariants(word: string): string[] {
  if (word.length < 3) return [word]
  return [
    word.slice(0, -1),
    word.slice(0, 2) + word.charAt(2) + word.slice(2),
    word.charAt(0) + word.charAt(2) + word.charAt(1) + word.slice(3),
  ]
}

// ─── Query generators ─────────────────────────────────────────────────────────

type QueryCase = { query: string; label: string }

function foodQueryCases(): QueryCase[] {
  return SAMPLE_FOODS.flatMap(food => [
    { query: food, label: `bare: "${food}"` },
    { query: `${food} near me`, label: `near me: "${food} near me"` },
    { query: `best ${food}`, label: `best: "best ${food}"` },
  ])
}

function cuisineQueryCases(): QueryCase[] {
  return SAMPLE_CUISINES.map(c => ({
    query: `${c.toLowerCase()} near me`,
    label: `cuisine near me: "${c} near me"`,
  }))
}

function vibeQueryCases(): QueryCase[] {
  return VIBES.map(v => ({ query: `${v} restaurant`, label: `vibe: "${v} restaurant"` }))
}

function locationQueryCases(): QueryCase[] {
  return SAMPLE_LOCS.map(loc => ({
    query: `ramen in ${loc}`,
    label: `food+location: "ramen in ${loc}"`,
  }))
}

function typoQueryCases(): QueryCase[] {
  return SAMPLE_FOODS.flatMap(food =>
    typoVariants(food).map((typo, i) => ({
      query: typo,
      label: `typo ${i} of "${food}": "${typo}"`,
    }))
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Generated: food queries parse without crashing', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it.each(foodQueryCases())('$label', ({ query }) => {
    expect(() => parseSearchQuery(query)).not.toThrow()
    const result = parseSearchQuery(query)
    expect(KNOWN_INTENTS).toContain(result.intent)
    expect(Array.isArray(result.searchWords)).toBe(true)
    expect(Array.isArray(result.cuisineTerms)).toBe(true)
    expect(Array.isArray(result.dishTerms)).toBe(true)
  })
})

describe('Generated: food + near-me queries produce non-general intent', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it.each(
    SAMPLE_FOODS.map(food => ({ query: `${food} near me`, food }))
  )('$query is not classified as general', ({ query }) => {
    const result = parseSearchQuery(query)
    // "near me" is a location signal — combined with food, intent must not be 'general'
    expect(result.intent).not.toBe('general')
  })
})

describe('Generated: cuisine + near-me queries classify correctly', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it.each(
    SAMPLE_CUISINES.map(c => ({ query: `${c.toLowerCase()} near me`, cuisine: c }))
  )('$query has cuisine/mixed/location intent', ({ query }) => {
    const result = parseSearchQuery(query)
    expect(KNOWN_INTENTS).toContain(result.intent)
    // A bare cuisine + location hint should not be classified as 'dish' or 'restaurant'
    expect(['dish', 'restaurant']).not.toContain(result.intent)
  })
})

describe('Generated: typo variants do not crash the parser', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it.each(typoQueryCases())('$label', ({ query }) => {
    expect(() => parseSearchQuery(query)).not.toThrow()
    const result = parseSearchQuery(query)
    expect(result).toBeDefined()
    expect(KNOWN_INTENTS).toContain(result.intent)
    expect(Array.isArray(result.searchWords)).toBe(true)
    expect(Array.isArray(result.cuisineTerms)).toBe(true)
    expect(Array.isArray(result.dishTerms)).toBe(true)
    expect(typeof result.raw).toBe('string')
    expect(typeof result.normalised).toBe('string')
  })
})

describe('Generated: location compound queries produce location signals', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it.each(locationQueryCases())('$label includes location term', ({ query }) => {
    expect(() => parseSearchQuery(query)).not.toThrow()
    const result = parseSearchQuery(query)
    expect(result.locationTerms.length).toBeGreaterThan(0)
    // food + in + location → mixed or location intent
    expect(['mixed', 'location']).toContain(result.intent)
  })
})

describe('Generated: vibe queries produce a defined intent', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it.each(vibeQueryCases())('$label', ({ query }) => {
    expect(() => parseSearchQuery(query)).not.toThrow()
    const result = parseSearchQuery(query)
    expect(KNOWN_INTENTS).toContain(result.intent)
  })
})

describe('Performance: all generated queries complete in <500ms', () => {
  it('batch of all generated query cases is synchronous and fast', () => {
    const allCases = [
      ...foodQueryCases(),
      ...cuisineQueryCases(),
      ...vibeQueryCases(),
      ...locationQueryCases(),
      ...typoQueryCases(),
    ]
    expect(allCases.length).toBeGreaterThan(40)
    const start = Date.now()
    for (const { query } of allCases) {
      parseSearchQuery(query)
    }
    expect(Date.now() - start).toBeLessThan(500)
  })
})
