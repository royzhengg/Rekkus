#!/usr/bin/env node
const {
  getComplianceDoc,
  missingTerms,
  printResult,
  requiredScriptMissing,
  riskyBacklogRowsMissingComplianceImpact,
} = require('./lib/policy-checks')

const args = new Set(process.argv.slice(2))
const failures = []
const warnings = []

if (!getComplianceDoc()) {
  failures.push('docs/security/COMPLIANCE.md is required as the app-wide compliance owner doc.')
}

const requiredSections = [
  'Data Inventory',
  'Provider Terms',
  'Privacy Rights',
  'Retention',
  'Deletion',
  'Export',
  'Attribution',
  'App Store',
  'Google Play',
  'Audit Evidence',
  'ISO',
  'Compliance Impact',
  'Release Gate',
]

for (const term of missingTerms('docs/security/COMPLIANCE.md', requiredSections)) {
  failures.push(`docs/security/COMPLIANCE.md must include ${term} coverage.`)
}

for (const term of missingTerms('operations/RELEASE.md', ['Compliance Impact', 'Privacy Policy', 'Terms', 'Data Safety', 'attribution', 'RLS', 'audit'])) {
  warnings.push(`operations/RELEASE.md should include ${term} release-gate coverage.`)
}

const riskyRows = riskyBacklogRowsMissingComplianceImpact()
if (riskyRows.length > 0) {
  warnings.push(`${riskyRows.length} risky backlog rows lack an explicit Compliance Impact phrase; add it when rows are next touched.`)
}

for (const scriptName of requiredScriptMissing([
  'check:compliance',
  'check:data-inventory',
  'check:rls',
  'check:audit',
  'check:providers',
  'check:privacy',
  'check:iso',
])) {
  failures.push(`package.json is missing ${scriptName}.`)
}

printResult({
  name: 'Compliance checks',
  failures,
  warnings,
  summary: { riskyBacklogRowsMissingComplianceImpact: riskyRows.length },
}, args)
