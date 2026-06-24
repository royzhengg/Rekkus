-- Domain: Foundation
-- Owner: Platform
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- =============================================================================
-- Extensions
-- =============================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
