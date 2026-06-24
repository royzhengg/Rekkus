import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type Place = Tables['places']['Row'];
export type PlaceInsert = Tables['places']['Insert'];
export type PlaceUpdate = Tables['places']['Update'];

export type PlaceContact = Tables['place_contact']['Row'];
export type PlaceContactInsert = Tables['place_contact']['Insert'];
export type PlaceContactUpdate = Tables['place_contact']['Update'];

export type PlaceFeatures = Tables['place_features']['Row'];
export type PlaceFeaturesInsert = Tables['place_features']['Insert'];

export type PlaceStats = Tables['place_stats']['Row'];

export type PlaceOpeningHours = Tables['place_opening_hours']['Row'];
export type PlaceOpeningHoursInsert = Tables['place_opening_hours']['Insert'];

export type PlaceOwner = Tables['place_owners']['Row'];
export type PlaceOwnerInsert = Tables['place_owners']['Insert'];

export type PlaceObservation = Tables['place_observations']['Row'];
export type PlaceObservationInsert = Tables['place_observations']['Insert'];

export type PlaceClosureSignal = Tables['place_closure_signals']['Row'];
export type PlaceClosureSignalInsert = Tables['place_closure_signals']['Insert'];

export type PlacePopularityCache = Tables['place_popularity_cache']['Row'];
export type PlaceSearchIndex = Tables['place_search_index']['Row'];

export type PlaceProviderMetadata = Tables['place_provider_metadata']['Row'];
export type PlaceProviderLink = Tables['place_provider_links']['Row'];
export type PlaceProviderCache = Tables['place_provider_cache']['Row'];

export type PlaceAlias = Tables['place_aliases']['Row'];
export type PlaceTaxonomy = Tables['place_taxonomies']['Row'];
export type PlaceTrait = Tables['place_traits']['Row'];
export type PlaceProvenance = Tables['place_provenance']['Row'];

export type PlaceStatus = Enums['place_status'];
export type VerificationLevel = Enums['verification_level'];
export type PlaceTraitSlug = Enums['place_trait_slug'];
export type PlaceClosureSignalType = Enums['place_closure_signal_type'];
export type PlaceSignalValue = Enums['place_signal_value'];
