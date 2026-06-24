import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type User = Tables['users']['Row'];
export type UserInsert = Tables['users']['Insert'];
export type UserUpdate = Tables['users']['Update'];

export type UserSettings = Tables['user_settings']['Row'];
export type UserSettingsInsert = Tables['user_settings']['Insert'];
export type UserSettingsUpdate = Tables['user_settings']['Update'];

export type Follow = Tables['follows']['Row'];
export type FollowInsert = Tables['follows']['Insert'];

export type FollowRequest = Tables['follow_requests']['Row'];
export type FollowRequestInsert = Tables['follow_requests']['Insert'];
export type FollowRequestUpdate = Tables['follow_requests']['Update'];

export type UserBlock = Tables['user_blocks']['Row'];
export type UserBlockInsert = Tables['user_blocks']['Insert'];

export type UserTrustProfile = Tables['user_trust_profiles']['Row'];
export type UserTopSpot = Tables['user_top_spots']['Row'];
export type UserTopSpotInsert = Tables['user_top_spots']['Insert'];

export type UserTopicFollow = Tables['user_topic_follows']['Row'];
export type UserTopicFollowInsert = Tables['user_topic_follows']['Insert'];

export type SavedPlace = Tables['saved_places']['Row'];
export type SavedPlaceInsert = Tables['saved_places']['Insert'];

export type PushToken = Tables['push_tokens']['Row'];
export type PushTokenInsert = Tables['push_tokens']['Insert'];

export type FollowRequestApprovalSource = Enums['follow_request_approval_source'];
