#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '..')
const reminder = 'Reminder: Did you update docs/LESSONS.md and verify AGENTS.md covers this pattern?'

function readCommitMessage() {
  const argIndex = process.argv.indexOf('--commit-msg')
  const msgPath = argIndex >= 0 ? process.argv[argIndex + 1] : ''
  if (msgPath) return fs.readFileSync(msgPath, 'utf8')
  return process.env.CHECK_LESSONS_COMMIT_MSG ?? ''
}

function stagedFeatureFiles() {
  try {
    const output = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    return output.split('\n').filter(file => file.startsWith('features/'))
  } catch {
    return []
  }
}

function verifyInstallFiles() {
  const required = [
    'scripts/check-lessons.js',
    '.githooks/commit-msg',
    '.husky/commit-msg',
  ]
  const missing = required.filter(file => !fs.existsSync(path.join(repoRoot, file)))
  if (missing.length > 0) {
    console.error('FAIL [LESSONS] Missing lesson freshness hook files:')
    for (const file of missing) console.error(`- ${file}`)
    process.exit(1)
  }
  console.log('Lessons freshness check passed.')
}

const message = readCommitMessage()
if (!message) {
  verifyInstallFiles()
  process.exit(0)
}

if (/\b(fix|bug)\b/i.test(message) && stagedFeatureFiles().length > 0) {
  console.warn(reminder)
}
