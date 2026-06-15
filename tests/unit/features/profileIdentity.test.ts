import {
  deriveProfileInterests,
  deriveReviewedRestaurants,
  deriveTopRestaurants,
  formatProfileCount,
  normalizeProfileTabParam,
  profileCollectionIsVisible,
} from '@/features/profile/profileIdentity'
import type { Collection } from '@/lib/services/collections'
import type { SavedPlace } from '@/lib/services/places'
import type { Post } from '@/types/domain'

function post(overrides: Partial<Post>): Post {
  return {
    id: 1,
    dbId: 'post-1',
    title: 'Dinner',
    body: '',
    creator: 'roy3',
    initials: 'RZ',
    avatarBg: '#fff',
    avatarColor: '#111',
    likes: '0',
    imgKey: '0',
    tall: false,
    tags: [],
    location: 'Henry Lees',
    food: 4,
    vibe: 4,
    cost: 2,
    ...overrides,
  }
}

function savedLocation(overrides: Partial<SavedPlace>): SavedPlace {
  return {
    id: 'saved-1',
    place_id: 'restaurant-1',
    created_at: '2026-06-01T00:00:00Z',
    places: {
      name: 'Saved Spot',
      address: 'Hart St',
      latitude: -33.8,
      longitude: 151.2,
      google_place_id: 'place-1',
    },
    ...overrides,
  }
}

function collection(visibility: Collection['visibility']): Collection {
  return {
    id: `collection-${visibility}`,
    user_id: 'user-1',
    name: 'Best ramen',
    description: null,
    visibility,
    share_slug: null,
  }
}

describe('profile identity helpers', () => {
  it('normalizes and ranks favourite cuisines by count then rating', () => {
    const interests = deriveProfileInterests([
      post({ cuisine_type: 'japanese', food: 4 }),
      post({ cuisine_type: 'Japanese', food: 5 }),
      post({ cuisine_type: 'Mexican', food: 5 }),
    ])

    expect(interests).toEqual([
      { category: 'food', subcategory: 'japanese', label: 'Japanese', emoji: '🍜' },
      { category: 'food', subcategory: 'mexican', label: 'Mexican', emoji: '🌮' },
    ])
  })

  it('deduplicates reviewed restaurants by restaurant id and counts reviews', () => {
    const restaurants = deriveReviewedRestaurants([
      post({ placeId: 'restaurant-1', location: 'Henry Lees', createdAt: '2026-06-01T00:00:00Z', food: 4, imageUrl: 'https://example.com/first.jpg' }),
      post({ placeId: 'restaurant-1', location: 'Henry Lees', createdAt: '2026-06-02T00:00:00Z', food: 5 }),
      post({ placeId: 'place-2', location: 'Doodee King', food: 3 }),
    ])

    expect(restaurants).toHaveLength(2)
    expect(restaurants[0]).toMatchObject({
      id: 'restaurant-1',
      name: 'Henry Lees',
      reviewCount: 2,
      avgFoodRating: 4.5,
      lastReviewedAt: '2026-06-02T00:00:00Z',
      photoUrl: 'https://example.com/first.jpg',
    })
  })

  it('uses reviewed restaurants before saved fallback restaurants', () => {
    const reviewed = deriveReviewedRestaurants([
      post({ placeId: 'restaurant-1', location: 'Reviewed Spot', food: 5 }),
    ])
    const top = deriveTopRestaurants(reviewed, [
      savedLocation({ place_id: 'restaurant-1', places: { name: 'Reviewed Spot', address: null, latitude: null, longitude: null, google_place_id: null } }),
      savedLocation({ id: 'saved-2', place_id: 'restaurant-2', places: { name: 'Saved Fallback', address: 'King St', latitude: null, longitude: null, google_place_id: null } }),
    ])

    expect(top.map(restaurant => restaurant.name)).toEqual(['Reviewed Spot', 'Saved Fallback'])
  })

  it('formats compact profile stat counts', () => {
    expect(formatProfileCount(58)).toBe('58')
    expect(formatProfileCount(1200)).toBe('1.2k')
    expect(formatProfileCount(1000)).toBe('1k')
  })

  it('shows private collections only to the owner', () => {
    expect(profileCollectionIsVisible(collection('private'), true)).toBe(true)
    expect(profileCollectionIsVisible(collection('private'), false)).toBe(false)
    expect(profileCollectionIsVisible(collection('unlisted'), false)).toBe(true)
    expect(profileCollectionIsVisible(collection('public'), false)).toBe(true)
  })

  it('maps legacy profile tabs into the two-tab model', () => {
    expect(normalizeProfileTabParam('reviews')).toBe('reviews')
    expect(normalizeProfileTabParam('restaurants')).toBe('reviews')
    expect(normalizeProfileTabParam('liked')).toBe('reviews')
    expect(normalizeProfileTabParam('lists')).toBe('collections')
    expect(normalizeProfileTabParam('collections')).toBe('collections')
    expect(normalizeProfileTabParam('saved')).toBe('saved-legacy')
    expect(normalizeProfileTabParam('unknown')).toBeNull()
  })
})
