#!/usr/bin/env node
const { printResult, requiredScriptMissing } = require('./lib/policy-checks')
const { exists, listFiles, readText } = require('./lib/files')

const args = new Set(process.argv.slice(2))
const failures = []
const warnings = []

function requireTerms(file, terms, mode = 'warning') {
  if (!exists(file)) {
    failures.push(`${file} is required for observability checks.`)
    return
  }

  const source = readText(file)
  for (const term of terms) {
    const pattern = term instanceof RegExp ? term : new RegExp(term, 'i')
    if (!pattern.test(source)) {
      const label = term instanceof RegExp ? term.source : term
      const message = `${file} must include observability coverage for "${label}".`
      if (mode === 'failure') failures.push(message)
      else warnings.push(message)
    }
  }
}

for (const scriptName of requiredScriptMissing([
  'check:observability',
  'check:search',
  'ops:summary',
  'ops:report',
])) {
  failures.push(`package.json is missing ${scriptName}.`)
}

requireTerms(
  'operations/OBSERVABILITY.md',
  [
    'Crash/error reporting',
    'Release health',
    'Analytics quality',
    'Onboarding anomaly',
    'Upload failure',
    'Failed job/cron',
    'API cost',
    'AI cost',
    'Moderation spike',
    'Storage growth',
    'App Store review',
    'Revenue instrumentation',
    'Operational dashboard',
    'Founder command center',
    'VS Code operational surface',
  ],
  'failure'
)

requireTerms(
  'operations/RELEASE.md',
  ['Release Health Checklist', 'check:observability', 'check:search'],
  'failure'
)
requireTerms(
  'operations/COSTS.md',
  ['API Cost Dashboard', 'AI Cost Monitor', 'Storage Growth Monitor'],
  'failure'
)
requireTerms(
  'operations/LAUNCHES.md',
  ['App Store Review Tracking', 'store review status'],
  'failure'
)
requireTerms(
  'business/INSTRUMENTATION.md',
  ['Revenue Instrumentation', 'subscription conversion', 'churn', 'paid feature adoption'],
  'failure'
)
requireTerms(
  'operations/FOUNDER_OS.md',
  ['Operational Dashboard', 'Founder Command Center', 'VS Code operational surface'],
  'failure'
)
requireTerms(
  'operations/AUTOMATION.md',
  ['check:observability', 'check:search', 'VS Code'],
  'failure'
)
requireTerms(
  'docs/analytics/ANALYTICS.md',
  [
    'onboarding_step',
    'onboarding_anomaly',
    'upload_failure',
    'event_version',
    'sampleRate',
    '90 days',
  ],
  'failure'
)
requireTerms(
  'operations/OBSERVABILITY.md',
  ['Sentry', 'EXPO_PUBLIC_SENTRY_DSN', 'SENTRY_AUTH_TOKEN', 'source maps'],
  'failure'
)
requireTerms(
  'docs/architecture/ARCHITECTURE.md',
  ['Crash/error reporting', 'Sentry', 'Feature flags', 'Analytics'],
  'failure'
)

const analytics = exists('lib/analytics.ts') ? readText('lib/analytics.ts') : ''
for (const token of [
  'onboardingAnomaly',
  'onboardingStep',
  'uploadFailure',
  'SAFE_METADATA_KEYS',
]) {
  if (!analytics.includes(token)) failures.push(`lib/analytics.ts must include ${token}.`)
}
for (const token of ['event_version', 'eventVersion', 'sampleRate']) {
  if (!analytics.includes(token)) failures.push(`lib/analytics.ts must include ${token}.`)
}

const crashReporting = exists('lib/services/crashReporting.ts')
  ? readText('lib/services/crashReporting.ts')
  : ''
for (const token of [
  '@sentry/react-native',
  'initializeCrashReporting',
  'captureCrash',
  'if (!SENTRY_ENABLED || !SENTRY_DSN) return component',
  'sendDefaultPii: false',
]) {
  if (!crashReporting.includes(token))
    failures.push(`lib/services/crashReporting.ts must include ${token}.`)
}

