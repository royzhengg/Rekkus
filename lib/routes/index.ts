// Typed route builders for Expo Router. All dynamic route construction lives here
// so a route rename or param change is caught in one place, not scattered across features.

export interface RestaurantDetailParams {
  restaurantId: string
  placeId?: string
  name?: string
  address?: string
  lat?: string | number
  lng?: string | number
  searchSessionId?: string
  searchQuery?: string
  searchResultType?: string
  searchResultPosition?: string | number
}

export interface SearchAttributionRouteParams {
  searchSessionId?: string
  searchQuery?: string
  searchResultType?: string
  searchResultPosition?: string | number
}

export interface PostDetailParams extends SearchAttributionRouteParams {
  postId: string
}

export interface DishDetailParams extends SearchAttributionRouteParams {
  dishId: string
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
export type FollowListType = 'followers' | 'following'
const MAX_ATTRIBUTION_QUERY_LENGTH = 120

function attributionParams(opts: SearchAttributionRouteParams) {
  return {
    ...(opts.searchSessionId !== undefined ? { searchSessionId: opts.searchSessionId } : {}),
    ...(opts.searchQuery !== undefined ? { searchQuery: opts.searchQuery } : {}),
    ...(opts.searchResultType !== undefined ? { searchResultType: opts.searchResultType } : {}),
    ...(opts.searchResultPosition !== undefined
      ? { searchResultPosition: String(opts.searchResultPosition) }
      : {}),
  }
}

export function searchAttributionRouteParams(
  query: string | undefined,
  searchSessionId: string | undefined,
  resultType: string,
  position: number | undefined
): SearchAttributionRouteParams {
  if (!query || !searchSessionId || position == null) return {}
  return {
    searchSessionId,
    searchQuery: query.trim().slice(0, MAX_ATTRIBUTION_QUERY_LENGTH),
    searchResultType: resultType,
    searchResultPosition: position,
  }
}

export const routes = {
  postDetail: (input: string | PostDetailParams) => {
    const opts = typeof input === 'string' ? { postId: input } : input
    return {
      pathname: '/posts/[postId]' as const,
      params: { postId: opts.postId, ...attributionParams(opts) },
    }
  },

  dishDetail: (input: string | DishDetailParams) => {
    const opts = typeof input === 'string' ? { dishId: input } : input
    return {
      pathname: '/dishes/[dishId]' as const,
      params: { dishId: opts.dishId, ...attributionParams(opts) },
    }
  },

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
      ...attributionParams(opts),
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

  userFollows: (username: string, listType: FollowListType) => ({
    pathname: '/user/[username]/follows' as const,
    params: { username, listType },
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
    pathname: '/create' as const,
    params: { ...params },
  }),

  createDrafts: () => '/create/drafts' as const,

  draftEdit: (draftId: string) => ({
    pathname: '/create' as const,
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

  manageTopSpots: () => ({
    pathname: '/manage-top-spots' as const,
  }),
}
