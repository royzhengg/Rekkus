#!/usr/bin/env bash
# Enforces file size limits and service boundary rules across features/ and app/.
# Allowlisted files are tracked in backlog_new.md (ARCH-001–006); fix them there before removing from here.

cd "$(dirname "$0")/.."

FAILED=0

# ── LOC hard limit ──────────────────────────────────────────────────────────
# Features files must stay under 600 lines. Known violators are allowlisted.
LOC_ALLOWLIST=(
  "features/search/SearchScreen.tsx"
  "features/messages/ConversationScreen.tsx"
  "features/posts/PostDetailScreen.tsx"
  "features/messages/MessagesListScreen.tsx"
  "features/messages/ConversationInfoScreen.tsx"
  "features/create-post/CreatePostScreen.tsx"
  "features/restaurants/RestaurantDetailScreen.tsx"
  "features/restaurants/RestaurantsTabScreen.tsx"
)

while IFS= read -r -d $'\0' file; do
  lines=$(awk 'END{print NR}' "$file")
  if [ "$lines" -gt 600 ]; then
    relpath="${file#./}"
    allowed=0
    for item in "${LOC_ALLOWLIST[@]}"; do
      if [ "$relpath" = "$item" ]; then
        allowed=1
        break
      fi
    done
    if [ "$allowed" -eq 0 ]; then
      echo "FAIL [LOC] $relpath: $lines lines (hard limit: 600)"
      FAILED=1
    fi
  fi
done < <(find features -name "*.ts" -o -name "*.tsx" | tr '\n' '\0')

# ── Supabase import boundary ─────────────────────────────────────────────────
# features/ and app/ must not import supabase directly; all DB calls go through lib/services/.
SUPABASE_ALLOWLIST=(
  "features/auth/SignupProfileScreen.tsx"
  "features/profile/ProfileScreen.tsx"
  "features/restaurants/RestaurantDetailScreen.tsx"
  "features/messages/ConversationScreen.tsx"
  "features/messages/ConversationInfoScreen.tsx"
  "features/settings/ChangeEmailScreen.tsx"
  "features/settings/ChangePasswordScreen.tsx"
  "features/auth/ResetPasswordScreen.tsx"
  "features/messages/MessagesListScreen.tsx"
  "app/_layout.tsx"
)

while IFS= read -r file; do
  if grep -qE "from ['\"]@/lib/supabase" "$file" 2>/dev/null; then
    relpath="${file#./}"
    allowed=0
    for item in "${SUPABASE_ALLOWLIST[@]}"; do
      if [ "$relpath" = "$item" ]; then
        allowed=1
        break
      fi
    done
    if [ "$allowed" -eq 0 ]; then
      echo "FAIL [SUPABASE] $relpath: direct supabase import (use lib/services/)"
      FAILED=1
    fi
  fi
done < <(find features app -name "*.ts" -o -name "*.tsx" 2>/dev/null)

if [ "$FAILED" -eq 1 ]; then
  exit 1
fi

echo "Architecture check passed."
