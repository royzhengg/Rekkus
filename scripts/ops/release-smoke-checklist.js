#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { getArg, hasFlag, printHelp } = require('../lib/args')

const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, '../..', '.temp/release-smoke')

const SMOKE_ITEMS = [
  ['Auth sign in/up', 'Sign in, sign out, and new-account entry still work.'],
  ['Reset password', 'Reset link opens the app and reaches the expected recovery screen.'],
  ['Create post', 'Media, review, dish/recommendation, and share steps complete.'],
  ['Search', 'Search returns local-first results and empty/error states are usable.'],
  ['Post detail', 'Post detail opens from feed/search/profile and renders media plus actions.'],
  ['Restaurant detail', 'Restaurant detail opens, shows core metadata, and handles save/share actions.'],
  ['Map', 'Map opens, location fallback is usable, and markers/details respond.'],
  ['Profile', 'Profile opens for self and another user with posts/saves visible as expected.'],
  ['Redirects/deep links', 'Auth, share, notification, and reset-password redirects resolve correctly.'],
  ['Rollback build identified', 'Previous stable EAS build or rollback path is recorded.'],
  ['Known issues recorded', 'Release notes, backlog, or launch note list accepted issues.'],
]

if (hasFlag('--help')) {
  printHelp('release:smoke', 'Generate or validate the manual release smoke-test checklist.', [
    ['--env <name>', 'Target environment: staging, beta, or production.'],
    ['--candidate <id>', 'Release candidate/build identifier.'],
    ['--tester <name>', 'Tester name or initials for the generated checklist.'],
    ['--device <name>', 'Device/OS used for the smoke pass.'],
    ['--write [path]', `Write template to path, or ${path.relative(process.cwd(), DEFAULT_OUTPUT_DIR)} when omitted.`],
    ['--check <path>', 'Validate that every smoke checklist item is checked.'],
  ])
  process.exit(0)
}

const checkPath = getArg('--check')

if (checkPath) {
  validateChecklist(path.resolve(checkPath))
  process.exit(0)
}

const template = renderTemplate({
  env: getArg('--env') || process.env.EXPO_PUBLIC_APP_ENV || 'staging',
  candidate: getArg('--candidate') || process.env.REKKUS_RELEASE_CANDIDATE || '<build-id>',
  tester: getArg('--tester') || '<tester>',
  device: getArg('--device') || '<device / OS>',
})

const writeTarget = getWriteTarget()

if (writeTarget) {
  fs.mkdirSync(path.dirname(writeTarget), { recursive: true })
  fs.writeFileSync(writeTarget, template)
  console.log(`Release smoke checklist written to ${path.relative(process.cwd(), writeTarget)}.`)
} else {
  process.stdout.write(template)
}

function getWriteTarget() {
  if (!hasFlag('--write')) return null

  const explicitPath = getArg('--write')
  if (explicitPath && !explicitPath.startsWith('--')) {
    return path.resolve(explicitPath)
  }

  const candidate = sanitizeFilePart(getArg('--candidate') || process.env.REKKUS_RELEASE_CANDIDATE || 'candidate')
  const env = sanitizeFilePart(getArg('--env') || process.env.EXPO_PUBLIC_APP_ENV || 'staging')
  return path.join(DEFAULT_OUTPUT_DIR, `${env}-${candidate}.md`)
}

function sanitizeFilePart(value) {
  return String(value).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'candidate'
}

function renderTemplate({ env, candidate, tester, device }) {
  const lines = [
    '# Release Smoke Checklist',
    '',
    `- Environment: ${env}`,
    `- Release candidate: ${candidate}`,
    `- Tester: ${tester}`,
    `- Device/OS: ${device}`,
    `- Started: ${new Date().toISOString()}`,
    '',
    '## Required Smoke Pass',
    '',
    ...SMOKE_ITEMS.map(([label, description]) => `- [ ] ${label} - ${description}`),
    '',
    '## Notes',
    '',
    '- Blockers:',
    '- Accepted known issues:',
    '- Rollback build/path:',
    '',
  ]

  return `${lines.join('\n')}\n`
}

function validateChecklist(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Release smoke checklist is missing: ${filePath}`)
    process.exit(1)
  }

  const source = fs.readFileSync(filePath, 'utf8')
  const failures = []

  for (const [label] of SMOKE_ITEMS) {
    const itemPattern = new RegExp(`^- \\[[xX]\\] ${escapeRegExp(label)}\\b`, 'm')
    if (!itemPattern.test(source)) {
      failures.push(`${label} is not checked.`)
    }
  }

  for (const requiredField of ['Environment:', 'Release candidate:', 'Tester:', 'Device/OS:', 'Rollback build/path:']) {
    const valuePattern = new RegExp(`^- ${escapeRegExp(requiredField)}\\s*(.+)$`, 'm')
    const match = source.match(valuePattern)
    const value = match ? match[1].trim() : ''
    if (!value || /^<.+>$/.test(value)) {
      failures.push(`${requiredField} field needs a real value.`)
    }
  }

  if (failures.length > 0) {
    console.error('Release smoke checklist validation failed:')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }

  console.log(`Release smoke checklist passed: ${path.relative(process.cwd(), filePath)}.`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
