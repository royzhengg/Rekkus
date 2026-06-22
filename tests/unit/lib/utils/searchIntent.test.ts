import { loadDynamicCuisines, isDynamicFoodToken } from '@/lib/utils/cuisineSynonyms'
import { classifySearchIntent } from '@/lib/utils/searchIntent'

describe('classifySearchIntent', () => {
  // --- food / dish intent ---

  it('classifies clear food-only queries as food_dish', () => {
    expect(classifySearchIntent('ramen').kind).toBe('food_dish')
    expect(classifySearchIntent('pork').kind).toBe('food_dish')
    expect(classifySearchIntent('sushi').kind).toBe('food_dish')
  })

  it('classifies dish phrases not in FOOD_TERMS as food_dish (not place_name)', () => {
    // "dim sum" is not in FOOD_TERMS — previously fell through to place_name
    expect(classifySearchIntent('dim sum', { parsedIntent: 'dish' }).kind).toBe('food_dish')
  })

  // --- occasion / dietary — must not become place_name ---

  it('classifies occasion queries as general (not place_name)', () => {
    // "date night" has 2 tokens — previously fell through to the 2-token → place_name fallback
    expect(classifySearchIntent('date night', { parsedIntent: 'occasion' }).kind).toBe('general')
    expect(classifySearchIntent('birthday', { parsedIntent: 'occasion' }).kind).toBe('general')
    expect(classifySearchIntent('anniversary dinner', { parsedIntent: 'occasion' }).kind).toBe('general')
  })

  it('classifies dietary queries as general (not place_name)', () => {
    // "gluten free" has 2 tokens — previously fell through to the 2-token → place_name fallback
    expect(classifySearchIntent('gluten free', { parsedIntent: 'dietary' }).kind).toBe('general')
    expect(classifySearchIntent('vegan', { parsedIntent: 'dietary' }).kind).toBe('general')
    expect(classifySearchIntent('dairy free', { parsedIntent: 'dietary' }).kind).toBe('general')
  })

  // --- place name intent ---

  it('classifies known restaurant names as place_name', () => {
    expect(classifySearchIntent('chat thai').kind).toBe('place_name')
    expect(classifySearchIntent('din tai fung').kind).toBe('place_name')
  })

  it('classifies parsedIntent=place queries as place_name', () => {
    expect(classifySearchIntent('spice i am', { parsedIntent: 'place' }).kind).toBe('place_name')
  })

  // --- location intent ---

  it('classifies location queries as location', () => {
    expect(classifySearchIntent('bondi').kind).toBe('location')
    expect(classifySearchIntent('sydney').kind).toBe('location')
  })

  it('classifies food + location as mixed', () => {
    expect(classifySearchIntent('ramen bondi', { hasLocationTerms: true }).kind).toBe('mixed')
    expect(classifySearchIntent('ramen sydney', { hasLocationTerms: true }).kind).toBe('mixed')
  })

  // --- 2-token fallback must be general, not place_name ---

  it('unknown 2-token queries without food/location fall back to general, not place_name', () => {
    // These are ambiguous — should be general so entity weights spread evenly
    const result = classifySearchIntent('cozy vibes')
    expect(result.kind).toBe('general')
  })

  // --- empty / general ---

  it('empty query returns general at low confidence', () => {
    expect(classifySearchIntent('').kind).toBe('general')
  })
})

