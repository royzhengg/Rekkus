import { isPlaceResult, parsePlaceResults } from '@/lib/services/searchGuards'

const validPlaceRow = {
  id: 'place-1',
  name: 'Test Restaurant',
  address: '123 Main St',
  city: 'Sydney',
  cuisine_type: 'Japanese',
  google_place_id: null,
  latitude: -33.87,
  longitude: 151.21,
  google_rating: null,
  google_review_count: null,
}

describe('searchGuards — coordinate sanitization', () => {
  describe('(0, 0) Gulf of Guinea default', () => {
    it('nulls both coords when lat=0 and lng=0', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: 0, longitude: 0 }])
      expect(results[0]!.latitude).toBeNull()
      expect(results[0]!.longitude).toBeNull()
    })

    it('preserves lat=0 when lng is non-zero (equator is real)', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: 0, longitude: 100 }])
      expect(results[0]!.latitude).toBe(0)
      expect(results[0]!.longitude).toBe(100)
    })

    it('preserves lng=0 when lat is non-zero (prime meridian is real)', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: 51.5, longitude: 0 }])
      expect(results[0]!.latitude).toBe(51.5)
      expect(results[0]!.longitude).toBe(0)
    })
  })

  describe('out-of-range coordinates', () => {
    it('nulls both when lat < -90', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: -91, longitude: 151.21 }])
      expect(results[0]!.latitude).toBeNull()
      expect(results[0]!.longitude).toBeNull()
    })

    it('nulls both when lat > 90', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: 91, longitude: 151.21 }])
      expect(results[0]!.latitude).toBeNull()
      expect(results[0]!.longitude).toBeNull()
    })

    it('nulls both when lng < -180', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: -33.87, longitude: -181 }])
      expect(results[0]!.latitude).toBeNull()
      expect(results[0]!.longitude).toBeNull()
    })

    it('nulls both when lng > 180', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: -33.87, longitude: 181 }])
      expect(results[0]!.latitude).toBeNull()
      expect(results[0]!.longitude).toBeNull()
    })

    it('nulls both when both coords are wildly out of range', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: -200, longitude: 999 }])
      expect(results[0]!.latitude).toBeNull()
      expect(results[0]!.longitude).toBeNull()
    })
  })

  describe('null coordinates', () => {
    it('preserves null latitude', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: null, longitude: null }])
      expect(results[0]!.latitude).toBeNull()
      expect(results[0]!.longitude).toBeNull()
    })
  })

  describe('valid coordinates pass through', () => {
    it('preserves valid Sydney coordinates', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: -33.87, longitude: 151.21 }])
      expect(results[0]!.latitude).toBe(-33.87)
      expect(results[0]!.longitude).toBe(151.21)
    })

    it('preserves boundary values exactly at -90', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: -90, longitude: 0 }])
      expect(results[0]!.latitude).toBe(-90)
    })

    it('preserves boundary values exactly at 180', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, latitude: 0, longitude: 180 }])
      expect(results[0]!.longitude).toBe(180)
    })
  })

  describe('isPlaceResult guard', () => {
    it('accepts a row with occasion_tags array', () => {
      expect(isPlaceResult({ ...validPlaceRow, occasion_tags: ['special', 'date_night'] })).toBe(true)
    })

    it('accepts a row without occasion_tags (optional)', () => {
      expect(isPlaceResult({ ...validPlaceRow })).toBe(true)
    })

    it('rejects a row where occasion_tags is a string', () => {
      expect(isPlaceResult({ ...validPlaceRow, occasion_tags: 'special' })).toBe(false)
    })
  })

  describe('occasion_tags passthrough', () => {
    it('preserves occasion_tags when present', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, occasion_tags: ['special', 'date_night'] }])
      expect(results[0]!.occasion_tags).toEqual(['special', 'date_night'])
    })

    it('omits occasion_tags key when field is absent', () => {
      const results = parsePlaceResults([{ ...validPlaceRow }])
      expect('occasion_tags' in results[0]!).toBe(false)
    })

    it('omits occasion_tags key when field is undefined', () => {
      const results = parsePlaceResults([{ ...validPlaceRow, occasion_tags: undefined }])
      expect('occasion_tags' in results[0]!).toBe(false)
    })
  })
})
