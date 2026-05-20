const flags = {
  // Feed
  discoverFeed: {
    enabled: true,
    owner: 'Feed',
    state: 'active',
    createdAt: '2024-01-01',
    reviewAt: '2026-08-01',
    description: 'Enables the Discover feed surface.',
  },
  followingFeed: {
    enabled: true,
    owner: 'Feed',
    state: 'active',
    createdAt: '2024-01-01',
    reviewAt: '2026-08-01',
    description: 'Enables the following-based feed surface.',
  },
  mixedMediaPosts: {
    enabled: true,
    owner: 'Create',
    state: 'active',
    createdAt: '2026-05-18',
    reviewAt: '2026-08-18',
    description: 'Enables ordered mixed photo/video post media.',
  },
  hybridMediaProcessing: {
    enabled: true,
    owner: 'Media',
    state: 'active',
    createdAt: '2026-05-18',
    reviewAt: '2026-08-18',
    description: 'Enables on-device post media preparation with server processing fallback metadata.',
  },
  rekkusPicks: {
    enabled: true,
    owner: 'Taste Graph',
    state: 'active',
    createdAt: '2026-05-18',
    reviewAt: '2026-08-18',
    description: 'Enables Taste, Value, and Occasion post rating signals.',
  },
  searchFiltersV2: {
    enabled: true,
    owner: 'Search',
    state: 'active',
    createdAt: '2026-05-18',
    reviewAt: '2026-08-18',
    description: 'Enables intent-aware search filters and Rekkus-signal ranking controls.',
  },
  draftList: {
    enabled: true,
    owner: 'Create',
    state: 'active',
    createdAt: '2026-05-18',
    reviewAt: '2026-08-18',
    description: 'Enables multiple recoverable create-post drafts.',
  },

  // Places
  mapView: {
    enabled: true,
    owner: 'Places',
    state: 'active',
    createdAt: '2024-01-01',
    reviewAt: '2026-08-01',
    description: 'Enables map-based place discovery.',
  },
  savedPlaces: {
    enabled: true,
    owner: 'Places',
    state: 'active',
    createdAt: '2024-01-01',
    reviewAt: '2026-08-01',
    description: 'Enables saved place surfaces.',
  },

  // Social
  comments: {
    enabled: true,
    owner: 'Social',
    state: 'active',
    createdAt: '2024-01-01',
    reviewAt: '2026-08-01',
    description: 'Enables post comments and replies.',
  },
  directMessages: {
    enabled: true,
    owner: 'Social',
    state: 'active',
    createdAt: '2024-01-01',
    reviewAt: '2026-08-01',
    description: 'Direct messaging: 1:1 and group conversations with rich media support.',
  },
  notifications: {
    enabled: true,
    owner: 'Social',
    state: 'active',
    createdAt: '2024-01-01',
    reviewAt: '2026-08-01',
    description: 'Enables push notification registration and sends.',
  },

  // Onboarding
  signupProfile: {
    enabled: true,
    owner: 'Auth',
    state: 'active',
    createdAt: '2024-01-01',
    reviewAt: '2026-08-01',
    description: 'Enables the signup profile completion step.',
  },

  // Search enrichment
  searchEnrichmentV1: {
    enabled: true,
    owner: 'Search',
    state: 'active',
    createdAt: '2026-05-19',
    reviewAt: '2026-08-19',
    description: 'Query intent parsing, dish search RPC, suburb filter, popularity cache, contextual boosts.',
  },
  searchAutocomplete: {
    enabled: true,
    owner: 'Search',
    state: 'active',
    createdAt: '2026-05-19',
    reviewAt: '2026-08-19',
    description: 'Autocomplete suggestions via suggest_searches RPC at 100ms debounce.',
  },
  searchPersonalisation: {
    enabled: false,
    owner: 'Search',
    state: 'beta',
    createdAt: '2026-05-19',
    reviewAt: '2026-08-19',
    description: 'Taste profile boost from liked/saved posts. Enable after popularity cache is verified.',
  },
  locationGeocodeFallback: {
    enabled: false,
    owner: 'Search',
    state: 'beta',
    createdAt: '2026-05-19',
    reviewAt: '2026-08-19',
    description: 'Google Places geocoding as last-resort location resolver. Off by default — costs money. Only enable if DB suburb tiers return too many misses.',
  },
} as const

export type FeatureFlag = keyof typeof flags

export function isEnabled(flag: FeatureFlag): boolean {
  return flags[flag].enabled
}
