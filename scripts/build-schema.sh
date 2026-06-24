#!/usr/bin/env bash
# Concatenates supabase/schema/ domain files into supabase/schema.sql.
# This script is the source of truth for load order.
# Run: ./scripts/build-schema.sh > supabase/schema.sql
# Or:  ./scripts/build-schema.sh | diff - supabase/schema.sql (drift detection)
#
# Load order: extensions → enums → core → social → search → analytics →
#             provider → moderation → audit → governance → functions → rls

set -euo pipefail
SCHEMA_DIR="$(cd "$(dirname "$0")/../supabase/schema" && pwd)"

emit() {
  local file="$SCHEMA_DIR/$1"
  if [[ -f "$file" ]]; then
    echo ""
    echo "-- ---------------------------------------------------------------------------"
    echo "-- $1"
    echo "-- ---------------------------------------------------------------------------"
    cat "$file"
  fi
}

# Header
cat <<'HEADER'
-- =============================================================================
-- GENERATED FILE — do not edit manually.
-- Edit files in supabase/schema/ instead, then run scripts/build-schema.sh.
-- Never review this file in PR diffs; review the domain files instead.
-- =============================================================================

HEADER

# 1. Foundation
emit "00_extensions.sql"
emit "01_enums.sql"

# 2. Core — users
emit "core/users/users.sql"
emit "core/users/user_stats.sql"

# 3. Core — places
emit "core/places/places.sql"
emit "core/places/place_contact.sql"
emit "core/places/place_features.sql"
emit "core/places/place_hours.sql"
emit "core/places/place_sources.sql"
emit "core/places/place_aliases.sql"
emit "core/places/place_traits.sql"
emit "core/places/place_stats.sql"
emit "core/places/place_provider_metadata.sql"
emit "core/places/place_owners.sql"

# 4. Core — dishes
emit "core/dishes/dishes.sql"

# 5. Core — posts
emit "core/posts/posts.sql"
emit "core/posts/post_photos.sql"
emit "core/posts/post_hashtags.sql"
emit "core/posts/post_reactions.sql"
emit "core/posts/post_edits.sql"
emit "core/posts/comments.sql"

# 6. Social
emit "social/follows.sql"
emit "social/collections.sql"
emit "social/interactions.sql"
emit "social/messaging.sql"

# 7. Search
emit "search/taxonomy.sql"
emit "search/search_index.sql"
emit "search/search_events.sql"
emit "search/saved_searches.sql"
emit "search/suburb_data.sql"
emit "search/trending.sql"

# 8. Analytics
emit "analytics/events.sql"

# 9. Provider
emit "provider/cache.sql"
emit "provider/imports.sql"
emit "provider/observations.sql"
emit "provider/merges.sql"

# 10. Moderation
emit "moderation/moderation.sql"

# 11. Audit
emit "audit/audit_tables.sql"
emit "audit/place_ownership_events.sql"
emit "audit/views.sql"

# 12. Governance
emit "governance/governance.sql"

# 13. Functions
emit "functions/auth.sql"
emit "functions/stats.sql"
emit "functions/audit.sql"
emit "functions/messaging.sql"
emit "functions/search.sql"
emit "functions/places/lifecycle.sql"
emit "functions/places/stats.sql"
emit "functions/places/merge.sql"
emit "functions/collections.sql"
emit "functions/dishes.sql"

# 14. RLS
emit "rls/core.sql"
emit "rls/social.sql"
emit "rls/search.sql"
emit "rls/provider.sql"
emit "rls/admin.sql"
emit "rls/storage.sql"
