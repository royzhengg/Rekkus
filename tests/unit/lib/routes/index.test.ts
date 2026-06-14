import { routes, searchAttributionRouteParams } from '@/lib/routes'

describe('routes', () => {
  it.each([
    ['post detail', routes.postDetail('post-1'), { pathname: '/posts/[postId]', params: { postId: 'post-1' } }],
    ['dish detail', routes.dishDetail('dish-1'), { pathname: '/dishes/[dishId]', params: { dishId: 'dish-1' } }],
    ['collection detail', routes.collectionDetail('collection-1'), { pathname: '/collections/[collectionId]', params: { collectionId: 'collection-1' } }],
    ['user profile', routes.userProfile('roy'), { pathname: '/user/[username]', params: { username: 'roy' } }],
    ['user followers', routes.userFollows('roy', 'followers'), { pathname: '/user/[username]/follows', params: { username: 'roy', listType: 'followers' } }],
    ['user following', routes.userFollows('roy', 'following'), { pathname: '/user/[username]/follows', params: { username: 'roy', listType: 'following' } }],
    ['conversation info', routes.conversationInfo('conv-1'), { pathname: '/messages/info', params: { conversationId: 'conv-1' } }],
    ['draft edit', routes.draftEdit('draft-1'), { pathname: '/create', params: { draftId: 'draft-1' } }],
  ])('builds the %s route contract', (_label, route, expected) => {
    expect(route).toEqual(expected)
  })

  it('normalises optional restaurant detail values for route params', () => {
    expect(routes.restaurantDetail({ restaurantId: 'rest-1', lat: -33.87, lng: 151.21 })).toEqual({
      pathname: '/restaurants/[restaurantId]',
      params: {
        restaurantId: 'rest-1',
        placeId: 'none',
        name: '',
        address: '',
        lat: '-33.87',
        lng: '151.21',
      },
    })
  })

  it('preserves optional search attribution on detail routes', () => {
    const attribution = {
      searchSessionId: 'search-session-1',
      searchQuery: 'ramen',
      searchResultType: 'post',
      searchResultPosition: 2,
    }

    expect(routes.postDetail({ postId: 'post-1', ...attribution })).toEqual({
      pathname: '/posts/[postId]',
      params: {
        postId: 'post-1',
        searchSessionId: 'search-session-1',
        searchQuery: 'ramen',
        searchResultType: 'post',
        searchResultPosition: '2',
      },
    })
    expect(routes.dishDetail({ dishId: 'dish-1', ...attribution })).toEqual({
      pathname: '/dishes/[dishId]',
      params: {
        dishId: 'dish-1',
        searchSessionId: 'search-session-1',
        searchQuery: 'ramen',
        searchResultType: 'post',
        searchResultPosition: '2',
      },
    })
    expect(routes.restaurantDetail({ restaurantId: 'rest-1', ...attribution })).toEqual({
      pathname: '/restaurants/[restaurantId]',
      params: {
        restaurantId: 'rest-1',
        placeId: 'none',
        name: '',
        address: '',
        lat: '',
        lng: '',
        searchSessionId: 'search-session-1',
        searchQuery: 'ramen',
        searchResultType: 'post',
        searchResultPosition: '2',
      },
    })
  })

  it('normalises absent restaurant map values to strings', () => {
    expect(routes.restaurantMap({ restaurantId: 'rest-1' })).toEqual({
      pathname: '/restaurants/[restaurantId]/map',
      params: {
        restaurantId: 'rest-1',
        placeId: '',
        name: '',
        lat: '',
        lng: '',
        phone: '',
        openNow: '',
        googleRating: '',
        avgFood: '',
        avgVibe: '',
        avgCost: '',
        photoUrl: '',
        todayHours: '',
      },
    })
  })

  it('preserves search, creation, conversation, and sharing payloads', () => {
    expect(routes.saved()).toEqual({
      pathname: '/(tabs)/saved',
      params: { section: 'overview' },
    })
    expect(routes.saved('places')).toEqual({
      pathname: '/(tabs)/saved',
      params: { section: 'places' },
    })
    expect(routes.savedPlaces()).toEqual({
      pathname: '/saved/places',
    })
    expect(routes.savedPlaces({ view: 'map' })).toEqual({
      pathname: '/saved/places',
      params: { view: 'map' },
    })
    expect(routes.search('ramen', 'hashtag')).toEqual({
      pathname: '/(tabs)/search',
      params: { query: 'ramen', source: 'hashtag' },
    })
    expect(routes.createPost({ intent: 'edit', postId: 'post-1' })).toEqual({
      pathname: '/create',
      params: { intent: 'edit', postId: 'post-1' },
    })
    expect(routes.createDrafts()).toBe('/create/drafts')
    expect(routes.conversation('conv-1', { sharePostId: 'post-1' })).toEqual({
      pathname: '/messages/[conversationId]',
      params: { conversationId: 'conv-1', sharePostId: 'post-1' },
    })
    expect(routes.messageShare({ shareCaption: 'Great noodles' })).toEqual({
      pathname: '/messages/new',
      params: { shareCaption: 'Great noodles' },
    })
    expect(routes.messagePlaceShare({ sharePlaceId: 'place-1' })).toEqual({
      pathname: '/messages',
      params: { sharePlaceId: 'place-1' },
    })
  })

  it('searchAttributionRouteParams returns params when all fields present', () => {
    expect(searchAttributionRouteParams('ramen', 'sess-1', 'post', 2)).toEqual({
      searchSessionId: 'sess-1',
      searchQuery: 'ramen',
      searchResultType: 'post',
      searchResultPosition: 2,
    })
  })

  it('searchAttributionRouteParams returns empty when query or sessionId missing', () => {
    expect(searchAttributionRouteParams(undefined, 'sess-1', 'post', 2)).toEqual({})
    expect(searchAttributionRouteParams('ramen', undefined, 'post', 2)).toEqual({})
    expect(searchAttributionRouteParams('ramen', 'sess-1', 'post', undefined)).toEqual({})
  })
})
