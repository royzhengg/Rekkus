import { supabase } from '@/lib/supabase'
import { isCoolingDown } from '@/lib/utils/cooldown'
import { sanitizeAnalyticsMetadata } from './privacy'

type EntityType = 'place' | 'post' | 'user' | 'collection' | 'dish'

export type EventPayload = {
  event_type: string
  entity_type?: EntityType | undefined
  entity_id?: string | undefined
  metadata?: Record<string, unknown> | undefined
  eventVersion?: number | undefined
  sampleRate?: number | undefined
}

export type ProviderCacheState = 'hit' | 'miss' | 'deduped' | 'blocked' | 'error'
export type PlaceSelectionSource = 'nearby' | 'prediction'
export type SearchAttribution = {
  searchSessionId: string
  query: string
  resultType: 'post' | 'place' | 'user' | 'dish'
  resultPosition: number
}

export async function track(userId: string | null, payload: EventPayload): Promise<void> {
  try {
    const sampleRate = Math.max(0, Math.min(1, payload.sampleRate ?? 1))
    if (sampleRate <= 0 || Math.random() > sampleRate) return

    const metadata = sanitizeAnalyticsMetadata(payload.metadata)
    const identity = userId ?? 'anonymous'
    const entity = payload.entity_id ?? JSON.stringify(metadata ?? {})
    if (isCoolingDown(`analytics:${identity}:${payload.event_type}:${entity}`, 15_000)) return
    const eventVersion = Math.max(1, Math.floor(payload.eventVersion ?? 1))
    await supabase.from('analytics_events').insert({
      user_id: userId,
      event_type: payload.event_type,
      event_version: eventVersion,
      ...(payload.entity_type ? { entity_type: payload.entity_type } : {}),
      ...(payload.entity_id ? { entity_id: payload.entity_id } : {}),
      ...(metadata ? { metadata } : {}),
    })
  } catch {
    // analytics must never crash the app
  }
}

export function searchAttributionMetadata(
  attribution?: SearchAttribution | null
): Record<string, unknown> | undefined {
  if (!attribution) return undefined
  return {
    search_session_id: attribution.searchSessionId,
    query: attribution.query,
    result_type: attribution.resultType,
    result_position: Math.max(1, Math.round(attribution.resultPosition)),
  }
}
