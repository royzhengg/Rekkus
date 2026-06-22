const path = require('path')
const { exists, listFiles, readJson, readText } = require('./files')

const RISKY_BACKLOG_TERMS =
  /\b(security|privacy|compliance|provider|google|supabase|migration|analytics|media|notification|ranking|auth|payment|moderation|admin|restaurant metadata|place details|quota|audit|retention|deletion|export)\b/i

const PUBLIC_WRITE_POLICY_PATTERN =
  /create\s+policy\s+["'][^"']+["']\s+on\s+(?:public\.)?(\w+)[\s\S]{0,220}for\s+(?:insert|update|delete|all)[\s\S]{0,220}(?:to\s+public|auth\.role\(\)\s*=\s*['"]anon['"]|using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\))/i

function readSchemaSource() {
  const files = listFiles('supabase/migrations', (filePath) => filePath.endsWith('.sql'))
  return files.map((file) => `-- ${file}\n${readText(file)}`).join('\n\n')
}

function extractCreatedTables(source) {
  return [...source.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\b/gi)]
    .map((match) => match[1])
    .filter((table) => table !== 'schema_migrations')
}

function hasRls(source, table) {
  return new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(source)
}

function hasPolicy(source, table) {
  return new RegExp(`create\\s+policy\\s+["'][^"']+["']\\s+on\\s+(?:public\\.)?${table}\\b`, 'i').test(source)
}

function getComplianceDoc() {
  return exists('docs/security/COMPLIANCE.md') ? readText('docs/security/COMPLIANCE.md') : ''
}

function getReleaseDoc() {
  return exists('operations/RELEASE.md') ? readText('operations/RELEASE.md') : ''
}

function getBacklogRows() {
  if (!exists('BACKLOG.md')) return []
  return readText('BACKLOG.md')
    .split('\n')
    .filter((line) => /^\|\s*\[[ x~]\]/.test(line))
}

function riskyBacklogRowsMissingComplianceImpact() {
  return getBacklogRows().filter((row) => RISKY_BACKLOG_TERMS.test(row) && !/Compliance Impact/i.test(row))
}

function missingTerms(file, terms) {
  if (!exists(file)) return terms
  const source = readText(file)
  return terms.filter((term) => !new RegExp(term, 'i').test(source))
}

function riskyFiles() {
  const roots = ['app', 'features', 'components', 'lib', 'supabase/functions', 'scripts']
  return roots.flatMap((root) =>
    listFiles(root, (filePath) => /\.(ts|tsx|js|jsx)$/.test(filePath)),
  )
}

function directProviderAccessViolations() {
  const allowed = [
    /^lib\/services\//,
    /^lib\/supabase\.ts$/,
    /^lib\/config\.ts$/,
    /^supabase\/functions\//,
    /^scripts\//,
  ]
  const violations = []
  for (const file of riskyFiles()) {
    if (allowed.some((pattern) => pattern.test(file))) continue
    const source = readText(file)
    if (/maps\.googleapis\.com|place\/(?:autocomplete|details|textsearch)|GOOGLE_PLACES_KEY/.test(source)) {
      violations.push(`${file} performs direct Google/provider access; route through lib/services.`)
    }
  }
  return violations
}

function analyticsPrivacyViolations() {
  const violations = []
  const analyticsSource = [
    'lib/analytics.ts',
    'lib/analytics/privacy.ts',
    'lib/analytics/core.ts',
    'lib/analytics/events.ts',
  ].filter(exists).map(readText).join('\n')
  for (const token of ['sanitizeAnalyticsMetadata', 'SAFE_METADATA_KEYS', 'SENSITIVE_VALUE_PATTERN']) {
    if (!analyticsSource.includes(token)) {
      violations.push(`lib/analytics.ts must use ${token} before writing analytics metadata.`)
    }
  }

  const forbidden = /(password|secret|service_role|reset_link|private_note|raw_provider_payload|precise_location|email\s*:|phone\s*:)/i
  for (const file of riskyFiles()) {
    if (file.startsWith('scripts/')) continue
    const source = readText(file)
    const lines = source.split('\n')
    const analyticsLine = lines.findIndex((line) => /analytics_events|track[A-Z]\w*\(/.test(line))
    if (analyticsLine === -1) continue
    const nearby = lines.slice(Math.max(0, analyticsLine - 8), analyticsLine + 16).join('\n')
    if (forbidden.test(nearby)) {
      violations.push(`${file} may write sensitive data into analytics; document or remove the payload.`)
    }
  }
  return violations
}

function loadPackageScripts() {
  return readJson('package.json').scripts ?? {}
}

function requiredScriptMissing(names) {
  const scripts = loadPackageScripts()
  return names.filter((name) => !scripts[name])
}

function publicWritePolicies(source) {
  return source
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => /create\s+policy/i.test(statement))
    .filter((statement) => PUBLIC_WRITE_POLICY_PATTERN.test(`${statement};`))
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
}

function printResult({ name, failures, warnings, summary }, args = new Set()) {
  const result = {
    checkedAt: new Date().toISOString(),
    name,
    failures,
    warnings,
    summary,
  }

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else {
    process.stdout.write(`${name}: ${failures.length ? 'failed' : 'passed'}.\n`)
    if (failures.length) {
      process.stdout.write('\nFailures:\n')
      for (const failure of failures) process.stdout.write(`- ${failure}\n`)
    }
    if (warnings.length) {
      process.stdout.write('\nWarnings:\n')
      for (const warning of warnings) process.stdout.write(`- ${warning}\n`)
    }
  }

  process.exit(failures.length ? 1 : 0)
}

function writeFileIfRequested(relativePath, content, args) {
  if (!args.has('--write')) return false
  const fs = require('fs')
  const { repoPath } = require('./files')
  fs.mkdirSync(path.dirname(repoPath(relativePath)), { recursive: true })
  fs.writeFileSync(repoPath(relativePath), content)
  return true
}

module.exports = {
  analyticsPrivacyViolations,
  directProviderAccessViolations,
  extractCreatedTables,
  getComplianceDoc,
  getReleaseDoc,
  hasPolicy,
  hasRls,
  missingTerms,
  printResult,
  publicWritePolicies,
  readSchemaSource,
  requiredScriptMissing,
  riskyBacklogRowsMissingComplianceImpact,
  writeFileIfRequested,
}
