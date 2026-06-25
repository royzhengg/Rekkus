#!/usr/bin/env node
// B-630: Verify that build-schema.sh produces identical output across two independent runs.
// Catches non-deterministic `find` ordering, environment-dependent output, or shell state leakage.

'use strict'

const { spawnSync } = require('child_process')
const { createHash } = require('crypto')
const path = require('path')
const { parseFlags } = require('./lib/args')
const { printResult } = require('./ops/lib/policy-checks')

const args = parseFlags()
const t0 = Date.now()

const BUILD_SCRIPT = path.join(__dirname, 'build-schema.sh')

const failures = []
const warnings = []

function runBuild() {
  const result = spawnSync('bash', [BUILD_SCRIPT], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (result.error) throw result.error
  return result.stdout
}

let out1, out2
try {
  out1 = runBuild()
  out2 = runBuild()
} catch (err) {
  failures.push(`build-schema.sh failed to run: ${err.message}`)
  printResult({ name: `Build determinism (${Date.now() - t0} ms)`, failures, warnings }, args)
  process.exit(1)
}

const hash1 = createHash('sha256').update(out1).digest('hex')
const hash2 = createHash('sha256').update(out2).digest('hex')

if (hash1 !== hash2) {
  failures.push(
    'build-schema.sh is non-deterministic: two consecutive runs produced different output.\n' +
      `  Run 1 SHA-256: ${hash1}\n` +
      `  Run 2 SHA-256: ${hash2}\n` +
      '  Common causes: unsorted `find` calls, `NOW()` in SQL, environment variables, or file system ordering.'
  )
} else {
  const lines = out1.split('\n').length
  warnings.length === 0 &&
    process.stderr.write(
      `[check-build-determinism] both runs identical — ${lines} lines, SHA-256: ${hash1.slice(0, 12)}…\n`
    )
}

const elapsed = Date.now() - t0
printResult({ name: `Build determinism (${elapsed} ms)`, failures, warnings }, args)
process.exit(failures.length > 0 ? 1 : 0)