const runtimeConfig = exists('lib/config.ts') ? readText('lib/config.ts') : ''
if (/SENTRY_ENABLED\s*=[\s\S]{0,180}APP_ENV\s*===/.test(runtimeConfig)) {
  failures.push('lib/config.ts must activate Sentry only through EXPO_PUBLIC_SENTRY_ENABLED.')
}

const appConfig = exists('app.config.js') ? readText('app.config.js') : ''
if (!appConfig.includes('@sentry/react-native/expo')) {
  failures.push('app.config.js must include the Sentry Expo plugin.')
}
for (const token of [
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'organization: sentryOrganization',
  'project: sentryProject',
]) {
  if (!appConfig.includes(token))
    failures.push(`app.config.js must configure ${token} for Sentry source maps.`)
}

const easConfig = exists('eas.json') ? JSON.parse(readText('eas.json')) : undefined
for (const [profile, environment, enabled] of [
  ['staging', 'preview', 'false'],
  ['beta', 'preview', 'false'],
  ['production', 'production', 'true'],
]) {
  const buildConfig = easConfig?.build?.[profile]
  if (buildConfig?.environment !== environment) {
    failures.push(
      `eas.json build.${profile} must use the ${environment} EAS environment for Sentry configuration.`
    )
  }
  if (buildConfig?.env?.EXPO_PUBLIC_SENTRY_ENABLED !== enabled) {
    failures.push(
      `eas.json build.${profile} must set EXPO_PUBLIC_SENTRY_ENABLED=${enabled} under the temporary Sentry policy.`
    )
  }
}

const featureFlags = exists('lib/featureFlags.ts') ? readText('lib/featureFlags.ts') : ''
for (const token of [
  'feature-flags',
  'FEATURE_FLAG_OVERRIDE_TTL_MS',
  'refreshFeatureFlagOverrides',
]) {
  if (!featureFlags.includes(token)) failures.push(`lib/featureFlags.ts must include ${token}.`)
}

const approvedAnalyticsWriters = new Set(['lib/analytics.ts'])
const directAnalyticsWritePattern =
  /from\(['"]analytics_events['"]\)[\s\S]{0,220}\.(insert|upsert|update|delete)\s*\(/m
for (const file of [
  ...listFiles('app', f => /\.[jt]sx?$/.test(f)),
  ...listFiles('components', f => /\.[jt]sx?$/.test(f)),
  ...listFiles('features', f => /\.[jt]sx?$/.test(f)),
  ...listFiles('lib', f => /\.[jt]sx?$/.test(f)),
]) {
  if (approvedAnalyticsWriters.has(file)) continue
  const source = readText(file)
  if (directAnalyticsWritePattern.test(source)) {
    failures.push(
      `${file} writes directly to analytics_events; route privacy-safe writes through lib/analytics.ts.`
    )
  }
}

const authContext = exists('lib/contexts/AuthContext.tsx')
  ? readText('lib/contexts/AuthContext.tsx')
  : ''
for (const token of [
  'onboardingAnomaly',
  'login_email',
  'signup_email',
  'password_reset',
  'login_google',
]) {
  if (!authContext.includes(token))
    warnings.push(`lib/contexts/AuthContext.tsx should include ${token} onboarding signal.`)
}

const uploadSources = [
  exists('components/post-create/StepMedia.tsx')
    ? readText('components/post-create/StepMedia.tsx')
    : '',
  exists('features/settings/EditProfileScreen.tsx')
    ? readText('features/settings/EditProfileScreen.tsx')
    : '',
].join('\n')
for (const token of ['uploadFailure', 'validation_rejected', 'avatar_upload']) {
  if (!uploadSources.includes(token))
    warnings.push(`Upload surfaces should include ${token} observability signal.`)
}

if (!exists('.vscode/tasks.json')) {
  failures.push('.vscode/tasks.json is required for the VS Code operational surface.')
}

printResult(
  {
    name: 'Observability checks',
    failures,
    warnings,
    summary: {
      mode: 'report-only',
      signals: [
        'crashes',
        'release-health',
        'analytics-quality',
        'onboarding-anomalies',
        'upload-failures',
        'jobs',
        'costs',
        'moderation',
        'storage',
        'store-reviews',
        'revenue',
        'founder-dashboard',
      ],
    },
  },
  args
)
