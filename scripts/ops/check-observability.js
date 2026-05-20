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

for (const scriptName of requiredScriptMissing(['check:observability', 'check:search', 'ops:summary', 'ops:report'])) {
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
  'failure',
)

requireTerms('operations/RELEASE.md', ['Release Health Checklist', 'check:observability', 'check:search'], 'failure')
requireTerms('operations/COSTS.md', ['API Cost Dashboard', 'AI Cost Monitor', 'Storage Growth Monitor'], 'failure')
requireTerms('operations/LAUNCHES.md', ['App Store Review Tracking', 'store review status'], 'failure')
requireTerms('business/INSTRUMENTATION.md', ['Revenue Instrumentation', 'subscription conversion', 'churn', 'paid feature adoption'], 'failure')
requireTerms('operations/FOUNDER_OS.md', ['Operational Dashboard', 'Founder Command Center', 'VS Code operational surface'], 'failure')
requireTerms('operations/AUTOMATION.md', ['check:observability', 'check:search', 'VS Code'], 'failure')
requireTerms('docs/analytics/ANALYTICS.md', ['onboarding_step', 'onboarding_anomaly', 'upload_failure'], 'failure')

const analytics = exists('lib/analytics.ts') ? readText('lib/analytics.ts') : ''
for (const token of ['onboardingAnomaly', 'onboardingStep', 'uploadFailure', 'SAFE_METADATA_KEYS']) {
  if (!analytics.includes(token)) failures.push(`lib/analytics.ts must include ${token}.`)
}

const approvedAnalyticsWriters = new Set([
  'lib/analytics.ts',
  'lib/services/googlePlaces.ts',
])
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
    failures.push(`${file} writes directly to analytics_events; route privacy-safe writes through lib/analytics.ts.`)
  }
}

const authContext = exists('lib/contexts/AuthContext.tsx') ? readText('lib/contexts/AuthContext.tsx') : ''
for (const token of ['onboardingAnomaly', 'login_email', 'signup_email', 'password_reset', 'login_google']) {
  if (!authContext.includes(token)) warnings.push(`lib/contexts/AuthContext.tsx should include ${token} onboarding signal.`)
}

const uploadSources = [
  exists('components/post-create/StepMedia.tsx') ? readText('components/post-create/StepMedia.tsx') : '',
  exists('features/settings/EditProfileScreen.tsx') ? readText('features/settings/EditProfileScreen.tsx') : '',
].join('\n')
for (const token of ['uploadFailure', 'validation_rejected', 'avatar_upload']) {
  if (!uploadSources.includes(token)) warnings.push(`Upload surfaces should include ${token} observability signal.`)
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
  args,
)
