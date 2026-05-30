'use strict'
const { referencesForFlag } = require('../lib/feature-flags')
const { exists, readText } = require('../lib/files')

function checkFeatureFlags(flags, today, result) {
  if (flags.length === 0) {
    result.failures.push('lib/featureFlags.ts must define metadata-backed feature flags.')
    return { count: 0, stale: [], unreferenced: [] }
  }

  const stale = []
  const unreferenced = []
  for (const flag of flags) {
    for (const field of ['owner', 'state', 'createdAt', 'reviewAt', 'description']) {
      if (!flag[field]) result.failures.push(`Feature flag ${flag.name} is missing ${field}.`)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(flag.createdAt) || !/^\d{4}-\d{2}-\d{2}$/.test(flag.reviewAt)) {
      result.failures.push(`Feature flag ${flag.name} must use YYYY-MM-DD dates.`)
    }
    if (!flag.enabled && flag.reviewAt < today) {
      stale.push(flag.name)
      result.warnings.push(`Disabled feature flag ${flag.name} is past review date ${flag.reviewAt}.`)
    }

    const references = referencesForFlag(flag.name)
    if (references.length === 0) {
      unreferenced.push(flag.name)
      result.warnings.push(`Feature flag ${flag.name} is not referenced outside lib/featureFlags.ts.`)
    }
  }

  return { count: flags.length, stale, unreferenced }
}

function checkExperiments(today, result) {
  if (!exists('operations/EXPERIMENTS.md')) {
    result.failures.push('operations/EXPERIMENTS.md is required for experiment tracking.')
    return { active: 0, expired: [] }
  }

  const source = readText('operations/EXPERIMENTS.md')
  const rows = source
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('Name |'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))

  const expired = []
  for (const cells of rows) {
    const [name, status, owner, hypothesis, startDate, expiryDate, successMetric, rollbackTrigger] = cells
    if (!name) continue
    const missing = []
    if (!owner) missing.push('owner')
    if (!hypothesis) missing.push('hypothesis')
    if (!startDate) missing.push('start date')
    if (!expiryDate) missing.push('expiry date')
    if (!successMetric) missing.push('success metric')
    if (!rollbackTrigger) missing.push('rollback trigger')
    if (missing.length) result.failures.push(`Experiment ${name} is missing ${missing.join(', ')}.`)
    if (status === 'Active' && expiryDate < today) {
      expired.push(name)
      result.warnings.push(`Experiment ${name} expired on ${expiryDate}.`)
    }
  }

  return {
    active: rows.filter((cells) => cells[1] === 'Active').length,
    expired,
  }
}

module.exports = { checkFeatureFlags, checkExperiments }
