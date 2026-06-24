import type { Database } from '@/types/database'

type Tables = Database['public']['Tables']
type Enums  = Database['public']['Enums']

export type TaxonomySuggestion = Tables['taxonomy_suggestions']['Row']
export type TaxonomyAssignment = Tables['place_taxonomies']['Row']

// Derived from Postgres enum types — keep in sync with migration taxonomy enums
export type TaxonomySource            = Enums['taxonomy_source']
export type TaxonomySuggestionStatus  = Enums['taxonomy_suggestion_status']
export type TaxonomyReviewReason      = Enums['taxonomy_review_reason']
