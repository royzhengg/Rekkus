#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { walkFiles, readText } = require('./lib/scan-files')
const { asyncSafetyFailures } = require('./lib/async-safety-rules')
const { iosVisualFailures } = require('./lib/ios-visual-rules')
const { motionFailures } = require('./lib/motion-rules')
const { navigationSafetyFailures } = require('./lib/navigation-safety-rules')
const { runtimeBoundaryFailures } = require('./lib/runtime-boundary-rules')

const root = path.resolve(__dirname, '..')
const failures = []

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

// ── Single-file invariant checks ─────────────────────────────────────────────

const postDrafts = readText('lib/services/postDrafts.ts')
if (
  !/let\s+allSynced\s*=\s*true/.test(postDrafts) ||
  !/if\s*\(\s*allSynced\s*\)\s*await AsyncStorage\.setItem\(migrationKey/.test(postDrafts)
) {
  failures.push('post draft migration must only set the migration key after all candidates sync.')
}

const useSearch = readText('lib/hooks/useSearch.ts')
const searchPipeline = readText('lib/search/pipeline.ts')
const searchContext = exists('lib/search/context.ts') ? readText('lib/search/context.ts') : ''
if (/resolveSuburbQuery\([^)]*\)\.then/.test(useSearch) || /resolveSuburbQuery\([^)]*\)\.then/.test(searchContext)) {
  failures.push('search suburb DB resolution must be awaited before paid provider fallback.')
}
if (
  !/runSearchPipeline/.test(useSearch) ||
  !/decideSearchProviderFallback/.test(searchPipeline) ||
  /fetchPlaceAutocompleteJson\(\s*(?:q|context\.query)\s*,\s*null\s*\)/.test(searchPipeline)
) {
  failures.push('main Search provider fallback must use the shared intent/locality gate and must not call Google fallback with null coordinates for ambiguous food queries.')
}

const useRestaurantSearch = readText('lib/hooks/usePlaceSearch.ts')
if (!/decideSearchProviderFallback/.test(useRestaurantSearch) || !/fetchPredictions\(\s*query,\s*effectiveCoords\s*\)/.test(useRestaurantSearch)) {
  failures.push('create-post restaurant tagging must keep the shared fallback gate and pass effective coords (userLocation.coords or explicit override) into provider predictions.')
}

const featureFlags = readText('lib/featureFlags.ts')
if (!/analytics\.actionError\([^)]*refresh_feature_flags/.test(featureFlags)) {
  failures.push('feature flag refresh failures must emit a privacy-safe operational signal.')
}

