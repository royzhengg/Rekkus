import type { ProvenanceType } from '@/components/discovery'

export type DiscoveryModuleId =
  | 'saved_searches'
  | 'recent_searches'
  | 'trending_now'
  | 'trending_dishes'
  | 'popular_places'
  | 'staff_picks'
  | 'taste_guides'

export type DiscoveryPriorityGroup =
  | 'personal_memory'
  | 'recent_intent'
  | 'community_momentum'
  | 'local_options'
  | 'editorial_inspiration'
  | 'social_graph_expansion'

export type DiscoveryModuleDefinition = {
  id: DiscoveryModuleId
  title: string
  subtitle: string
  priorityGroup: DiscoveryPriorityGroup
  provenance: ProvenanceType
  emptyBehaviour: 'hide' | 'ledger_prompt'
  analyticsName: string
}

export const DISCOVERY_MODULES: DiscoveryModuleDefinition[] = [
  {
    id: 'saved_searches',
    title: 'Recently saved',
    subtitle: 'Jump back into your food journey.',
    priorityGroup: 'personal_memory',
    provenance: 'YOU_SAVED',
    emptyBehaviour: 'hide',
    analyticsName: 'saved_searches',
  },
  {
    id: 'recent_searches',
    title: 'Recent intent',
    subtitle: 'Pick up where your cravings left off.',
    priorityGroup: 'recent_intent',
    provenance: 'RECENT',
    emptyBehaviour: 'hide',
    analyticsName: 'recent_searches',
  },
  {
    id: 'trending_now',
    title: 'Popular this week',
    subtitle: 'Searches people keep coming back to.',
    priorityGroup: 'community_momentum',
    provenance: 'TRENDING',
    emptyBehaviour: 'hide',
    analyticsName: 'trending_now',
  },
  {
    id: 'trending_dishes',
    title: 'Dishes worth saving',
    subtitle: 'Food signals rising across Rekkus.',
    priorityGroup: 'community_momentum',
    provenance: 'TRENDING',
    emptyBehaviour: 'hide',
    analyticsName: 'trending_dishes',
  },
  {
    id: 'popular_places',
    title: 'Popular nearby',
    subtitle: 'Places people keep saving this week.',
    priorityGroup: 'local_options',
    provenance: 'LOCAL',
    emptyBehaviour: 'hide',
    analyticsName: 'popular_places',
  },
  {
    id: 'staff_picks',
    title: 'Staff picks',
    subtitle: 'Handpicked favourites from the Rekkus team.',
    priorityGroup: 'editorial_inspiration',
    provenance: 'STAFF',
    emptyBehaviour: 'hide',
    analyticsName: 'staff_picks',
  },
  {
    id: 'taste_guides',
    title: 'Taste guides',
    subtitle: "Follow people whose recommendations you'll probably love.",
    priorityGroup: 'social_graph_expansion',
    provenance: 'FOLLOWING',
    emptyBehaviour: 'ledger_prompt',
    analyticsName: 'taste_guides',
  },
]

export function discoveryModule(id: DiscoveryModuleId): DiscoveryModuleDefinition {
  const module = DISCOVERY_MODULES.find(item => item.id === id)
  if (!module) throw new Error(`Unknown discovery module: ${id}`)
  return module
}

