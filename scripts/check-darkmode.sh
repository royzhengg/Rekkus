#!/usr/bin/env bash
# AUTO-004: Catch hardcoded background colors that break dark mode.
# Only checks backgroundColor — icon/text color:'#fff' on dark overlays is intentional.
# Excludes SVG fill= lines (Google brand colors).

cd "$(dirname "$0")/.."

MATCHES=$(grep -rnE \
  -e "backgroundColor:[[:space:]]*['\"]#[Ff]{3}['\"]" \
  -e "backgroundColor:[[:space:]]*['\"]#[Ff]{6}['\"]" \
  -e "backgroundColor:[[:space:]]*['\"]#[Ff][Ee][Ee]2[Ee]2['\"]" \
  -e "backgroundColor:[[:space:]]*['\"]#[Ff][Ee][Ff]0[Ff]0['\"]" \
  -e "backgroundColor:[[:space:]]*'white'" \
  -e 'backgroundColor:[[:space:]]*"white"' \
  --include="*.tsx" --include="*.ts" \
  features/ components/ 2>/dev/null \
  | grep -v 'fill=' \
  | grep -v '^\s*//' \
  || true)

if [ -n "$MATCHES" ]; then
  echo "FAIL [DARKMODE] Hardcoded background colors found — use useThemeColors() tokens (c.bg, c.surface, c.errorBg, c.white):"
  echo "$MATCHES"
  exit 1
fi

echo "Dark mode check passed."
