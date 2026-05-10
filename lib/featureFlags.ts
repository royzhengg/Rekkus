const flags = {
  // Feed
  discoverFeed: true,
  followingFeed: true,

  // Places
  mapView: true,
  savedPlaces: true,

  // Social
  comments: true,
  directMessages: false,
  notifications: true,

  // Onboarding
  signupProfile: true,
} as const

export type FeatureFlag = keyof typeof flags

export function isEnabled(flag: FeatureFlag): boolean {
  return flags[flag]
}
