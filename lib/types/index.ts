// Branded ID types and constructor helpers — never cast to these directly, use as*() helpers
export type {
  PlaceId,
  UserId,
  PostId,
  DishId,
  CollectionId,
  ConversationId,
  MessageId,
  CommentId,
  SocialEventId,
} from './branded';
export {
  asPlaceId,
  asUserId,
  asPostId,
  asDishId,
  asCollectionId,
  asConversationId,
  asMessageId,
  asCommentId,
  asSocialEventId,
} from './branded';

// Place domain — DB-row shapes only
// For product-level place type (name/suburb/lat/lng) see types/domain.ts
export type {
  Place,
  PlaceInsert,
  PlaceUpdate,
  PlaceContact,
  PlaceContactInsert,
  PlaceContactUpdate,
  PlaceFeatures,
  PlaceFeaturesInsert,
  PlaceStats,
  PlaceOpeningHours,
  PlaceOpeningHoursInsert,
  PlaceOwner,
  PlaceOwnerInsert,
  PlaceObservation,
  PlaceObservationInsert,
  PlaceClosureSignal,
  PlaceClosureSignalInsert,
  PlacePopularityCache,
  PlaceSearchIndex,
  PlaceProviderMetadata,
  PlaceProviderLink,
  PlaceProviderCache,
  PlaceAlias,
  PlaceTaxonomy,
  PlaceTrait,
  PlaceProvenance,
  PlaceStatus,
  VerificationLevel,
  PlaceTraitSlug,
  PlaceClosureSignalType,
  PlaceSignalValue,
} from './place';

// User domain
export type {
  User,
  UserInsert,
  UserUpdate,
  UserSettings,
  UserSettingsInsert,
  UserSettingsUpdate,
  Follow,
  FollowInsert,
  FollowRequest,
  FollowRequestInsert,
  FollowRequestUpdate,
  UserBlock,
  UserBlockInsert,
  UserTrustProfile,
  UserTopSpot,
  UserTopSpotInsert,
  UserTopicFollow,
  UserTopicFollowInsert,
  SavedPlace,
  SavedPlaceInsert,
  PushToken,
  PushTokenInsert,
  FollowRequestApprovalSource,
} from './user';

// Post domain
// Note: PostRow is the raw DB row. The richer app-facing Post type lives in types/domain.ts
export type {
  PostRow,
  PostInsert,
  PostUpdate,
  PostPhoto,
  PostPhotoInsert,
  PostReaction,
  PostReactionInsert,
  PostEmbedding,
  PostEmbeddingInsert,
  PostHashtag,
  PostHashtagInsert,
  PostEditEvent,
  PostEditEventInsert,
  PostDraft,
  PostDraftInsert,
  PostDraftUpdate,
  PostDraftMedia,
  PostDraftMediaInsert,
  Comment,
  CommentInsert,
  CommentUpdate,
  Like,
  LikeInsert,
  Save,
  SaveInsert,
  Hashtag,
  HashtagInsert,
} from './post';

// Dish domain
export type {
  Dish,
  DishInsert,
  DishUpdate,
  DishEmbedding,
  DishEmbeddingInsert,
  SavedDish,
  SavedDishInsert,
} from './dish';

// Collection domain
// Note: CollectionRow is the raw DB row. App-facing Collection type lives in lib/services/collections.ts
export type {
  CollectionRow,
  CollectionInsert,
  CollectionUpdate,
  CollectionItem,
  CollectionItemInsert,
} from './collection';

// Messaging domain
export type {
  Conversation,
  ConversationInsert,
  ConversationUpdate,
  ConversationParticipant,
  ConversationParticipantInsert,
  ConversationParticipantUpdate,
  Message,
  MessageInsert,
  MessageUpdate,
  MessageDelivery,
  MessageDeliveryInsert,
  MessageReaction,
  MessageReactionInsert,
  ConversationPinnedMessage,
  ConversationPinnedMessageInsert,
} from './messaging';

// Social / notifications domain
export type {
  SocialEvent,
  SocialEventInsert,
  NotificationDelivery,
  NotificationDeliveryInsert,
  SocialEventType,
  SocialEventEntityType,
  SocialEventSourceType,
  EventOrigin,
} from './social';

// Moderation domain
export type {
  ContentReport,
  ContentReportInsert,
  ContentReportUpdate,
  ModerationAction,
  ModerationActionInsert,
  ModerationAppeal,
  ModerationAppealInsert,
  ModerationAppealUpdate,
} from './moderation';

// Analytics domain
export type {
  AnalyticsEvent,
  AnalyticsEventInsert,
  AuthAuditEvent,
  AuthAuditEventInsert,
  ContentLifecycleEvent,
  ContentLifecycleEventInsert,
  SearchAnalytics,
  SearchAnalyticsInsert,
  PrivacyAuditEvent,
  PrivacyAuditEventInsert,
  PrivacyAuditEventType,
} from './analytics';
