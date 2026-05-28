#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '..')
const lessonsIndexPath = path.join(repoRoot, 'docs/LESSONS.md')
const lessonsDirPath = path.join(repoRoot, 'docs/lessons')
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

function lessonTopicPaths() {
  if (!fs.existsSync(lessonsIndexPath)) {
    console.error('check:automation failed: docs/LESSONS.md is missing.')
    process.exit(1)
  }

  if (!fs.existsSync(lessonsDirPath) || !fs.statSync(lessonsDirPath).isDirectory()) {
    console.error('check:automation failed: docs/lessons/ topic directory is missing.')
    process.exit(1)
  }

  const index = fs.readFileSync(lessonsIndexPath, 'utf8')
  const topicFiles = fs
    .readdirSync(lessonsDirPath)
    .filter(file => file.endsWith('.md'))
    .sort()

  if (topicFiles.length === 0) {
    console.error('check:automation failed: docs/lessons/ has no topic files.')
    process.exit(1)
  }

  const missingLinks = topicFiles.filter(file => !index.includes(`(lessons/${file})`))
  if (missingLinks.length > 0) {
    console.error('check:automation failed: docs/LESSONS.md does not link every lesson topic:')
    for (const file of missingLinks) console.error(`- docs/lessons/${file}`)
    process.exit(1)
  }

  return topicFiles.map(file => `docs/lessons/${file}`)
}

function getModifiedMs(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath)
  const dirtyStatus = runGit(['status', '--short', '--', relativePath])
  if (dirtyStatus) return fs.statSync(absolutePath).mtimeMs

  const committedTimestamp = runGit(['log', '-1', '--format=%ct', '--', relativePath])
  if (committedTimestamp && /^\d+$/.test(committedTimestamp)) {
    return Number(committedTimestamp) * 1000
  }

  return fs.statSync(absolutePath).mtimeMs
}

const topicPaths = lessonTopicPaths()
const modifiedMs = Math.max(...topicPaths.map(getModifiedMs))
const ageMs = Date.now() - modifiedMs
const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))

if (ageMs > maxAgeMs) {
  const modifiedDate = new Date(modifiedMs).toISOString().slice(0, 10)
  console.error(
    `check:automation failed: lesson topics are ${ageDays} days old (last updated ${modifiedDate}).`
  )
  console.error(
    'Record durable learning in the relevant docs/lessons/<topic>.md file before this becomes institutional amnesia.'
  )
  process.exit(1)
}

console.log(`Automation guardrails passed. Lesson topics were updated ${ageDays} days ago.`)
