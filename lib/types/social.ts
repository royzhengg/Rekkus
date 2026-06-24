import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type SocialEvent = Tables['social_events']['Row'];
export type SocialEventInsert = Tables['social_events']['Insert'];

export type NotificationDelivery = Tables['notification_deliveries']['Row'];
export type NotificationDeliveryInsert = Tables['notification_deliveries']['Insert'];

export type SocialEventType = Enums['social_event_type'];
export type SocialEventEntityType = Enums['social_event_entity_type'];
export type SocialEventSourceType = Enums['social_event_source_type'];
export type EventOrigin = Enums['event_origin'];
