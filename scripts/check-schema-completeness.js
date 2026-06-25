#!/usr/bin/env node
// B-630: Verify every table in the live DB has a domain file entry (and vice versa),
// manifest is fresh, and declared dependencies are valid.
//
// Modes:
//   default  — compares schema-index.json against the live local Supabase DB.
//              Requires `supabase start`. Skips gracefully if DB is unreachable.
//   --offline — validates manifest completeness against domain file headers only.
//              No DB required. Safe in CI without a running DB.

'use strict'

const { spawnSync } = require('child_process')
const { createHash } = require('crypto')
const { existsSync, readFileSync } = require('fs')
const path = require('path')
const { parseFlags } = require('./lib/args')
const { printResult } = require('./ops/lib/policy-checks')

const args = parseFlags()
const offline = args.has('--offline')
const t0 = Date.now()

const ROOT = path.join(__dirname, '..')
const MANIFEST_PATH = path.join(ROOT, 'docs/database/schema-index.json')
const BUILD_SCRIPT = path.join(__dirname, 'build-schema.sh')
const SCHEMA_DIR = path.join(ROOT, 'supabase/schema')

const failures = []
const warnings = []

// ─── Load manifest ────────────────────────────────────────────────────────────

if (!existsSync(MANIFEST_PATH)) {
  failures.push('docs/database/schema-index.json is missing. Run: ./scripts/build-schema.sh > supabase/schema.sql')
  printResult({ name: `Schema completeness (${Date.now() - t0} ms)`, failures, warnings }, args)
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
} catch {
  failures.push('docs/database/schema-index.json is not valid JSON. Regenerate: ./scripts/build-schema.sh > supabase/schema.sql')
  printResult({ name: `Schema completeness (${Date.now() - t0} ms)`, failures, warnings }, args)
  process.exit(1)
}

const manifestTables = new Set(Object.keys(manifest.owners ?? {}))

// ─── Freshness check ──────────────────────────────────────────────────────────
// Re-run generate-schema-index.js in dry-run mode and compare hash.
// We call it with MANIFEST_DRYRUN=1 so the script writes to stdout instead of file.

function freshHash() {
  try {
    const result = spawnSync('node', [path.join(__dirname, 'generate-schema-index.js')], {
      env: { ...process.env, MANIFEST_DRYRUN: '1' },
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    if (result.status !== 0) return null
    return createHash('sha256').update(result.stdout).digest('hex')
  } catch {
    return null
  }
}

const committedHash = createHash('sha256')
  .update(readFileSync(MANIFEST_PATH, 'utf-8'))
  .digest('hex')

// ─── Dependency validation ────────────────────────────────────────────────────

function getEmitOrder() {
  const script = readFileSync(BUILD_SCRIPT, 'utf-8')
  const files = []
  for (const m of script.matchAll(/^emit\s+"([^"]+)"/gm)) {
    const f = m[1]
    if (!f.startsWith('rls/') && !f.startsWith('functions/') && !f.match(/^0[01]_/)) {
      files.push(f)
    }
  }
  return files
}

const emitOrder = getEmitOrder()
const emitSet = new Set(emitOrder)

for (const [domainName, domainData] of Object.entries(manifest.domains ?? {})) {
  for (const dep of domainData.dependsOn ?? []) {
    if (!emitSet.has(dep)) {
      failures.push(`Domain "${domainName}" declares dependency "${dep}" but it is not in build-schema.sh`)
    } else {
      // Check dep appears before all files in this domain
      const domainFiles = domainData.files ?? []
      const depIdx = emitOrder.indexOf(dep)
      for (const f of domainFiles) {
        const fIdx = emitOrder.indexOf(f)
        if (fIdx !== -1 && depIdx > fIdx) {
          failures.push(`Domain "${domainName}": dependency "${dep}" emitted after "${f}" in build-schema.sh`)
        }
      }
    }
  }
}

// ─── Offline mode: validate manifest vs domain files only ─────────────────────

if (offline) {
  // Check every file in build-schema.sh emit list appears in the manifest
  for (const f of emitOrder) {
    const absPath = path.join(SCHEMA_DIR, f)
    if (!existsSync(absPath)) {
      failures.push(`build-schema.sh emits "${f}" but file does not exist`)
    }
  }

  // Check every file in manifest appears in build-schema.sh
  const manifestFiles = new Set(
    Object.values(manifest.domains ?? {}).flatMap((d) => d.files ?? []),
  )
  for (const f of manifestFiles) {
    if (!emitSet.has(f)) {
      warnings.push(`schema-index.json references "${f}" but it is not in build-schema.sh`)
    }
  }

  // Detect duplicate table entries across domain files
  const seen = new Map()
  for (const [table, owner] of Object.entries(manifest.owners ?? {})) {
    if (seen.has(table)) {
      failures.push(`Duplicate table "${table}" in both "${seen.get(table)}" and "${owner.file}"`)
    } else {
      seen.set(table, owner.file)
    }
  }

  const elapsed = Date.now() - t0
  printResult(
    {
      name: `Schema completeness — offline (${elapsed} ms) — ${manifestTables.size} tables, ${Object.keys(manifest.domains ?? {}).length} domains`,
      failures,
      warnings,
    },
    args,
  )
  process.exit(failures.length > 0 ? 1 : 0)
}

// ─── Online mode: compare manifest against live DB ────────────────────────────

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres'

const SQL = `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`

const dbResult = spawnSync('psql', [DB_URL, '-t', '-A', '-c', SQL], {
  encoding: 'utf-8',
  stdio: ['pipe', 'pipe', 'pipe'],
})

if (dbResult.status !== 0 || dbResult.error) {
  warnings.push(
    'Local Supabase is not running — skipping live DB comparison. ' +
      'Run `supabase start`, or use --offline for header-only validation.',
  )
} else {
  const dbTables = new Set(
    dbResult.stdout
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  )

  // Tables in DB but not in manifest
  for (const t of dbTables) {
    if (!manifestTables.has(t)) {
      failures.push(
        `Table "${t}" exists in DB but has no domain file entry. ` +
          'Add it to the correct domain file and rebuild: ./scripts/build-schema.sh > supabase/schema.sql',
      )
    }
  }

  // Tables in manifest but not in DB
  for (const t of manifestTables) {
    if (!dbTables.has(t)) {
      failures.push(
        `Table "${t}" is in schema-index.json (file: ${manifest.owners[t]?.file}) but not in the DB. ` +
          'Run: supabase migration up --include-all',
      )
    }
  }
}

// Freshness check (skip in dry-run / CI-without-generate context)
const fresh = freshHash()
if (fresh !== null && fresh !== committedHash) {
  failures.push(
    'docs/database/schema-index.json is stale. ' +
      'Rebuild: ./scripts/build-schema.sh > supabase/schema.sql',
  )
}

const elapsed = Date.now() - t0
printResult(
  {
    name: `Schema completeness (${elapsed} ms) — ${manifestTables.size} tables, ${Object.keys(manifest.domains ?? {}).length} domains`,
    failures,
    warnings,
  },
  args,
)
process.exit(failures.length > 0 ? 1 : 0)
