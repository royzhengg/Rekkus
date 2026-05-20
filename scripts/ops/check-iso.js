#!/usr/bin/env node
const { missingTerms, printResult, writeFileIfRequested } = require('./lib/policy-checks')

const args = new Set(process.argv.slice(2))
const failures = []
const warnings = []

const controls = [
  'Asset inventory',
  'Access control',
  'Supplier',
  'Secure development',
  'Incident response',
  'Logging',
  'Monitoring',
  'Vulnerability',
  'Backup',
  'Recovery',
  'Data classification',
  'Retention',
  'Privacy',
  'Change management',
]

for (const term of missingTerms('docs/security/COMPLIANCE.md', controls)) {
  warnings.push(`ISO readiness map should include ${term}.`)
}

for (const term of missingTerms('docs/security/SECURITY.md', ['ISO 27001', 'incident', 'dependency audit', 'RLS'])) {
  failures.push(`docs/security/SECURITY.md must include ${term}.`)
}

const report = [
  '# ISO Evidence Summary',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  'This generated report summarizes repo evidence for ISO-style readiness. It is not a certification claim.',
  '',
  '## Controls',
  '',
  ...controls.map((control) => `- ${control}: see docs/security/COMPLIANCE.md and linked owner docs.`),
  '',
  '## Required Checks',
  '',
  '- npm run check:compliance',
  '- npm run check:data-inventory',
  '- npm run check:rls',
  '- npm run check:audit',
  '- npm run check:providers',
  '- npm run check:privacy',
  '- npm run check:iso',
  '- npm run check:release',
  '',
].join('\n')

const wrote = writeFileIfRequested('operations/ISO_EVIDENCE.md', report, args)

printResult({
  name: 'ISO readiness checks',
  failures,
  warnings,
  summary: { controls: controls.length, wroteEvidence: wrote },
}, args)
