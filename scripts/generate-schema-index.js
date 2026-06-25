#!/usr/bin/env node
// Generates docs/database/schema-index.json from ownership headers in domain SQL files.
// Called by scripts/build-schema.sh as a side-effect of every schema build.
// Output is sorted alphabetically so Git diffs are deterministic.

'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SCHEMA_DIR = path.join(ROOT, 'supabase/schema')
const BUILD_SCRIPT = path.join(__dirname, 'build-schema.sh')
const OUTPUT = path.join(ROOT, 'docs/database/schema-index.json')

// Parse emit("...") calls from build-schema.sh to get the ordered file list.
// Excludes rls/ and functions/ directories — those files declare policies/functions, not table ownership.
function getEmittedFiles() {
  const script = fs.readFileSync(BUILD_SCRIPT, 'utf-8')
  const files = []
  for (const m of script.matchAll(/^emit\s+"([^"]+)"/gm)) {
    const f = m[1]
    if (!f.startsWith('rls/') && !f.startsWith('functions/') && !f.match(/^0[01]_/)) {
      files.push(f)
    }
  }
  return files
}

// Parse structured header fields (new format: "-- Key: value").
function parseHeader(content) {
  const header = {}
  for (const m of content.matchAll(/^--\s+(Domain|Owner|Canonical|Lifecycle|Owned tables|Dependencies):\s*(.+)$/gm)) {
    header[m[1].toLowerCase().replace(/ /g, '_')] = m[2].trim()
  }
  return header
}

// Fallback: scan for CREATE TABLE names when header lacks "Owned tables:".
function scanTableNames(content) {
  const tables = new Set()
  for (const m of content.matchAll(/^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\b/gim)) {
    tables.add(m[1])
  }
  return [...tables]
}

const emittedFiles = getEmittedFiles()
const owners = {}   // table -> { file, domain, lifecycle }
const domains = {}  // domainName -> { dependsOn[], files[], tables[] }
const duplicates = []

for (const relPath of emittedFiles) {
  const absPath = path.join(SCHEMA_DIR, relPath)
  if (!fs.existsSync(absPath)) continue

  const content = fs.readFileSync(absPath, 'utf-8')
  const header = parseHeader(content)

  const domainName = header['domain'] ?? 'Unknown'
  const lifecycle = header['lifecycle'] ?? 'Core'
  const dependsRaw = header['dependencies']
  const dependsOn =
    dependsRaw && dependsRaw !== '(none)'
      ? dependsRaw.split(',').map((d) => d.trim()).filter(Boolean)
      : []

  let tables
  if (header['owned_tables']) {
    tables = header['owned_tables'].split(',').map((t) => t.trim()).filter(Boolean)
  } else {
    tables = scanTableNames(content)
  }

  if (!domains[domainName]) domains[domainName] = { dependsOn: [], files: [], tables: [] }
  if (!domains[domainName].files.includes(relPath)) domains[domainName].files.push(relPath)
  for (const dep of dependsOn) {
    if (!domains[domainName].dependsOn.includes(dep)) domains[domainName].dependsOn.push(dep)
  }

  for (const table of tables) {
    if (owners[table]) {
      duplicates.push(`'${table}' defined in both '${owners[table].file}' and '${relPath}'`)
    } else {
      owners[table] = { file: relPath, domain: domainName, lifecycle }
    }
    if (!domains[domainName].tables.includes(table)) domains[domainName].tables.push(table)
  }
}

if (duplicates.length > 0) {
  process.stderr.write(`[generate-schema-index] WARN: duplicate table definitions:\n  ${duplicates.join('\n  ')}\n`)
}

// Sort everything alphabetically for deterministic diffs.
const sortedOwners = Object.fromEntries(Object.entries(owners).sort())
const sortedDomains = Object.fromEntries(
  Object.entries(domains)
    .sort()
    .map(([k, v]) => [
      k,
      {
        dependsOn: [...v.dependsOn].sort(),
        files: [...v.files].sort(),
        tables: [...v.tables].sort(),
      },
    ]),
)

const manifest = {
  _generated: 'Do not edit. Regenerate: ./scripts/build-schema.sh > supabase/schema.sql',
  schemaVersion: 1,
  owners: sortedOwners,
  domains: sortedDomains,
}

const json = JSON.stringify(manifest, null, 2) + '\n'

// MANIFEST_DRYRUN=1: write to stdout for hash comparison (used by check-schema-completeness.js).
if (process.env.MANIFEST_DRYRUN === '1') {
  process.stdout.write(json)
} else {
  const outputDir = path.dirname(OUTPUT)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(OUTPUT, json)
  process.stderr.write(`[generate-schema-index] ${OUTPUT}\n`)
}
