#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { hasFlag, printHelp } = require('./lib/args.js')

if (hasFlag('--help') || hasFlag('-h')) {
  printHelp(
    'check:coordination',
    'Fail on missing coordination files, invalid backlog counter, duplicate backlog IDs, or active file-ownership conflicts.',
  )
  process.exit(0)
}

const ROOT = path.resolve(__dirname, '..')
const REQUIRED_FILES = [
  'AGENTS.md',
  'BACKLOG.md',
  'worklog.md',
  'backlog-counter.md',
  'lessons.md',
]
const BACKLOG_FILES = ['BACKLOG.md', 'COMPLETED_ITEMS.md']
const KNOWN_DUPLICATE_IDS = new Set(['b-563', 'b-564', 'b-565', 'b-566'])
const failures = []
const warnings = []

function filePath(relativePath) {
  return path.join(ROOT, relativePath)
}

function read(relativePath) {
  return fs.readFileSync(filePath(relativePath), 'utf8')
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length
}

function extractAnchors(relativePath) {
  const text = read(relativePath)
  const anchors = []
  for (const match of text.matchAll(/<a id="(b-\d{3,})"><\/a>/g)) {
    anchors.push({
      id: match[1],
      file: relativePath,
      line: lineNumber(text, match.index ?? 0),
      numeric: Number(match[1].slice(2)),
    })
  }
  return anchors
}

function parseCounter() {
  const text = read('backlog-counter.md')
  const matches = [...text.matchAll(/^Next backlog ID:\s*(B-\d{3,})\s*$/gmi)]
  if (matches.length !== 1) {
    failures.push('backlog-counter.md must contain exactly one "Next backlog ID: B-###" line.')
    return null
  }

  return {
    id: matches[0][1],
    numeric: Number(matches[0][1].slice(2)),
  }
}

function markdownCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim())
}

function activeWorkRows() {
  const text = read('worklog.md')
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex(line => /^## Active Work\s*$/.test(line))
  if (start === -1) {
    failures.push('worklog.md must include "## Active Work".')
    return []
  }

  const rows = []
  let header = null
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^##\s+/.test(line)) break
    if (!line.trim().startsWith('|')) continue
    if (/^\|\s*-+/.test(line)) continue

    const cells = markdownCells(line)
    if (!header) {
      header = cells.map(cell => cell.toLowerCase())
      continue
    }

    const row = {}
    for (let cellIndex = 0; cellIndex < header.length; cellIndex += 1) {
      row[header[cellIndex]] = cells[cellIndex] ?? ''
    }
    row.line = i + 1
    rows.push(row)
  }

  return rows
}

function normalizeClaimedFile(value) {
  return value.replace(/`/g, '').trim()
}

function claimedFiles(value) {
  if (!value || value === '-') return []
  return value
    .split(/,|<br\s*\/?>|;/i)
    .map(normalizeClaimedFile)
    .filter(Boolean)
}

function isReleasedStatus(status) {
  return /^(done|complete|completed|released|cancelled|canceled)$/i.test(status.trim())
}

const SHAREABLE_COORDINATION_FILES = new Set([
  'AGENTS.md',
  'BACKLOG.md',
  'COMPLETED_ITEMS.md',
  'REPO_MAP.md',
  'worklog.md',
  'backlog-counter.md',
  'lessons.md',
])

function isShareableClaim(claimed) {
  return (
    SHAREABLE_COORDINATION_FILES.has(claimed) ||
    /^docs\//.test(claimed) ||
    /^product\//.test(claimed) ||
    /^design\//.test(claimed) ||
    /^operations\//.test(claimed) ||
    /^tests\/unit\/lib\/services\//.test(claimed)
  )
}

function rowAllowsSharedOverlap(row) {
  const note = `${row.blockers ?? ''} ${row.notes ?? ''}`
  return /shared overlap/i.test(note)
}

for (const relativePath of REQUIRED_FILES) {
  if (!fs.existsSync(filePath(relativePath))) {
    failures.push(`${relativePath} is required for multi-agent coordination.`)
  }
}

if (failures.length === 0) {
  const counter = parseCounter()
  const anchors = BACKLOG_FILES.flatMap(extractAnchors)
  const maxAnchor = anchors.reduce((max, anchor) => Math.max(max, anchor.numeric), 0)

  if (counter && counter.numeric <= maxAnchor) {
    failures.push(`${counter.id} in backlog-counter.md must be greater than current max backlog anchor B-${String(maxAnchor).padStart(3, '0')}.`)
  }

  const anchorsById = new Map()
  for (const anchor of anchors) {
    const entries = anchorsById.get(anchor.id) ?? []
    entries.push(anchor)
    anchorsById.set(anchor.id, entries)
  }

  for (const [id, entries] of anchorsById.entries()) {
    if (entries.length <= 1) continue
    const allowedKnownDuplicate = KNOWN_DUPLICATE_IDS.has(id) && entries.every(entry => entry.file === 'BACKLOG.md')
    if (allowedKnownDuplicate) {
      warnings.push(`${id} duplicate allowed temporarily; see BACKLOG.md known duplicate note.`)
      continue
    }

    failures.push(
      `${id} appears ${entries.length} times: ${entries.map(entry => `${entry.file}:${entry.line}`).join(', ')}`
    )
  }

  const fileClaims = new Map()
  for (const row of activeWorkRows()) {
    if (isReleasedStatus(row.status ?? '')) continue
    for (const claimed of claimedFiles(row['files claimed'])) {
      const claims = fileClaims.get(claimed) ?? []
      claims.push({
        label: `${row['agent / session'] || 'unknown'} at worklog.md:${row.line}`,
        allowsSharedOverlap: rowAllowsSharedOverlap(row),
      })
      fileClaims.set(claimed, claims)
    }
  }

  for (const [claimed, claims] of fileClaims.entries()) {
    if (claims.length > 1) {
      const shareable = isShareableClaim(claimed) && claims.every(claim => claim.allowsSharedOverlap)
      if (!shareable) {
        failures.push(`${claimed} is claimed by multiple active sessions: ${claims.map(claim => claim.label).join('; ')}`)
      } else {
        warnings.push(`${claimed} has shared active ownership: ${claims.map(claim => claim.label).join('; ')}`)
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Coordination guardrails failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

for (const warning of warnings) console.warn(`WARN [COORDINATION] ${warning}`)
console.log('Coordination guardrails passed.')
