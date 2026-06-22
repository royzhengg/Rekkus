import { inferOccasionTags, mapOsmTagsToPlaceAttributes } from '@/lib/services/placeEnrichment'

describe('inferOccasionTags', () => {
  it('flags omakase restaurants as fine_dining + special', () => {
    const tags = inferOccasionTags({ name: 'Nobu Omakase', cuisine_type: 'Japanese Omakase' })
    expect(tags).toContain('fine_dining')
    expect(tags).toContain('special')
  })

  it('flags kaiseki cuisine as fine_dining', () => {
    const tags = inferOccasionTags({ name: 'Sakura Kaiseki', cuisine_type: 'Kaiseki' })
    expect(tags).toContain('fine_dining')
  })

  it('infers fine_dining from "degustation" in name when cuisine_type is null', () => {
    const tags = inferOccasionTags({ name: 'A Degustation House', cuisine_type: null })
    expect(tags).toContain('fine_dining')
  })

  it('returns [] for generic Japanese cuisine (no fine-dining inference from broad type)', () => {
    const tags = inferOccasionTags({ name: 'Sushi Hub', cuisine_type: 'Japanese' })
    expect(tags).toEqual([])
  })

  it('returns [] for Japanese restaurant chain without strong signals', () => {
    const tags = inferOccasionTags({ name: 'Ichiban Boshi', cuisine_type: 'Japanese' })
    expect(tags).toEqual([])
  })

  it('flags McDonalds as quick_bite + casual', () => {
    const tags = inferOccasionTags({ name: "McDonald's", cuisine_type: null })
    expect(tags).toContain('quick_bite')
    expect(tags).toContain('casual')
  })

  it('flags KFC as quick_bite', () => {
    const tags = inferOccasionTags({ name: 'KFC Bondi', cuisine_type: 'Fast Food' })
    expect(tags).toContain('quick_bite')
  })

  it('flags tavern in name as casual + group', () => {
    const tags = inferOccasionTags({ name: 'The Local Tavern', cuisine_type: null })
    expect(tags).toContain('casual')
    expect(tags).toContain('group')
  })

  it('flags cafe cuisine_type as casual + quick_bite', () => {
    const tags = inferOccasionTags({ name: 'Happy Cafe', cuisine_type: 'Cafe' })
    expect(tags).toContain('casual')
    expect(tags).toContain('quick_bite')
  })

  it('returns [] for Italian restaurant with no other signals', () => {
    const tags = inferOccasionTags({ name: 'Osteria Milano', cuisine_type: 'Italian' })
    expect(tags).toEqual([])
  })

  it('all returned tags are snake_case with no hyphens or uppercase', () => {
    const inputs = [
      { name: 'Nobu Omakase', cuisine_type: 'Japanese Omakase' },
      { name: "McDonald's", cuisine_type: null },
      { name: 'The Local Pub', cuisine_type: null },
    ]
    for (const input of inputs) {
      const tags = inferOccasionTags(input)
      for (const tag of tags) {
        expect(tag).toMatch(/^[a-z0-9_]+$/)
      }
    }
  })
})

describe('mapOsmTagsToPlaceAttributes', () => {
  it('maps fast_food amenity + burger cuisine → quick_bite tag + Burgers cuisine_type', () => {
    const result = mapOsmTagsToPlaceAttributes({ amenity: 'fast_food', cuisine: 'burger' })
    expect(result.occasion_tags).toContain('quick_bite')
    expect(result.cuisine_type).toBe('Burgers')
  })

  it('maps bar amenity → casual + group tags', () => {
    const result = mapOsmTagsToPlaceAttributes({ amenity: 'bar' })
    expect(result.occasion_tags).toContain('casual')
    expect(result.occasion_tags).toContain('group')
  })

  it('maps cafe + coffee cuisine → casual tag', () => {
    const result = mapOsmTagsToPlaceAttributes({ amenity: 'cafe', cuisine: 'coffee' })
    expect(result.occasion_tags).toContain('casual')
  })

  it('maps restaurant + sushi cuisine → Japanese cuisine_type, no occasion tags', () => {
    const result = mapOsmTagsToPlaceAttributes({ amenity: 'restaurant', cuisine: 'sushi' })
    expect(result.cuisine_type).toBe('Japanese')
    expect(result.occasion_tags).toEqual([])
  })

  it('maps restaurant + pizza cuisine → Italian cuisine_type, no occasion tags', () => {
    const result = mapOsmTagsToPlaceAttributes({ amenity: 'restaurant', cuisine: 'pizza' })
    expect(result.cuisine_type).toBe('Italian')
    expect(result.occasion_tags).toEqual([])
  })

  it('does not infer date_night from Japanese cuisine alone', () => {
    const result = mapOsmTagsToPlaceAttributes({ amenity: 'restaurant', cuisine: 'japanese' })
    expect(result.cuisine_type).toBe('Japanese')
    expect(result.occasion_tags).not.toContain('date_night')
    expect(result.occasion_tags).toEqual([])
  })

  it('does not crash on missing amenity field — returns sensible defaults', () => {
    expect(() => mapOsmTagsToPlaceAttributes({})).not.toThrow()
    const result = mapOsmTagsToPlaceAttributes({})
    expect(result.occasion_tags).toBeDefined()
    expect(Array.isArray(result.occasion_tags)).toBe(true)
  })

  it('all returned occasion_tags are snake_case', () => {
    const inputs = [
      { amenity: 'fast_food', cuisine: 'burger' },
      { amenity: 'bar' },
      { amenity: 'cafe' },
    ]
    for (const input of inputs) {
      const result = mapOsmTagsToPlaceAttributes(input)
      for (const tag of result.occasion_tags) {
        expect(tag).toMatch(/^[a-z0-9_]+$/)
      }
    }
  })
})
