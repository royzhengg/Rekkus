#!/usr/bin/env node
'use strict'

/**
 * Shared CLI argument utilities for all scripts/.
 * Use these instead of inline `process.argv.slice(2)` / `new Set(process.argv)`.
 *
 * Enforced by check:scripts (Rule 2).
 */

/** Returns process.argv.slice(2) as an array. Use instead of process.argv.slice(2) directly. */
function argv() {
  return process.argv.slice(2)
}

function parseFlags(argv = process.argv.slice(2)) {
  return new Set(argv)
}

function hasFlag(flag, argv = process.argv.slice(2)) {
  return argv.includes(flag)
}

function getArg(flag, argv = process.argv.slice(2)) {
  const idx = argv.indexOf(flag)
  return idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : null
}

function isCI() {
  return process.env.CI === 'true'
}

function useColor() {
  return !isCI() && Boolean(process.stdout.isTTY)
}

/**
 * Prints a standardised help block and exits 0.
 *
 * @param {string} scriptName  - npm script name, e.g. 'check:hygiene'
 * @param {string} description - one-line description shown under Usage
 * @param {Array<[string, string]>} options - pairs of [flag, description]
 */
function printHelp(scriptName, description, options = []) {
  process.stdout.write(`\nUsage: npm run ${scriptName} [options]\n`)
  if (description) process.stdout.write(`\n${description}\n`)
  if (options.length) {
    process.stdout.write('\nOptions:\n')
    for (const [flag, desc] of options) {
      process.stdout.write(`  ${flag.padEnd(18)}${desc}\n`)
    }
  }
  process.stdout.write('\n')
}

module.exports = { argv, parseFlags, hasFlag, getArg, isCI, useColor, printHelp }
