export const routes = {
  tabs: {
    feed: '/(tabs)/feed',
    search: '/(tabs)/search',
    create: '/(tabs)/create',
    restaurants: '/(tabs)/restaurants',
    profile: '/(tabs)/profile',
    alerts: '/(tabs)/alerts',
  },
  auth: {
    welcome: '/(auth)/welcome',
    login: '/(auth)/login',
    signup: '/(auth)/signup',
    signupProfile: '/(auth)/signup-profile',
    forgotPassword: '/(auth)/forgot-password',
    resetPassword: '/(auth)/reset-password',
  },
  settings: {
    index: '/settings',
    editProfile: '/settings/edit-profile',
    changeEmail: '/settings/change-email',
    changePassword: '/settings/change-password',
    connectedAccounts: '/settings/connected-accounts',
  },
  messages: {
    index: '/messages',
    conversation: (conversationId: string) => `/messages/${conversationId}`,
  },
  post: (postId: string | number) => `/posts/${postId}`,
  restaurant: (restaurantId: string) => `/restaurants/${restaurantId}`,
  restaurantMap: (restaurantId: string) => `/restaurants/${restaurantId}/map`,
  user: (username: string) => `/user/${username}`,
} as const
