'use strict'
const { spawnSync } = require('child_process')
const { exists, repoPath } = require('../lib/files')

function checkDisasterRecovery(result) {
  if (!exists('scripts/ops/check-disaster-recovery.js')) {
    result.failures.push('scripts/ops/check-disaster-recovery.js is required for backup/restore drill verification.')
    return { runnable: false }
  }

  const check = spawnSync(process.execPath, [repoPath('scripts/ops/check-disaster-recovery.js'), '--json'], {
    cwd: repoPath(),
    encoding: 'utf8',
  })

  if (check.error) {
    result.failures.push(`Disaster recovery check could not run: ${check.error.message}`)
    return { runnable: false }
  }

  let parsed = null
  try {
    parsed = JSON.parse(check.stdout)
  } catch (error) {
    result.failures.push('Disaster recovery check did not return valid JSON.')
  }

  if (check.status !== 0) {
    const details = parsed?.failures?.length ? parsed.failures.join('; ') : check.stderr.trim()
    result.failures.push(`Disaster recovery check failed: ${details || 'unknown failure'}`)
  }

  if (parsed?.warnings?.length) {
    for (const warning of parsed.warnings) result.warnings.push(`Disaster recovery: ${warning}`)
  }

  return {
    runnable: check.status === 0,
    mode: parsed?.mode ?? 'unknown',
    source: parsed?.source ?? null,
    criticalTables: parsed?.criticalTables ?? [],
    criticalBuckets: parsed?.criticalBuckets ?? [],
  }
}

function checkDeadCode(result) {
  if (!exists('scripts/ops/check-dead-code.js')) {
    result.failures.push('scripts/ops/check-dead-code.js is required for dead-code detection.')
    return { candidates: [] }
  }

  const check = spawnSync(process.execPath, [repoPath('scripts/ops/check-dead-code.js'), '--json'], {
    cwd: repoPath(),
    encoding: 'utf8',
  })

  if (check.error) {
    result.warnings.push(`Dead-code check could not run: ${check.error.message}`)
    return { candidates: [] }
  }

  try {
    const parsed = JSON.parse(check.stdout)
    return { candidates: parsed.candidates ?? [] }
  } catch (error) {
    result.warnings.push('Dead-code check did not return valid JSON.')
    return { candidates: [] }
  }
}

function checkJobMonitors(result) {
  if (!exists('scripts/ops/check-job-monitors.js')) {
    result.failures.push('scripts/ops/check-job-monitors.js is required for report-only job monitor checks.')
    return { runnable: false }
  }

  const check = spawnSync(process.execPath, [repoPath('scripts/ops/check-job-monitors.js'), '--json'], {
    cwd: repoPath(),
    encoding: 'utf8',
  })

  let parsed = null
  try {
    parsed = JSON.parse(check.stdout)
  } catch (error) {
    result.failures.push('Job monitor check did not return valid JSON.')
  }

  if (check.status !== 0) {
    const details = parsed?.failures?.length ? parsed.failures.join('; ') : check.stderr.trim()
    result.failures.push(`Job monitor check failed: ${details || 'unknown failure'}`)
  }

  for (const warning of parsed?.warnings ?? []) {
    result.warnings.push(`jobs: ${warning}`)
  }

  return {
    runnable: check.status === 0,
    mode: parsed?.summary?.mode ?? 'unknown',
    monitors: parsed?.summary?.monitors ?? [],
  }
}

function checkComplianceAutomation(result) {
  const checks = [
    ['compliance', 'scripts/ops/check-compliance.js'],
    ['dataInventory', 'scripts/ops/check-data-inventory.js'],
    ['rls', 'scripts/ops/check-rls.js'],
    ['audit', 'scripts/ops/check-audit.js'],
    ['providers', 'scripts/ops/check-providers.js'],
    ['privacy', 'scripts/ops/check-privacy.js'],
    ['jobs', 'scripts/ops/check-job-monitors.js'],
    ['iso', 'scripts/ops/check-iso.js'],
  ]
  const summary = {}

  for (const [name, scriptPath] of checks) {
    if (!exists(scriptPath)) {
      result.failures.push(`${scriptPath} is required for compliance automation.`)
      summary[name] = { runnable: false, failures: 1, warnings: 0 }
      continue
    }

    const check = spawnSync(process.execPath, [repoPath(scriptPath), '--json'], {
      cwd: repoPath(),
      encoding: 'utf8',
    })

    let parsed = null
    try {
      parsed = JSON.parse(check.stdout)
    } catch (error) {
      result.failures.push(`${scriptPath} did not return valid JSON.`)
    }

    if (check.status !== 0) {
      const details = parsed?.failures?.length ? parsed.failures.join('; ') : check.stderr.trim()
      result.failures.push(`${name} check failed: ${details || 'unknown failure'}`)
    }

    for (const warning of parsed?.warnings ?? []) {
      result.warnings.push(`${name}: ${warning}`)
    }

    summary[name] = {
      runnable: check.status === 0,
      failures: parsed?.failures?.length ?? 0,
      warnings: parsed?.warnings?.length ?? 0,
    }
  }

  return summary
}

module.exports = {
  checkDisasterRecovery,
  checkDeadCode,
  checkJobMonitors,
  checkComplianceAutomation,
}
