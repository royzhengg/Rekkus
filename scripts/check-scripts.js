#!/usr/bin/env node
'use strict'
/**
 * Guardrail: enforces three rules for all scripts/ files.
 *
 * Rule 1 — No stale duplicate files
 *   Rejects files whose basename matches patterns macOS produces when
 *   drag-copying (e.g. "check-hygiene 2.js", "check-tokens copy.js").
 *
 * Rule 2 — No inline arg-parsing boilerplate
 *   All scripts must use scripts/lib/args.js instead of directly calling
 *   process.argv.slice(2) or new Set(process.argv).
 *
 * Rule 3 — No silent success
 *   Every top-level executable script must acknowledge completion via
 *   console.log() or process.stdout.write() so the developer knows it passed.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const failures = []

// ── Rule 1: No stale duplicate files ─────────────────────────────────────────

const DUPE_PATTERN = /[ ](2|3|copy|\(1\))\.js$/i

for (const name of fs.readdirSync(__dirname)) {
  if (DUPE_PATTERN.test(name)) {
    failures.push(`FAIL [SCRIPTS] Duplicate/backup file detected: scripts/${name}`)
  }
}

// ── Rule 2: No inline arg-parsing boilerplate ─────────────────────────────────

const BOILERPLATE = /new\s+Set\s*\(\s*process\.argv|process\.argv\.slice\s*\(\s*2\s*\)/

function jsFilesIn(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.js') && !/ /.test(name) && fs.statSync(path.join(dir, name)).isFile())
    .map(name => path.join(dir, name))
}

const topLevelScripts = jsFilesIn(__dirname)
const opsScripts = jsFilesIn(path.join(__dirname, 'ops'))
const allExecutableScripts = [...topLevelScripts, ...opsScripts]

const ARGS_LIB = path.join(__dirname, 'lib', 'args.js')
const SELF = __filename

for (const file of allExecutableScripts) {
  // The shared utility and this guardian are exempt.
  if (file === ARGS_LIB || file === SELF) continue

  const source = fs.readFileSync(file, 'utf8')
  if (BOILERPLATE.test(source)) {
    failures.push(
      `FAIL [SCRIPTS] Inline arg-parsing in ${path.relative(ROOT, file)} — use scripts/lib/args.js instead.`
    )
  }
}

// ── Rule 3: No silent success ─────────────────────────────────────────────────

// Scripts that legitimately produce no direct console.log or process.stdout.write:
// they delegate all output to a subprocess (stdio: inherit) or exit silently
// when there is nothing to report.
const SILENT_BY_DESIGN = new Set([
  'check-coverage.js',   // delegates output to Jest (stdio: inherit)
  'test-type-safety.js', // delegates output to Node test runner (stdio: inherit)
  'postinstall.js',      // only prints when it removes corrupted dirs
])

for (const file of topLevelScripts) {
  const name = path.basename(file)
  // Library utilities in scripts/lib/ are not executable checks.
  if (path.dirname(file) === path.join(__dirname, 'lib')) continue
  if (SILENT_BY_DESIGN.has(name)) continue

  const source = fs.readFileSync(file, 'utf8')
  // printResult() from scripts/ops/lib/policy-checks.js internally calls process.stdout.write
  if (!source.includes('console.log(') && !source.includes('process.stdout.write(') && !source.includes('printResult(')) {
    failures.push(
      `FAIL [SCRIPTS] ${path.relative(ROOT, file)} has no console.log — scripts must acknowledge completion.`
    )
  }
}

// ── Rule 4: No ops orchestrator exceeds 300 LOC ──────────────────────────────
// After B-538 decomposition, check-operations.js is ~260 LOC.
// This threshold prevents any scripts/ops/*.js from re-growing into a monolith.
// Files under scripts/ops/lib/ and scripts/ops/checks/ are focused modules and exempt.

const MAX_OPS_LOC = 300

for (const name of fs.readdirSync(path.join(__dirname, 'ops'))) {
  if (!name.endsWith('.js') || / /.test(name)) continue
  const file = path.join(__dirname, 'ops', name)
  if (!fs.statSync(file).isFile()) continue
  const lines = fs.readFileSync(file, 'utf8').split('\n').length
  if (lines > MAX_OPS_LOC) {
    failures.push(
      `FAIL [SCRIPTS] ${path.relative(ROOT, file)} is ${lines} LOC — ops scripts must stay under ${MAX_OPS_LOC} LOC. Extract to scripts/ops/checks/.`
    )
  }
}

// ── Result ────────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  for (const f of failures) process.stderr.write(`${f}\n`)
  process.exit(1)
}

console.log('Scripts guardrail passed.')
