#!/usr/bin/env node
/**
 * check:ux-signals
 *
 * Prevents multi-step user flows from shipping without funnel instrumentation.
 *
 * Rules:
 *  1. Every feature screen with step state (useState<Step> or const [step,) must call
 *     a funnel analytics method (analytics.createPostFunnel or similar) unless it is
 *     in the funnelAllowlist with a B-### backlog ID.
 *  2. lib/analytics.ts must export the three UX quality signal methods.
 *  3. docs/analytics/ANALYTICS.md must document the three event types.
 *
 * To add a new multi-step screen: either add funnel instrumentation (preferred) or
 * add it to funnelAllowlist with a B-### backlog ID explaining why it is deferred.
 */
const { readAnalyticsSources, readText, walkFiles } = require('./lib/scan-files')
const { hasFlag, printHelp } = require('./lib/args')

if (hasFlag('--help') || hasFlag('-h')) {
  printHelp('check:ux-signals', 'Ensures multi-step flows have funnel instrumentation.')
  process.exit(0)
}

const failures = []
const warnings = []

// Multi-step screens that are intentionally untracked.
// Add a B-### backlog ID and reason. Remove the entry once funnel calls are added.
const funnelAllowlist = new Map([
  // Example:
  // ['features/onboarding/OnboardingScreen.tsx', 'B-999 — onboarding funnel deferred until B-999'],
  ['features/settings/Enable2FAScreen.tsx', 'B-638 — 2FA enrollment funnel covered by per-step events (twoFactorSetupStarted/QrShown/Completed/Abandoned); no aggregate createFunnel call needed'],
])

// ── Rule 1: multi-step screen coverage ──────────────────────────────────────

const STEP_STATE_PATTERN = /useState\s*<\s*Step\s*>|const\s+\[step\s*,/
const FUNNEL_CALL_PATTERN = /analytics\.\w*[Ff]unnel|analytics\.createPostFunnel/

for (const file of walkFiles(['features'], { extensions: ['.ts', '.tsx'] })) {
  const source = readText(file)
  if (!STEP_STATE_PATTERN.test(source)) continue

  if (funnelAllowlist.has(file)) {
    warnings.push(`WARN [UX-SIGNALS] ${file}: multi-step flow is allowlisted (${funnelAllowlist.get(file)}). Remove from allowlist when funnel calls are added.`)
    continue
  }

  if (!FUNNEL_CALL_PATTERN.test(source)) {
    failures.push(
      `FAIL [UX-SIGNALS] ${file}: has step state but no funnel analytics call.\n` +
      `  Add analytics.createPostFunnel() (or equivalent) for each step entry, completion, and abandonment.\n` +
      `  Or add to funnelAllowlist in scripts/check-ux-signals.js with a B-### backlog ID.`
    )
  }
}

// ── Rule 2: analytics.ts must export the three UX quality methods ────────────

const analyticsSource = readAnalyticsSources()

for (const method of ['createPostFunnel', 'rageTap', 'deadClick']) {
  if (!analyticsSource.includes(method)) {
    failures.push(`FAIL [UX-SIGNALS] lib/analytics.ts must export analytics.${method}.`)
  }
}

if (!analyticsSource.includes('tap_count')) {
  failures.push(`FAIL [UX-SIGNALS] lib/analytics.ts SAFE_METADATA_KEYS must include 'tap_count'.`)
}

// ── Rule 3: ANALYTICS.md must document the three event types ─────────────────

const analyticsDocPath = 'docs/analytics/ANALYTICS.md'
const analyticsDoc = (() => { try { return readText(analyticsDocPath) } catch { return '' } })()

for (const eventType of ['create_post_funnel', 'interaction_rage_tap', 'interaction_dead_click']) {
  if (!analyticsDoc.includes(eventType)) {
    failures.push(`FAIL [UX-SIGNALS] docs/analytics/ANALYTICS.md must document the '${eventType}' event type.`)
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

for (const w of warnings) console.warn(w)

if (failures.length > 0) {
  console.error('UX signals check failed:')
  for (const f of failures) console.error(f)
  process.exit(1)
}

console.log(
  warnings.length > 0
    ? 'UX signals check passed with advisory warnings.'
    : 'UX signals check passed.'
)
