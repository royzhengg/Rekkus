import {
  buildSavedLibraryCounts,
  buildSavedLibraryItems,
  filterSavedLibraryItems,
  isSelectableSavedLibraryItem,
  savedLibraryItemKindLabel,
  savedLibraryItemMetadata,
} from '@/features/saved/savedLibrary'
import type { Collection } from '@/lib/services/collections'
import type { SavedLocation } from '@/lib/services/restaurants'
import type { Post, SavedDish } from '@/types/domain'

const dish: SavedDish = {
  id: 'dish-1',
  name: 'Chilli wontons',
  savedAt: '2026-06-12T10:00:00.000Z',
  representativeImageUrl: 'https://example.com/wontons.jpg',
  restaurant: { id: 'restaurant-1', name: 'Golden Dumpling' },
}

const place: SavedLocation = {
  id: 'saved-location-1',
  restaurant_id: 'restaurant-1',
  created_at: '2026-06-11T10:00:00.000Z',
  restaurants: {
    name: 'Golden Dumpling',
    address: '1 Market Street',
    latitude: null,
    longitude: null,
    google_place_id: null,
  },
}

const post: Post = {
  id: 1,
  dbId: 'post-1',
  title: 'Dumpling run',
  body: '',
  creator: 'maya',
  initials: 'M',
  avatarBg: 'red',
  avatarColor: 'white',
  likes: '0',
  imgKey: '1',
  imageUrl: 'https://example.com/post.jpg',
  createdAt: '2026-06-10T10:00:00.000Z',
  tall: false,
  tags: [],
  location: 'Golden Dumpling',
  food: 5,
  vibe: 4,
  cost: 3,
  mustOrder: 'Pork noodles',
}

const collection: Collection = {
  id: 'collection-1',
  user_id: 'user-1',
  name: 'Weeknight favourites',
  description: null,
  visibility: 'private',
  share_slug: null,
}

describe('savedLibrary', () => {
  it('normalizes mixed saved entities into one recency-ordered library', () => {
    const items = buildSavedLibraryItems({
      dishes: [dish],
      locations: [place],
      posts: [post],
      collections: [collection],
    })

    expect(items.map(item => item.id)).toEqual([
      'dish:dish-1',
      'restaurant:restaurant-1',
      'post:post-1',
      'collection:collection-1',
    ])
    expect(items[0]).toMatchObject({
      title: 'Chilli wontons',
      subtitle: 'Golden Dumpling',
      targetType: 'dish',
      targetId: 'dish-1',
    })
    expect(buildSavedLibraryCounts({ dishes: [dish], locations: [place], posts: [post], collections: [collection] })).toEqual({
      dishes: 1,
      places: 1,
      posts: 1,
      collections: 1,
    })
  })

  it('filters by scope and local search without treating collections as bulk-selectable targets', () => {
    const items = buildSavedLibraryItems({
      dishes: [dish],
      locations: [place],
      posts: [post],
      collections: [collection],
    })

    expect(filterSavedLibraryItems(items, 'places', '').map(item => item.type)).toEqual(['restaurant'])
    expect(filterSavedLibraryItems(items, 'all', 'noodles').map(item => item.id)).toEqual(['post:post-1'])
    expect(filterSavedLibraryItems(items, 'collections', 'weeknight').map(item => item.id)).toEqual(['collection:collection-1'])
    expect(items.filter(isSelectableSavedLibraryItem).map(item => item.type)).toEqual(['dish', 'restaurant', 'post'])
  })

  it('builds clean display metadata for saved rows', () => {
    const items = buildSavedLibraryItems({
      dishes: [dish],
      locations: [place],
      posts: [post],
      collections: [collection],
    })

    expect(items.map(savedLibraryItemKindLabel)).toEqual(['Dish', 'Place', 'Post', 'List'])
    expect(items.map(savedLibraryItemMetadata)).toEqual([
      'Dish · Golden Dumpling',
      'Place · 1 Market Street',
      'Post · Golden Dumpling · @maya',
      'List · Private',
    ])
  })

  it('uses a neutral saved-place fallback when address is unavailable', () => {
    const placeWithoutAddress: SavedLocation = {
      ...place,
      restaurants: {
        name: 'Golden Dumpling',
        address: null,
        latitude: null,
        longitude: null,
        google_place_id: null,
      },
    }
    const items = buildSavedLibraryItems({
      dishes: [],
      locations: [placeWithoutAddress],
      posts: [],
      collections: [],
    })

    expect(savedLibraryItemMetadata(items[0]!)).toBe('Place · Saved place')
  })
})
