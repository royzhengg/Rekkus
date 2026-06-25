import type { lightColors } from '@/constants/Colors'

export type DiscoveryColors = typeof lightColors

export type ProvenanceType =
  | 'FOLLOWING'
  | 'LOCAL'
  | 'STAFF'
  | 'TRENDING'
  | 'NEW'
  | 'POPULAR'
  | 'YOU_SAVED'
  | 'RECENT'
  | 'SIMILAR_TO_YOU'

