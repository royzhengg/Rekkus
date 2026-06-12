#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { asyncSafetyFailures } = require('./lib/async-safety-rules')
const { iosVisualFailures } = require('./lib/ios-visual-rules')
const { motionFailures } = require('./lib/motion-rules')
const { navigationSafetyFailures } = require('./lib/navigation-safety-rules')
const { runtimeBoundaryFailures } = require('./lib/runtime-boundary-rules')

const root = path.resolve(__dirname, '..')
const failures = []

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function walk(relativeRoot, visitor) {
  const start = path.join(root, relativeRoot)
  if (!fs.existsSync(start)) return
  const stack = [start]
  while (stack.length) {
    const current = stack.pop()
    const stat = fs.statSync(current)
    const name = path.basename(current)
    if (stat.isDirectory()) {
      if (['.git', '.expo', '.temp', 'node_modules', 'coverage'].includes(name)) continue
      for (const child of fs.readdirSync(current)) stack.push(path.join(current, child))
      continue
    }
    visitor(path.relative(root, current), fs.readFileSync(current, 'utf8'))
  }
}

const postDrafts = read('lib/services/postDrafts.ts')
if (
  !/let\s+allSynced\s*=\s*true/.test(postDrafts) ||
  !/if\s*\(\s*allSynced\s*\)\s*await AsyncStorage\.setItem\(migrationKey/.test(postDrafts)
) {
  failures.push('post draft migration must only set the migration key after all candidates sync.')
}

const useSearch = read('lib/hooks/useSearch.ts')
const searchPipeline = read('lib/search/pipeline.ts')
const searchContext = read('lib/search/context.ts')
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

const useRestaurantSearch = read('lib/hooks/useRestaurantSearch.ts')
if (!/decideSearchProviderFallback/.test(useRestaurantSearch) || !/fetchPredictions\(\s*query,\s*effectiveCoords\s*\)/.test(useRestaurantSearch)) {
  failures.push('create-post restaurant tagging must keep the shared fallback gate and pass effective coords (userLocation.coords or explicit override) into provider predictions.')
}

walk('lib/hooks', (file, source) => {
  if (!/\.tsx?$/.test(file)) return
  failures.push(...asyncSafetyFailures(file, source))
})

const featureFlags = read('lib/featureFlags.ts')
if (!/analytics\.actionError\([^)]*refresh_feature_flags/.test(featureFlags)) {
  failures.push('feature flag refresh failures must emit a privacy-safe operational signal.')
}

const rootLayout = read('app/_layout.tsx')
if (/registerPushToken\([^,\n)]*,\s*\{\s*requestPermission:\s*true/.test(rootLayout)) {
  failures.push('root layout must not request push permission implicitly.')
}

// B-524: foreground location permission is contextual and must never run on screen mount.
walk('features', (file, source) => {
  if (!/\.tsx?$/.test(file)) return
  if (/useUserLocation\s*\(\s*\{[\s\S]*?autoRequest\s*:/.test(source)) {
    failures.push(
      `${file} requests location through autoRequest; location must be initiated by a user action (B-524).`
    )
  }
})

const userLocationHook = read('lib/hooks/useUserLocation.ts')
if (
  /autoRequest/.test(userLocationHook) ||
  /useEffect\s*\([\s\S]*?requestLocation\s*\(/.test(userLocationHook)
) {
  failures.push(
    'useUserLocation must expose explicit actions only; it cannot request GPS during an effect (B-524).'
  )
}

// B-525: visible tabs are destinations; contribution remains a separate action.
const tabsLayout = read('app/(tabs)/_layout.tsx')
if (/name=["']create["'][\s\S]{0,180}tabBarButton/.test(tabsLayout)) {
  failures.push(
    'Create must not be rendered as a visible tab action; use the floating Create action (B-525).'
  )
}
if (!/FloatingActionButton/.test(tabsLayout) || /<Tabs\.Screen\s+name=["']create["']/.test(tabsLayout)) {
  failures.push(
    'root tabs must expose the floating Create action without registering Create as a tab screen (B-408/B-525).'
  )
}

if (!/<Stack\.Screen[\s\S]*name=["']create["'][\s\S]*presentation: Platform\.OS === ['"]ios['"] \? ['"]pageSheet['"] : ['"]modal['"]/.test(rootLayout)) {
  failures.push(
    'Create must be registered as a root modal stack route with iOS pageSheet presentation (B-408).'
  )
}

// B-528: permission denial recovery must use usePermissionRecovery + Linking.openSettings, not Alert.alert.
// Alert.alert with "Settings" in the message gives users no actionable path and violates App Store guidelines.
const alertPermissionPattern =
  /Alert\.alert\s*\(\s*(?:'[^']*'|"[^"]*")\s*,\s*(?:'[^']*[Ss]ettings[^']*'|"[^"]*[Ss]ettings[^"]*")/
for (const relativeRoot of ['features', 'components', 'lib']) {
  walk(relativeRoot, (file, source) => {
    if (!/\.tsx?$/.test(file)) return
    if (alertPermissionPattern.test(source)) {
      failures.push(
        `${file} uses Alert.alert to direct the user to device Settings; ` +
          'use usePermissionRecovery and RekkusActionSheet with Linking.openSettings() instead (B-528).'
      )
    }
  })
}

const observability = read('scripts/ops/check-observability.js')
if (
  /lib\/services\/googlePlaces\.ts/.test(observability) &&
  /approvedAnalyticsWriters/.test(observability)
) {
  failures.push('googlePlaces must not be allowlisted for direct analytics_events writes.')
}

for (const relativeRoot of [
  'app',
  'features',
  'components',
  'constants',
  'lib',
  'types',
  'supabase/functions',
]) {
  walk(relativeRoot, (file, source) => {
    if (!/\.[jt]sx?$/.test(file)) return
    if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/m.test(source)) {
      failures.push(
        `${file} contains an empty catch block; handle, report, or document the fallback.`
      )
    }
    failures.push(...runtimeBoundaryFailures(file, source))
    failures.push(...iosVisualFailures(file, source))
    failures.push(...motionFailures(file, source))
    failures.push(...navigationSafetyFailures(file, source))
    if (/(?:from|import\s*\(|require\s*\()\s*['"](?:\.\.\/){3,}/m.test(source)) {
      failures.push(
        `${file} uses a deep relative import; prefer the @/ alias for stable boundaries.`
      )
    }
    source.split('\n').forEach((line, index) => {
      if (/\b(?:TODO|FIXME|HACK)\b/.test(line) && !/\bB-\d+\b/.test(line)) {
        failures.push(
          `${file}:${index + 1} has untracked TODO/FIXME/HACK debt; reference a BACKLOG.md ID.`
        )
      }
    })
    if (
      file !== 'lib/analytics.ts' &&
      file !== 'supabase/functions/analytics-retention/index.ts' &&
      /from\(['"]analytics_events['"]\)[\s\S]{0,220}\.(insert|upsert|update|delete)\s*\(/m.test(
        source
      )
    ) {
      failures.push(`${file} writes directly to analytics_events; use lib/analytics.ts.`)
    }
    if (/^components\//.test(file) && /useRouter\(|router\.push|router\.replace/.test(source)) {
      failures.push(`${file} owns navigation; keep shared components route-agnostic.`)
    }
    if (/^components\//.test(file) && /`\/[a-z][^`]*\$\{/.test(source)) {
      failures.push(`${file} contains a template literal route string; use @/lib/routes helpers.`)
    }
    if (/^components\//.test(file) && /pathname:\s*['"]\//.test(source)) {
      failures.push(`${file} contains an inline route pathname object; use @/lib/routes helpers.`)
    }
    if (/^features\//.test(file) && /from ['"]@\/lib\/data['"]/.test(source)) {
      failures.push(`${file} imports legacy lib/data; use lib/dataSources/demoData.`)
    }
  })
}

if (!exists('operations/JOB_MANIFEST.md')) {
  failures.push('operations/JOB_MANIFEST.md is required for scheduled job evidence.')
}

// B-520 guardrail: login audit events must always carry a context argument (device metadata).
// Pattern flags bare calls with no second argument: recordAuthAuditEvent('login_*_success')
// Prevents silently omitting device_os/provider from future login audit call sites.
const loginAuditNoContextPattern =
  /recordAuthAuditEvent\s*\(\s*['"`]login_(?:email|oauth)_success['"`]\s*\)/
for (const relativeRoot of ['app', 'features', 'lib', 'components']) {
  walk(relativeRoot, (file, source) => {
    if (!/\.tsx?$/.test(file)) return
    if (loginAuditNoContextPattern.test(source)) {
      failures.push(
        `${file} calls recordAuthAuditEvent for a login event without a context argument; ` +
          'always pass { provider, ...getDeviceContext() } so device metadata is captured (B-520).'
      )
    }
  })
}

// B-239b: Phase 2 deferrable functions must go through runDeferredMutation in feature files.
// Direct calls bypass the offline queue and break offline write recovery.
const DEFERRABLE_FNS = [
  'addReaction', 'removeReaction',
  'muteConversation', 'unmuteConversation',
  'archiveConversation', 'unarchiveConversation',
  'pinConversation', 'unpinConversation',
  'markConversationUnread',
]
const deferrablePattern = new RegExp(`\\b(${DEFERRABLE_FNS.join('|')})\\b`)
walk('features', (file, source) => {
  if (!/\.tsx?$/.test(file)) return
  if (deferrablePattern.test(source)) {
    failures.push(
      `${file} directly uses a Phase 2 deferrable function; ` +
        'call runDeferredMutation({ kind: ... }) instead (B-239b).'
    )
  }
})

if (failures.length) {
  console.error('Hidden-risk guardrails failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Hidden-risk guardrails passed.')
