#!/usr/bin/env node
const {
  analyticsPrivacyViolations,
  getReleaseDoc,
  missingTerms,
  printResult,
} = require('./lib/policy-checks')
const { exists, readText } = require('./lib/files')

const args = new Set(process.argv.slice(2))
const failures = []
const warnings = []
const release = getReleaseDoc()

for (const term of missingTerms('docs/security/COMPLIANCE.md', [
  'Privacy Policy',
  'Terms',
  'account deletion',
  'data export',
  'App Store',
  'Google Play Data Safety',
  'precise location',
])) {
  failures.push(`Privacy governance must include ${term}.`)
}

for (const term of ['Privacy policy', 'terms', 'deletion', 'export', 'App Store', 'Play Store', 'Data Safety']) {
  if (!new RegExp(term, 'i').test(release)) warnings.push(`operations/RELEASE.md should include ${term}.`)
}

if (!exists('app/settings/privacy-data.tsx')) {
  failures.push('app/settings/privacy-data.tsx is required for the in-app Privacy and Data surface.')
}
if (exists('features/settings/SettingsScreen.tsx') && !/privacy-data/.test(readText('features/settings/SettingsScreen.tsx'))) {
  failures.push('SettingsScreen must link to /settings/privacy-data.')
}

for (const violation of analyticsPrivacyViolations()) warnings.push(violation)

printResult({
  name: 'Privacy checks',
  failures,
  warnings,
  summary: { analyticsPrivacyWarnings: analyticsPrivacyViolations().length },
}, args)
