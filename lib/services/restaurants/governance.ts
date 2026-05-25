import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export type RestaurantSuggestionInput = {
  restaurantId: string
  field: 'name' | 'address' | 'city' | 'cuisine_type' | 'price_range' | 'phone' | 'website' | 'hours' | 'other'
  currentValue?: Json
  suggestedValue?: Json
  issueSummary: string
}

export async function recordRestaurantObservation(input: {
  restaurantId?: string
  observationType: string
  observedValue: Record<string, Json>
  sourceEntityType?: string
  sourceEntityId?: string
  confidence?: number
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  await supabase.from('restaurant_observations').insert({
    restaurant_id: input.restaurantId ?? null,
    user_id: userId,
    observation_type: input.observationType,
    observed_value: input.observedValue,
    source_type: 'first_party_user',
    source_entity_type: input.sourceEntityType ?? null,
    source_entity_id: input.sourceEntityId ?? null,
    confidence: input.confidence ?? 0.5,
  })
}

export async function submitRestaurantEditSuggestion(input: RestaurantSuggestionInput) {
  await recordRestaurantObservation({
    restaurantId: input.restaurantId,
    observationType: `metadata_correction:${input.field}`,
    observedValue: {
      field: input.field,
      current_value: input.currentValue ?? null,
      suggested_value: input.suggestedValue ?? null,
      issue_summary: input.issueSummary,
    },
    sourceEntityType: 'restaurant',
    sourceEntityId: input.restaurantId,
    confidence: 0.45,
  })

  await reportDataRepair({
    entityType: 'restaurant',
    entityId: input.restaurantId,
    restaurantId: input.restaurantId,
    repairType: `metadata_correction:${input.field}`,
    issueSummary: input.issueSummary,
    beforeSummary: { field: input.field, value: input.currentValue ?? null },
    afterSummary: { field: input.field, value: input.suggestedValue ?? null },
  })
}

export async function submitDuplicateRestaurantSuggestion(input: {
  restaurantId: string
  duplicateName?: string | undefined
  duplicateAddress?: string | undefined
  duplicateProvider?: string | undefined
  duplicateProviderPlaceId?: string | undefined
  reason?: string | undefined
}) {
  const reason = input.reason ?? 'possible_duplicate_reported_by_user'
  await recordRestaurantAlias({
    restaurantId: input.restaurantId,
    provider: input.duplicateProvider,
    providerPlaceId: input.duplicateProviderPlaceId,
    aliasName: input.duplicateName,
    aliasAddress: input.duplicateAddress,
    reason,
    confidence: 0.45,
  })
  await recordRestaurantMergeEvidence({
    canonicalRestaurantId: input.restaurantId,
    reason,
    confidence: 0.35,
    beforeSummary: {
      restaurant_id: input.restaurantId,
      duplicate_name: input.duplicateName ?? null,
      duplicate_address: input.duplicateAddress ?? null,
    },
    afterSummary: { status: 'reported_for_manual_review' },
    rollbackReference: 'no_merge_performed',
  })
}

export async function submitCommunityVerification(input: {
  restaurantId: string
  verificationType?: 'details_look_right' | 'visited_recently' | 'owner_content_seen'
  note?: string
}) {
  await recordRestaurantObservation({
    restaurantId: input.restaurantId,
    observationType: `community_verification:${input.verificationType ?? 'details_look_right'}`,
    observedValue: {
      verification_type: input.verificationType ?? 'details_look_right',
      note: input.note ?? null,
    },
    sourceEntityType: 'restaurant',
    sourceEntityId: input.restaurantId,
    confidence: 0.5,
  })
  await recordRestaurantAuditEvent({
    action: 'restaurant_community_verification_submitted',
    entityType: 'restaurant',
    entityId: input.restaurantId,
    restaurantId: input.restaurantId,
    sourceType: 'first_party_user',
    reason: input.verificationType ?? 'details_look_right',
    afterSummary: { status: 'pending_review' },
    complianceCategory: 'restaurant_data_independence',
  })
}

export async function recordRestaurantAuditEvent(input: {
  action: string
  entityType: string
  entityId?: string
  restaurantId?: string
  sourceType?: string
  reason?: string
  beforeSummary?: Record<string, Json>
  afterSummary?: Record<string, Json>
  complianceCategory?: string
}) {
  await supabase.from('restaurant_audit_events').insert({
    actor_type: 'client',
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    restaurant_id: input.restaurantId ?? null,
    source_type: input.sourceType ?? null,
    reason: input.reason ?? null,
    before_summary: input.beforeSummary ?? null,
    after_summary: input.afterSummary ?? null,
    compliance_category: input.complianceCategory ?? null,
  })
}

export async function submitRestaurantClaim(input: {
  restaurantId: string
  reason?: string
  evidenceSummary?: Record<string, Json>
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return

  await supabase.from('restaurant_ownership_events').insert({
    restaurant_id: input.restaurantId,
    event_type: 'claim_submitted',
    actor_id: userId,
    new_owner_id: userId,
    source_type: 'owner_submitted',
    reason: input.reason ?? null,
    evidence_summary: input.evidenceSummary ?? {},
    status: 'pending',
  })
}

export async function recordRestaurantAlias(input: {
  restaurantId: string
  provider?: string | undefined
  providerPlaceId?: string | undefined
  aliasName?: string | undefined
  aliasAddress?: string | undefined
  reason: string
  confidence?: number | undefined
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return

  await supabase.from('restaurant_aliases').insert({
    restaurant_id: input.restaurantId,
    provider: input.provider ?? null,
    provider_place_id: input.providerPlaceId ?? null,
    alias_name: input.aliasName ?? null,
    alias_address: input.aliasAddress ?? null,
    reason: input.reason,
    confidence: input.confidence ?? 0.5,
    created_by: userId,
  })
}

export async function recordRestaurantMergeEvidence(input: {
  canonicalRestaurantId: string
  mergedRestaurantId?: string
  reason: string
  confidence?: number
  beforeSummary?: Record<string, Json>
  afterSummary?: Record<string, Json>
  rollbackReference?: string
}) {
  const { data: userData } = await supabase.auth.getUser()
  await supabase.from('restaurant_merge_events').insert({
    canonical_restaurant_id: input.canonicalRestaurantId,
    merged_restaurant_id: input.mergedRestaurantId ?? null,
    actor_id: userData.user?.id ?? null,
    reason: input.reason,
    confidence: input.confidence ?? 0.5,
    before_summary: input.beforeSummary ?? {},
    after_summary: input.afterSummary ?? {},
    rollback_reference: input.rollbackReference ?? null,
  })
}

export async function reportDataRepair(input: {
  entityType: 'restaurant' | 'post' | 'dish' | 'user'
  entityId?: string
  restaurantId?: string
  repairType: string
  issueSummary: string
  beforeSummary?: Record<string, Json>
  afterSummary?: Record<string, Json>
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return

  await supabase.from('data_repair_events').insert({
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    restaurant_id: input.restaurantId ?? null,
    actor_id: userId,
    repair_type: input.repairType,
    source_type: 'user_report',
    issue_summary: input.issueSummary,
    before_summary: input.beforeSummary ?? {},
    after_summary: input.afterSummary ?? {},
    status: 'reported',
  })
}
