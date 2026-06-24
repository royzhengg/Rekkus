#!/usr/bin/env bash
# Verifies that supabase/schema.sql is up to date with the domain files in supabase/schema/.
# Fails if the two are out of sync — run ./scripts/build-schema.sh > supabase/schema.sql to fix.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GENERATED=$(mktemp /tmp/generated-schema-XXXXXX.sql)
trap 'rm -f "$GENERATED"' EXIT

"$REPO_ROOT/scripts/build-schema.sh" > "$GENERATED"

if diff --unified=3 "$GENERATED" "$REPO_ROOT/supabase/schema.sql" > /dev/null 2>&1; then
  echo "✓ supabase/schema.sql is up to date with supabase/schema/ domain files."
  exit 0
else
  echo "✗ supabase/schema.sql is out of sync with supabase/schema/ domain files."
  echo ""
  echo "  Diff (generated vs committed):"
  diff --unified=3 "$GENERATED" "$REPO_ROOT/supabase/schema.sql" || true
  echo ""
  echo "  Fix: ./scripts/build-schema.sh > supabase/schema.sql"
  exit 1
fi
