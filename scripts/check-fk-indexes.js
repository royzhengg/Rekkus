#!/usr/bin/env node
// B-631: Verify every FK column in the public schema has a valid, non-partial,
// non-expression leading-column index on the referencing side.
//
// Also detects duplicate indexes (hard fail) and redundant/subsumed indexes (warn).
// Allowlist: scripts/check-fk-indexes.ignore.json — FK constraints intentionally skipped.
//
// Gracefully skips when local Supabase is not running.
// --strict: promotes warnings to failures.

'use strict'

const { spawnSync } = require('child_process')
const { existsSync, readFileSync } = require('fs')
const path = require('path')
const { parseFlags } = require('./lib/args')
const { printResult } = require('./ops/lib/policy-checks')

const args = parseFlags()
const strict = args.has('--strict')
const t0 = Date.now()

const SQL_FILE = path.join(__dirname, 'sql/check_fk_indexes.sql')
const ALLOWLIST_FILE = path.join(__dirname, 'check-fk-indexes.ignore.json')
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres'

const failures = []
const warnings = []

// ─── Load allowlist ────────────────────────────────────────────────────────────

let allowlist = {}
if (existsSync(ALLOWLIST_FILE)) {
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf-8'))
    for (const [k, v] of Object.entries(raw)) {
      if (!k.startsWith('_')) allowlist[k] = v
    }
  } catch {
    warnings.push(`Could not parse ${ALLOWLIST_FILE} — allowlist disabled`)
  }
}

// ─── Run SQL ──────────────────────────────────────────────────────────────────

const sqlContent = readFileSync(SQL_FILE, 'utf-8')

// Split the three queries on the separator comment lines.
const queries = sqlContent
  .split(/^-- ─+\n/m)
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('--'))

function runQuery(sql) {
  const result = spawnSync(
    'psql',
    [DB_URL, '--no-psqlrc', '-t', '-A', '-F', '\t', '-c', sql],
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
  return result
}

// Check DB reachability with the first query.
const q1Result = runQuery(queries[0] ?? '')

if (q1Result.status !== 0 || q1Result.error) {
  warnings.push(
    'Local Supabase is not running — skipping FK index check. ' +
      'Run `supabase start`, or set DATABASE_URL to a reachable instance.'
  )
  printResult({ name: `FK index coverage (${Date.now() - t0} ms)`, failures, warnings }, args)
  process.exit(0)
}

// ─── Query 1: Missing FK indexes ─────────────────────────────────────────────

const missingRows = q1Result.stdout
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [table_name, fk_columns, fk_name, suggested_fix] = line.split('\t')
    return { table_name, fk_columns, fk_name, suggested_fix }
  })

let uncoveredCount = 0
for (const row of missingRows) {
  const key = `${row.table_name}.${row.fk_name}`
  if (allowlist[key]) continue
  uncoveredCount++
  failures.push(
    `Missing FK index: ${row.table_name} (${row.fk_columns}) — FK: ${row.fk_name}\n` +
      `    Fix: ${row.suggested_fix}`
  )
}

const allowlistedCount = missingRows.length - uncoveredCount

// ─── Query 2: Duplicate indexes (hard fail) ───────────────────────────────────

if (queries[1]) {
  const q2 = runQuery(queries[1])
  if (q2.status === 0 && q2.stdout.trim()) {
    for (const line of q2.stdout.trim().split('\n').filter(Boolean)) {
      const [table_name, duplicate_indexes, key_columns, suggested_fix] = line.split('\t')
      failures.push(
        `Duplicate indexes on ${table_name} (${key_columns}): ${duplicate_indexes}\n` +
          `    Fix: ${suggested_fix}`
      )
    }
  }
}

// ─── Query 3: Redundant/subsumed indexes (warn or fail under --strict) ─────────

if (queries[2]) {
  const q3 = runQuery(queries[2])
  if (q3.status === 0 && q3.stdout.trim()) {
    for (const line of q3.stdout.trim().split('\n').filter(Boolean)) {
      const [table_name, narrow_index, subsuming_index, suggested_fix] = line.split('\t')
      const msg =
        `Redundant index on ${table_name}: ${narrow_index} is subsumed by ${subsuming_index}\n` +
        `    Fix: ${suggested_fix}`
      if (strict) failures.push(msg)
      else warnings.push(msg)
    }
  }
}

const elapsed = Date.now() - t0
const summary =
  `${uncoveredCount} uncovered FKs` +
  (allowlistedCount > 0 ? `, ${allowlistedCount} allowlisted` : '') +
  (strict ? ' [--strict]' : '')

printResult(
  { name: `FK index coverage (${elapsed} ms) — ${summary}`, failures, warnings },
  args
)
process.exit(failures.length > 0 ? 1 : 0)
