#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '..')
const lessonsPath = path.join(repoRoot, 'docs/LESSONS.md')
const maxAgeDays = 30
const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

function getLessonsModifiedMs() {
  if (!fs.existsSync(lessonsPath)) {
    console.error('check:automation failed: docs/LESSONS.md is missing.')
    process.exit(1)
  }

  const relativePath = 'docs/LESSONS.md'
  const dirtyStatus = runGit(['status', '--short', '--', relativePath])
  if (dirtyStatus) return fs.statSync(lessonsPath).mtimeMs

  const committedTimestamp = runGit(['log', '-1', '--format=%ct', '--', relativePath])
  if (committedTimestamp && /^\d+$/.test(committedTimestamp)) {
    return Number(committedTimestamp) * 1000
  }

  return fs.statSync(lessonsPath).mtimeMs
}

const modifiedMs = getLessonsModifiedMs()
const ageMs = Date.now() - modifiedMs
const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))

if (ageMs > maxAgeMs) {
  const modifiedDate = new Date(modifiedMs).toISOString().slice(0, 10)
  console.error(
    `check:automation failed: docs/LESSONS.md is ${ageDays} days old (last updated ${modifiedDate}).`
  )
  console.error(
    'Update docs/LESSONS.md and the relevant docs/lessons/<topic>.md topic before this becomes institutional amnesia.'
  )
  process.exit(1)
}

console.log(`Automation guardrails passed. docs/LESSONS.md is ${ageDays} days old.`)
