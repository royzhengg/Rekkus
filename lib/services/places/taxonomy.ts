import { supabase } from '@/lib/supabase'
import type { TaxonomyAssignment, TaxonomyReviewReason } from '@/lib/types/taxonomy'
import type { Database } from '@/types/database'

type ReviewQueueItem =
  Database['public']['Functions']['get_taxonomy_review_queue']['Returns'][number]

export async function submitUserTaxonomySuggestion(
  placeId: string,
  nodeId: string,
  confidence = 0.40
): Promise<string | null> {
  const { data, error } = await supabase.rpc('submit_taxonomy_suggestion', {
    p_place_id: placeId,
    p_node_id: nodeId,
    p_confidence: confidence,
  })
  if (error) throw error
  return data as string | null
}

export async function assignAdminTaxonomy(
  placeId: string,
  nodeId: string,
  confidence = 0.90,
  notes?: string
): Promise<void> {
  const { error } = await supabase.rpc('assign_taxonomy_admin', {
    p_place_id: placeId,
    p_node_id: nodeId,
    p_confidence: confidence,
    ...(notes !== undefined ? { p_notes: notes } : {}),
  })
  if (error) throw error
}

export async function promoteTaxonomySuggestion(
  suggestionId: string,
  notes?: string
): Promise<void> {
  const { error } = await supabase.rpc('promote_taxonomy_suggestion', {
    p_suggestion_id: suggestionId,
    ...(notes !== undefined ? { p_notes: notes } : {}),
  })
  if (error) throw error
}

export async function rejectTaxonomySuggestion(
  suggestionId: string,
  reason?: TaxonomyReviewReason,
  notes?: string
): Promise<void> {
  const { error } = await supabase.rpc('reject_taxonomy_suggestion', {
    p_suggestion_id: suggestionId,
    ...(reason !== undefined ? { p_reason: reason } : {}),
    ...(notes !== undefined ? { p_notes: notes } : {}),
  })
  if (error) throw error
}

export async function removeAdminTaxonomy(
  placeId: string,
  nodeId: string,
  reason?: TaxonomyReviewReason,
  notes?: string
): Promise<void> {
  const { error } = await supabase.rpc('remove_taxonomy_assignment', {
    p_place_id: placeId,
    p_node_id: nodeId,
    ...(reason !== undefined ? { p_reason: reason } : {}),
    ...(notes !== undefined ? { p_notes: notes } : {}),
  })
  if (error) throw error
}

export async function getPlaceAcceptedTaxonomies(placeId: string): Promise<TaxonomyAssignment[]> {
  const { data, error } = await supabase
    .from('place_taxonomies_accepted')
    .select('*')
    .eq('place_id', placeId)
  if (error) throw error
  return (data ?? []) as unknown as TaxonomyAssignment[]
}

export async function getTaxonomyReviewQueue(
  limit = 100,
  offset = 0
): Promise<ReviewQueueItem[]> {
  const { data, error } = await supabase.rpc('get_taxonomy_review_queue', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return data ?? []
}
