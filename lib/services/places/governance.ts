import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export type PlaceSuggestionInput = {
  placeId: string
  field: 'name' | 'address' | 'city' | 'cuisine_type' | 'price_range' | 'phone' | 'website' | 'hours' | 'other'
  currentValue?: Json
  suggestedValue?: Json
  issueSummary: string
}

export async function recordPlaceObservation(input: {
  placeId?: string
  observationType: string
  observedValue: Record<string, Json>
  sourceEntityType?: string
  sourceEntityId?: string
  confidence?: number
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  await supabase.from('place_observations').insert({
    place_id: input.placeId ?? null,
    user_id: userId,
    observation_type: input.observationType,
    observed_value: input.observedValue,
    source_type: 'first_party_user',
    source_entity_type: input.sourceEntityType ?? null,
    source_entity_id: input.sourceEntityId ?? null,
    confidence: input.confidence ?? 0.5,
  })
}

export async function submitPlaceEditSuggestion(input: PlaceSuggestionInput) {
  await recordPlaceObservation({
    placeId: input.placeId,
    observationType: `metadata_correction:${input.field}`,
    observedValue: {
      field: input.field,
      current_value: input.currentValue ?? null,
      suggested_value: input.suggestedValue ?? null,
      issue_summary: input.issueSummary,
    },
    sourceEntityType: 'place',
    sourceEntityId: input.placeId,
    confidence: 0.45,
  })

  await reportDataRepair({
    entityType: 'place',
    entityId: input.placeId,
    placeId: input.placeId,
    repairType: `metadata_correction:${input.field}`,
    issueSummary: input.issueSummary,
    beforeSummary: { field: input.field, value: input.currentValue ?? null },
    afterSummary: { field: input.field, value: input.suggestedValue ?? null },
  })
}

export async function submitDuplicatePlaceSuggestion(input: {
  placeId: string
  duplicateName?: string | undefined
  duplicateAddress?: string | undefined
  duplicateProvider?: string | undefined
  duplicateProviderPlaceId?: string | undefined
  reason?: string | undefined
}) {
  const reason = input.reason ?? 'possible_duplicate_reported_by_user'
  await recordPlaceProviderLink({
    placeId: input.placeId,
    provider: input.duplicateProvider,
    providerPlaceId: input.duplicateProviderPlaceId,
    aliasName: input.duplicateName,
    aliasAddress: input.duplicateAddress,
    reason,
    confidence: 0.45,
  })
  await recordPlaceMergeEvidence({
    canonicalPlaceId: input.placeId,
    reason,
    confidence: 0.35,
    beforeSummary: {
      place_id: input.placeId,
      duplicate_name: input.duplicateName ?? null,
      duplicate_address: input.duplicateAddress ?? null,
    },
    afterSummary: { status: 'reported_for_manual_review' },
    rollbackReference: 'no_merge_performed',
  })
}

export async function submitCommunityVerification(input: {
  placeId: string
  verificationType?: 'details_look_right' | 'visited_recently' | 'owner_content_seen'
  note?: string
}) {
  await recordPlaceObservation({
    placeId: input.placeId,
    observationType: `community_verification:${input.verificationType ?? 'details_look_right'}`,
    observedValue: {
      verification_type: input.verificationType ?? 'details_look_right',
      note: input.note ?? null,
    },
    sourceEntityType: 'place',
    sourceEntityId: input.placeId,
    confidence: 0.5,
  })
  await recordPlaceAuditEvent({
    action: 'place_community_verification_submitted',
    entityType: 'place',
    entityId: input.placeId,
    placeId: input.placeId,
    sourceType: 'first_party_user',
    reason: input.verificationType ?? 'details_look_right',
    afterSummary: { status: 'pending_review' },
    complianceCategory: 'place_data_independence',
  })
}

export async function recordPlaceAuditEvent(input: {
  action: string
  entityType: string
  entityId?: string
  placeId?: string
  sourceType?: string
  reason?: string
  beforeSummary?: Record<string, Json>
  afterSummary?: Record<string, Json>
  complianceCategory?: string
}) {
  await supabase.from('place_audit_events').insert({
    actor_type: 'client',
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    place_id: input.placeId ?? null,
    source_type: input.sourceType ?? null,
    reason: input.reason ?? null,
    before_summary: input.beforeSummary ?? null,
    after_summary: input.afterSummary ?? null,
    compliance_category: input.complianceCategory ?? null,
  })
}

export async function submitPlaceClaim(input: {
  placeId: string
  reason?: string
  evidenceSummary?: Record<string, Json>
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return

  await supabase.from('place_ownership_events').insert({
    place_id: input.placeId,
    event_type: 'claim_submitted',
    actor_id: userId,
    new_owner_id: userId,
    source_type: 'owner_submitted',
    reason: input.reason ?? null,
    evidence_summary: input.evidenceSummary ?? {},
    status: 'pending',
  })
}

export async function recordPlaceProviderLink(input: {
  placeId: string
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

  await supabase.from('place_provider_links').insert({
    place_id: input.placeId,
    provider: input.provider ?? null,
    provider_place_id: input.providerPlaceId ?? null,
    alias_name: input.aliasName ?? null,
    alias_address: input.aliasAddress ?? null,
    reason: input.reason,
    confidence: input.confidence ?? 0.5,
    created_by: userId,
  })
}

/** @deprecated Use recordPlaceProviderLink instead */
export const recordPlaceAlias = recordPlaceProviderLink

export async function recordPlaceMergeEvidence(input: {
  canonicalPlaceId: string
  mergedPlaceId?: string
  reason: string
  confidence?: number
  beforeSummary?: Record<string, Json>
  afterSummary?: Record<string, Json>
  rollbackReference?: string
}) {
  const { data: userData } = await supabase.auth.getUser()
  await supabase.from('place_merge_events').insert({
    canonical_place_id: input.canonicalPlaceId,
    merged_place_id: input.mergedPlaceId ?? null,
    actor_id: userData.user?.id ?? null,
    reason: input.reason,
    confidence: input.confidence ?? 0.5,
    before_summary: input.beforeSummary ?? {},
    after_summary: input.afterSummary ?? {},
    rollback_reference: input.rollbackReference ?? null,
  })
}

export async function reportDataRepair(input: {
  entityType: 'place' | 'post' | 'dish' | 'user'
  entityId?: string
  placeId?: string
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
    place_id: input.placeId ?? null,
    actor_id: userId,
    repair_type: input.repairType,
    source_type: 'user_report',
    issue_summary: input.issueSummary,
    before_summary: input.beforeSummary ?? {},
    after_summary: input.afterSummary ?? {},
    status: 'reported',
  })
}
