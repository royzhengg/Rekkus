#!/usr/bin/env node
/**
 * check:coverage — enforces ratcheted coverage for shared high-risk logic.
 *
 * Jest's coverageThreshold in jest.config.js defines the current floor.
 * This script is a thin wrapper that runs `jest --coverage` and exits with
 * the same code, surfacing any threshold failures as a CI-blocking check.
 *
 * Why: prevents shared utility, service, route, and async-hook safety nets
 * from being removed after a bug fix or refactor.
 */

const { execSync } = require('child_process')

try {
  execSync(
    'node node_modules/jest/bin/jest.js --coverage --runInBand --coverageReporters=text --passWithNoTests',
    { stdio: 'inherit' }
  )
} catch {
  process.exit(1)
}
