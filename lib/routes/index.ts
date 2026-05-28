// Typed route builders for Expo Router. All dynamic route construction lives here
// so a route rename or param change is caught in one place, not scattered across features.

export interface RestaurantDetailParams {
  restaurantId: string
  placeId?: string
  name?: string
  address?: string
  lat?: string | number
  lng?: string | number
}

export interface RestaurantMapParams {
  restaurantId: string
  placeId?: string
  name?: string
  lat?: string
  lng?: string
  phone?: string
  openNow?: string
  googleRating?: string
  avgFood?: string
  avgVibe?: string
  avgCost?: string
  photoUrl?: string
  todayHours?: string
}

export interface CreatePostParams {
  intent?: string
  postId?: string
  draftId?: string
  nonce?: string
  prefillName?: string
  prefillAddress?: string
  prefillLat?: string
  prefillLng?: string
  prefillPlaceId?: string
  prefillRestaurantId?: string
}

export interface MessageShareParams {
  sharePostId?: string
  sharePostDbId?: string
  shareCaption?: string
  shareImageUrl?: string
  shareAuthor?: string
  shareLocation?: string
}

export interface MessagePlaceShareParams {
  sharePlaceId?: string
  sharePlaceName?: string
  sharePlaceAddress?: string
  sharePlaceCuisine?: string
}

export type SavedSection = 'overview' | 'dishes' | 'places' | 'posts' | 'collections'

export const routes = {
  postDetail: (postId: string) => ({
    pathname: '/posts/[postId]' as const,
    params: { postId },
  }),

  dishDetail: (dishId: string) => ({
    pathname: '/dishes/[dishId]' as const,
    params: { dishId },
  }),

  saved: (section: SavedSection = 'overview') => ({
    pathname: '/(tabs)/saved' as const,
    params: { section },
  }),

  collectionDetail: (collectionId: string) => ({
    pathname: '/collections/[collectionId]' as const,
    params: { collectionId },
  }),

  restaurantDetail: (opts: RestaurantDetailParams) => ({
    pathname: '/restaurants/[restaurantId]' as const,
    params: {
      restaurantId: opts.restaurantId,
      placeId: opts.placeId ?? 'none',
      name: opts.name ?? '',
      address: opts.address ?? '',
      lat: String(opts.lat ?? ''),
      lng: String(opts.lng ?? ''),
    },
  }),

  restaurantMap: (opts: RestaurantMapParams) => ({
    pathname: '/restaurants/[restaurantId]/map' as const,
    params: {
      restaurantId: opts.restaurantId,
      placeId: opts.placeId ?? '',
      name: opts.name ?? '',
      lat: opts.lat ?? '',
      lng: opts.lng ?? '',
      phone: opts.phone ?? '',
      openNow: opts.openNow ?? '',
      googleRating: opts.googleRating ?? '',
      avgFood: opts.avgFood ?? '',
      avgVibe: opts.avgVibe ?? '',
      avgCost: opts.avgCost ?? '',
      photoUrl: opts.photoUrl ?? '',
      todayHours: opts.todayHours ?? '',
    },
  }),

  userProfile: (username: string) => ({
    pathname: '/user/[username]' as const,
    params: { username },
  }),

  conversation: (conversationId: string, shareParams?: MessageShareParams) => ({
    pathname: '/messages/[conversationId]' as const,
    params: { conversationId, ...shareParams },
  }),

  conversationInfo: (conversationId: string) => ({
    pathname: '/messages/info' as const,
    params: { conversationId },
  }),

  search: (query: string, source?: string) => ({
    pathname: '/(tabs)/search' as const,
    params: { query, ...(source !== undefined ? { source } : {}) },
  }),

  createPost: (params?: CreatePostParams) => ({
    pathname: '/(tabs)/create' as const,
    params: { ...params },
  }),

  createDrafts: () => '/create/drafts' as const,

  draftEdit: (draftId: string) => ({
    pathname: '/(tabs)/create' as const,
    params: { draftId },
  }),

  messageShare: (params: MessageShareParams) => ({
    pathname: '/messages/new' as const,
    params: { ...params },
  }),

  messagePlaceShare: (params: MessagePlaceShareParams) => ({
    pathname: '/messages' as const,
    params: { ...params },
  }),
}
