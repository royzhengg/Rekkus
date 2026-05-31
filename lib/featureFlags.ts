import { useSyncExternalStore } from 'react'
import { analytics } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'

const FEATURE_FLAG_OVERRIDE_TTL_MS = 60_000

const flags = {
  // Create
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
    description:
      'Enables on-device post media preparation with server processing fallback metadata.',
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

  // Social
  directMessages: {
    enabled: true,
    owner: 'Social',
    state: 'active',
    createdAt: '2024-01-01',
    reviewAt: '2026-08-01',
    description: 'Direct messaging: 1:1 and group conversations with rich media support.',
  },
  gifSearch: {
    enabled: true,
    owner: 'Social',
    state: 'active',
    createdAt: '2026-05-22',
    reviewAt: '2026-08-22',
    description:
      'GIF search via Giphy in direct messages. Kill-switch independent of directMessages. Requires EXPO_PUBLIC_GIPHY_* key; degrades gracefully without one.',
  },
  notifications: {
    enabled: true,
    owner: 'Social',
    state: 'active',
    createdAt: '2024-01-01',
    reviewAt: '2026-08-01',
    description: 'Enables push notification registration and sends.',
  },

  locationGeocodeFallback: {
    enabled: false,
    owner: 'Search',
    state: 'beta',
    createdAt: '2026-05-19',
    reviewAt: '2026-08-19',
    description:
      'Google Places geocoding as last-resort location resolver. Off by default — costs money. Only enable if DB suburb tiers return too many misses.',
  },

  // Visual experiments
  iosTabBarMaterial: {
    enabled: false,
    owner: 'Design / iOS UX',
    state: 'planned',
    createdAt: '2026-05-27',
    reviewAt: '2026-06-10',
    description:
      'B-531 staging-only iOS tab material spike; disable through feature_flag_overrides to restore opaque navigation until physical-iPhone acceptance passes.',
  },
} as const

export type FeatureFlag = keyof typeof flags

let overrideCache: Partial<Record<FeatureFlag, boolean>> = {}
let overrideFetchedAt = 0
let overrideRefresh: Promise<void> | null = null
const subscribers = new Set<() => void>()

function isFeatureFlag(value: string): value is FeatureFlag {
  return Object.prototype.hasOwnProperty.call(flags, value)
}

function parseOverrideResponse(value: unknown): Partial<Record<FeatureFlag, boolean>> {
  const next: Partial<Record<FeatureFlag, boolean>> = {}
  if (!isRecord(value) || !Array.isArray(value.overrides)) {
    analytics.actionError(null, 'runtime_boundary', 'feature_flag_response_invalid')
    return next
  }
  let hasInvalidRow = false
  for (const row of value.overrides) {
    if (!isRecord(row) || typeof row.flag_name !== 'string') {
      hasInvalidRow = true
      continue
    }
    if (!isFeatureFlag(row.flag_name) || typeof row.enabled !== 'boolean') {
      hasInvalidRow = true
      continue
    }
    if (
      row.expires_at !== null &&
      row.expires_at !== undefined &&
      typeof row.expires_at !== 'string'
    ) {
      hasInvalidRow = true
      continue
    }
    if (typeof row.expires_at === 'string' && Date.parse(row.expires_at) <= Date.now()) continue
    next[row.flag_name] = row.enabled
  }
  if (hasInvalidRow) analytics.actionError(null, 'runtime_boundary', 'feature_flag_row_invalid')
  return next
}

export function isEnabled(flag: FeatureFlag): boolean {
  const override = overrideCache[flag]
  if (typeof override === 'boolean') return override
  return flags[flag].enabled
}

function subscribeToFeatureFlags(listener: () => void): () => void {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

function publishFeatureFlagChange(): void {
  for (const subscriber of subscribers) subscriber()
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  return useSyncExternalStore(
    subscribeToFeatureFlags,
    () => isEnabled(flag),
    () => flags[flag].enabled
  )
}

export async function refreshFeatureFlagOverrides(force = false): Promise<void> {
  if (!force && Date.now() - overrideFetchedAt < FEATURE_FLAG_OVERRIDE_TTL_MS) return
  if (overrideRefresh) return overrideRefresh

  overrideRefresh = (async () => {
    try {
      const response = await supabase.functions.invoke<unknown>('feature-flags', {
        method: 'GET',
      })
      const data = response.data
      if (response.error) return
      overrideCache = parseOverrideResponse(data)
      overrideFetchedAt = Date.now()
      publishFeatureFlagChange()
    } catch {
      analytics.actionError(null, 'refresh_feature_flags', 'network_error')
      // Feature flags must fall back to code defaults during incidents or network failures.
    } finally {
      overrideRefresh = null
    }
  })()

  return overrideRefresh
}