describe('dynamic cuisine vocabulary (Fix 3)', () => {
  beforeEach(() => {
    // reset between tests by loading an empty array — additive so can't truly clear,
    // but each test loads what it needs and checks only what it loaded
  })

  it('returns false before any load', () => {
    expect(isDynamicFoodToken('omakase_unique_xyz')).toBe(false)
  })

  it('recognises full cuisine type after load', () => {
    loadDynamicCuisines(['TestOmakase2025'])
    expect(isDynamicFoodToken('testomakase2025')).toBe(true)
  })

  it('extracts individual words from multi-word cuisine type', () => {
    loadDynamicCuisines(['Japanese Yakitori Bar'])
    expect(isDynamicFoodToken('yakitori')).toBe(true)
    expect(isDynamicFoodToken('japanese')).toBe(true)
  })

  it('ignores words shorter than 3 characters', () => {
    loadDynamicCuisines(['a la carte'])
    expect(isDynamicFoodToken('a')).toBe(false)
    expect(isDynamicFoodToken('la')).toBe(false)
    expect(isDynamicFoodToken('carte')).toBe(true)
  })

  it('is case-insensitive for input', () => {
    loadDynamicCuisines(['Robatayaki'])
    expect(isDynamicFoodToken('ROBATAYAKI')).toBe(true)
    expect(isDynamicFoodToken('Robatayaki')).toBe(true)
    expect(isDynamicFoodToken('robatayaki')).toBe(true)
  })

  it('is additive across multiple calls', () => {
    loadDynamicCuisines(['KappouJapanese'])
    loadDynamicCuisines(['IzakayaStyle'])
    expect(isDynamicFoodToken('kappoujapanese')).toBe(true)
    expect(isDynamicFoodToken('izakayastyle')).toBe(true)
  })
})

describe('classifySearchIntent with dynamic vocab (Fix 3)', () => {
  it('classifies unknown cuisine as food_dish after loading it into dynamic vocab', () => {
    loadDynamicCuisines(['UniqueTestCuisine9999'])
    expect(classifySearchIntent('uniquetestcuisine9999').kind).toBe('food_dish')
  })
})

describe('search intent regression suite (Fix 3)', () => {
  const cases: Array<[string, string, string]> = [
    ['ramen', 'food_dish', 'food term'],
    ['sushi', 'food_dish', 'food term'],
    ['pizza', 'food_dish', 'food term'],
    ['wagyu', 'food_dish', 'food term'],
    ['best wagyu', 'food_dish', 'food token present'],
    ['date night', 'general', 'occasion'],
    ['birthday dinner', 'general', 'occasion'],
    ['anniversary dinner', 'general', 'occasion'],
    ['celebration', 'general', 'occasion'],
    ['gluten free', 'general', 'dietary'],
    ['halal', 'general', 'dietary'],
    ['vegan', 'general', 'dietary'],
    ['buffet', 'general', 'no match'],
    ['quick bite', 'general', 'occasion'],
  ]

  test.each(cases)('"%s" → %s (%s)', (query, expectedKind) => {
    const parsedIntent = ['date night', 'birthday dinner', 'anniversary dinner', 'celebration', 'quick bite'].includes(query)
      ? 'occasion'
      : ['gluten free', 'halal', 'vegan'].includes(query)
        ? 'dietary'
        : undefined
    const result = classifySearchIntent(query, parsedIntent ? { parsedIntent } : undefined)
    expect(result.kind).toBe(expectedKind)
  })

  it('"totti\'s" → place_name (possessive)', () => {
    expect(classifySearchIntent("totti's").kind).toBe('place_name')
  })

  it('"hurricane\'s grill" → place_name (known place)', () => {
    expect(classifySearchIntent("hurricane's grill").kind).toBe('place_name')
  })

  it('"din tai fung" → place_name (known place)', () => {
    expect(classifySearchIntent('din tai fung').kind).toBe('place_name')
  })

  it('"ramen in sydney" → mixed (food + location)', () => {
    expect(classifySearchIntent('ramen in sydney').kind).toBe('mixed')
  })

  it('"cafe near me" → location (location preposition)', () => {
    expect(classifySearchIntent('cafe near me').kind).toBe('location')
  })

  it('"restaurants in bondi" → location (location term)', () => {
    expect(classifySearchIntent('restaurants in bondi').kind).toBe('location')
  })

  it('"dim sum" → food_dish (2-token food)', () => {
    expect(classifySearchIntent('dim sum', { parsedIntent: 'dish' }).kind).toBe('food_dish')
  })
})
