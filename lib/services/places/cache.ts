import { supabase } from '@/lib/supabase'
import type { FullPlaceDetail } from './google'

export async function recordPlaceSource(
  placeId: string,
  sourceType: string,
  sourceId: string,
  options: {
    source_rights?: string
    attribution_required?: boolean
    cacheability?: string
    retention_policy?: string
    confidence?: number
  } = {}
) {
  if (!placeId || !sourceId) return
  await supabase.from('place_provenance').upsert(
    {
      place_id: placeId,
      source_type: sourceType,
      source_id: sourceId,
      source_rights: options.source_rights ?? 'first_party',
      attribution_required: options.attribution_required ?? false,
      cacheability: options.cacheability ?? 'permanent_identifier',
      retention_policy: options.retention_policy ?? 'retain_until_unlinked_or_place_deleted',
      confidence: options.confidence ?? 0.5,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'source_type,source_id' }
  )
}

export async function recordPlaceProviderCache(
  placeId: string,
  sourceType: string,
  sourceId: string,
  detail: FullPlaceDetail
) {
  if (!placeId || !sourceId) return
  const now = new Date()
  const staleAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await supabase.rpc('record_place_provider_snapshot', {
    p_place_id: placeId,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_field_mask: [
      'name',
      'formatted_address',
      'geometry',
      'business_status',
      'formatted_phone_number',
      'website',
      'price_level',
      'types',
      'opening_hours',
      'photos',
      'rating',
      'user_ratings_total',
    ],
    p_normalized_payload: {
      name: detail.name,
      formatted_address: detail.formatted_address,
      lat: detail.geometry.location.lat,
      lng: detail.geometry.location.lng,
      business_status: detail.business_status ?? null,
      phone: detail.formatted_phone_number ?? null,
      website: detail.website ?? null,
      price_level: detail.price_level ?? null,
      types: detail.types ?? [],
      rating: detail.rating ?? null,
      user_ratings_total: detail.user_ratings_total ?? null,
    },
    p_attribution_required: sourceType === 'google_places',
    p_attribution_text: sourceType === 'google_places' ? 'Google' : '',
    p_cacheability:
      sourceType === 'google_places'
        ? 'place_id_permanent_content_restricted'
        : 'source_terms_defined',
    p_retention_policy:
      sourceType === 'google_places'
        ? 'retain_place_id_refresh_content_by_terms'
        : 'retain_until_source_or_place_deleted',
    p_stale_at: staleAt,
  })
}
