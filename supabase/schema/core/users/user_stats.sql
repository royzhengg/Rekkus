-- Domain: Core
-- Owner: Platform
-- Classification: Metadata
-- Lifecycle: Derived
-- Source of Truth: No

-- user_stats: Deferred. Current counters (follower_count, post_count) live on users table.
-- Create this table when a third counter is needed (likes_received, collections_count, etc.)
-- Rebuild: SELECT repair_user_stats() — function to be written when table is created.
