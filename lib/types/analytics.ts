import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type AnalyticsEvent = Tables['analytics_events']['Row'];
export type AnalyticsEventInsert = Tables['analytics_events']['Insert'];

export type AuthAuditEvent = Tables['auth_audit_events']['Row'];
export type AuthAuditEventInsert = Tables['auth_audit_events']['Insert'];

export type ContentLifecycleEvent = Tables['content_lifecycle_events']['Row'];
export type ContentLifecycleEventInsert = Tables['content_lifecycle_events']['Insert'];

export type SearchAnalytics = Tables['search_analytics']['Row'];
export type SearchAnalyticsInsert = Tables['search_analytics']['Insert'];

export type PrivacyAuditEvent = Tables['privacy_audit_events']['Row'];
export type PrivacyAuditEventInsert = Tables['privacy_audit_events']['Insert'];

export type PrivacyAuditEventType = Enums['privacy_audit_event_type'];
