#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '../..')
const { parseFlags } = require('../lib/args')
const args = parseFlags()

const CRITICAL_TABLES = [
  'users',
  'posts',
  'post_photos',
  'restaurants',
  'likes',
  'saves',
  'comments',
  'analytics_events',
]

const CRITICAL_BUCKETS = ['avatars']
const failures = []
const warnings = []

const schemaSource = readSchemaSource()
const drDoc = readRepoFile('docs/security/DISASTER_RECOVERY.md')
const releaseDoc = readRepoFile('operations/RELEASE.md')

checkCriticalTables(schemaSource.source, schemaSource.label)
checkStorageBuckets(schemaSource.source, schemaSource.label)
checkDisasterRecoveryDoc(drDoc)
checkReleaseGate(releaseDoc)

const result = {
  checkedAt: new Date().toISOString(),
  mode: schemaSource.mode,
  source: schemaSource.label,
  criticalTables: CRITICAL_TABLES,
  criticalBuckets: CRITICAL_BUCKETS,
  failures,
  warnings,
}

if (args.has('--json')) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else {
  render(result)
}

process.exit(failures.length > 0 ? 1 : 0)

function readSchemaSource() {
  const schemaDumpPath = process.env.RESTORE_DRILL_SCHEMA_SQL

  if (schemaDumpPath) {
    const absolutePath = path.resolve(schemaDumpPath)
    if (!fs.existsSync(absolutePath)) {
      failures.push(`RESTORE_DRILL_SCHEMA_SQL does not exist: ${schemaDumpPath}`)
      return { mode: 'restore-dump', label: schemaDumpPath, source: '' }
    }

    return {
      mode: 'restore-dump',
      label: schemaDumpPath,
      source: fs.readFileSync(absolutePath, 'utf8'),
    }
  }

  const migrationsDir = path.join(repoRoot, 'supabase/migrations')
  if (!fs.existsSync(migrationsDir)) {
    failures.push('supabase/migrations is missing.')
    return { mode: 'repo-migrations', label: 'supabase/migrations', source: '' }
  }

  const migrationNames = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  if (migrationNames.length === 0) {
    failures.push('supabase/migrations has no SQL migrations to verify.')
  }

  const source = migrationNames
    .map((name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8'))
    .join('\n\n')

  return { mode: 'repo-migrations', label: 'supabase/migrations/*.sql', source }
}

function checkCriticalTables(source, label) {
  for (const table of CRITICAL_TABLES) {
    const tablePattern = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${table}\\b`, 'i')
    const rlsPattern = new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`, 'i')

    if (!tablePattern.test(source)) {
      failures.push(`${label} does not define critical table public.${table}.`)
      continue
    }

    if (!rlsPattern.test(source)) {
      failures.push(`${label} does not enable RLS for public.${table}.`)
    }
  }
}

function checkStorageBuckets(source, label) {
  for (const bucket of CRITICAL_BUCKETS) {
    const bucketPattern = new RegExp(
      `insert\\s+into\\s+storage\\.buckets[\\s\\S]+values\\s*\\([\\s\\S]*['"]${bucket}['"]`,
      'i',
    )
    const policyPattern = new RegExp(`bucket_id\\s*=\\s*['"]${bucket}['"]`, 'i')

    if (!bucketPattern.test(source)) {
      warnings.push(`${label} does not create storage bucket ${bucket}; confirm provider-side backup ownership.`)
    }

    if (!policyPattern.test(source)) {
      warnings.push(`${label} does not include storage policies for bucket ${bucket}.`)
    }
  }
}

function checkDisasterRecoveryDoc(source) {
  const requiredPhrases = [
    'Restore Drill Checklist',
    'RESTORE_DRILL_SCHEMA_SQL',
    'Quarterly after production',
    'non-production Supabase project',
    'Run app smoke tests',
  ]

  for (const phrase of requiredPhrases) {
    if (!source.includes(phrase)) {
      failures.push(`docs/security/DISASTER_RECOVERY.md must mention "${phrase}".`)
    }
  }
}

function checkReleaseGate(source) {
  if (!source.includes('npm run check:dr')) {
    failures.push('operations/RELEASE.md must include npm run check:dr in release gates.')
  }

  if (!source.includes('DISASTER_RECOVERY.md')) {
    failures.push('operations/RELEASE.md must link to disaster recovery governance.')
  }
}

function readRepoFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath)
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing.`)
    return ''
  }

  return fs.readFileSync(absolutePath, 'utf8')
}

function render(result) {
  if (result.failures.length === 0) {
    process.stdout.write(`Disaster recovery checks passed using ${result.source}.\n`)
  } else {
    process.stdout.write(`Disaster recovery checks failed using ${result.source}.\n`)
  }

  if (result.failures.length) {
    process.stdout.write('\nFailures:\n')
    for (const failure of result.failures) process.stdout.write(`- ${failure}\n`)
  }

  if (result.warnings.length) {
    process.stdout.write('\nWarnings:\n')
    for (const warning of result.warnings) process.stdout.write(`- ${warning}\n`)
  }
}