const rootLayout = readText('app/_layout.tsx')
if (/registerPushToken\([^,\n)]*,\s*\{\s*requestPermission:\s*true/.test(rootLayout)) {
  failures.push('root layout must not request push permission implicitly.')
}
if (!/<Stack\.Screen[\s\S]*name=["']create["'][\s\S]*presentation: Platform\.OS === ['"]ios['"] \? ['"]pageSheet['"] : ['"]modal['"]/.test(rootLayout)) {
  failures.push('Create must be registered as a root modal stack route with iOS pageSheet presentation (B-408).')
}

const userLocationHook = readText('lib/hooks/useUserLocation.ts')
if (
  /autoRequest/.test(userLocationHook) ||
  /useEffect\s*\([\s\S]*?requestLocation\s*\(/.test(userLocationHook)
) {
  failures.push('useUserLocation must expose explicit actions only; it cannot request GPS during an effect (B-524).')
}

const tabsLayout = readText('app/(tabs)/_layout.tsx')
if (/name=["']create["'][\s\S]{0,180}tabBarButton/.test(tabsLayout)) {
  failures.push('Create must not be rendered as a visible tab action; use the floating Create action (B-525).')
}
if (!/FloatingActionButton/.test(tabsLayout) || /<Tabs\.Screen\s+name=["']create["']/.test(tabsLayout)) {
  failures.push('root tabs must expose the floating Create action without registering Create as a tab screen (B-408/B-525).')
}

if (!exists('operations/JOB_MANIFEST.md')) {
  failures.push('operations/JOB_MANIFEST.md is required for scheduled job evidence.')
}

// ── Walk A: lib/hooks — async safety ─────────────────────────────────────────

for (const file of walkFiles(['lib/hooks'], { extensions: ['.ts', '.tsx'] })) {
  const source = readText(file)
  failures.push(...asyncSafetyFailures(file, source))
}

// ── Walk B: all source dirs — all per-file guardrails in a single pass ────────

const alertPermissionPattern =
  /Alert\.alert\s*\(\s*(?:'[^']*'|"[^"]*")\s*,\s*(?:'[^']*[Ss]ettings[^']*'|"[^"]*[Ss]ettings[^"]*")/
const loginAuditNoContextPattern =
  /recordAuthAuditEvent\s*\(\s*['"`]login_(?:email|oauth)_success['"`]\s*\)/
const DEFERRABLE_FNS = [
  'addReaction', 'removeReaction',
  'muteConversation', 'unmuteConversation',
  'archiveConversation', 'unarchiveConversation',
  'pinConversation', 'unpinConversation',
  'markConversationUnread',
]
const deferrablePattern = new RegExp(`\\b(${DEFERRABLE_FNS.join('|')})\\b`)

const SOURCE_ROOTS = ['app', 'features', 'components', 'constants', 'lib', 'types', 'supabase/functions']
for (const file of walkFiles(SOURCE_ROOTS, { extensions: ['.ts', '.tsx', '.js', '.jsx'] })) {
  const source = readText(file)

  // B-524: location permission must be user-initiated (features only)
  if (file.startsWith('features/') && /useUserLocation\s*\(\s*\{[\s\S]*?autoRequest\s*:/.test(source)) {
    failures.push(
      `${file} requests location through autoRequest; location must be initiated by a user action (B-524).`
    )
  }

  // B-528: permission recovery must use usePermissionRecovery, not Alert.alert
  if (/^(features|components|lib)\//.test(file) && alertPermissionPattern.test(source)) {
    failures.push(
      `${file} uses Alert.alert to direct the user to device Settings; ` +
        'use usePermissionRecovery and RekkusActionSheet with Linking.openSettings() instead (B-528).'
    )
  }

  // Empty catch blocks
  if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/m.test(source)) {
    failures.push(`${file} contains an empty catch block; handle, report, or document the fallback.`)
  }

  failures.push(...runtimeBoundaryFailures(file, source))
  failures.push(...iosVisualFailures(file, source))
  failures.push(...motionFailures(file, source))
  failures.push(...navigationSafetyFailures(file, source))

  // Deep relative imports
  if (/(?:from|import\s*\(|require\s*\()\s*['"](?:\.\.\/){3,}/m.test(source)) {
    failures.push(`${file} uses a deep relative import; prefer the @/ alias for stable boundaries.`)
  }

  // Untracked debt markers
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (/\b(?:TODO|FIXME|HACK)\b/.test(lines[i]) && !/\bB-\d+\b/.test(lines[i])) {
      failures.push(`${file}:${i + 1} has untracked TODO/FIXME/HACK debt; reference a BACKLOG.md ID.`)
    }
  }

  // Analytics boundary: only lib/analytics.ts and the retention function may write directly
  if (
    file !== 'lib/analytics.ts' &&
    file !== 'lib/analytics/core.ts' &&
    file !== 'lib/analytics/events.ts' &&
    file !== 'supabase/functions/analytics-retention/index.ts' &&
    /from\(['"]analytics_events['"]\)[\s\S]{0,220}\.(insert|upsert|update|delete)\s*\(/m.test(source)
  ) {
    failures.push(`${file} writes directly to analytics_events; use lib/analytics.ts.`)
  }

  // Component navigation isolation
  if (file.startsWith('components/')) {
    if (/useRouter\(|router\.push|router\.replace/.test(source)) {
      failures.push(`${file} owns navigation; keep shared components route-agnostic.`)
    }
    if (/`\/[a-z][^`]*\$\{/.test(source)) {
      failures.push(`${file} contains a template literal route string; use @/lib/routes helpers.`)
    }
    if (/pathname:\s*['"]\//.test(source)) {
      failures.push(`${file} contains an inline route pathname object; use @/lib/routes helpers.`)
    }
  }

  // Legacy lib/data import (features only)
  if (file.startsWith('features/') && /from ['"]@\/lib\/data['"]/.test(source)) {
    failures.push(`${file} imports legacy lib/data; use lib/dataSources/demoData.`)
  }

  // B-520: login audit events must carry device context (app, features, lib, components)
  if (/^(app|features|lib|components)\//.test(file) && loginAuditNoContextPattern.test(source)) {
    failures.push(
      `${file} calls recordAuthAuditEvent for a login event without a context argument; ` +
        'always pass { provider, ...getDeviceContext() } so device metadata is captured (B-520).'
    )
  }

  // B-239b: Phase 2 deferrable functions must go through runDeferredMutation (features only)
  if (file.startsWith('features/') && deferrablePattern.test(source)) {
    failures.push(
      `${file} directly uses a Phase 2 deferrable function; ` +
        'call runDeferredMutation({ kind: ... }) instead (B-239b).'
    )
  }
}

if (failures.length) {
  console.error('Hidden-risk guardrails failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Hidden-risk guardrails passed.')
