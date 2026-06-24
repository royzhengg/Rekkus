export const searchOwnership = {
  filtering: 'server',
  ranking: 'server',
  collectionOrdering: 'server',
  suggestionBaseRanking: 'server',
  suggestionClientBoosts: 'client_bounded',
  discoveryModuleOrdering: 'product',
  persistence: 'client',
  analytics: 'analytics_layer',
} as const

export type SearchOwnershipArea = keyof typeof searchOwnership
